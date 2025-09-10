import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageCircle, X, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { ChatMessage } from '../services/openai';
import { aiAssistantService } from '../services/aiAssistantService';
import { useAuth } from '../hooks/useAuth';
import { supabase, Profile } from '../lib/supabase';

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIChat({ isOpen, onClose }: AIChatProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi there! I'm your AI assistant. I can help you manage your family schedule, create shopping lists, suggest gifts, and much more. What can I help you with today?`
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id || !isOpen) return;
      
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        if (!error && profileData) {
          setProfile(profileData);
          // Update the initial message with the user's name
          setMessages([{
            role: 'assistant',
            content: `Hi ${profileData.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'there'}! I'm your AI assistant. I can help you manage your family schedule, create shopping lists, suggest gifts, and much more. What can I help you with today?`
          }]);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };
    
    if (isOpen && user?.id) {
      loadProfile();
    }
  }, [user, isOpen]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onstart = () => {
        setIsListening(true);
      };
      
      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Use the enhanced AI assistant service
      const result = await aiAssistantService.processUserMessage(userMessage.content, user.id);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.message
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (recognition && !isListening) {
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    'Add reminder for tomorrow at 3pm',
    'Add milk to shopping list',
    'Show my upcoming events',
    'What\'s on my shopping list?',
    'Schedule dentist appointment next week',
    'Remind me to call mom tonight'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md mx-auto bg-white rounded-t-2xl sm:rounded-2xl h-[85vh] sm:h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">AI Assistant</h3>
              <p className="text-xs text-gray-500">Always here to help</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] p-2 sm:p-3 rounded-xl sm:rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-xs sm:text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-2 sm:p-3 rounded-xl sm:rounded-2xl">
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-gray-600" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="px-3 sm:px-4 pb-2">
            <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => setInputMessage(action)}
                  className="px-2 py-1 sm:px-3 bg-purple-100 text-purple-700 rounded-full text-xs hover:bg-purple-200 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-gray-200">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading || !recognition}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors ${
                isListening
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? (
                <MicOff className="w-3 h-3 sm:w-4 sm:h-4" />
              ) : (
                <Mic className="w-3 h-3 sm:w-4 sm:h-4" />
              )}
            </button>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? "Listening..." : "Ask me anything..."}
              className="flex-1 px-3 py-2 sm:px-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
              disabled={isLoading || isListening}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || isListening}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <Send className="w-3 h-3 sm:w-4 sm:h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}