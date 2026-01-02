'use client';

import { useState, useEffect } from 'react';
import { InterviewSession } from '@/components/InterviewSession';
import { ArrowRight, Shield, Sparkles, Mic, Video } from 'lucide-react';

export default function Home() {
  const [isStarted, setIsStarted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#E8EFE9] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#39634E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isStarted) {
    return <InterviewSession onReset={() => setIsStarted(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#E8EFE9] font-['DM_Sans',sans-serif] flex items-center justify-center p-6" suppressHydrationWarning>
      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[#39634E] to-[#2d5040] shadow-2xl shadow-[#39634E]/30 mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[#1e3a2c] mb-3">
            AI Interview Simulator
          </h1>
          <p className="text-[#5a7d67] text-lg max-w-md mx-auto">
            Practice your technical interview skills with an AI-powered interviewer
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-[#d4e4d9] p-8">
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-[#5a7d67] mb-6">
                Click below to start your mock technical interview. The AI will ask you questions and provide feedback.
              </p>
            </div>

            <button
              onClick={() => setIsStarted(true)}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-[#39634E] to-[#2d5040] text-white font-semibold text-lg shadow-lg shadow-[#39634E]/30 hover:shadow-xl hover:shadow-[#39634E]/40 hover:scale-[1.01] transition-all duration-300"
            >
              Start Interview
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-[#e8efe9]">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#f8fbf9]">
                <div className="w-10 h-10 rounded-lg bg-[#e8efe9] flex items-center justify-center">
                  <Mic className="w-5 h-5 text-[#39634E]" />
                </div>
                <span className="text-xs text-[#5a7d67] text-center">Voice Chat</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#f8fbf9]">
                <div className="w-10 h-10 rounded-lg bg-[#e8efe9] flex items-center justify-center">
                  <Video className="w-5 h-5 text-[#39634E]" />
                </div>
                <span className="text-xs text-[#5a7d67] text-center">Video Feed</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#f8fbf9]">
                <div className="w-10 h-10 rounded-lg bg-[#e8efe9] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#39634E]" />
                </div>
                <span className="text-xs text-[#5a7d67] text-center">Free to Use</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-[#8ca898] mt-6">
          Powered by Qwen LLM with browser speech synthesis
        </p>
      </div>
    </div>
  );
}
