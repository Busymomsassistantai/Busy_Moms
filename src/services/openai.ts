class OpenAIService {
  private openai: any = null;

  constructor() {
    // Only initialize OpenAI if API key is available
    if (import.meta.env.VITE_OPENAI_API_KEY) {
      try {
        // Dynamic import to avoid build errors when OpenAI is not available
        import('openai').then(({ default: OpenAI }) => {
          this.openai = new OpenAI({
            apiKey: import.meta.env.VITE_OPENAI_API_KEY,
            dangerouslyAllowBrowser: true
          });
        }).catch(console.error);
      } catch (error) {
        console.warn('OpenAI not available:', error);
      }
    }
  }

  async chat(messages: Array<{ role: string; content: string }>) {
    if (!this.openai) {
      return this.getFallbackResponse(messages);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 500,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content || 'I apologize, but I cannot provide a response at the moment.';
    } catch (error) {
      console.error('OpenAI chat error:', error);
      return this.getFallbackResponse(messages);
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
    if (!this.openai) {
      return this.fallbackParseWhatsApp(message);
    }

    try {
      const prompt = `Parse this WhatsApp message and determine if it contains event information. Return JSON only:

Message: "${message}"

Return format:
{
  "isEvent": boolean,
  "eventDetails": {
    "title": "event title",
    "date": "extracted date or null",
    "time": "extracted time or null", 
    "location": "extracted location or null"
  }
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          return JSON.parse(content);
        } catch {
          // If JSON parsing fails, fall back to rule-based parsing
          return this.fallbackParseWhatsApp(message);
        }
      }
    } catch (error) {
      console.error('OpenAI WhatsApp parsing error:', error);
    }

    return this.fallbackParseWhatsApp(message);
  }

  private getFallbackResponse(messages: Array<{ role: string; content: string }>): string {
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
    
    if (lastMessage.includes('hello') || lastMessage.includes('hi')) {
      return "Hello! I'm your family assistant. I can help you manage events, tasks, shopping lists, and more. How can I assist you today?";
    }
    
    if (lastMessage.includes('event') || lastMessage.includes('calendar')) {
      return "I can help you manage your family events and calendar. You can add events, set reminders, and keep track of important dates.";
    }
    
    if (lastMessage.includes('task') || lastMessage.includes('chore')) {
      return "I can help you organize family tasks and chores. You can assign tasks to family members and track their completion.";
    }
    
    if (lastMessage.includes('shopping') || lastMessage.includes('grocery')) {
      return "I can help you manage your shopping lists. Add items, organize by category, and keep track of what you need to buy.";
    }
    
    if (lastMessage.includes('contact')) {
      return "I can help you manage your family contacts including babysitters, doctors, teachers, and other important people in your family's life.";
    }
    
    return "I'm here to help you manage your family's schedule, tasks, and daily activities. What would you like assistance with?";
  }

  private fallbackParseWhatsApp(message: string): {
    isEvent: boolean;
    eventDetails?: {
      title: string;
      date?: string;
      time?: string;
      location?: string;
    };
  } {
    const lower = message.toLowerCase();
    
    // Look for event keywords
    const eventKeywords = ['party', 'birthday', 'appointment', 'meeting', 'practice', 'game', 'event'];
    const hasEventKeyword = eventKeywords.some(keyword => lower.includes(keyword));
    
    if (!hasEventKeyword) {
      return { isEvent: false };
    }
    
    // Extract title (first sentence or up to date/time)
    const sentences = message.split(/[.!?]/);
    const title = sentences[0]?.trim() || message.substring(0, 50);
    
    // Look for dates
    const datePatterns = [
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(\d{1,2}\/\d{1,2}\/?\d{0,4})\b/,
      /\b(\d{1,2}-\d{1,2}-?\d{0,4})\b/,
      /\b(today|tomorrow|next week)\b/i
    ];
    
    let date = '';
    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        date = match[1];
        break;
      }
    }
    
    // Look for times
    const timePattern = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}-\d{1,2}(?:\s*(?:am|pm))?)\b/i;
    const timeMatch = message.match(timePattern);
    const time = timeMatch?.[1] || '';
    
    // Look for locations
    const locationPatterns = [
      /\bat\s+([^.!?]+?)(?:\s+on|\s+this|\s+next|$)/i,
      /\bin\s+([^.!?]+?)(?:\s+on|\s+this|\s+next|$)/i,
      /\b(?:location|venue|place):\s*([^.!?]+)/i
    ];
    
    let location = '';
    for (const pattern of locationPatterns) {
      const match = message.match(pattern);
      if (match) {
        location = match[1]?.trim() || '';
        break;
      }
    }
    
    return {
      isEvent: true,
      eventDetails: {
        title: title || 'Event',
        date: date || undefined,
        time: time || undefined,
        location: location || undefined
      }
    };
  }
}

export const openaiService = new OpenAIService();
export default openaiService;