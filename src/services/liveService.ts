import type { LiveSessionCallbacks } from '@/types/interview';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

export class LiveInterviewService {
  private callbacks: LiveSessionCallbacks | null = null;
  private isConnected = false;
  private recognition: ISpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private conversationHistory: ChatMessage[] = [];
  private isProcessing = false;
  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.synthesis = window.speechSynthesis;
    }
  }

  async connect(callbacks: LiveSessionCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.isConnected = true;
    callbacks.onConnect();

    await this.sendInitialGreeting();
  }

  private async sendInitialGreeting(): Promise<void> {
    const initialMessage = {
      role: 'user' as const,
      content: 'Start the interview by greeting the candidate and asking them to tell you about themselves.',
    };
    
    await this.getAIResponse([initialMessage], false);
  }

  private async getAIResponse(messages: ChatMessage[], addToHistory: boolean = true): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await response.json();
      const aiMessage = data.message;

      if (addToHistory) {
        this.conversationHistory.push({ role: 'assistant', content: aiMessage });
      } else {
        this.conversationHistory = [{ role: 'assistant', content: aiMessage }];
      }

      this.callbacks?.onTextResponse(aiMessage);
      await this.speakText(aiMessage);
    } catch (error) {
      console.error('AI response error:', error);
      this.callbacks?.onError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      this.isProcessing = false;
    }
  }

  private speakText(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synthesis) {
        resolve();
        return;
      }

      this.synthesis.cancel();
      this.isSpeaking = true;

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = this.synthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')
      ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        this.callbacks?.onAudioData(new ArrayBuffer(0));
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        resolve();
      };

      this.synthesis.speak(utterance);
    });
  }

  async startMicrophone(): Promise<void> {
    const win = window as unknown as { 
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    
    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      throw new Error('Speech recognition not supported in this browser. Please use Chrome or Edge.');
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    let finalTranscript = '';

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        }
      }

      if (finalTranscript.trim() && !this.isProcessing && !this.isSpeaking) {
        const userMessage = finalTranscript.trim();
        finalTranscript = '';
        
        this.stopSpeaking();
        this.callbacks?.onInterrupted();
        
        this.conversationHistory.push({ role: 'user', content: userMessage });
        this.getAIResponse(this.conversationHistory);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error);
        this.callbacks?.onError(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    this.recognition.onend = () => {
      if (this.isConnected && this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          console.log('Recognition restart failed:', e);
        }
      }
    };

    this.recognition.start();
  }

  private stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  stopMicrophone(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }

  async disconnect(): Promise<void> {
    this.stopMicrophone();
    this.stopSpeaking();
    this.isConnected = false;
    this.conversationHistory = [];
    this.callbacks?.onDisconnect();
  }

  isSessionConnected(): boolean {
    return this.isConnected;
  }
}
