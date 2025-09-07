import { aiAssistantService } from './aiAssistantService';
import { supabase } from "../lib/supabase";

// Fallback minimal speech types (safe for TS projects without full lib.dom)
interface MinimalSpeechResult { transcript: string }
interface MinimalSpeechEvent { results?: Array<Array<MinimalSpeechResult>> }
interface MinimalSpeechErrorEvent { error?: string }
interface MinimalSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: MinimalSpeechEvent) => void;
  onerror?: (e: MinimalSpeechErrorEvent) => void;
  onend?: () => void;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;
type WindowSpeech = { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };

export interface OpenAIRealtimeConfig {
  model: string;
  wakeWord?: string; // e.g. "hey sara"
  vadThreshold?: number; // amplitude gate
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  instructions?: string;
}

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

class Emitter {
  private listeners = new Map<string, Array<(ev: RealtimeEvent) => void>>();
  on(type: string, fn: (ev: RealtimeEvent) => void) {
    const arr = this.listeners.get(type) || [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }
  off(type: string, fn: (ev: RealtimeEvent) => void) {
    const arr = this.listeners.get(type) || [];
    this.listeners.set(type, arr.filter(f => f !== fn));
  }
  emit(ev: RealtimeEvent) {
    const arr = this.listeners.get(ev.type) || [];
    for (const f of arr) f(ev);
  }
}

const RTC_URL = import.meta.env.VITE_OPENAI_REALTIME_URL as string | undefined;
const EPHEMERAL_URL = import.meta.env.VITE_OPENAI_EPHEMERAL_URL as string | undefined;
const FUNCTIONS_BASE = String(import.meta.env.VITE_FUNCTIONS_URL ?? '').replace(/\/+$/, '');

export class OpenAIRealtimeService extends Emitter {
  private pc?: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private micStream?: MediaStream;
  private audioEl?: HTMLAudioElement;
  private recognition?: MinimalSpeechRecognition;
  private wakeWordRecognition?: MinimalSpeechRecognition;
  private vadThreshold: number;
  private buffer: Float32Array[] = [];
  private currentUserId?: string;
  private connected = false;
  private lastTokenFetchError?: string;

  // Callbacks required by UI
  private onEventCb?: (event: RealtimeEvent) => void;
  private onConnStateCb?: (state: RTCPeerConnectionState) => void;
  private onWakeWordDetectedCb?: () => void;
  private isListeningForWakeWordFlag = false;

  constructor(private config: OpenAIRealtimeConfig) {
    super();
    this.vadThreshold = config.vadThreshold ?? 0.03;
  }

  // == Public API expected by UI ==
  onEvent(cb: (event: RealtimeEvent) => void) { this.onEventCb = cb; }
  offEvent(_cb?: (event: RealtimeEvent) => void) { this.onEventCb = undefined; } // single-subscriber is fine here
  onConnectionStateChange(cb: (state: RTCPeerConnectionState) => void) { this.onConnStateCb = cb; }
  onWakeWordDetected(cb: () => void) { this.onWakeWordDetectedCb = cb; }

  isSupported(): boolean { return typeof RTCPeerConnection !== 'undefined'; }
  isConnected(): boolean { return this.connected; }
  getAudioElement(): HTMLAudioElement | undefined { return this.audioEl; }

  async initialize(userId: string) {
    this.currentUserId = userId;
    await this.connectRealtime();
    await this.startWakeWordDetection();
  }

  async startConversation() { await this.startRecording(); }
  async stopConversation() { this.stopRecording(); }
  async disconnect() { await this.disconnectRealtime(); }
  async mute() { if (this.micStream) this.micStream.getAudioTracks().forEach(t => (t.enabled = false)); }
  async unmute() { if (this.micStream) this.micStream.getAudioTracks().forEach(t => (t.enabled = true)); }
  async interrupt() { this.buffer = []; }

  // == Internals ==
  private emitUI(event: RealtimeEvent) { this.onEventCb?.(event); this.emit(event); }
  private emitConn(state: RTCPeerConnectionState) { this.onConnStateCb?.(state); this.emitUI({ type: 'connection.state', state }); }

  /** Build a list of candidate URLs for the ephemeral token endpoint. */
  private buildTokenUrlCandidates(): string[] {
    const urls: string[] = [];
    if (EPHEMERAL_URL) urls.push(EPHEMERAL_URL);
    if (FUNCTIONS_BASE) {
      urls.push(
        `${FUNCTIONS_BASE}/openai-token`,
        `${FUNCTIONS_BASE}/webrtc-token`,
        `${FUNCTIONS_BASE}/realtime-token`,
      );
      urls.push(
        `${FUNCTIONS_BASE}/functions/v1/openai-token`,
        `${FUNCTIONS_BASE}/functions/v1/webrtc-token`,
        `${FUNCTIONS_BASE}/functions/v1/realtime-token`,
      );
    }
    urls.push(
      '/openai-token',
      '/webrtc-token',
      '/realtime-token',
      '/api/openai-token',
      '/api/webrtc-token',
      '/api/realtime-token'
    );
    return Array.from(new Set(urls));
  }

  /** Attempt JSON POST to each candidate; require JSON content-type; return parsed JSON. */
  private async fetchJsonFirst(body: unknown): Promise<any> {
    const candidates = this.buildTokenUrlCandidates();
    const authHeader: Record<string, string> = {};
    try {
      const { data: { session} } = await supabase.auth.getSession();
      if (session?.access_token) authHeader.Authorization = `Bearer ${session.access_token}`;
    } catch { /* optional */ }

    const tried: string[] = [];
    for (const url of candidates) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeader },
          body: JSON.stringify(body ?? {}),
        });
        tried.push(`${url} -> ${resp.status}`);
        const ct = resp.headers.get('content-type') || '';
        if (!resp.ok) continue;
        if (!ct.includes('application/json')) continue;
        return await resp.json();
      } catch (e) {
        tried.push(`${url} -> ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
    }
    this.lastTokenFetchError = `Tried: ${tried.join(' | ')}`;
    throw new Error(`No valid token endpoint responded with JSON. ${this.lastTokenFetchError}`);
  }

  /** Extract the ephemeral key from commonly used JSON shapes. */
  private extractEphemeralKey(json: any): string {
    return json?.client_secret?.value || json?.value || json?.token || '';
  }

  async startWakeWordDetection() {
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
          this.onWakeWordDetectedCb?.();
          this.startRecording().catch(e => {
            this.emitUI({ type: 'assistant.error', message: e instanceof Error ? e.message : String(e) });
          });
          break;
        }
      }
    };
    this.wakeWordRecognition.onerror = () => { /* ignore */ };
    this.wakeWordRecognition.onend = () => { if (this.isListeningForWakeWordFlag) this.startWakeWordDetection(); };
    this.wakeWordRecognition.start();
    this.isListeningForWakeWordFlag = true;
  }

  stopWakeWordDetection() {
    this.isListeningForWakeWordFlag = false;
    this.wakeWordRecognition?.stop();
    this.wakeWordRecognition = undefined;
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
      this.emitUI({ type: 'vad.level', value: max });
      if (max > this.vadThreshold) {
        this.buffer.push(new Float32Array(ch));
      } else if (this.buffer.length > 0) {
        const concat = this.concatBuffers(this.buffer);
        this.buffer = [];
        this.emitUI({ type: 'vad.segment', data: concat });
        const fakeText = '[voice] user audio segment';
        this.processUserText(fakeText).catch((e) => {
          this.emitUI({ type: 'assistant.error', message: e instanceof Error ? e.message : String(e) });
        });
      }
    };

    this.emitUI({ type: 'recording.started' });
  }

  stopRecording() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = undefined;
      this.emitUI({ type: 'recording.stopped' });
    }
  }

  private concatBuffers(chunks: Float32Array[]): Float32Array {
    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Float32Array(total);
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.length; }
    return out;
  }

  async connectRealtime() {
    if (this.pc) return;

    // Acquire ephemeral key from your backend (Edge Function/Server), trying multiple candidates.
    const tokenJson = await this.fetchJsonFirst({ userId: this.currentUserId || 'anonymous', roomId: 'default' });
    const EPHEMERAL_KEY = this.extractEphemeralKey(tokenJson);
    if (!EPHEMERAL_KEY) throw new Error('Token endpoint JSON missing client_secret.value/token');

    this.pc = new RTCPeerConnection();
    this.pc.onconnectionstatechange = () => {
      const s = this.pc!.connectionState;
      this.connected = (s === 'connected');
      this.emitConn(s);
    };

    // Mic
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.micStream!));

    // Remote audio
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    this.audioEl = audioEl;
    this.pc.ontrack = (e) => { this.audioEl!.srcObject = e.streams[0]; };

    // Data channel
    this.dc = this.pc.createDataChannel('oai-events');
    this.dc.onmessage = (ev) => { this.emitUI({ type: 'oai.message', raw: ev.data }); };

    // SDP exchange
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    if (!offer.sdp) throw new Error('Failed to create SDP offer.');
    const resp = await fetch(`${(RTC_URL || 'https://api.openai.com/v1/realtime')}?model=${this.config.model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    });
    if (!resp.ok) throw new Error(`Realtime connect failed: ${resp.status} ${resp.statusText}`);

    await this.pc.setRemoteDescription({ type: 'answer', sdp: await resp.text() });
    this.emitUI({ type: 'realtime.connected' });
  }

  async disconnectRealtime() {
    if (this.pc) {
      this.pc.close();
      this.pc = undefined;
      this.dc = undefined;
      this.emitUI({ type: 'realtime.disconnected' });
    }
    this.stopRecording();
    this.stopWakeWordDetection();
    this.connected = false;
    this.audioEl = undefined;
  }

  async processUserText(message: string) {
    try {
      const result = await aiAssistantService.processUserMessage(message, this.currentUserId!);
      this.emitUI({ type: 'assistant.action', data: result });
    } catch (e: unknown) {
      this.emitUI({ type: 'assistant.error', message: (e instanceof Error ? e.message : String(e)) || 'Action failed' });
    }
  }
}

export const openaiRealtimeService = new OpenAIRealtimeService({
  model: 'gpt-4o-realtime-preview',
  wakeWord: 'hey sara',
  vadThreshold: 0.03,
  voice: 'alloy',
  instructions: 'You are Sara, a helpful AI assistant embedded in a family organizer app.'
});

export default openaiRealtimeService;