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
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
  onaudiostart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
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
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentTranscript = '';
  private sessionId: string = '';
  private retryCount = 0;
  private maxRetries = 3;
  private recognitionRestartTimeout: ReturnType<typeof setTimeout> | null = null;
  private speechSynthesisTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.synthesis = window.speechSynthesis;
      this.sessionId = crypto.randomUUID();
      
      if (this.synthesis) {
        this.synthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          this.synthesis?.getVoices();
        };
      }
    }
  }

  async connect(callbacks: LiveSessionCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.isConnected = true;
    this.retryCount = 0;
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const aiMessage = data.message;

      if (!aiMessage || aiMessage.trim() === '') {
        throw new Error('Empty response from AI');
      }

      this.retryCount = 0;

      if (addToHistory) {
        this.conversationHistory.push({ role: 'assistant', content: aiMessage });
      } else {
        this.conversationHistory = [{ role: 'assistant', content: aiMessage }];
      }

      this.callbacks?.onTextResponse(aiMessage);
      
      this.storeTranscript('ai', aiMessage);
      
      await this.speakText(aiMessage);
    } catch (error) {
      console.error('AI response error:', error);
      
      if (this.retryCount < this.maxRetries && this.isConnected) {
        this.retryCount++;
        console.log(`Retrying AI response (${this.retryCount}/${this.maxRetries})...`);
        this.isProcessing = false;
        
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
        
        if (this.isConnected) {
          await this.getAIResponse(messages, addToHistory);
        }
        return;
      }
      
      this.callbacks?.onError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      this.isProcessing = false;
    }
  }

  private async storeTranscript(role: 'user' | 'ai', content: string): Promise<void> {
    try {
      await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          role,
          content,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to store transcript:', error);
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

      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      let currentIndex = 0;

      const speakNext = () => {
        if (currentIndex >= sentences.length || !this.isConnected) {
          this.isSpeaking = false;
          this.currentUtterance = null;
          resolve();
          return;
        }

        const sentence = sentences[currentIndex].trim();
        if (!sentence) {
          currentIndex++;
          speakNext();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(sentence);
        this.currentUtterance = utterance;
        
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = this.synthesis!.getVoices();
        const preferredVoice = voices.find(
          (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))
        ) || voices.find((v) => v.lang.startsWith('en-US')) 
          || voices.find((v) => v.lang.startsWith('en')) 
          || voices[0];
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        if (currentIndex === 0) {
          utterance.onstart = () => {
            this.callbacks?.onAudioData(new ArrayBuffer(0));
          };
        }

        if (this.speechSynthesisTimeout) {
          clearTimeout(this.speechSynthesisTimeout);
        }
        this.speechSynthesisTimeout = setTimeout(() => {
          if (this.isSpeaking) {
            console.log('Speech synthesis timeout, forcing continue...');
            this.synthesis?.cancel();
            this.isSpeaking = false;
            this.currentUtterance = null;
            resolve();
          }
        }, 30000);

        utterance.onend = () => {
          if (this.speechSynthesisTimeout) {
            clearTimeout(this.speechSynthesisTimeout);
          }
          currentIndex++;
          speakNext();
        };

        utterance.onerror = (e) => {
          console.error('Speech synthesis error:', e);
          if (this.speechSynthesisTimeout) {
            clearTimeout(this.speechSynthesisTimeout);
          }
          currentIndex++;
          speakNext();
        };

        try {
          this.synthesis!.speak(utterance);
          
          setTimeout(() => {
            if (this.synthesis?.paused) {
              this.synthesis.resume();
            }
          }, 100);
        } catch (e) {
          console.error('Failed to speak:', e);
          currentIndex++;
          speakNext();
        }
      };

      speakNext();
    });
  }

  async startMicrophone(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        } 
      });
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      throw new Error('Microphone permission denied. Please allow microphone access and try again.');
    }

    const win = window as unknown as { 
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    
    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      throw new Error('Speech recognition not supported. Please use Chrome, Edge, or Safari.');
    }

    this.SpeechRecognitionAPI = SpeechRecognitionAPI;
    this.setupRecognition();
  }

  private SpeechRecognitionAPI: SpeechRecognitionConstructor | null = null;

  private setupRecognition(): void {
    if (!this.SpeechRecognitionAPI) return;
    
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        console.log('Error aborting previous recognition:', e);
      }
    }

    this.recognition = new this.SpeechRecognitionAPI();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onaudiostart = () => {
      console.log('Microphone is capturing audio');
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!this.isConnected) return;

      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const displayText = this.currentTranscript + (finalTranscript || interimTranscript);
      
      if (displayText.trim()) {
        this.callbacks?.onUserTranscript(displayText, false);
      }

      if (finalTranscript) {
        this.currentTranscript += finalTranscript + ' ';
        
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
        }
        
        this.silenceTimeout = setTimeout(() => {
          this.processUserInput();
        }, 600);
      } else if (interimTranscript) {
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
        }
        this.silenceTimeout = setTimeout(() => {
          if (this.currentTranscript.trim()) {
            this.processUserInput();
          }
        }, 1500);
      }
    };

    this.recognition.onspeechend = () => {
      if (this.currentTranscript.trim() && !this.isProcessing && !this.isSpeaking) {
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
        }
        this.silenceTimeout = setTimeout(() => {
          this.processUserInput();
        }, 400);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        this.callbacks?.onError(new Error('Microphone access denied. Please allow microphone access.'));
        return;
      }
      
      if (event.error === 'network') {
        this.callbacks?.onError(new Error('Network error. Please check your connection.'));
        this.scheduleRecognitionRestart();
        return;
      }

      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.scheduleRecognitionRestart();
      }
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      
      if (this.isConnected) {
        this.scheduleRecognitionRestart();
      }
    };

    try {
      this.recognition.start();
      console.log('Speech recognition started');
    } catch (e) {
      console.error('Failed to start recognition:', e);
      this.scheduleRecognitionRestart();
    }
  }

  private scheduleRecognitionRestart(): void {
    if (!this.isConnected || !this.SpeechRecognitionAPI) return;

    if (this.recognitionRestartTimeout) {
      clearTimeout(this.recognitionRestartTimeout);
    }

    this.recognitionRestartTimeout = setTimeout(() => {
      if (this.isConnected && this.SpeechRecognitionAPI) {
        console.log('Restarting speech recognition...');
        this.setupRecognition();
      }
    }, 200);
  }

  private processUserInput(): void {
    const userMessage = this.currentTranscript.trim();
    
    if (!userMessage || this.isProcessing) {
      return;
    }

    if (this.isSpeaking) {
      this.stopSpeaking();
      this.callbacks?.onInterrupted();
    }

    this.callbacks?.onUserTranscript(userMessage, true);
    
    this.storeTranscript('user', userMessage);
    
    this.currentTranscript = '';
    
    this.conversationHistory.push({ role: 'user', content: userMessage });
    this.getAIResponse(this.conversationHistory);
  }

  private stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    if (this.speechSynthesisTimeout) {
      clearTimeout(this.speechSynthesisTimeout);
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  stopMicrophone(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }
    if (this.recognitionRestartTimeout) {
      clearTimeout(this.recognitionRestartTimeout);
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
      this.recognition = null;
    }
  }

  async disconnect(): Promise<void> {
    this.stopMicrophone();
    this.stopSpeaking();
    this.isConnected = false;
    this.conversationHistory = [];
    this.currentTranscript = '';
    this.retryCount = 0;
    this.callbacks?.onDisconnect();
  }

  isSessionConnected(): boolean {
    return this.isConnected;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  retryLastResponse(): void {
    if (this.conversationHistory.length > 0 && !this.isProcessing) {
      this.getAIResponse(this.conversationHistory, false);
    }
  }
}
