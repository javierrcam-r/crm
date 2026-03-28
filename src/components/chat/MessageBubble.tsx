'use client';

import { Bot, User, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

function inlineFormat(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded-md bg-white/[0.08] text-indigo-200 text-[11px] font-mono">$1</code>');
}

function renderTable(rows: string[]) {
  const parseRow = (r: string) =>
    r.split('|').slice(1, -1).map(c => c.trim());

  const header = parseRow(rows[0]);
  const body = rows.slice(2).filter(r => !r.match(/^\|[\s\-:|]+\|$/));

  return (
    <div className="overflow-x-auto my-2.5 rounded-xl border border-white/[0.08]"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03), transparent)', backdropFilter: 'blur(8px)' }}>
      <table className="w-full text-[11px] sm:text-xs">
        <thead>
          <tr className="border-b border-white/[0.08]">
            {header.map((h, i) => (
              <th key={i} className="px-2.5 sm:px-3 py-2 text-left font-bold text-indigo-200/90 whitespace-nowrap uppercase tracking-wider text-[10px]"
                dangerouslySetInnerHTML={{ __html: inlineFormat(h) }} />
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => {
            const cells = parseRow(row);
            return (
              <tr key={ri} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors">
                {cells.map((c, ci) => (
                  <td key={ci} className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-white/60 whitespace-nowrap"
                    dangerouslySetInnerHTML={{ __html: inlineFormat(c) }} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatContent(text: string) {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableRows.push(lines[i].trim());
        i++;
      }
      if (tableRows.length >= 2) {
        elements.push(<span key={`t-${i}`}>{renderTable(tableRows)}</span>);
      }
      continue;
    }

    const line = lines[i];
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-1.5" />);
    } else if (/^#{1,3}\s/.test(line)) {
      const level = (line.match(/^(#{1,3})/)?.[1].length) || 1;
      const text = line.replace(/^#{1,3}\s/, '');
      const sizes = ['text-sm font-bold', 'text-[13px] font-bold', 'text-xs font-semibold'];
      elements.push(
        <span key={i} className={`block text-white mt-2 mb-0.5 ${sizes[level - 1]}`}
          dangerouslySetInnerHTML={{ __html: inlineFormat(text) }} />
      );
    } else if (/^[-•]\s/.test(line)) {
      elements.push(
        <span key={i} className="flex gap-2 items-start pl-0.5">
          <span className="w-1 h-1 rounded-full bg-indigo-400/60 mt-[7px] shrink-0" />
          <span className="text-white/70" dangerouslySetInnerHTML={{ __html: inlineFormat(line.replace(/^[-•]\s/, '')) }} />
        </span>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <span key={i} className="flex gap-2 items-start">
          <span className="text-indigo-300/80 shrink-0 font-bold text-[11px] mt-[1px] w-4 text-right">{num}.</span>
          <span className="text-white/70" dangerouslySetInnerHTML={{ __html: inlineFormat(line.replace(/^\d+\.\s/, '')) }} />
        </span>
      );
    } else {
      elements.push(
        <span key={i} className="block text-white/70" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
    }
    i++;
  }
  return elements;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/10 transition-all text-white/30 hover:text-white/60" title="Copiar">
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`group flex gap-2 sm:gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end`}>
      {/* Avatar */}
      <div className={`shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl flex items-center justify-center ${
        isUser
          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20'
          : 'bg-white/[0.06] border border-white/[0.08]'
      }`}>
        {isUser
          ? <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
          : <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-300/80" />
        }
      </div>

      {/* Bubble */}
      <div className={`relative max-w-[88%] sm:max-w-[85%] rounded-2xl text-[13px] sm:text-sm leading-relaxed ${
        isUser
          ? 'bg-gradient-to-br from-indigo-500/90 to-purple-600/90 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-br-md shadow-lg shadow-indigo-500/10'
          : 'px-3 sm:px-4 py-2 sm:py-2.5 rounded-bl-md border border-white/[0.06]'
      }`}
        style={!isUser ? {
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
          backdropFilter: 'blur(12px)',
        } : undefined}>
        {/* Top shine on assistant bubble */}
        {!isUser && <div className="absolute top-0 inset-x-2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />}

        <div className="space-y-0.5">{formatContent(content)}</div>

        {isStreaming && (
          <span className="inline-flex items-center gap-0.5 ml-1">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
          </span>
        )}

        {/* Copy button for assistant messages */}
        {!isUser && !isStreaming && content.length > 20 && (
          <div className="flex justify-end mt-1 -mb-0.5">
            <CopyButton text={content} />
          </div>
        )}
      </div>
    </div>
  );
}
