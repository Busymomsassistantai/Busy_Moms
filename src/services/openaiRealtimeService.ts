// OpenAI Realtime API service using WebRTC
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
  private config: OpenAIRealtimeConfig;
  private onEventCb?: (event: RealtimeEvent) => void;
  private onConnStateCb?: (state: RTCPeerConnectionState) => void;
  private wakeWordDetection: boolean = false;
  private isListeningForWakeWord: boolean = false;
  private wakeWordRecognition: SpeechRecognition | null = null;
  private onWakeWordDetectedCb?: () => void;

  constructor(config: OpenAIRealtimeConfig = {}) {
    this.config = {
      model: 'gpt-4o-mini-tts',         // ✅ current model
      voice: 'onyx',
      speed: '2.0',
      wakeWord: 'Hey Sarah',
      instructions: `You are a helpful AI assistant for busy parents in the "Busy Moms Assistant" app.
Keep responses concise, practical, empathetic, and actionable. Speak in a cheerful and positive tone.`,
      ...config,
    };
    
    // Initialize wake word detection
    this.initializeWakeWordDetection();
  }

  static isSupported(): boolean {
    return !!(window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia);
  }

  private initializeWakeWordDetection() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.wakeWordRecognition = new SpeechRecognition();
      
      this.wakeWordRecognition.continuous = true;
      this.wakeWordRecognition.interimResults = false;
      this.wakeWordRecognition.lang = 'en-US';
      
      this.wakeWordRecognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        console.log('🎤 Wake word detection heard:', transcript);
        
        if (transcript.includes(this.config.wakeWord?.toLowerCase() || 'hey sarah')) {
          console.log('✅ Wake word detected!');
          this.onWakeWordDetected();
        }
      };
      
      this.wakeWordRecognition.onerror = (event) => {
        console.error('Wake word recognition error:', event.error);
        // Restart wake word detection on error
        setTimeout(() => this.startWakeWordDetection(), 1000);
      };
      
      this.wakeWordRecognition.onend = () => {
        // Restart wake word detection if it stops
        if (this.wakeWordDetection && this.isListeningForWakeWord) {
          setTimeout(() => this.startWakeWordDetection(), 100);
        }
      };
    }
  }

  private onWakeWordDetected() {
    this.onWakeWordDetectedCb?.();
    // Temporarily stop wake word detection while in conversation
    this.stopWakeWordDetection();
  }

  startWakeWordDetection() {
    if (this.wakeWordRecognition && !this.isListeningForWakeWord) {
      try {
        this.wakeWordDetection = true;
        this.isListeningForWakeWord = true;
        this.wakeWordRecognition.start();
        console.log('🎤 Started listening for wake word:', this.config.wakeWord);
      } catch (error) {
        console.error('Failed to start wake word detection:', error);
      }
    }
  }

  stopWakeWordDetection() {
    if (this.wakeWordRecognition && this.isListeningForWakeWord) {
      try {
        this.wakeWordDetection = false;
        this.isListeningForWakeWord = false;
        this.wakeWordRecognition.stop();
        console.log('🔇 Stopped listening for wake word');
      } catch (error) {
        console.error('Failed to stop wake word detection:', error);
      }
    }
  }

  onWakeWordDetected(callback: () => void) {
    this.onWakeWordDetectedCb = callback;
  }

  isListeningForWakeWord(): boolean {
    return this.isListeningForWakeWord;
  }

  async initialize(userId: string): Promise<void> {
    // 1) Get ephemeral token from your (server-side) function
    const tokenResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, sessionId: `session-${Date.now()}` }),
    });

    if (!tokenResp.ok) {
      const t = await tokenResp.text().catch(() => '');
      throw new Error(`Failed to get OpenAI token: ${t || tokenResp.status}`);
    }
    const tokenJson = await tokenResp.json();
    if (tokenJson.demo) {
      throw new Error('OpenAI API key not configured on server. Configure it to enable voice chat.');
    }
    const EPHEMERAL_KEY: string = tokenJson.value || tokenJson.client_secret || tokenJson.clientSecret;

    // 2) Build RTCPeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Remote audio
    this.audioEl = document.createElement('audio');
    this.audioEl.autoplay = true;

    this.pc.ontrack = (e) => {
      if (this.audioEl) this.audioEl.srcObject = e.streams[0];
    };

    // Receive audio from model
    this.pc.addTransceiver('audio', { direction: 'recvonly' });

    // Mic
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const [micTrack] = this.micStream.getAudioTracks();
    this.pc.addTrack(micTrack, this.micStream);

    // Data channel: let the server create it, we listen here
    this.pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this.setupDataChannelHandlers();
    };

    // Connection state
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState || 'closed';
      this.connected = state === 'connected';
      this.onConnStateCb?.(state);
    };

    // 3) Offer → /realtime/calls → Answer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const res = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(this.config.model!)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        'Content-Type': 'application/sdp',
        'OpenAI-Beta': 'realtime=v1', // ✅ required
      },
      body: offer.sdp,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI Realtime API error: ${res.status} ${res.statusText}\n${body}`);
    }

    const answerSdp = await res.text();
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    // 4) Send initial session settings
    this.sendEvent({
      type: 'session.update',
      session: {
        voice: this.config.voice,
        instructions: this.config.instructions,
        turn_detection: {
          type: 'none', // Disable automatic voice detection
        },
      },
    });
    
    // Start wake word detection after initialization
    this.startWakeWordDetection();
  }

  private setupDataChannelHandlers() {
    if (!this.dc) return;

    this.dc.onopen = () => {
      // console.log('📡 oai-events channel open');
    };

    this.dc.onmessage = (ev) => {
      try {
        const evt = JSON.parse(ev.data);
        this.onEventCb?.(evt);
      } catch (e) {
        // console.warn('bad event', e);
      }
    };

    this.dc.onerror = (e) => {
      // console.error('dc error', e);
    };

    this.dc.onclose = () => {
      // console.log('📡 oai-events channel closed');
    };
  }

  // === Public API ===
  onEvent(cb: (event: RealtimeEvent) => void) {
    this.onEventCb = cb;
  }

  offEvent(cb: (event: RealtimeEvent) => void) {
    if (this.onEventCb === cb) this.onEventCb = undefined;
  }

  onConnectionStateChange(cb: (state: RTCPeerConnectionState) => void) {
    this.onConnStateCb = cb;
  }

  sendEvent(event: RealtimeEvent): void {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(event));
    }
  }

  sendMessage(text: string): void {
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    this.sendEvent({ type: 'response.create' });
  }

  startConversation(): void {
    // Enable voice activity detection for the conversation
    this.sendEvent({
      type: 'session.update',
      session: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000,
        },
      },
    });
    this.sendEvent({ type: 'input_audio_buffer.commit' });
  }

  stopConversation(): void {
    // Disable voice activity detection
    this.sendEvent({
      type: 'session.update',
      session: {
        turn_detection: {
          type: 'none',
        },
      },
    });
    this.sendEvent({ type: 'input_audio_buffer.clear' });
    // Restart wake word detection
    setTimeout(() => this.startWakeWordDetection(), 500);
  }

  interrupt(): void {
    this.sendEvent({ type: 'response.cancel' });
  }

  async mute() {
    this.micStream?.getAudioTracks().forEach(t => (t.enabled = false));
  }

  async unmute() {
    this.micStream?.getAudioTracks().forEach(t => (t.enabled = true));
  }

  isRealtimeConnected(): boolean {
    return this.connected;
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audioEl;
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.pc?.connectionState || null;
  }

  disconnect(): void {
    try {
      this.stopWakeWordDetection();
      this.micStream?.getTracks().forEach(t => t.stop());
      this.micStream = null;
      this.dc?.close();
      this.dc = null;
      this.pc?.close();
      this.pc = null;
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.srcObject = null;
        this.audioEl = null;
      }
    } finally {
      this.connected = false;
    }
  }
}

// Singleton
export const openaiRealtimeService = new OpenAIRealtimeService();
