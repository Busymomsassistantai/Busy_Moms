// OpenAI Realtime API service using WebRTC
import { aiAssistantService } from './aiAssistantService';

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
  private currentUserId: string | null = null;

  constructor(config: OpenAIRealtimeConfig = {}) {
    this.config = {
      model: 'gpt-4o-mini-tts',         // ✅ current model
      voice: 'onyx',
      speed: '3.0',
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
    this.currentUserId = userId;
    
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
        instructions: `${this.config.instructions}

You can help users with:
1. Calendar management - creating events, viewing schedule
2. Reminders - setting up tasks and notifications  
3. Shopping lists - adding items, viewing lists
4. General assistance - answering questions

When users ask you to perform actions like "add to calendar", "remind me", or "add to shopping list", 
you should acknowledge the request and let them know you're processing it. Keep responses conversational and helpful.

For shopping list commands specifically:
- When someone says "add [item] to shopping list" or "I need to buy [item]", confirm you're adding it
- When someone asks "what's on my shopping list" or "show my shopping list", let them know you're checking
- When someone says "remove [item]" or "mark [item] as bought", confirm the action
- Always be specific about what item you're adding/removing/checking

Examples:
- "I'll add milk to your shopping list right away!"
- "Let me check what's on your shopping list for you."
- "I've marked bread as completed on your shopping list."`,
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
        this.handleRealtimeEvent(evt);
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

  private async handleRealtimeEvent(event: RealtimeEvent) {
    // Handle specific events that might contain shopping list commands
    if (event.type === 'conversation.item.created' && event.item?.role === 'user') {
      const userMessage = event.item.content?.[0]?.text;
      if (userMessage && this.currentUserId) {
        // Check if this is a shopping list command
        if (this.isShoppingListCommand(userMessage)) {
          try {
            const result = await aiAssistantService.processUserMessage(userMessage, this.currentUserId);
            console.log('🛒 Shopping list action processed:', result);
          } catch (error) {
            console.error('Error processing shopping list command:', error);
          }
        }
      }
    }
  }

  private isShoppingListCommand(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    const shoppingKeywords = [
      'add to shopping list',
      'shopping list',
      'buy',
      'need to get',
      'pick up',
      'grocery',
      'groceries',
      'milk',
      'bread',
      'eggs',
      'remove from shopping',
      'delete from shopping',
      'mark as bought',
      'completed shopping'
    ];
    
    return shoppingKeywords.some(keyword => lowerMessage.includes(keyword));
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

  async sendVoiceCommand(command: string): Promise<void> {
    if (this.currentUserId) {
      try {
        const result = await aiAssistantService.processUserMessage(command, this.currentUserId);
        
        // If it's a shopping list action, handle it specially
        if (result.type === 'shopping' && result.success) {
          // Send a confirmation message to the AI for voice output
          this.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'input_text', text: result.message }],
            },
          });
          this.sendEvent({ type: 'response.create' });
        } else {
          // For other actions, let the AI handle the response naturally
          this.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: command }],
            },
          });
          this.sendEvent({ type: 'response.create' });
        }
      } catch (error) {
        console.error('Error processing voice command:', error);
        // Send error message to AI for voice output
        this.sendEvent({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'input_text', text: "I had trouble processing that request. Could you try again?" }],
          },
        });
        this.sendEvent({ type: 'response.create' });
      }
    }
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
import { aiAssistantService } from './aiAssistantService';
