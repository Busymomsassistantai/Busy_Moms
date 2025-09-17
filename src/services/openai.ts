import OpenAI from 'openai';

type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: Role;
  content: string;
}

/**
 * Centralized client for model interactions used by the app.
 * 
 * NOTE: In production you should proxy requests via your own backend or Supabase Edge Functions.
 * We keep browser SDK enabled for local development convenience.
 */
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  // WARNING: Exposes your key in the browser. Replace with server proxy in production.
  dangerouslyAllowBrowser: true,
});

export class AIService {
  /** Basic chat wrapper that returns plain text. */
  async chat(messages: ChatMessage[], model = 'gpt-4o-mini'): Promise<string> {
    try {
      if (!import.meta.env.VITE_OPENAI_API_KEY) {
        console.warn('⚠️ No OpenAI API key configured, using fallback response');
        // Return a helpful fallback response
        const userMessage = messages[messages.length - 1]?.content || '';
        return this.getFallbackResponse(userMessage);
      }

      console.log('🤖 Making OpenAI API call with messages:', messages);
      
      const resp = await openai.chat.completions.create({
        model,
        messages: messages,
        temperature: 0.2,
        max_tokens: 500,
      });

      const content = resp.choices?.[0]?.message?.content ?? '';
      console.log('🤖 OpenAI response:', content);
      
      return typeof content === 'string' ? content : JSON.stringify(content);
    } catch (err: any) {
      console.error('❌ OpenAI API error:', err?.message || err);
      
      // Provide fallback response instead of throwing
      const userMessage = messages[messages.length - 1]?.content || '';
      return this.getFallbackResponse(userMessage);
    }
  }

  /** Fallback response when OpenAI API is not available */
  private getFallbackResponse(userMessage: string): string {
    const lower = userMessage.toLowerCase();
    
    // Shopping list responses
    if (lower.includes('shopping') || lower.includes('add') && (lower.includes('list') || lower.includes('buy'))) {
      return "I'd be happy to help with your shopping list! Try saying something like 'add milk to shopping list' or 'buy bread' and I'll add it for you.";
    }
    
    // Reminder responses
    if (lower.includes('remind') || lower.includes('reminder')) {
      return "I can help you set reminders! Try saying 'remind me to call mom tomorrow at 3pm' and I'll create that reminder for you.";
    }
    
    // Calendar/event responses
    if (lower.includes('schedule') || lower.includes('appointment') || lower.includes('event')) {
      return "I can help you schedule events! Try saying 'schedule dentist appointment next Friday' and I'll add it to your calendar.";
    }
    
    // Task responses
    if (lower.includes('task') || lower.includes('todo')) {
      return "I can help you create tasks! Try saying 'create task to clean room' and I'll add it to your task list.";
    }
    
    // General help
    return "I'm here to help you manage your busy family life! I can:\n\n• Add items to your shopping list\n• Set reminders for important tasks\n• Schedule appointments and events\n• Create tasks for family members\n\nWhat would you like me to help you with?";
  }

  /** Parse WhatsApp messages for event information */
  async parseWhatsAppMessage(message: string): Promise<{
    isEvent: boolean;
    eventDetails?: {
      title: string;
      date?: string;
      time?: string;
      location?: string;
    };
  }> {
    try {
      const response = await this.chat([
        {
          role: 'system',
          content: 'You are a WhatsApp message parser. Extract event information from messages. Return JSON with isEvent (boolean) and eventDetails (title, date in YYYY-MM-DD format, time in HH:MM format, location) if found.'
        },
        {
          role: 'user',
          content: `Parse this WhatsApp message for event information: "${message}"`
        }
      ]);

      const parsed = JSON.parse(response);
      return parsed;
    } catch (error) {
      console.error('Error parsing WhatsApp message:', error);
      return { isEvent: false };
    }
  }
}

export const aiService = new AIService();