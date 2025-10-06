import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, MessageCircle, X, Loader2, Phone, PhoneOff
} from 'lucide-react';
import { openaiRealtimeService, RealtimeEvent } from '../services/openaiRealtimeService';
import { aiAssistantService } from '../services/aiAssistantService';
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
  const [isWaitingForWakeWord, setIsWaitingForWakeWord] = useState(false);
  const [inConversation, setInConversation] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    if (initializingRef.current) return;

    initializingRef.current = true;
    setError(null);

    (async () => {
      try {
        setIsConnecting(true);

        // 1) Feature check
        if (typeof openaiRealtimeService.isSupported === 'function') {
          if (!openaiRealtimeService.isSupported()) {
            throw new Error('WebRTC is not supported in this browser');
          }
        }

        // 2) Wire event handlers BEFORE/AS initialize
        openaiRealtimeService.onEvent(handleRealtimeEvent);
        openaiRealtimeService.onConnectionStateChange((state) => {
          setConnectionState(state);
          setIsConnected(state === 'connected');
          if (state === 'connected') {
            setIsWaitingForWakeWord(true);
          }
        });

        // 3) Set up wake word detection
        openaiRealtimeService.onWakeWordDetected(() => {
          console.log('🎤 Wake word detected, starting conversation');
          setIsWaitingForWakeWord(false);
          setInConversation(true);
          openaiRealtimeService.startConversation?.();
        });

        // 3) Initialize (server should mint ephemeral token, set up WebRTC)
        await openaiRealtimeService.initialize(user.id);

        // 4) Audio element from service
        const audioEl = openaiRealtimeService.getAudioElement?.();
        if (audioEl) audioRef.current = audioEl;

        setError(null);
        // intentionally leave isConnecting as true until state flips via onConnectionStateChange
      } catch (e: any) {
        console.error('❌ OpenAI Realtime initialization failed:', e);
        setError(e?.message || 'Failed to initialize AI voice chat');
        setIsConnecting(false);
        initializingRef.current = false;
      }
    })();

    // Cleanup ALWAYS on unmount/close
    return () => {
      try {
        openaiRealtimeService.offEvent?.(handleRealtimeEvent);
        openaiRealtimeService.disconnect?.();
      } catch {}
      setIsConnected(false);
      setConnectionState('closed');
      setConversation([]);
      setCurrentResponse('');
      setIsListening(false);
      setIsMuted(false);
      setIsConnecting(false);
      initializingRef.current = false;
    };
  }, [isOpen, user]);

  // Flip connecting spinner if we reach a terminal state
  useEffect(() => {
    if (connectionState === 'connected' || connectionState === 'failed' || connectionState === 'closed') {
      setIsConnecting(false);
    }
  }, [connectionState]);

  const handleRealtimeEvent = (event: RealtimeEvent) => {
    // console.debug('📨 Realtime event:', event.type, event);
    setConversation(prev => [...prev, event]);

    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        break;

      case 'conversation.item.created':
        // could update UI for assistant/user items here
        break;

      case 'response.text.delta':
        if (event.delta) setCurrentResponse(prev => prev + event.delta);
        break;

      case 'response.done':
        setCurrentResponse('');
        // End conversation and return to wake word detection
        setTimeout(() => {
          setInConversation(false);
          setIsWaitingForWakeWord(true);
          openaiRealtimeService.stopConversation?.();
        }, 1000);
        break;

      case 'input_audio_buffer.speech_started':
        setIsListening(true);
        break;

      case 'input_audio_buffer.speech_stopped':
        setIsListening(false);
        break;

      case 'error':
        setError(event.error?.message || 'An error occurred');
        break;
    }
  };

  const sendTextMessage = (text: string) => {
    if (!isConnected) {
      setError('Not connected to AI. Please wait for connection.');
      return;
    }
    
    // Send message directly to OpenAI Realtime API
    // The service will handle shopping list processing internally
    openaiRealtimeService.sendMessage?.(text);
    
    setConversation(prev => [
      ...prev,
      { type: 'user_message', content: text, timestamp: Date.now() } as RealtimeEvent
    ]);
  };

  const toggleMute = async () => {
    try {
      if (!isConnected) return;
      if (isMuted) {
        await openaiRealtimeService.unmute?.();
        setIsMuted(false);
      } else {
        await openaiRealtimeService.mute?.();
        setIsMuted(true);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not toggle mute');
    }
  };

  const startVoiceConversation = () => {
    if (isConnected && !inConversation) {
      setIsWaitingForWakeWord(false);
      setInConversation(true);
      openaiRealtimeService.startConversation?.();
    }
  };

  const endConversation = () => {
    if (isConnected) {
      setInConversation(false);
      setIsWaitingForWakeWord(true);
      openaiRealtimeService.stopConversation?.();
    }
  };

  const interruptAI = () => {
    if (isConnected) openaiRealtimeService.interrupt?.();
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
      <div className="bg-theme-surface rounded-lg shadow-xl max-w-md w-full h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <MessageCircle className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="font-semibold text-gray-900">AI Voice Assistant</h3>
              <p className={`text-sm ${getConnectionStatusColor()}`}>
                {getConnectionStatusText()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-theme-secondary rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 p-4 overflow-y-auto">
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
                  <p className="text-sm text-theme-fg opacity-70 mb-4 whitespace-pre-wrap">{error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      setIsConnecting(true);
                      // re-run init
                      (async () => {
                        try {
                          await openaiRealtimeService.initialize(user!.id);
                        } catch (e: any) {
                          setError(e?.message || 'Failed to initialize AI voice chat');
                        } finally {
                          setIsConnecting(false);
                        }
                      })();
                    }}
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

          {/* Wake Word Status */}
          {isConnected && isWaitingForWakeWord && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg text-theme-fg opacity-90 mb-2">Listening for wake word</p>
              <p className="text-sm text-theme-fg opacity-60 mb-4">Say <strong>"Hey, Sarah"</strong> to start a conversation</p>
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="text-sm text-purple-800">
                  💡 The AI is waiting for you to say the wake word before it starts listening to your requests
                </p>
              </div>
            </div>
          )}

          {/* Active Conversation */}
          {isConnected && inConversation && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg text-theme-fg opacity-90 mb-2">Conversation Active</p>
              <p className="text-sm text-gray-500">I'm listening and ready to help!</p>
            </div>
          )}

          {/* Conversation Display */}
          {isConnected && inConversation && (
            <div className="space-y-4">
              {currentResponse && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">AI is responding:</span> {currentResponse}
                  </p>
                </div>
              )}

              {isListening && (
                <div className="bg-green-50 p-3 rounded-lg flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-sm text-green-800 font-medium">Listening...</p>
                </div>
              )}

              {/* Quick Text Input */}
              <div className="bg-theme-bg p-4 rounded-lg">
                <p className="text-sm text-theme-fg opacity-70 mb-3">Or type a message:</p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="flex-1 px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        const value = input.value.trim();
                        if (value) {
                          sendTextMessage(value);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.parentElement?.querySelector('input')) as HTMLInputElement | null;
                      const value = input?.value.trim();
                      if (value) {
                        sendTextMessage(value);
                        if (input) input.value = '';
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
        <div className="p-4 bg-theme-bg flex items-center justify-center space-x-4">
          <button
            onClick={toggleMute}
            disabled={!isConnected}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isMuted
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-200 text-theme-fg opacity-90 hover:bg-gray-300'
            } disabled:opacity-50`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={startVoiceConversation}
            disabled={!isConnected || inConversation}
            className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors disabled:opacity-50"
            title="Start voice conversation"
          >
            <Phone className="w-5 h-5" />
          </button>

          <button
            onClick={endConversation}
            disabled={!isConnected || !inConversation}
            className="w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50"
            title="End conversation"
          >
            <PhoneOff className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <MessageCircle className="w-4 h-4" />
            <span>
              {isWaitingForWakeWord ? 'Say "Hey, Sarah"' : inConversation ? 'In conversation' : 'Real-time AI Voice'}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border-t border-blue-200 p-4">
          <h4 className="font-medium text-blue-900 mb-2">How to use:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Say <strong>"Hey, Sarah"</strong> to activate the AI assistant</li>
            <li>• Once activated, just start talking - the AI will hear you and respond</li>
            <li>• Click the green phone button to manually start a conversation</li>
            <li>• Use the red button to end the conversation and return to wake word mode</li>
            <li>• Mute your microphone with the red button</li>
            <li>• You can also type messages in the text input above</li>
          </ul>

          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <h5 className="font-medium text-green-900 mb-1">Wake Word Active:</h5>
            <p className="text-sm text-green-800">
              The AI is now listening for "Hey, Sarah" to start conversations automatically. This prevents always-on listening while still providing hands-free activation.
            </p>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h5 className="font-medium text-yellow-900 mb-1">Setup Required:</h5>
            <p className="text-sm text-yellow-800">
              To enable voice chat, configure the server route that mints the OpenAI Realtime session and returns an ephemeral client_secret.
            </p>
          </div>
        </div>

        {/* WebRTC Not Supported Warning */}
        {typeof openaiRealtimeService.isSupported === 'function' && !openaiRealtimeService.isSupported() && (
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
