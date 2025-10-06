import React, { useState, useRef } from 'react';
import { MessageCircle, Upload, X, Calendar, MapPin, Clock, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase, Event } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { openaiService } from '../services/openai';

interface WhatsAppIntegrationProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated?: (event: Event) => void;
}

export function WhatsAppIntegration({ isOpen, onClose, onEventCreated }: WhatsAppIntegrationProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [parsedEvent, setParsedEvent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseWhatsAppMessage = async (messageText: string) => {
    setProcessing(true);
    setError(null);
    setParsedEvent(null);

    try {
      // Use AI to parse the WhatsApp message
      const result = await openaiService.parseWhatsAppMessage(messageText);
      
      if (result.isEvent && result.eventDetails) {
        setParsedEvent({
          title: result.eventDetails.title,
          description: messageText,
          event_date: result.eventDetails.date || '',
          start_time: result.eventDetails.time || '',
          location: result.eventDetails.location || '',
          event_type: 'party',
          participants: [],
          rsvp_required: true,
          rsvp_status: 'pending',
          source: 'whatsapp'
        });
      } else {
        setError('No event information found in this message. Please try a message that contains event details like date, time, and location.');
      }
    } catch (error) {
      console.error('Error parsing WhatsApp message:', error);
      setError('Failed to parse message. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    await parseWhatsAppMessage(message);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setMessage(text);
      parseWhatsAppMessage(text);
    };
    reader.readAsText(file);
  };

  const createEventFromParsed = async () => {
    if (!parsedEvent || !user) return;

    setProcessing(true);
    try {
      const eventData = {
        ...parsedEvent,
        user_id: user.id
      };

      const { data: newEvent, error } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (error) throw error;

      // Also save the WhatsApp message
      await supabase
        .from('whatsapp_messages')
        .insert([{
          user_id: user.id,
          message_id: `msg_${Date.now()}`,
          sender: 'Unknown',
          message_content: message,
          parsed_event_data: parsedEvent,
          processed: true,
          event_created: true,
          created_event_id: newEvent.id
        }]);

      onEventCreated?.(newEvent);
      onClose();
      setMessage('');
      setParsedEvent(null);
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Failed to create event. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const sampleMessages = [
    "Hi everyone! Emma's 8th birthday party this Saturday 2-5pm at Chuck E. Cheese on Main Street. RSVP by Thursday! 🎂🎉",
    "Soccer practice moved to Sunday 10am at Riverside Park. Please bring water bottles and cleats!",
    "Parent-teacher conference scheduled for March 15th at 3:30pm in Room 204. Looking forward to discussing your child's progress."
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">WhatsApp Integration</h2>
                <p className="text-xs sm:text-sm text-gray-600">Parse messages to create events automatically</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
            </button>
          </div>

          {/* Input Methods */}
          <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Paste WhatsApp Message
              </label>
              <form onSubmit={handleMessageSubmit}>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                  rows={3}
                  placeholder="Paste your WhatsApp message here..."
                />
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 mt-2 sm:mt-3">
                  <button
                    type="submit"
                    disabled={!message.trim() || processing}
                    className="w-full sm:w-auto px-3 py-2 sm:px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
                  >
                    {processing ? 'Parsing...' : 'Parse Message'}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto px-3 py-2 sm:px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
                  >
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Upload File</span>
                  </button>
                </div>
              </form>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Sample Messages */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">Try these sample messages:</h3>
            <div className="space-y-1 sm:space-y-2">
              {sampleMessages.map((sample, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setMessage(sample);
                    parseWhatsAppMessage(sample);
                  }}
                  className="w-full text-left p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-xs sm:text-sm"
                >
                  "{sample}"
                </button>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                <p className="text-xs sm:text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Parsed Event Preview */}
          {parsedEvent && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                <h3 className="font-medium text-green-900 text-sm sm:text-base">Event Detected!</h3>
              </div>
              
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-lg">{parsedEvent.title}</h4>
                  <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                    {parsedEvent.event_type}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                  {parsedEvent.event_date && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                      <span>{parsedEvent.event_date}</span>
                    </div>
                  )}
                  
                  {parsedEvent.start_time && (
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                      <span>{parsedEvent.start_time}</span>
                    </div>
                  )}
                  
                  {parsedEvent.location && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                      <span>{parsedEvent.location}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                    <span>RSVP Required</span>
                  </div>
                </div>

                <div className="pt-2 sm:pt-3 border-t border-green-200">
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">Original message:</p>
                  <p className="text-xs sm:text-sm bg-white p-2 sm:p-3 rounded border italic">
                    "{parsedEvent.description}"
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-2 sm:pt-3">
                  <button
                    onClick={createEventFromParsed}
                    disabled={processing}
                    className="w-full sm:w-auto px-3 py-2 sm:px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
                  >
                    {processing ? 'Creating...' : 'Add to Calendar'}
                  </button>
                  <button
                    onClick={() => setParsedEvent(null)}
                    className="w-full sm:w-auto px-3 py-2 sm:px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <h3 className="font-medium text-blue-900 mb-2 text-sm sm:text-base">How it works:</h3>
            <ul className="text-xs sm:text-sm text-blue-700 space-y-1">
              <li>• Copy and paste messages containing event information</li>
              <li>• Our AI will automatically detect dates, times, locations, and event details</li>
              <li>• Review the parsed information and add it to your calendar</li>
              <li>• Perfect for birthday party invitations, school events, and group activities</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}