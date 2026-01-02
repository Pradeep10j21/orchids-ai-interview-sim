'use client';

import { useEffect, useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface AIAvatarProps {
  isSpeaking: boolean;
}

export function AIAvatar({ isSpeaking }: AIAvatarProps) {
  const [waveformBars, setWaveformBars] = useState<number[]>([]);

  useEffect(() => {
    if (isSpeaking) {
      const interval = setInterval(() => {
        setWaveformBars(
          Array.from({ length: 12 }, () => Math.random() * 100 + 20)
        );
      }, 100);
      return () => clearInterval(interval);
    } else {
      setWaveformBars(Array.from({ length: 12 }, () => 20));
    }
  }, [isSpeaking]);

  return (
    <div className="relative h-full w-full rounded-2xl bg-gradient-to-br from-[#39634E] via-[#2d5040] to-[#1e3a2c] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }} />
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="flex flex-col items-center gap-8 z-10">
        <div className={`relative transition-transform duration-300 ${isSpeaking ? 'scale-105' : 'scale-100'}`}>
          <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
            isSpeaking 
              ? 'bg-emerald-400/30 animate-ping' 
              : 'bg-transparent'
          }`} style={{ animationDuration: '1.5s' }} />
          <div className={`absolute -inset-2 rounded-full transition-all duration-500 ${
            isSpeaking 
              ? 'bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-emerald-400/20 animate-pulse' 
              : 'bg-transparent'
          }`} />
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-900/50">
            <Bot className="w-14 h-14 text-white" />
            {isSpeaking && (
              <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-yellow-300 animate-bounce" style={{ animationDuration: '0.8s' }} />
            )}
          </div>
        </div>

        <div className="flex items-end gap-1 h-16">
          {waveformBars.map((height, index) => (
            <div
              key={index}
              className="w-1.5 rounded-full bg-gradient-to-t from-emerald-400 to-teal-300 transition-all duration-100"
              style={{
                height: `${isSpeaking ? height : 20}%`,
                opacity: isSpeaking ? 0.9 : 0.4,
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'
          }`} />
          <span className="text-white/80 text-sm font-medium tracking-wide">
            {isSpeaking ? 'Speaking...' : 'Listening'}
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-white/90 text-xs font-medium">AI Interviewer</span>
        </div>
      </div>
    </div>
  );
}
