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
  const streamRef = useRef<MediaStream | null>(null);

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
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(165, 180, 252, 0.8)';
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    animRef.current = requestAnimationFrame(drawWaveform);
  }, [recording]);

  useEffect(() => {
    if (recording) {
      drawWaveform();
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [recording, drawWaveform]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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
      } else if (data.error) {
        console.error('Transcription error:', data.error);
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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
        <Loader2 className="w-4 h-4 text-indigo-300 animate-spin" />
        <span className="text-xs text-indigo-200">Transcribiendo...</span>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <canvas ref={canvasRef} width={80} height={28} className="opacity-80" />
        <span className="text-xs text-red-300 font-mono min-w-[36px] tabular-nums">{formatTime(elapsed)}</span>
        <button
          onClick={stopRecording}
          className="w-9 h-9 rounded-xl bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-all animate-pulse"
        >
          <Square className="w-3.5 h-3.5 text-white fill-white" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all disabled:opacity-40"
      title="Grabar audio"
    >
      <Mic className="w-4 h-4 text-indigo-300" />
    </button>
  );
}
