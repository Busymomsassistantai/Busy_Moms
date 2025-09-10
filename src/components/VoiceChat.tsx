import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Volume2, VolumeX, Users, X } from 'lucide-react';
import { webrtcService } from '../services/webrtcService';
import { useAuth } from '../hooks/useAuth';

interface VoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
}

export function VoiceChat({ isOpen, onClose, roomId = 'family-chat' }: VoiceChatProps) {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [error, setError] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize WebRTC when component opens
  useEffect(() => {
    if (isOpen && user) {
      initializeConnection();
    }
    
    return () => {
      if (isOpen) {
        cleanup();
      }
    };
  }, [isOpen, user]);

  const initializeConnection = async () => {
    if (!user) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      // Check WebRTC support
      if (!webrtcService.constructor.isSupported()) {
        throw new Error('WebRTC is not supported in this browser');
      }

      // Initialize peer connection with audio by default
      await webrtcService.initializePeerConnection({
        audio: true,
        video: isVideoEnabled,
        dataChannel: true
      });

      // Set up event handlers
      webrtcService.onRemoteStream((stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      });

      webrtcService.onConnectionStateChange((state) => {
        setConnectionState(state);
        setIsConnected(state === 'connected');
      });

      webrtcService.onDataChannelMessage((message) => {
        console.log('📨 Received message:', message);
        // Handle incoming messages (could be used for text chat)
      });

      // Get local stream for preview
      const localStream = webrtcService.getLocalStream();
      if (localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        localStreamRef.current = localStream;
      }

      console.log('✅ WebRTC initialized successfully');
    } catch (error) {
      console.error('❌ WebRTC initialization failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize voice chat');
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = async () => {
    try {
      if (isVideoEnabled) {
        // Turn off video
        if (localStreamRef.current) {
          const videoTracks = localStreamRef.current.getVideoTracks();
          videoTracks.forEach(track => track.stop());
        }
        setIsVideoEnabled(false);
      } else {
        // Turn on video
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        
        if (localStreamRef.current && videoTrack) {
          localStreamRef.current.addTrack(videoTrack);
          
          // Add to peer connection if connected
          const pc = webrtcService['peerConnection'];
          if (pc) {
            pc.addTrack(videoTrack, localStreamRef.current);
          }
        }
        
        setIsVideoEnabled(true);
      }
    } catch (error) {
      console.error('❌ Failed to toggle video:', error);
      setError('Failed to access camera');
    }
  };

  const endCall = () => {
    cleanup();
    onClose();
  };

  const cleanup = () => {
    webrtcService.disconnect();
    localStreamRef.current = null;
    setIsConnected(false);
    setConnectionState('closed');
  };

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'disconnected':
      case 'failed':
      case 'closed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionState) {
      case 'new': return 'Initializing...';
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'failed': return 'Connection failed';
      case 'closed': return 'Connection closed';
      default: return 'Unknown';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Family Voice Chat</h3>
              <p className={`text-sm ${getConnectionStatusColor()}`}>
                {getConnectionStatusText()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Video Area */}
        <div className="flex-1 bg-gray-900 relative">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            style={{ display: isConnected ? 'block' : 'none' }}
          />
          
          {/* Local Video Preview */}
          <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
              You
            </div>
          </div>

          {/* Connection Status Overlay */}
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                {isConnecting ? (
                  <>
                    <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg">Connecting to family chat...</p>
                  </>
                ) : error ? (
                  <>
                    <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <X className="w-8 h-8" />
                    </div>
                    <p className="text-lg mb-2">Connection Error</p>
                    <p className="text-sm text-gray-300">{error}</p>
                    <button
                      onClick={initializeConnection}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Retry Connection
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8" />
                    </div>
                    <p className="text-lg">Ready to connect</p>
                    <p className="text-sm text-gray-300">Waiting for family members to join...</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-gray-50 flex items-center justify-center space-x-4">
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isMuted 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isVideoEnabled 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={endCall}
            className="w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            title="End call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Users className="w-4 h-4" />
            <span>Room: {roomId}</span>
          </div>
        </div>

        {/* WebRTC Not Supported Warning */}
        {!webrtcService.constructor.isSupported() && (
          <div className="p-4 bg-yellow-50 border-t border-yellow-200">
            <p className="text-sm text-yellow-800">
              ⚠️ WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}