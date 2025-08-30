// WebRTC service for real-time communication
export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  apiToken?: string;
}

export interface PeerConnectionOptions {
  audio?: boolean;
  video?: boolean;
  dataChannel?: boolean;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private config: WebRTCConfig;
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onDataChannelMessageCallback?: (message: string) => void;
  private onConnectionStateChangeCallback?: (state: RTCPeerConnectionState) => void;

  constructor(config: WebRTCConfig) {
    this.config = config;
  }

  // Initialize peer connection with ephemeral token
  async initializePeerConnection(options: PeerConnectionOptions = {}): Promise<RTCPeerConnection> {
    try {
      // Get ephemeral token from our edge function
      const tokenResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webrtc-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: crypto.randomUUID(),
          roomId: 'family-chat'
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get WebRTC token');
      }

      const tokenData = await tokenResponse.json();
      
      // Create peer connection with ICE servers from token response
      const rtcConfig: RTCConfiguration = {
        iceServers: tokenData.iceServers || [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      this.peerConnection = new RTCPeerConnection(rtcConfig);

      // Set up event handlers
      this.setupPeerConnectionHandlers();

      // Set up media streams if requested
      if (options.audio || options.video) {
        await this.setupMediaStreams(options);
      }

      // Set up data channel if requested
      if (options.dataChannel) {
        this.setupDataChannel();
      }

      console.log('✅ WebRTC peer connection initialized');
      return this.peerConnection;
    } catch (error) {
      console.error('❌ Failed to initialize WebRTC:', error);
      throw error;
    }
  }

  private setupPeerConnectionHandlers() {
    if (!this.peerConnection) return;

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('📺 Received remote stream');
      this.remoteStream = event.streams[0];
      this.onRemoteStreamCallback?.(this.remoteStream);
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated');
        // In a real app, you'd send this to the remote peer via signaling server
        this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔗 Connection state changed:', state);
      this.onConnectionStateChangeCallback?.(state || 'closed');
    };

    // Handle data channel from remote peer
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (event) => {
        console.log('📨 Data channel message received:', event.data);
        this.onDataChannelMessageCallback?.(event.data);
      };
    };
  }

  private async setupMediaStreams(options: PeerConnectionOptions) {
    try {
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: options.audio || false,
        video: options.video || false
      });

      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      console.log('🎤 Local media stream set up');
    } catch (error) {
      console.error('❌ Failed to get user media:', error);
      throw new Error('Failed to access camera/microphone. Please check permissions.');
    }
  }

  private setupDataChannel() {
    if (!this.peerConnection) return;

    this.dataChannel = this.peerConnection.createDataChannel('familyChat', {
      ordered: true
    });

    this.dataChannel.onopen = () => {
      console.log('📡 Data channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      console.log('📨 Data channel message:', event.data);
      this.onDataChannelMessageCallback?.(event.data);
    };

    this.dataChannel.onerror = (error) => {
      console.error('❌ Data channel error:', error);
    };
  }

  // Create offer for initiating connection
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      console.log('📤 Created offer');
      return offer;
    } catch (error) {
      console.error('❌ Failed to create offer:', error);
      throw error;
    }
  }

  // Create answer for responding to connection
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('📥 Created answer');
      return answer;
    } catch (error) {
      console.error('❌ Failed to create answer:', error);
      throw error;
    }
  }

  // Handle remote answer
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(answer);
      console.log('✅ Remote answer set');
    } catch (error) {
      console.error('❌ Failed to handle answer:', error);
      throw error;
    }
  }

  // Handle ICE candidate
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.addIceCandidate(candidate);
      console.log('🧊 ICE candidate added');
    } catch (error) {
      console.error('❌ Failed to add ICE candidate:', error);
      throw error;
    }
  }

  // Send message via data channel
  sendMessage(message: string): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
      console.log('📤 Message sent via data channel:', message);
    } else {
      console.warn('⚠️ Data channel not ready');
    }
  }

  // Get local stream for UI
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream for UI
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Event handlers
  onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  onDataChannelMessage(callback: (message: string) => void) {
    this.onDataChannelMessageCallback = callback;
  }

  onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateChangeCallback = callback;
  }

  // Signaling (in a real app, this would use WebSockets or similar)
  private sendSignalingMessage(message: any) {
    // In a real implementation, you'd send this to your signaling server
    // For demo purposes, we'll just log it
    console.log('📡 Signaling message:', message);
    
    // You could implement this using Supabase real-time subscriptions
    // or a WebSocket connection to your signaling server
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

    this.remoteStream = null;
    console.log('🔌 WebRTC connection closed');
  }

  // Check if WebRTC is supported
  static isSupported(): boolean {
    return !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // Get connection state
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }
}

// Singleton instance
export const webrtcService = new WebRTCService({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
});