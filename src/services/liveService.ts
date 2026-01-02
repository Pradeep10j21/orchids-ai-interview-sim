import type { LiveSessionCallbacks } from '@/types/interview';
import {
  float32ToInt16,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  resampleAudio,
} from '@/utils/audioUtils';

const SYSTEM_INSTRUCTION = `You are a Professional Technical Recruiter conducting a technical interview. Your role is to interview the candidate professionally and assess their skills.

Interview Flow:
1. Start with "Tell me about yourself."
2. After their introduction, ask follow-up questions about projects they mentioned.
3. Then move to technical topics: OOP concepts, DBMS, Operating Systems, Data Structures & Algorithms, React.js, and Express.js.

Rules:
- Ask ONE question at a time. Wait for the candidate to finish before asking the next question.
- Keep your responses concise and professional. Do not lecture or teach - just interview.
- Be encouraging but maintain professional distance.
- If the candidate struggles, you may provide a small hint but move on if they cannot answer.
- Acknowledge their answers briefly before moving to the next question.

Remember: You are interviewing them, not teaching them. Keep the conversation flowing naturally like a real interview.`;

export class LiveInterviewService {
  private ws: WebSocket | null = null;
  private callbacks: LiveSessionCallbacks | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private playbackContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private isConnected = false;
  private apiKey: string;
  private initialPromptSent = false;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    this.apiKey = apiKey;
  }

  async connect(callbacks: LiveSessionCallbacks): Promise<void> {
    this.callbacks = callbacks;

    try {
      const url = `wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17`;
      
      this.ws = new WebSocket(url, [
        'realtime',
        `openai-insecure-api-key.${this.apiKey}`,
        'openai-beta.realtime-v1',
      ]);

      this.ws.onopen = () => {
        console.log('WebSocket opened');
        this.isConnected = true;
        this.sendSessionUpdate();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleServerMessage(data);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.callbacks?.onError(new Error('WebSocket connection error'));
      };

      this.ws.onclose = (e) => {
        console.log('WebSocket closed:', e.code, e.reason);
        this.isConnected = false;
        this.callbacks?.onDisconnect();
      };

      this.playbackContext = new AudioContext({ sampleRate: 24000 });
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  }

  private sendSessionUpdate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: SYSTEM_INSTRUCTION,
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    };

    this.ws.send(JSON.stringify(sessionUpdate));
  }

  private sendInitialPrompt(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    console.log('Sending initial prompt...');

    const conversationItem = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Start the interview by greeting the candidate and asking them to tell you about themselves.',
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(conversationItem));
    console.log('Conversation item sent');

    const responseCreate = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
      },
    };

    this.ws.send(JSON.stringify(responseCreate));
    console.log('Response create sent');
  }

  private handleServerMessage(message: Record<string, unknown>): void {
    const type = message.type as string;
    console.log('Received message:', type, message);

    switch (type) {
      case 'session.created':
        console.log('Session created');
        this.callbacks?.onConnect();
        break;

      case 'session.updated':
        console.log('Session updated');
        if (!this.initialPromptSent) {
          this.initialPromptSent = true;
          this.sendInitialPrompt();
        }
        break;

      case 'response.audio.delta':
        if (message.delta) {
          const audioData = base64ToArrayBuffer(message.delta as string);
          this.callbacks?.onAudioData(audioData);
          this.queueAudioForPlayback(audioData);
        }
        break;

      case 'response.audio_transcript.delta':
        if (message.delta) {
          this.callbacks?.onTextResponse(message.delta as string);
        }
        break;

      case 'response.text.delta':
        if (message.delta) {
          this.callbacks?.onTextResponse(message.delta as string);
        }
        break;

      case 'input_audio_buffer.speech_started':
        this.stopAudioPlayback();
        this.callbacks?.onInterrupted();
        break;

      case 'error':
        console.error('OpenAI error:', message.error);
        const errorObj = message.error as { message?: string } | undefined;
        this.callbacks?.onError(new Error(errorObj?.message || 'Unknown error'));
        break;

      case 'response.done':
        console.log('Response complete');
        break;

      default:
        break;
    }
  }

  private async queueAudioForPlayback(audioData: ArrayBuffer): Promise<void> {
    if (!this.playbackContext) return;

    try {
      const int16Array = new Int16Array(audioData);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768;
      }

      const audioBuffer = this.playbackContext.createBuffer(
        1,
        float32Array.length,
        24000
      );
      audioBuffer.copyToChannel(float32Array, 0);

      this.audioQueue.push(audioBuffer);

      if (!this.isPlaying) {
        this.playNextAudio();
      }
    } catch (error) {
      console.error('Failed to queue audio:', error);
    }
  }

  private playNextAudio(): void {
    if (!this.playbackContext || this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift();

    if (!audioBuffer) {
      this.isPlaying = false;
      return;
    }

    const source = this.playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.playbackContext.destination);

    source.onended = () => {
      this.playNextAudio();
    };

    source.start();
  }

  private stopAudioPlayback(): void {
    this.audioQueue = [];
    this.isPlaying = false;
  }

  async startMicrophone(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: 24000 });
      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.scriptProcessor.onaudioprocess = (event) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const resampledData = resampleAudio(
          inputData,
          this.audioContext?.sampleRate || 44100,
          24000
        );
        const int16Data = float32ToInt16(resampledData);
        const base64Audio = arrayBufferToBase64(int16Data.buffer as ArrayBuffer);

        const audioAppend = {
          type: 'input_audio_buffer.append',
          audio: base64Audio,
        };

        this.ws.send(JSON.stringify(audioAppend));
      };

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Failed to start microphone:', error);
      throw error;
    }
  }

  stopMicrophone(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  async disconnect(): Promise<void> {
    this.stopMicrophone();
    this.stopAudioPlayback();

    if (this.playbackContext) {
      await this.playbackContext.close();
      this.playbackContext = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  isSessionConnected(): boolean {
    return this.isConnected;
  }
}
