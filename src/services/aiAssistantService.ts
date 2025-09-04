import { supabase } from '../lib/supabase';
import { aiService } from './openai';

export interface AIAction {
  type: 'calendar' | 'reminder' | 'shopping' | 'chat';
  data?: any;
  success: boolean;
  message: string;
}

export class AIAssistantService {
  async processUserMessage(message: string, userId: string): Promise<AIAction> {
    try {
      // First, determine what type of action the user wants
      const actionType = await this.classifyUserIntent(message);
      
      switch (actionType.type) {
        case 'calendar':
          return await this.handleCalendarAction(message, userId, actionType.details);
        case 'reminder':
          return await this.handleReminderAction(message, userId, actionType.details);
        case 'shopping':
          return await this.handleShoppingAction(message, userId, actionType.details);
        case 'task':
          return await this.handleTaskAction(message, userId, actionType.details);
        default:
          return await this.handleChatAction(message, userId);
      }
    } catch (error) {
      console.error('Error processing user message:', error);
      return {
        type: 'chat',
        success: false,
        message: 'I had trouble understanding that request. Could you try rephrasing it?'
      };
    }
  }

  private async classifyUserIntent(message: string): Promise<{
    type: 'calendar' | 'reminder' | 'shopping' | 'task' | 'chat';
    details?: any;
  }> {
    const prompt = `Analyze this user message and determine what action they want to take. Respond with JSON only:

Message: "${message}"

Classify as one of these types:
- "calendar": Creating, editing, or viewing calendar events
- "reminder": Setting up reminders or tasks
- "shopping": Adding items to shopping list or managing shopping
- "task": Creating, assigning, or managing family tasks/chores
- "chat": General conversation or questions

If it's calendar, reminder, shopping, or task, extract relevant details.

Response format:
{
  "type": "calendar|reminder|shopping|task|chat",
  "details": {
    "action": "create|add|update|delete|remove|complete|mark|view",
    "title": "extracted title",
    "item": "item name for shopping actions",
    "assignee": "person name if mentioned (for Emma, Tom needs, etc.)",
    "date": "YYYY-MM-DD if mentioned",
    "time": "HH:MM if mentioned",
    "location": "location if mentioned",
    "description": "description if mentioned",
    "priority": "low|medium|high if mentioned",
    "category": "category if mentioned",
    "quantity": number if mentioned
  }
}

For shopping actions:
- "add" or "create": Adding new items
- "remove" or "delete": Removing items from list
- "complete" or "mark": Marking items as completed
- "view" or "show": Displaying the shopping list

For task actions:
- "create" or "add": Creating new tasks
- "assign": Assigning tasks to family members
- "complete" or "mark": Marking tasks as completed
- "view" or "show": Displaying tasks
- "update": Updating task details

Today is ${new Date().toISOString().split('T')[0]}.
Tomorrow is ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}.`;

    try {
      const response = await aiService.chat([
        { role: 'user', content: prompt }
      ]);

      const cleanedResponse = response.trim()
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '');
      
      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('Error classifying intent:', error);
      return { type: 'chat' };
    }
  }

  private async handleCalendarAction(message: string, userId: string, details: any): Promise<AIAction> {
    try {
      if (details.action === 'create' || !details.action) {
        // Create new calendar event
        const eventData = {
          user_id: userId,
          title: details.title || 'New Event',
          description: details.description || message,
          event_date: details.date || new Date().toISOString().split('T')[0],
          start_time: details.time || null,
          end_time: details.time ? this.addHourToTime(details.time) : null,
          location: details.location || '',
          event_type: this.categorizeEventType(details.title || message),
          participants: [],
          rsvp_required: false,
          rsvp_status: 'pending' as const,
          source: 'manual' as const
        };

        const { data: newEvent, error } = await supabase
          .from('events')
          .insert([eventData])
          .select()
          .single();

        if (error) throw error;

        return {
          type: 'calendar',
          data: newEvent,
          success: true,
          message: `✅ I've added "${newEvent.title}" to your calendar for ${this.formatDate(newEvent.event_date)}${newEvent.start_time ? ` at ${newEvent.start_time}` : ''}${newEvent.location ? ` at ${newEvent.location}` : ''}.`
        };
      } else if (details.action === 'view') {
        // View upcoming events
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const { data: events, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', userId)
          .gte('event_date', today)
          .lte('event_date', nextWeek)
          .order('event_date', { ascending: true })
          .order('start_time', { ascending: true });

        if (error) throw error;

        const eventsList = events.map(event => 
          `• ${event.title} - ${this.formatDate(event.event_date)}${event.start_time ? ` at ${event.start_time}` : ''}${event.location ? ` (${event.location})` : ''}`
        ).join('\n');

        return {
          type: 'calendar',
          data: events,
          success: true,
          message: events.length > 0 
            ? `📅 Here are your upcoming events:\n\n${eventsList}`
            : '📅 You have no upcoming events in the next week.'
        };
      }

      return {
        type: 'calendar',
        success: false,
        message: 'I can help you create or view calendar events. Try saying "Add meeting tomorrow at 2pm" or "Show my upcoming events".'
      };
    } catch (error) {
      console.error('Error handling calendar action:', error);
      return {
        type: 'calendar',
        success: false,
        message: 'I had trouble managing your calendar. Please try again.'
      };
    }
  }

  private async handleReminderAction(message: string, userId: string, details: any): Promise<AIAction> {
    try {
      if (details.action === 'create' || !details.action) {
        // Create new reminder
        const reminderData = {
          user_id: userId,
          title: details.title || 'New Reminder',
          description: details.description || message,
          reminder_date: details.date || new Date().toISOString().split('T')[0],
          reminder_time: details.time || null,
          priority: details.priority || 'medium' as const,
          completed: false,
          recurring: false
        };

        const { data: newReminder, error } = await supabase
          .from('reminders')
          .insert([reminderData])
          .select()
          .single();

        if (error) throw error;

        // Also create a calendar event for the reminder
        const eventData = {
          user_id: userId,
          title: newReminder.title,
          description: 'Reminder: ' + (newReminder.description || ''),
          event_date: newReminder.reminder_date,
          start_time: newReminder.reminder_time,
          end_time: newReminder.reminder_time ? this.addMinutesToTime(newReminder.reminder_time, 30) : null,
          location: '',
          event_type: 'other' as const,
          participants: [],
          rsvp_required: false,
          rsvp_status: 'pending' as const,
          source: 'manual' as const
        };

        await supabase.from('events').insert([eventData]);

        return {
          type: 'reminder',
          data: newReminder,
          success: true,
          message: `✅ I've set a reminder for "${newReminder.title}" on ${this.formatDate(newReminder.reminder_date)}${newReminder.reminder_time ? ` at ${newReminder.reminder_time}` : ''}. I've also added it to your calendar!`
        };
      } else if (details.action === 'view') {
        // View upcoming reminders
        const today = new Date().toISOString().split('T')[0];
        
        const { data: reminders, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('user_id', userId)
          .eq('completed', false)
          .gte('reminder_date', today)
          .order('reminder_date', { ascending: true })
          .order('reminder_time', { ascending: true })
          .limit(10);

        if (error) throw error;

        const remindersList = reminders.map(reminder => 
          `• ${reminder.title} - ${this.formatDate(reminder.reminder_date)}${reminder.reminder_time ? ` at ${reminder.reminder_time}` : ''}${reminder.priority === 'high' ? ' (High Priority)' : ''}`
        ).join('\n');

        return {
          type: 'reminder',
          data: reminders,
          success: true,
          message: reminders.length > 0 
            ? `⏰ Here are your upcoming reminders:\n\n${remindersList}`
            : '⏰ You have no pending reminders.'
        };
      }

      return {
        type: 'reminder',
        success: false,
        message: 'I can help you set reminders. Try saying "Remind me to pick up groceries tomorrow at 3pm" or "Show my reminders".'
      };
    } catch (error) {
      console.error('Error handling reminder action:', error);
      return {
        type: 'reminder',
        success: false,
        message: 'I had trouble setting that reminder. Please try again.'
      };
    }
  }

  private async handleShoppingAction(message: string, userId: string, details: any): Promise<AIAction> {
    try {
      if (details.action === 'create' || details.action === 'add' || !details.action) {
        // Add item to shopping list
        const itemData = {
          user_id: userId,
          item: details.title || 'New Item',
          category: details.category || this.categorizeShoppingItem(details.title || message),
          quantity: details.quantity || 1,
          urgent: details.priority === 'high',
          notes: details.description || '',
          completed: false
        };

        const { data: newItem, error } = await supabase
          .from('shopping_lists')
          .insert([itemData])
          .select()
          .single();

        if (error) throw error;

        return {
          type: 'shopping',
          data: newItem,
          success: true,
          message: `✅ I've added "${newItem.item}" to your shopping list${newItem.quantity > 1 ? ` (quantity: ${newItem.quantity})` : ''}${newItem.urgent ? ' and marked it as urgent' : ''}.`
        };
      } else if (details.action === 'remove' || details.action === 'delete') {
        // Remove item from shopping list
        const itemName = details.title || details.item;
        if (!itemName) {
          return {
            type: 'shopping',
            success: false,
            message: 'Please specify which item you want to remove from your shopping list.'
          };
        }

        // Find and remove the item
        const { data: items, error: findError } = await supabase
          .from('shopping_lists')
          .select('*')
          .eq('user_id', userId)
          .eq('completed', false)
          .ilike('item', `%${itemName}%`)
          .limit(1);

        if (findError) throw findError;

        if (!items || items.length === 0) {
          return {
            type: 'shopping',
            success: false,
            message: `I couldn't find "${itemName}" in your shopping list. Try saying "show my shopping list" to see what's available.`
          };
        }

        const itemToRemove = items[0];
        const { error: deleteError } = await supabase
          .from('shopping_lists')
          .delete()
          .eq('id', itemToRemove.id);

        if (deleteError) throw deleteError;

        return {
          type: 'shopping',
          data: itemToRemove,
          success: true,
          message: `✅ I've removed "${itemToRemove.item}" from your shopping list.`
        };
      } else if (details.action === 'complete' || details.action === 'mark') {
        // Mark item as completed
        const itemName = details.title || details.item;
        if (!itemName) {
          return {
            type: 'shopping',
            success: false,
            message: 'Please specify which item you want to mark as completed.'
          };
        }

        const { data: items, error: findError } = await supabase
          .from('shopping_lists')
          .select('*')
          .eq('user_id', userId)
          .eq('completed', false)
          .ilike('item', `%${itemName}%`)
          .limit(1);

        if (findError) throw findError;

        if (!items || items.length === 0) {
          return {
            type: 'shopping',
            success: false,
            message: `I couldn't find "${itemName}" in your shopping list.`
          };
        }

        const itemToComplete = items[0];
        const { data: completedItem, error: updateError } = await supabase
          .from('shopping_lists')
          .update({ completed: true })
          .eq('id', itemToComplete.id)
          .select()
          .single();

        if (updateError) throw updateError;

        return {
          type: 'shopping',
          data: completedItem,
          success: true,
          message: `✅ I've marked "${completedItem.item}" as completed on your shopping list.`
        };
      } else if (details.action === 'view') {
        // View shopping list
        const { data: items, error } = await supabase
          .from('shopping_lists')
          .select('*')
          .eq('user_id', userId)
          .eq('completed', false)
          .order('urgent', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;

        const itemsList = items.map(item => 
          `• ${item.item}${item.quantity > 1 ? ` (${item.quantity})` : ''}${item.urgent ? ' 🔴' : ''}`
        ).join('\n');

        return {
          type: 'shopping',
          data: items,
          success: true,
          message: items.length > 0 
            ? `🛒 Here's your shopping list:\n\n${itemsList}\n\n${items.filter(i => i.urgent).length > 0 ? '🔴 = Urgent items' : ''}`
            : '🛒 Your shopping list is empty.'
        };
      }

      return {
        type: 'shopping',
        success: false,
        message: 'I can help you manage your shopping list. Try saying "Add milk to shopping list", "Remove bread from shopping list", "Mark eggs as completed", or "Show my shopping list".'
      };
    } catch (error) {
      console.error('Error handling shopping action:', error);
      return {
        type: 'shopping',
        success: false,
        message: 'I had trouble updating your shopping list. Please try again.'
      };
    }
  }

  private async handleChatAction(message: string, userId: string): Promise<AIAction> {
    try {
      const response = await aiService.chat([
        { role: 'user', content: message }
      ]);

      return {
        type: 'chat',
        success: true,
        message: response
      };
    } catch (error) {
      console.error('Error handling chat action:', error);
      return {
        type: 'chat',
        success: false,
        message: 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.'
      };
    }
  }

  // Helper methods
  private addHourToTime(time: string): string {
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const newHours = (hours + 1) % 24;
      return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } catch {
      return time;
    }
  }

  private addMinutesToTime(time: string, minutesToAdd: number): string {
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + minutesToAdd;
      const newHours = Math.floor(totalMinutes / 60) % 24;
      const newMinutes = totalMinutes % 60;
      return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    } catch {
      return time;
    }
  }

  private categorizeEventType(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes('doctor') || lower.includes('appointment') || lower.includes('medical')) return 'medical';
    if (lower.includes('school') || lower.includes('teacher') || lower.includes('class')) return 'school';
    if (lower.includes('party') || lower.includes('birthday') || lower.includes('celebration')) return 'party';
    if (lower.includes('sport') || lower.includes('practice') || lower.includes('game')) return 'sports';
    if (lower.includes('meeting') || lower.includes('conference')) return 'meeting';
    if (lower.includes('family') || lower.includes('dinner') || lower.includes('visit')) return 'family';
    return 'other';
  }

  private categorizeShoppingItem(item: string): string {
    const lower = item.toLowerCase();
    if (lower.includes('milk') || lower.includes('cheese') || lower.includes('yogurt') || lower.includes('butter')) return 'dairy';
    if (lower.includes('apple') || lower.includes('banana') || lower.includes('vegetable') || lower.includes('fruit')) return 'produce';
    if (lower.includes('chicken') || lower.includes('beef') || lower.includes('meat') || lower.includes('fish')) return 'meat';
    if (lower.includes('bread') || lower.includes('cake') || lower.includes('muffin') || lower.includes('bagel')) return 'bakery';
    if (lower.includes('diaper') || lower.includes('formula') || lower.includes('baby') || lower.includes('wipes')) return 'baby';
    if (lower.includes('soap') || lower.includes('detergent') || lower.includes('cleaner') || lower.includes('paper')) return 'household';
    return 'other';
  }

  private categorizeTask(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes('clean') || lower.includes('tidy') || lower.includes('organize')) return 'chores';
    if (lower.includes('homework') || lower.includes('study') || lower.includes('read')) return 'homework';
    if (lower.includes('practice') || lower.includes('game') || lower.includes('sport')) return 'sports';
    if (lower.includes('piano') || lower.includes('music') || lower.includes('instrument')) return 'music';
    if (lower.includes('doctor') || lower.includes('medicine') || lower.includes('health')) return 'health';
    if (lower.includes('friend') || lower.includes('party') || lower.includes('social')) return 'social';
    return 'other';
  }

  private calculateTaskPoints(priority: string, title: string): number {
    let basePoints = 0;
    
    // Base points by priority
    switch (priority) {
      case 'high': basePoints = 15; break;
      case 'medium': basePoints = 10; break;
      case 'low': basePoints = 5; break;
    }
    
    // Bonus points for certain task types
    const lower = title.toLowerCase();
    if (lower.includes('homework') || lower.includes('study')) basePoints += 5;
    if (lower.includes('help') || lower.includes('assist')) basePoints += 3;
    
    return basePoints;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    if (date.toDateString() === today.toDateString()) {
      return 'today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  }

  // Voice-specific methods for real-time integration
  async processVoiceCommand(command: string, userId: string): Promise<string> {
    const result = await this.processUserMessage(command, userId);
    return result.message;
  }

  async getQuickResponse(message: string): Promise<string> {
    // For voice responses, keep them concise
    const prompt = `Respond to this message in 1-2 sentences, suitable for voice output: "${message}"`;
    
    try {
      const response = await aiService.chat([
        { role: 'user', content: prompt }
      ]);
      return response;
    } catch (error) {
      return 'I\'m here to help with your family schedule, reminders, and shopping list. What can I do for you?';
    }
  }
}

export const aiAssistantService = new AIAssistantService();