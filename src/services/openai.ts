import { chatCompletion, type ChatMessage } from '../lib/aiProxy';

export type { ChatMessage };

/**
 * Centralized client for model interactions used by the app.
 * 
 * NOTE: All OpenAI requests now go through our Supabase Edge Function ai-proxy.
 * No OpenAI SDK or API keys are used in the browser.
 */

export class AIService {
  /** Basic chat wrapper that returns plain text. */
  async chat(messages: ChatMessage[], model = 'gpt-4o-mini'): Promise<string> {
    try {
      console.log('🤖 Making AI proxy call with messages:', messages);
      
      const resp = await chatCompletion({
        messages,
        model,
        temperature: 0.2,
        max_tokens: 500
      });

      const content = resp?.choices?.[0]?.message?.content ?? '';
      console.log('🤖 AI proxy response:', content);
      
      return typeof content === 'string' ? content : JSON.stringify(content);
    } catch (err: any) {
      console.error('❌ AI proxy error:', err?.message || err);
      
      // Provide fallback response instead of throwing
      const userMessage = messages[messages.length - 1]?.content || '';
      return this.getFallbackResponse(userMessage);
    }
  }

  /** Fallback response when AI proxy is not available */
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
      const resp = await chatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are a WhatsApp message parser. Extract event information from messages. Return JSON with isEvent (boolean) and eventDetails (title, date in YYYY-MM-DD format, time in HH:MM format, location) if found.'
          },
          {
            role: 'user',
            content: `Parse this WhatsApp message for event information: "${message}"`
          }
        ],
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 300
      });

      const response = resp?.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(response);
      return parsed;
    } catch (error) {
      console.error('Error parsing WhatsApp message:', error);
      return { isEvent: false };
    }
  }
}

export const aiService = new AIService();