'use client';

import { Bot } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="flex gap-2 sm:gap-2.5 items-end">
      <div className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/[0.08]">
        <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-300/80" />
      </div>
      <div className="rounded-2xl rounded-bl-md px-4 py-3 border border-white/[0.06]"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/30 mr-1.5 font-medium">Pensando</span>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400/60"
              style={{
                animation: 'pulse 1.2s ease-in-out infinite',
                animationDelay: `${i * 200}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
