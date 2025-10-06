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
    <div className="fixed inset-0 bg-rose-900 bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-400 via-pink-400 to-orange-300 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">AI Voice Assistant</h3>
                <p className={`text-sm font-medium ${connectionState === 'connected' ? 'text-green-100' : connectionState === 'connecting' ? 'text-yellow-100' : 'text-rose-100'}`}>
                  {getConnectionStatusText()}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-opacity-30 transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-rose-50 to-white">
          {!isConnected && (
            <div className="text-center py-8">
              {isConnecting ? (
                <>
                  <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  </div>
                  <p className="text-lg font-semibold text-gray-800">Connecting to AI Assistant...</p>
                  <p className="text-sm text-gray-600">Setting up real-time voice connection</p>
                </>
              ) : error ? (
                <>
                  <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-rose-600 mb-2">Connection Error</p>
                  <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{error}</p>
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
                    className="px-6 py-3 bg-gradient-to-r from-rose-400 to-pink-400 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    Retry Connection
                  </button>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-gray-800">Ready to connect</p>
                  <p className="text-sm text-gray-600">Click the microphone to start talking</p>
                </>
              )}
            </div>
          )}

          {/* Wake Word Status */}
          {isConnected && isWaitingForWakeWord && (
            <div className="text-center py-8">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-rose-400 via-pink-400 to-orange-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse shadow-lg">
                  <Mic className="w-12 h-12 text-white" />
                </div>
                <div className="absolute inset-0 w-24 h-24 mx-auto bg-gradient-to-br from-rose-400 to-pink-400 rounded-full animate-ping opacity-20"></div>
              </div>
              <p className="text-xl font-bold text-gray-800 mb-2">Listening for wake word</p>
              <p className="text-base text-gray-600 mb-4">Say <strong className="text-rose-600">"Hey, Sarah"</strong> to start</p>
              <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-200 p-4 rounded-2xl">
                <p className="text-sm text-rose-800 font-medium">
                  💡 The AI is waiting for you to say the wake word before it starts listening to your requests
                </p>
              </div>
            </div>
          )}

          {/* Active Conversation */}
          {isConnected && inConversation && (
            <div className="text-center py-8">
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <MessageCircle className="w-12 h-12 text-white" />
              </div>
              <p className="text-xl font-bold text-gray-800 mb-2">Conversation Active</p>
              <p className="text-base text-gray-600">I'm listening and ready to help!</p>
            </div>
          )}

          {/* Conversation Display */}
          {isConnected && inConversation && (
            <div className="space-y-4">
              {currentResponse && (
                <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-200 p-4 rounded-2xl">
                  <p className="text-sm text-rose-900">
                    <span className="font-semibold">AI is responding:</span> {currentResponse}
                  </p>
                </div>
              )}

              {isListening && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-4 rounded-2xl flex items-center space-x-3">
                  <div className="w-4 h-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full animate-pulse shadow-lg"></div>
                  <p className="text-sm text-green-900 font-semibold">Listening...</p>
                </div>
              )}

              {/* Quick Text Input */}
              <div className="bg-white border-2 border-rose-200 p-4 rounded-2xl">
                <p className="text-sm font-medium text-gray-700 mb-3">Or type a message:</p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-rose-400 transition-all"
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
                    className="px-6 py-3 bg-gradient-to-r from-rose-400 to-pink-400 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 bg-gradient-to-r from-rose-50 to-pink-50 border-t-2 border-rose-100 flex items-center justify-center space-x-4">
          <button
            onClick={toggleMute}
            disabled={!isConnected}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-md hover:shadow-lg ${
              isMuted
                ? 'bg-gradient-to-br from-red-400 to-red-500 text-white'
                : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-rose-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={startVoiceConversation}
            disabled={!isConnected || inConversation}
            className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title="Start voice conversation"
          >
            <Phone className="w-7 h-7" />
          </button>

          <button
            onClick={endConversation}
            disabled={!isConnected || !inConversation}
            className="w-14 h-14 bg-gradient-to-br from-red-400 to-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="End conversation"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          <div className="flex items-center space-x-2 text-sm font-medium text-rose-700">
            <MessageCircle className="w-5 h-5" />
            <span>
              {isWaitingForWakeWord ? 'Say "Hey, Sarah"' : inConversation ? 'In conversation' : 'Real-time AI Voice'}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-t-2 border-rose-100 p-6">
          <h4 className="font-bold text-rose-900 mb-3 text-base">How to use:</h4>
          <ul className="text-sm text-rose-800 space-y-2">
            <li className="flex items-start space-x-2"><span>•</span><span>Say <strong>"Hey, Sarah"</strong> to activate the AI assistant</span></li>
            <li className="flex items-start space-x-2"><span>•</span><span>Once activated, just start talking - the AI will hear you and respond</span></li>
            <li className="flex items-start space-x-2"><span>•</span><span>Click the green phone button to manually start a conversation</span></li>
            <li className="flex items-start space-x-2"><span>•</span><span>Use the red button to end the conversation and return to wake word mode</span></li>
            <li className="flex items-start space-x-2"><span>•</span><span>Mute your microphone with the mute button</span></li>
            <li className="flex items-start space-x-2"><span>•</span><span>You can also type messages in the text input above</span></li>
          </ul>

          <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl">
            <h5 className="font-bold text-green-900 mb-2 text-sm">Wake Word Active:</h5>
            <p className="text-sm text-green-800">
              The AI is now listening for "Hey, Sarah" to start conversations automatically. This prevents always-on listening while still providing hands-free activation.
            </p>
          </div>

          <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl">
            <h5 className="font-bold text-amber-900 mb-2 text-sm">Setup Required:</h5>
            <p className="text-sm text-amber-800">
              To enable voice chat, configure the server route that mints the OpenAI Realtime session and returns an ephemeral client_secret.
            </p>
          </div>
        </div>

        {/* WebRTC Not Supported Warning */}
        {typeof openaiRealtimeService.isSupported === 'function' && !openaiRealtimeService.isSupported() && (
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-t-2 border-amber-300">
            <p className="text-sm font-medium text-amber-900">
              ⚠️ WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
