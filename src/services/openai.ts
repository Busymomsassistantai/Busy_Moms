import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, API calls should go through your backend
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIService {
  private systemPrompt = `You are a helpful AI assistant for busy parents, specifically designed for the "Busy Moms Assistant" app. You help with:

- Managing family schedules and events
- Shopping lists and gift suggestions
- Reminders and daily planning
- Contact management
- General parenting advice and support

Keep responses concise, practical, and empathetic. Always consider the busy lifestyle of parents and provide actionable suggestions. Use a warm, supportive tone.`;

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...messages
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
    } catch (error) {
      console.error('OpenAI API Error:', error);
      // Return a fallback response instead of throwing an error for reminder extraction
      if (error instanceof Error && error.message.includes('API')) {
        return 'I\'m having trouble connecting to my AI service right now. Please try again in a moment.';
      }
      throw new Error('Unable to connect to AI service. Please check your connection and try again.');
    }
  }

  async generateEventSuggestions(eventType: string, age?: number): Promise<string> {
    const prompt = `Suggest 3 practical ideas for a ${eventType}${age ? ` for a ${age}-year-old` : ''}. Keep suggestions brief and actionable.`;
    
    try {
      const response = await this.chat([
        { role: 'user', content: prompt }
      ]);
      return response;
    } catch (error) {
      return 'Unable to generate suggestions at the moment. Please try again later.';
    }
  }

  async parseWhatsAppMessage(message: string): Promise<{
    isEvent: boolean;
    eventDetails?: {
      title: string;
      date?: string;
      time?: string;
      location?: string;
    };
  }> {
    const prompt = `Analyze this WhatsApp message and determine if it contains an event invitation or announcement. If it does, extract the event details:

Message: "${message}"

Respond in JSON format with:
{
  "isEvent": boolean,
  "eventDetails": {
    "title": "event name",
    "date": "date if mentioned",
    "time": "time if mentioned", 
    "location": "location if mentioned"
  }
}`;

    try {
      const response = await this.chat([
        { role: 'user', content: prompt }
      ]);
      
      // Try to parse JSON response
      const parsed = JSON.parse(response);
      return parsed;
    } catch (error) {
      return { isEvent: false };
    }
  }
}

export const aiService = new AIService();