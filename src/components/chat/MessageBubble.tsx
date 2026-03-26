'use client';

import { Bot, User } from 'lucide-react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

function formatContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    let processed = line
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded bg-white/10 text-xs font-mono">$1</code>');

    if (/^[-•]\s/.test(line)) {
      processed = `<span class="flex gap-1.5"><span class="text-indigo-300 shrink-0">•</span><span>${processed.replace(/^[-•]\s/, '')}</span></span>`;
    }

    if (line.trim() === '') return <br key={i} />;
    return <span key={i} className="block" dangerouslySetInnerHTML={{ __html: processed }} />;
  });
}

export default function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end`}>
      <div className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center ${
        isUser
          ? 'bg-indigo-500/80 text-white'
          : 'bg-white/10 border border-white/20 text-indigo-300'
      }`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? 'bg-indigo-500/80 backdrop-blur text-white rounded-br-md'
          : 'bg-white/10 backdrop-blur-md border border-white/10 text-white/90 rounded-bl-md'
      }`}>
        <div className="space-y-0.5">{formatContent(content)}</div>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-indigo-300 rounded-full animate-pulse ml-0.5 -mb-0.5" />
        )}
      </div>
    </div>
  );
}
