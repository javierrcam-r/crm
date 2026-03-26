'use client';

import { Bot } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="flex gap-2.5 items-end">
      <div className="shrink-0 w-7 h-7 rounded-xl flex items-center justify-center bg-white/10 border border-white/20 text-indigo-300">
        <Bot className="w-3.5 h-3.5" />
      </div>
      <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-indigo-300/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-indigo-300/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-indigo-300/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
