'use client';

import { useEffect, useRef } from 'react';
import { Bot, User, MessageSquare } from 'lucide-react';
import type { Message } from '@/types/interview';

interface ChatPanelProps {
  messages: Message[];
}

export function ChatPanel({ messages }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-lg border border-[#d4e4d9] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#d4e4d9] bg-gradient-to-r from-[#f5f9f6] to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#39634E] flex items-center justify-center">
            <MessageSquare className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1e3a2c]">Transcript</h2>
            <p className="text-xs text-[#5a7d67]">{messages.length} messages</p>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-[#f8fbf9] to-white"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-[#e8efe9] flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-[#39634E]" />
            </div>
            <p className="text-[#5a7d67] text-sm font-medium">
              Conversation transcript will appear here
            </p>
            <p className="text-[#8ca898] text-xs mt-1">
              Start the interview to begin
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user'
                    ? 'bg-[#39634E]'
                    : 'bg-gradient-to-br from-emerald-400 to-teal-500'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-[#39634E] text-white rounded-br-md'
                    : 'bg-white border border-[#d4e4d9] text-[#1e3a2c] rounded-bl-md shadow-sm'
                }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
                <span
                  className={`text-[10px] mt-2 block ${
                    message.role === 'user' ? 'text-white/60' : 'text-[#8ca898]'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
