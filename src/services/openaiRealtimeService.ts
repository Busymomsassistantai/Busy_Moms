// OpenAI Realtime API service using WebRTC
import { aiAssistantService } from './aiAssistantService';

// Local fallbacks for browsers/TS configs that don't include these in lib.dom.d.ts
// If your project already includes proper DOM speech types, you can remove these aliases.
type SpeechRecognition = any;
type SpeechRecognitionEvent = any;
type SpeechRecognitionErrorEvent = any;

export interface OpenAIRealtimeConfig {
model?: string;
voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
instructions?: string;
wakeWord?: string;
}

export interface RealtimeEvent {
type: string;
[key: string]: any;
}

export class OpenAIRealtimeService {
private pc: RTCPeerConnection | null = null;
private dc: RTCDataChannel | null = null;
private audioEl: HTMLAudioElement | null = null;
private micStream: MediaStream | null = null;
private connected = false;
private config: OpenAIRealtimeConfig = {};
private onEventCb?: (event: RealtimeEvent) => void;
private onConnStateCb?: (state: RTCPeerConnectionState) => void;

// Wake word detection state
private wakeWordDetection = false;
private isListeningForWakeWordFlag = false; // renamed to avoid method/property collision
private wakeWordRecognition: SpeechRecognition | null = null;
private onWakeWordDetectedCb?: () => void;

private currentUserId: string | null = null;

constructor(config: OpenAIRealtimeConfig = {}) {
this.config = {
model: 'gpt-4o-realtime-preview',
voice: 'alloy',
instructions: `You are Sara, a helpful AI assistant embedded in a family organizer app.

Keep replies short and actionable.

When the user asks for reminders, events, shopping, or tasks, respond with a concise confirmation.

DO NOT produce code fences or markdown unless asked.`,
...config,
};
}

onEvent(cb: (event: RealtimeEvent) => void) {
this.onEventCb = cb;
}

onConnectionStateChange(cb: (state: RTCPeerConnectionState) => void) {
this.onConnStateCb = cb;
}

private emit(event: RealtimeEvent) {
try {
this.onEventCb?.(event);
} catch (e) {
// eslint-disable-next-line no-console
console.error('onEvent callback error:', e);
}
}

private emitConn(state: RTCPeerConnectionState) {
try {
this.onConnStateCb?.(state);
} catch (e) {
// eslint-disable-next-line no-console
console.error('onConnectionStateChange callback error:', e);
}
}

private startWakeWordDetection() {
try {
const hasSpeech =
typeof window !== 'undefined' &&
(('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window));

if (!hasSpeech) {
  // eslint-disable-next-line no-console
  console.warn('SpeechRecognition is not supported in this browser.');
  return;
}

const SpeechRecognitionCtor =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

this.wakeWordRecognition = new SpeechRecognitionCtor();
this.wakeWordRecognition.continuous = true;
this.wakeWordRecognition.interimResults = false;
this.wakeWordRecognition.lang = 'en-US';
const wakeWord = (this.config.wakeWord || 'sara').toLowerCase();

this.wakeWordRecognition.onresult = (event: SpeechRecognitionEvent) => {
  const results = (event as any).results || [];
  if (!results || !results.length) return;
  const transcript = results[results.length - 1][0].transcript.toLowerCase();
  if (typeof transcript === 'string' && transcript.includes(wakeWord)) {
    this.onWakeWordDetectedCb?.();
  }
};

this.wakeWordRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
  // eslint-disable-next-line no-console
  console.error('Wake word recognition error:', event);
};

this.wakeWordRecognition.onend = () => {
  if (this.isListeningForWakeWordFlag) {
    // Restart listening if it was stopped unexpectedly
    this.startWakeWordDetection();
  }
};

this.wakeWordRecognition.start();
this.isListeningForWakeWordFlag = true;
this.wakeWordDetection = true;
// eslint-disable-next-line no-console
console.log('🎤 Wake word detection started');


} catch (error) {
// eslint-disable-next-line no-console
console.error('Failed to start wake word detection:', error);
}
}

private stopWakeWordDetection() {
if (this.wakeWordRecognition) {
try {
this.wakeWordDetection = false;
this.isListeningForWakeWordFlag = false;
this.wakeWordRecognition.stop();
// eslint-disable-next-line no-console
console.log('🔇 Stopped listening for wake word');
} catch (error) {
// eslint-disable-next-line no-console
console.error('Failed to stop wake word detection:', error);
}
}
}

onWakeWordDetected(callback: () => void) {
this.onWakeWordDetectedCb = callback;
}

isListeningForWakeWord(): boolean {
return this.isListeningForWakeWordFlag;
}

async initialize(userId: string): Promise<void> {
this.currentUserId = userId;

// 1) Get ephemeral token from your (server-side) function
let tokenResp: Response;
try {
const baseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!baseUrl || !anonKey) {
  throw new Error('Realtime not configured: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

tokenResp = await fetch(`${baseUrl}/functions/v1/openai-token`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ userId, sessionId: `session-${Date.now()}` }),
});


} catch (e) {
throw new Error('Realtime not configured: missing openai-token Edge Function');
}

if (!tokenResp.ok) {
throw new Error(Failed to get ephemeral key: ${tokenResp.status});
}
const payload = await tokenResp.json().catch(() => ({}));
const EPHEMERAL_KEY = payload?.EPHEMERAL_KEY;
const RTC_URL = payload?.RTC_URL;

if (!EPHEMERAL_KEY) {
throw new Error('Failed to get ephemeral key: missing EPHEMERAL_KEY in response');
}

// 2) Create RTCPeerConnection & DataChannel
this.pc = new RTCPeerConnection({
iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});
this.dc = this.pc.createDataChannel('oai-events');
this.setupDataChannelHandlers();

// 3) Set up audio element
this.audioEl = new Audio();
this.audioEl.autoplay = true;

// 4) Local mic capture
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
throw new Error('Microphone access is not supported in this browser/environment.');
}
this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
this.micStream.getTracks().forEach(track => this.pc!.addTrack(track, this.micStream!));

// 5) Remote track
this.pc.ontrack = (e) => {
if (this.audioEl) this.audioEl.srcObject = e.streams[0];
};

// 6) ICE/connection state
this.pc.oniceconnectionstatechange = () => {
const state = this.pc!.iceConnectionState;
if (state === 'connected') this.connected = true;
if (state === 'disconnected' || state === 'failed') this.connected = false;
this.emitConn(this.pc!.connectionState);
};

// 7) Signal to OAI Realtime server
const offer = await this.pc.createOffer();
await this.pc.setLocalDescription(offer);

const resp = await fetch(${(RTC_URL || 'https://api.openai.com/v1/realtime')}?model=${this.config.model}, {
method: 'POST',
headers: {
Authorization: Bearer ${EPHEMERAL_KEY},
'Content-Type': 'application/sdp',
},
body: offer.sdp as any,
});

const answer = {
type: 'answer',
sdp: await resp.text(),
} as RTCSessionDescriptionInit;

await this.pc.setRemoteDescription(answer);

// 8) Send session meta (instructions, TTS voice, etc)
this.dc?.send(JSON.stringify({
type: 'session.update',
session: {
instructions: this.config.instructions,
voice: this.config.voice,
input_audio_format: 'pcm16',
output_audio_format: 'pcm16',
// Keep the model conversational for voice, but deterministic for actions
modalities: ['text', 'audio'],
// Examples of how Sara should respond
system_prompt_examples: `You are Sara. Keep confirmations terse:

"Added an event for 3pm tomorrow."

"Reminder set for 8:00 AM."

"Added milk to the shopping list."

"Task created for Jake due tomorrow."

"Marked bread as completed on the shopping list."`,
turn_detection: {
type: 'none', // Disable automatic voice detection
},
},
}));

// Start wake word detection after initialization
this.startWakeWordDetection();
}

private setupDataChannelHandlers() {
if (!this.dc) return;
this.dc.onmessage = async (evt) => {
try {
const msg = JSON.parse(evt.data);
this.emit(msg);
} catch (_e) {
// eslint-disable-next-line no-console
console.warn('Non-JSON data message:', evt.data);
}
};
}

async disconnect() {
try {
this.stopWakeWordDetection();
this.dc?.close();
this.pc?.close();
this.micStream?.getTracks().forEach(t => t.stop());
} finally {
this.dc = null;
this.pc = null;
this.audioEl = null;
this.micStream = null;
this.connected = false;
this.emitConn('disconnected' as RTCPeerConnectionState);
}
}

isSupported(): boolean {
return typeof RTCPeerConnection !== 'undefined';
// Note: you may also want to check for microphone permissions elsewhere.
}

isConnected(): boolean {
return this.connected;
}

/** Helper to let Sara write to the DB using the same logic as text chat. */
async handleTextAsCommand(message: string) {
if (!this.currentUserId) return;
try {
const result = await aiAssistantService.processUserMessage(message, this.currentUserId as any);
this.emit({ type: 'assistant.result', result });
} catch (e: any) {
this.emit({ type: 'assistant.error', message: e?.message || 'Action failed' });
}
}
}

export const openaiRealtimeService = new OpenAIRealtimeService();