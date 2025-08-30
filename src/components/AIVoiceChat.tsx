import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, MessageCircle, X, Loader2, Phone, PhoneOff } from 'lucide-react';
import { openaiRealtimeService, RealtimeEvent } from '../services/openaiRealtimeService';
import { useAuth } from '../hooks/useAuth';

interface AIVoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIVoiceChat({ isOpen, onClose }: AIVoiceChatProps) {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<RealtimeEvent[]>([]);
  const [currentResponse, setCurrentResponse] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize OpenAI Realtime when component opens
  useEffect(() => {
    if (isOpen && user) {
      initializeRealtimeConnection();
    }
    
    return () => {
      if (isOpen) {
        cleanup();
      }
    };
  }, [isOpen, user]);

  const initializeRealtimeConnection = async () => {
    if (!user) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      // Check WebRTC support
      if (!openaiRealtimeService.constructor.isSupported()) {
        throw new Error('WebRTC is not supported in this browser');
      }

      // Initialize OpenAI Realtime connection
      await openaiRealtimeService.initialize();

      // Set up event handlers
      openaiRealtimeService.onEvent((event) => {
        handleRealtimeEvent(event);
      });

      openaiRealtimeService.onConnectionStateChange((state) => {
        setConnectionState(state);
        setIsConnected(state === 'connected');
      });

      // Get audio element for playback
      const audioElement = openaiRealtimeService.getAudioElement();
      if (audioElement) {
        audioRef.current = audioElement;
      }

      console.log('✅ OpenAI Realtime initialized successfully');
    } catch (error) {
      console.error('❌ OpenAI Realtime initialization failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize AI voice chat');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRealtimeEvent = (event: RealtimeEvent) => {
    console.log('📨 Realtime event:', event.type, event);
    
    setConversation(prev => [...prev, event]);

    switch (event.type) {
      case 'session.created':
        console.log('✅ Session created');
        break;
        
      case 'session.updated':
        console.log('✅ Session updated');
        break;
        
      case 'conversation.item.created':
        if (event.item?.role === 'assistant') {
          console.log('🤖 Assistant message created');
        }
        break;
        
      case 'response.audio.delta':
        // Audio is handled automatically by WebRTC
        break;
        
      case 'response.text.delta':
        if (event.delta) {
          setCurrentResponse(prev => prev + event.delta);
        }
        break;
        
      case 'response.done':
        console.log('✅ Response completed');
        setCurrentResponse('');
        break;
        
      case 'input_audio_buffer.speech_started':
        setIsListening(true);
        console.log('🎤 Speech started');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        setIsListening(false);
        console.log('🎤 Speech stopped');
        break;
        
      case 'error':
        console.error('❌ OpenAI Realtime error:', event.error);
        setError(event.error?.message || 'An error occurred');
        break;
    }
  };

  const sendTextMessage = (text: string) => {
    if (!isConnected) {
      setError('Not connected to AI. Please wait for connection.');
      return;
    }
    
    openaiRealtimeService.sendMessage(text);
    
    // Add user message to conversation display
    setConversation(prev => [...prev, {
      type: 'user_message',
      content: text,
      timestamp: Date.now()
    }]);
  };

  const toggleMute = () => {
    if (openaiRealtimeService['localStream']) {
      const audioTracks = openaiRealtimeService['localStream'].getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const startVoiceConversation = () => {
    if (isConnected) {
      openaiRealtimeService.startConversation();
    }
  };

  const stopVoiceConversation = () => {
    if (isConnected) {
      openaiRealtimeService.stopConversation();
    }
  };

  const interruptAI = () => {
    if (isConnected) {
      openaiRealtimeService.interrupt();
    }
  };

  const cleanup = () => {
    openaiRealtimeService.disconnect();
    setIsConnected(false);
    setConnectionState('closed');
    setConversation([]);
    setCurrentResponse('');
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
      case 'connecting': return 'Connecting to AI...';
      case 'connected': return 'Connected to AI';
      case 'disconnected': return 'Disconnected';
      case 'failed': return 'Connection failed';
      case 'closed': return 'Connection closed';
      default: return 'Unknown';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Voice Assistant</h3>
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

        {/* Conversation Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Connection Status */}
          {!isConnected && (
            <div className="text-center py-8">
              {isConnecting ? (
                <>
                  <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
                  <p className="text-lg text-gray-700">Connecting to AI Assistant...</p>
                  <p className="text-sm text-gray-500">Setting up real-time voice connection</p>
                </>
              ) : error ? (
                <>
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-lg text-red-600 mb-2">Connection Error</p>
                  <p className="text-sm text-gray-600 mb-4">{error}</p>
                  <button
                    onClick={initializeRealtimeConnection}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    Retry Connection
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-lg text-gray-700">Ready to connect</p>
                  <p className="text-sm text-gray-500">Click the microphone to start talking</p>
                </>
              )}
            </div>
          )}

          {/* Conversation Display */}
          {isConnected && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                <p className="text-purple-800 font-medium">
                  🎤 Voice conversation active! Just start talking - I can hear you and will respond with voice.
                </p>
              </div>

              {/* Live Response */}
              {currentResponse && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">AI is responding:</span> {currentResponse}
                  </p>
                </div>
              )}

              {/* Listening Indicator */}
              {isListening && (
                <div className="bg-green-50 p-3 rounded-lg flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-sm text-green-800 font-medium">Listening...</p>
                </div>
              )}

              {/* Quick Text Input */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-3">Or type a message:</p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          sendTextMessage(input.value.trim());
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                      if (input?.value.trim()) {
                        sendTextMessage(input.value.trim());
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-gray-50 flex items-center justify-center space-x-4">
          <button
            onClick={toggleMute}
            disabled={!isConnected}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isMuted 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } disabled:opacity-50`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={startVoiceConversation}
            disabled={!isConnected}
            className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors disabled:opacity-50"
            title="Start voice conversation"
          >
            <Phone className="w-5 h-5" />
          </button>

          <button
            onClick={interruptAI}
            disabled={!isConnected}
            className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center hover:bg-orange-600 transition-colors disabled:opacity-50"
            title="Interrupt AI response"
          >
            <PhoneOff className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <MessageCircle className="w-4 h-4" />
            <span>Real-time AI Voice</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 border-t border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">How to use:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Click the green phone button to start voice conversation</li>
            <li>• Just start talking - the AI will hear you and respond with voice</li>
            <li>• Use the orange button to interrupt the AI if needed</li>
            <li>• Mute your microphone with the red button</li>
            <li>• You can also type messages in the text input above</li>
          </ul>
        </div>

        {/* WebRTC Not Supported Warning */}
        {!openaiRealtimeService.constructor.isSupported() && (
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