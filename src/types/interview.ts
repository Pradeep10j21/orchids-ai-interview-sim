export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export interface InterviewState {
  status: 'idle' | 'connecting' | 'active' | 'ended';
  isRecording: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isAISpeaking: boolean;
  currentQuestion: string;
  error: string | null;
}

export interface AudioConfig {
  inputSampleRate: number;
  outputSampleRate: number;
  channels: number;
}

export interface ConversationHistory {
  sessionId: string;
  startTime: string;
  endTime: string;
  messages: Message[];
}

export interface LiveSessionCallbacks {
  onConnect: () => void;
  onDisconnect: () => void;
  onAudioData: (audioData: ArrayBuffer) => void;
  onTextResponse: (text: string) => void;
  onError: (error: Error) => void;
  onInterrupted: () => void;
}
