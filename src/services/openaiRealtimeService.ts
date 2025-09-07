/* full file content */
import { aiAssistantService } from './aiAssistantService';

export interface OpenAIRealtimeConfig {
  model: string;
  wakeWord?: string; // e.g., "hey sara"
  vadThreshold?: number; // simple amplitude gate
}

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

// If your project already includes proper DOM speech types, you can remove these fallbacks.
interface MinimalSpeechResult { transcript: string }
interface MinimalSpeechEvent { results?: Array<Array<MinimalSpeechResult>> }
interface MinimalSpeechErrorEvent { error?: string }
interface MinimalSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: MinimalSpeechEvent) => void;
  onerror?: (e: MinimalSpeechErrorEvent) => void;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;
type WindowSpeech = { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };

// Minimal event emitter base
class Emitter {
  private listeners = new Map<string, Array<(ev: RealtimeEvent) => void>>();

  on(type: string, fn: (ev: RealtimeEvent) => void) {
    const arr = this.listeners.get(type) || [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }
  off(type: string, fn: (ev: RealtimeEvent) => void) {
    const arr = this.listeners.get(type) || [];
    this.listeners.set(type, arr.filter((f) => f !== fn));
  }
  emit(ev: RealtimeEvent) {
    const arr = this.listeners.get(ev.type) || [];
    for (const f of arr) f(ev);
  }
}

const RTC_URL = import.meta.env.VITE_OPENAI_REALTIME_URL as string | undefined;
const EPHEMERAL_URL = import.meta.env.VITE_OPENAI_EPHEMERAL_URL as string | undefined;

export class OpenAIRealtimeService extends Emitter {
  private pc?: RTCPeerConnection;
  private micStream?: MediaStream;
  private audioEl?: HTMLAudioElement;
  private recognition?: MinimalSpeechRecognition;
  private wakeWordRecognition?: MinimalSpeechRecognition;
  private vadThreshold: number;
  private buffer: Float32Array[] = [];
  private currentUserId?: string;

  constructor(private config: OpenAIRealtimeConfig) {
    super();
    this.vadThreshold = config.vadThreshold ?? 0.03;
  }

  attachUser(userId: string) {
    this.currentUserId = userId;
  }

  async initWakeWord() {
    const SpeechRecognitionCtor =
      (window as unknown as WindowSpeech).SpeechRecognition ||
      (window as unknown as WindowSpeech).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    this.wakeWordRecognition = new SpeechRecognitionCtor();
    this.wakeWordRecognition.continuous = true;
    this.wakeWordRecognition.interimResults = false;
    this.wakeWordRecognition.lang = 'en-US';

    const wake = (this.config.wakeWord || 'hey sara').toLowerCase();

    this.wakeWordRecognition.onresult = (event: MinimalSpeechEvent) => {
      const results = (event as unknown as { results?: Array<Array<{ transcript: string }>> }).results || [];
      for (const result of results) {
        const transcript = (result?.[0]?.transcript || '').toLowerCase();
        if (transcript.includes(wake)) {
          this.emit({ type: 'wake.detected' });
          this.startRecording().catch((e) => {
            this.emit({ type: 'assistant.error', message: (e instanceof Error ? e.message : String(e)) || 'Record start failed' });
          });
          break;
        }
      }
    };

    this.wakeWordRecognition.start();
  }

  async startRecording() {
    if (this.micStream) return;

    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(this.micStream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);

    src.connect(proc);
    proc.connect(ctx.destination);

    proc.onaudioprocess = (ev) => {
      const ch = ev.inputBuffer.getChannelData(0);
      const max = Math.max(...ch.map((v) => Math.abs(v)));
      this.emit({ type: 'vad.level', value: max });
      if (max > this.vadThreshold) {
        this.buffer.push(new Float32Array(ch));
      } else if (this.buffer.length > 0) {
        // End of speech segment
        const concat = this.concatBuffers(this.buffer);
        this.buffer = [];
        this.emit({ type: 'vad.segment', data: concat });
        // For demo: convert to fake text and dispatch to AI
        const fakeText = '[voice] user audio segment';
        this.processUserText(fakeText).catch((e) => {
          this.emit({ type: 'assistant.error', message: (e instanceof Error ? e.message : String(e)) || 'Voice segment failed' });
        });
      }
    };

    this.emit({ type: 'recording.started' });
  }

  stopRecording() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = undefined;
      this.emit({ type: 'recording.stopped' });
    }
  }

  private concatBuffers(chunks: Float32Array[]): Float32Array {
    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Float32Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }

  async connectRealtime() {
    if (this.pc) return;

    // Acquire ephemeral key from your backend
    const tokenResp = await fetch(EPHEMERAL_URL || '/api/realtime-token');
    if (!tokenResp.ok) {
      throw new Error(`Failed to get ephemeral key: ${tokenResp.status}`);
    }
    const { client_secret: { value: EPHEMERAL_KEY } = { value: '' } } = await tokenResp.json();

    this.pc = new RTCPeerConnection();
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.micStream!));

    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    this.audioEl = audioEl;

    this.pc.ontrack = (e) => {
      this.audioEl!.srcObject = e.streams[0];
    };

    const data = this.pc.createDataChannel('oai-events');
    data.onmessage = (ev) => {
      this.emit({ type: 'oai.message', raw: ev.data });
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    if (!offer.sdp) { throw new Error('Failed to create SDP offer.'); }
    const resp = await fetch(`${(RTC_URL || "https://api.openai.com/v1/realtime")}?model=${this.config.model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    });

    if (!resp.ok) {
      throw new Error(`Realtime connect failed: ${resp.status} ${resp.statusText}`);
    }

    const answerSDP = await resp.text();
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSDP });
    this.emit({ type: 'realtime.connected' });
  }

  async disconnectRealtime() {
    if (this.pc) {
      this.pc.close();
      this.pc = undefined;
      this.emit({ type: 'realtime.disconnected' });
    }
    this.stopRecording();
  }

  async processUserText(message: string) {
    try {
      const result = await aiAssistantService.processUserMessage(message, this.currentUserId!);
      this.emit({ type: 'assistant.action', data: result });
    } catch (e: unknown) {
      this.emit({ type: 'assistant.error', message: (e instanceof Error ? e.message : String(e)) || 'Action failed' });
    }
  }
}
export const openaiRealtimeService = new OpenAIRealtimeService({ model: 'gpt-4o-realtime-preview' });
