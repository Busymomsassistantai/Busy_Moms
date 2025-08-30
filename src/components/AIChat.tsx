import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageCircle, X, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { aiService, ChatMessage } from '../services/openai';
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
      // Check if the message is about adding a reminder
      const isReminderRequest = inputMessage.toLowerCase().includes('add reminder') || 
                               inputMessage.toLowerCase().includes('remind me') ||
                               inputMessage.toLowerCase().includes('create reminder');
      
      if (isReminderRequest && user?.id) {
        // Try to extract reminder details from the message
        const reminderDetails = await extractReminderDetails(inputMessage);
        
        console.log('🔍 Reminder request detected');
        console.log('📝 User ID:', user.id);
        console.log('📋 Extracted details:', reminderDetails);
        
        if (reminderDetails) {
          // Check if no time was specified and ask for clarification
          if (!reminderDetails.time) {
            console.log('⏰ No time specified, asking for clarification');
            const clarificationMessage: ChatMessage = {
              role: 'assistant',
              content: 'Is there a certain time or is it all day?'
            };
            setMessages(prev => [...prev, clarificationMessage]);
            setIsLoading(false);
            return;
          }
          
          try {
            console.log('💾 Creating reminder with details:', reminderDetails);
            console.log('🔑 User ID for reminder:', user.id);
            
            const reminderData = {
              user_id: user.id,
              title: reminderDetails.title,
              description: reminderDetails.description || '',
              reminder_date: reminderDetails.date,
              reminder_time: reminderDetails.time,
              priority: reminderDetails.priority || 'medium',
              completed: false,
              recurring: false
            };
            
            console.log('📤 Sending to Supabase:', reminderData);
            
            const { data: newReminder, error } = await supabase
              .from('reminders')
              .insert([reminderData])
              .select()
              .single();

            if (error) {
              console.error('❌ Supabase error creating reminder:', error);
              console.error('❌ Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
              });
              throw error;
            }

            console.log('✅ Reminder created successfully:', newReminder);
            
            // Also create a calendar event for the reminder
            try {
              const eventData = {
                user_id: user.id,
                title: reminderDetails.title,
                description: reminderDetails.description || 'Reminder',
                event_date: reminderDetails.date,
                start_time: reminderDetails.time,
                end_time: reminderDetails.time ? (() => {
                  try {
                    const startTime = new Date(`2000-01-01T${reminderDetails.time}`);
                    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
                    return endTime.toTimeString().slice(0, 5);
                  } catch {
                    return null;
                  }
                })() : null,
                location: '',
                event_type: 'other' as const,
                participants: [],
                rsvp_required: false,
                rsvp_status: 'pending' as const,
                source: 'manual' as const
              };

              console.log('Creating calendar event with data:', eventData);
              const { data: newEvent, error: eventError } = await supabase
                .from('events')
                .insert([eventData])
                .select()
                .single();

              if (eventError) {
                console.error('❌ Error creating calendar event for reminder:', eventError);
                // Don't fail the whole operation if calendar event creation fails
              } else {
                console.log('✅ Calendar event created for reminder:', newEvent);
              }
            } catch (eventCreationError) {
              console.error('❌ Error creating calendar event:', eventCreationError);
            }
            
            const assistantMessage: ChatMessage = {
              role: 'assistant',
              content: `✅ Perfect! I've added a reminder for "${reminderDetails.title}" on ${reminderDetails.date}${reminderDetails.time ? ` at ${reminderDetails.time}` : ''}. I've also added it to your calendar so you can see it there too!`
            };

            setMessages(prev => [...prev, assistantMessage]);
            setIsLoading(false);
            return;
          } catch (error) {
            console.error('❌ Error creating reminder:', error);
            console.error('❌ Full error object:', JSON.stringify(error, null, 2));
            const errorMessage: ChatMessage = {
              role: 'assistant',
              content: `I had trouble saving that reminder to your list. Error: ${(error as any)?.message || 'Unknown error'}. Could you try again with more specific details like "Remind me to pick up groceries tomorrow at 3pm"?`
            };
            setMessages(prev => [...prev, errorMessage]);
            setIsLoading(false);
            return;
          }
        } else {
          console.log('❌ Could not extract reminder details from message:', inputMessage);
          const errorMessage: ChatMessage = {
            role: 'assistant',
            content: 'I had trouble understanding the reminder details. Could you try again with more specific details like "Remind me to pick up groceries tomorrow at 3pm"?'
          };
          setMessages(prev => [...prev, errorMessage]);
          setIsLoading(false);
          return;
        }
      }

      const response = await aiService.chat([...messages, userMessage]);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response
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

  const extractReminderDetails = async (message: string): Promise<{
    title: string;
    description?: string;
    date: string;
    time?: string;
    priority?: 'low' | 'medium' | 'high';
  } | null> => {
    try {
      console.log('🔍 Extracting reminder details from message:', message);
      
      // Use AI to extract structured reminder data
      const extractionPrompt = `Extract reminder details from this message: "${message}"
      
      Respond ONLY with valid JSON in this exact format:
      {
        "title": "brief reminder title",
        "description": "optional longer description",
        "date": "YYYY-MM-DD format",
        "time": "HH:MM format (24-hour) or null",
        "priority": "low, medium, or high"
      }
      
      If no specific date is mentioned, use tomorrow's date. If "today" is mentioned, use today's date.
      Today is ${new Date().toISOString().split('T')[0]}.
      Tomorrow is ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}.`;

      const response = await aiService.chat([
        { role: 'user', content: extractionPrompt }
      ]);

      console.log('🤖 AI response for reminder extraction:', response);

      // Try to parse the JSON response
      // Clean the response by removing markdown code block syntax
      const cleanedResponse = response.trim()
        .replace(/^```json\s*/, '')  // Remove opening ```json
        .replace(/^```\s*/, '')      // Remove opening ```
        .replace(/\s*```$/, '');     // Remove closing ```
      
      console.log('🧹 Cleaned response:', cleanedResponse);
      
      const parsed = JSON.parse(cleanedResponse);
      console.log('📋 Parsed reminder details:', parsed);
      
      // Validate required fields
      if (parsed.title && parsed.date) {
        console.log('✅ Reminder details validated successfully');
        return parsed;
      }
      
      console.log('❌ Reminder details validation failed - missing title or date');
      return null;
    } catch (error) {
      console.error('❌ Error extracting reminder details:', error);
      return null;
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
    'Add reminder for tomorrow',
    'Create shopping list',
    'Suggest birthday gift ideas',
    'Help me plan this week'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="w-full max-w-md mx-auto bg-white rounded-t-2xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Assistant</h3>
              <p className="text-xs text-gray-500">Always here to help</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-2xl">
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => setInputMessage(action)}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs hover:bg-purple-200 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading || !recognition}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isListening
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? "Listening..." : "Ask me anything..."}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isLoading || isListening}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || isListening}
              className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}