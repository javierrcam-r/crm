'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onTranscription, disabled }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas || !recording) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, 'rgba(129, 140, 248, 0.4)');
    gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.8)');
    gradient.addColorStop(1, 'rgba(129, 140, 248, 0.4)');
    ctx.lineWidth = 2;
    ctx.strokeStyle = gradient;
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    animRef.current = requestAnimationFrame(drawWaveform);
  }, [recording]);

  useEffect(() => {
    if (recording) drawWaveform();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [recording, drawWaveform]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await sendAudio(blob, mimeType.includes('webm') ? 'audio.webm' : 'audio.mp4');
      };

      mediaRecorder.start(250);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err) {
      console.error('Mic access error:', err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const sendAudio = async (blob: Blob, filename: string) => {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append('audio', blob, filename);
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (data.text && typeof data.text === 'string') {
        onTranscription(data.text.trim());
      }
    } catch (err) {
      console.error('Send audio error:', err);
    } finally {
      setTranscribing(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (transcribing) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-indigo-500/20"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))' }}>
        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-300 animate-spin" />
        <span className="text-[10px] sm:text-xs text-indigo-200/70 font-medium">Transcribiendo...</span>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
          <span className="relative w-2 h-2 rounded-full bg-red-400 block" />
        </div>
        <canvas ref={canvasRef} width={60} height={24} className="opacity-90 hidden sm:block" />
        <span className="text-[10px] sm:text-xs text-red-300/80 font-mono min-w-[32px] tabular-nums">{formatTime(elapsed)}</span>
        <button
          onClick={stopRecording}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-red-500/30 hover:bg-red-500/50 border border-red-500/30 flex items-center justify-center transition-all"
        >
          <Square className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-300 fill-red-300" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg sm:rounded-xl flex items-center justify-center transition-all disabled:opacity-20 border border-white/[0.08] hover:border-white/15 hover:bg-white/[0.06] active:scale-90"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))' }}
      title="Grabar audio"
    >
      <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/40" />
    </button>
  );
}
