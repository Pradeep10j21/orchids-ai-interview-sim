'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Monitor,
  Circle,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { VideoFeed } from './VideoFeed';
import { AIAvatar } from './AIAvatar';
import { ChatPanel } from './ChatPanel';
import { LiveInterviewService } from '@/services/liveService';
import type { Message, InterviewState, ConversationHistory } from '@/types/interview';
import { generateUUID } from '@/utils/audioUtils';

interface InterviewSessionProps {
  apiKey: string;
  onReset?: () => void;
}

export function InterviewSession({ apiKey, onReset }: InterviewSessionProps) {
  const [state, setState] = useState<InterviewState>({
    status: 'idle',
    isRecording: false,
    isMuted: false,
    isCameraOff: false,
    isAISpeaking: false,
    currentQuestion: '',
    error: null,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  const serviceRef = useRef<LiveInterviewService | null>(null);
  const sessionIdRef = useRef<string>(generateUUID());
  const currentAIMessageRef = useRef<string>('');
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (state.status === 'active' && sessionStartTime) {
      interval = setInterval(() => {
        const diff = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        setElapsedTime(`${minutes}:${seconds}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.status, sessionStartTime]);

  const handleConnect = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'active', isRecording: true }));
    setSessionStartTime(new Date());
  }, []);

  const handleDisconnect = useCallback(() => {
    setState((prev) => {
      if (prev.status === 'active') {
        return { ...prev, status: 'ended', isRecording: false };
      }
      return prev;
    });
  }, []);

  const handleAudioData = useCallback(() => {
    setState((prev) => ({ ...prev, isAISpeaking: true }));
    
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
    }
    speakingTimeoutRef.current = setTimeout(() => {
      setState((prev) => ({ ...prev, isAISpeaking: false }));
    }, 500);
  }, []);

  const handleTextResponse = useCallback((text: string) => {
    currentAIMessageRef.current += text;

    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === 'ai') {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...lastMessage,
          content: currentAIMessageRef.current,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: generateUUID(),
          role: 'ai',
          content: currentAIMessageRef.current,
          timestamp: new Date(),
        },
      ];
    });

    const sentences = currentAIMessageRef.current.split(/[.?!]+/);
    const lastSentence = sentences[sentences.length - 2] || sentences[0];
    if (lastSentence && lastSentence.includes('?')) {
      setState((prev) => ({ ...prev, currentQuestion: lastSentence.trim() + '?' }));
    }
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('Interview error:', error);
    setState((prev) => ({ ...prev, error: error.message }));
  }, []);

  const handleInterrupted = useCallback(() => {
    currentAIMessageRef.current = '';
    setState((prev) => ({ ...prev, isAISpeaking: false }));
  }, []);

  const startInterview = async () => {
    if (!apiKey) {
      setState((prev) => ({ ...prev, error: 'API key is required' }));
      return;
    }

    setState((prev) => ({ ...prev, status: 'connecting', error: null }));

    try {
      serviceRef.current = new LiveInterviewService(apiKey);

      await serviceRef.current.connect({
        onConnect: handleConnect,
        onDisconnect: handleDisconnect,
        onAudioData: handleAudioData,
        onTextResponse: (text) => {
          handleTextResponse(text);
        },
        onError: handleError,
        onInterrupted: handleInterrupted,
      });

      await serviceRef.current.startMicrophone();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'idle',
        error: error instanceof Error ? error.message : 'Failed to start interview',
      }));
    }
  };

  const endInterview = async () => {
    if (serviceRef.current) {
      await serviceRef.current.disconnect();
      serviceRef.current = null;
    }

    downloadTranscript();

    setState((prev) => ({ ...prev, status: 'ended', isRecording: false }));
  };

  const toggleMute = () => {
    setState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const toggleCamera = () => {
    setState((prev) => ({ ...prev, isCameraOff: !prev.isCameraOff }));
  };

  const downloadTranscript = () => {
    const history: ConversationHistory = {
      sessionId: sessionIdRef.current,
      startTime: sessionStartTime?.toISOString() || new Date().toISOString(),
      endTime: new Date().toISOString(),
      messages: messages.map((m) => ({
        ...m,
        timestamp: m.timestamp,
      })),
    };

    const blob = new Blob([JSON.stringify(history, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-transcript-${sessionIdRef.current.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#E8EFE9] font-['DM_Sans',sans-serif]">
      <header className="bg-white border-b border-[#d4e4d9] px-6 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#39634E] to-[#2d5040] flex items-center justify-center">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#1e3a2c]">
                AI Interview Session
              </h1>
              <p className="text-xs text-[#5a7d67]">Technical Assessment</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {state.status === 'active' && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[#39634E]/10">
                <div className="flex items-center gap-2">
                  <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500 animate-pulse" />
                  <span className="text-sm font-medium text-[#39634E]">Live</span>
                </div>
                <div className="w-px h-4 bg-[#39634E]/20" />
                <span className="text-sm font-mono text-[#5a7d67]">{elapsedTime}</span>
              </div>
            )}

            {state.status === 'ended' && messages.length > 0 && (
              <button
                onClick={downloadTranscript}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#39634E] text-white text-sm font-medium hover:bg-[#2d5040] transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Transcript
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto p-6">
        {state.error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{state.error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {state.currentQuestion && state.status === 'active' && (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#39634E]/80 to-[#2d5040]/80 rounded-2xl blur-xl opacity-50" />
                <div className="relative px-6 py-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-[#d4e4d9] shadow-lg">
                  <p className="text-xs font-medium text-[#5a7d67] mb-1">Current Question</p>
                  <p className="text-[#1e3a2c] font-medium">{state.currentQuestion}</p>
                </div>
              </div>
            )}

            <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="h-full min-h-[300px]">
                <AIAvatar isSpeaking={state.isAISpeaking} />
              </div>
              <div className="h-full min-h-[300px]">
                <VideoFeed isCameraOff={state.isCameraOff} />
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              {state.status === 'idle' && (
                <button
                  onClick={startInterview}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#39634E] to-[#2d5040] text-white font-semibold text-lg shadow-xl shadow-[#39634E]/30 hover:shadow-2xl hover:shadow-[#39634E]/40 hover:scale-[1.02] transition-all duration-300"
                >
                  Start Interview
                </button>
              )}

              {state.status === 'connecting' && (
                <div className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#39634E]/20">
                  <Loader2 className="w-5 h-5 text-[#39634E] animate-spin" />
                  <span className="text-[#39634E] font-medium">Connecting...</span>
                </div>
              )}

              {state.status === 'active' && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white shadow-xl border border-[#d4e4d9]">
                  <button
                    onClick={toggleMute}
                    className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      state.isMuted
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-[#e8efe9] text-[#39634E] hover:bg-[#d4e4d9]'
                    }`}
                  >
                    {state.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>

                  <button
                    onClick={toggleCamera}
                    className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      state.isCameraOff
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-[#e8efe9] text-[#39634E] hover:bg-[#d4e4d9]'
                    }`}
                  >
                    {state.isCameraOff ? <CameraOff className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                  </button>

                  <div className="w-px h-10 bg-[#d4e4d9]" />

                  <button
                    onClick={endInterview}
                    className="w-14 h-14 rounded-xl bg-red-500 text-white hover:bg-red-600 flex items-center justify-center transition-all duration-200"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>
                </div>
              )}

              {state.status === 'ended' && (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-[#5a7d67]">Interview ended</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setState({
                          status: 'idle',
                          isRecording: false,
                          isMuted: false,
                          isCameraOff: false,
                          isAISpeaking: false,
                          currentQuestion: '',
                          error: null,
                        });
                        setMessages([]);
                        sessionIdRef.current = generateUUID();
                        currentAIMessageRef.current = '';
                      }}
                      className="px-6 py-3 rounded-xl bg-[#39634E] text-white font-medium hover:bg-[#2d5040] transition-colors"
                    >
                      Restart Session
                    </button>
                    {onReset && (
                      <button
                        onClick={onReset}
                        className="px-6 py-3 rounded-xl border border-[#39634E] text-[#39634E] font-medium hover:bg-[#39634E]/5 transition-colors"
                      >
                        Exit to Home
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-full min-h-[400px]">
            <ChatPanel messages={messages} />
          </div>
        </div>
      </main>
    </div>
  );
}
