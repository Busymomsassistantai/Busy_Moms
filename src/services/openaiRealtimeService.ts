// OpenAI Realtime API service using WebRTC
export interface OpenAIRealtimeConfig {
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  instructions?: string;
}

export interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export class OpenAIRealtimeService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private localStream: MediaStream | null = null;
  private isConnected: boolean = false;
  private config: OpenAIRealtimeConfig;
  private onEventCallback?: (event: RealtimeEvent) => void;
  private onConnectionStateChangeCallback?: (state: RTCPeerConnectionState) => void;

  constructor(config: OpenAIRealtimeConfig = {}) {
    this.config = {
      model: 'gpt-4o-realtime-preview',
      voice: 'alloy',
      instructions: `You are a helpful AI assistant for busy parents in the "Busy Moms Assistant" app. 
      
      You help with:
      - Managing family schedules and events
      - Shopping lists and gift suggestions  
      - Reminders and daily planning
      - Contact management
      - General parenting advice and support
      
      Keep responses concise, practical, and empathetic. Always consider the busy lifestyle of parents and provide actionable suggestions. Use a warm, supportive tone.`,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      // Get ephemeral token from our edge function
      const tokenResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: crypto.randomUUID(),
          sessionId: `session-${Date.now()}`
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get OpenAI token');
      }

      const tokenData = await tokenResponse.json();
      const EPHEMERAL_KEY = tokenData.value;

      // Create a peer connection
      this.peerConnection = new RTCPeerConnection();

      // Set up to play remote audio from the model
      this.audioElement = document.createElement("audio");
      this.audioElement.autoplay = true;
      this.peerConnection.ontrack = (e) => {
        if (this.audioElement) {
          this.audioElement.srcObject = e.streams[0];
        }
      };

      // Add local audio track for microphone input
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      this.peerConnection.addTrack(this.localStream.getTracks()[0]);

      // Set up data channel for sending and receiving events
      this.dataChannel = this.peerConnection.createDataChannel("oai-events");
      this.setupDataChannelHandlers();

      // Set up connection state monitoring
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState || 'closed';
        console.log('🔗 OpenAI Realtime connection state:', state);
        this.isConnected = state === 'connected';
        this.onConnectionStateChangeCallback?.(state);
      };

      // Start the session using the Session Description Protocol (SDP)
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime/calls";
      const model = this.config.model || "gpt-4o-realtime-preview";
      
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`OpenAI Realtime API error: ${sdpResponse.status} ${sdpResponse.statusText}`);
      }

      const answer = {
        type: "answer" as const,
        sdp: await sdpResponse.text(),
      };
      
      await this.peerConnection.setRemoteDescription(answer);

      console.log('✅ OpenAI Realtime API connected successfully');
      
      // Send initial configuration
      this.sendEvent({
        type: 'session.update',
        session: {
          voice: this.config.voice,
          instructions: this.config.instructions,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      });

    } catch (error) {
      console.error('❌ Failed to initialize OpenAI Realtime:', error);
      throw error;
    }
  }

  private setupDataChannelHandlers() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('📡 OpenAI data channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const realtimeEvent = JSON.parse(event.data);
        console.log('📨 OpenAI event received:', realtimeEvent.type);
        this.onEventCallback?.(realtimeEvent);
      } catch (error) {
        console.error('❌ Failed to parse OpenAI event:', error);
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('❌ OpenAI data channel error:', error);
    };

    this.dataChannel.onclose = () => {
      console.log('📡 OpenAI data channel closed');
    };
  }

  // Send event to OpenAI Realtime API
  sendEvent(event: RealtimeEvent): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
      console.log('📤 Sent event to OpenAI:', event.type);
    } else {
      console.warn('⚠️ OpenAI data channel not ready');
    }
  }

  // Send text message to AI
  sendMessage(text: string): void {
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      }
    });

    // Trigger response generation
    this.sendEvent({
      type: 'response.create'
    });
  }

  // Start voice conversation
  startConversation(): void {
    this.sendEvent({
      type: 'input_audio_buffer.commit'
    });
  }

  // Stop voice conversation
  stopConversation(): void {
    this.sendEvent({
      type: 'input_audio_buffer.clear'
    });
  }

  // Interrupt AI response
  interrupt(): void {
    this.sendEvent({
      type: 'response.cancel'
    });
  }

  // Event handlers
  onEvent(callback: (event: RealtimeEvent) => void) {
    this.onEventCallback = callback;
  }

  onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateChangeCallback = callback;
  }

  // Get connection state
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  // Check if connected
  isRealtimeConnected(): boolean {
    return this.isConnected;
  }

  // Get audio element for UI
  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }

  // Clean up resources
  disconnect(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }

    this.isConnected = false;
    console.log('🔌 OpenAI Realtime connection closed');
  }

  // Check if OpenAI Realtime is supported
  static isSupported(): boolean {
    return !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
}

// Singleton instance
export const openaiRealtimeService = new OpenAIRealtimeService();