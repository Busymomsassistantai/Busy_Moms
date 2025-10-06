// Google Calendar service for managing calendar integration
import { supabase } from '../lib/supabase';

export interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  htmlLink?: string;
  status?: string;
  created?: string;
  updated?: string;
}

export interface CalendarListOptions {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  q?: string;
}

class GoogleCalendarService {
  private baseUrl: string;
  private initialized = false;
  private available = false;
  private ready = false;
  private signedIn = false;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      console.error('❌ VITE_SUPABASE_URL not configured');
      this.baseUrl = '';
    } else {
      this.baseUrl = `${supabaseUrl}/functions/v1`;
    }
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing Google Calendar service...');

    if (!this.baseUrl) {
      console.error('❌ Supabase URL not configured');
      this.available = false;
      this.ready = false;
      this.signedIn = false;
      this.initialized = true;
      return;
    }

    try {
      const { data: { user, session } } = await supabase.auth.getUser();

      if (!user) {
        console.warn('⚠️ User not authenticated');
        this.available = false;
        this.ready = false;
        this.signedIn = false;
        this.initialized = true;
        return;
      }

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${this.baseUrl}/google-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          action: 'isConnected',
          userId: user.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.signedIn = data.connected || false;
        this.available = true;
        this.ready = true;
        console.log('✅ Google Calendar service initialized, connected:', this.signedIn);
      } else {
        console.warn('⚠️ Google Calendar service not available');
        this.available = false;
        this.ready = false;
        this.signedIn = false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Google Calendar service:', error);
      this.available = false;
      this.ready = false;
      this.signedIn = false;
    }

    this.initialized = true;
  }

  isAvailable(): boolean {
    return this.available;
  }

  isReady(): boolean {
    return this.ready;
  }

  isSignedIn(): boolean {
    return this.signedIn;
  }

  async signIn(): Promise<void> {
    console.log('🔐 Google Calendar sign-in should use ConnectGoogleCalendarButton component');
    throw new Error('Use ConnectGoogleCalendarButton component for Google OAuth sign-in');
  }

  private async makeApiCall(action: string, params: any = {}): Promise<any> {
    if (!this.available) {
      throw new Error('Google Calendar service not available');
    }

    if (!this.baseUrl) {
      throw new Error('Supabase URL not configured');
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!anonKey) {
        throw new Error('Supabase anon key not configured');
      }

      const response = await fetch(`${this.baseUrl}/google-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          action,
          userId: user.id,
          ...params
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `API call failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Google Calendar API call failed (${action}):`, error);
      throw error;
    }
  }

  async listUpcoming(maxResults: number = 10): Promise<GoogleCalendarEvent[]> {
    console.log('📅 Listing upcoming events...');
    
    try {
      const data = await this.makeApiCall('listUpcoming', { maxResults });
      return data.items || [];
    } catch (error) {
      console.error('❌ Failed to list upcoming events:', error);
      throw error;
    }
  }

  async getEvents(options: CalendarListOptions = {}): Promise<GoogleCalendarEvent[]> {
    console.log('📅 Getting events with options:', options);
    
    try {
      const data = await this.makeApiCall('getEvents', options);
      return data.items || [];
    } catch (error) {
      console.error('❌ Failed to get events:', error);
      throw error;
    }
  }

  async insertEvent(event: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent> {
    console.log('📅 Creating event:', event.summary);
    
    try {
      const createdEvent = await this.makeApiCall('insertEvent', { event });
      console.log('✅ Event created successfully');
      return createdEvent;
    } catch (error) {
      console.error('❌ Failed to create event:', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, event: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent> {
    console.log('📅 Updating event:', eventId);
    
    try {
      const updatedEvent = await this.makeApiCall('updateEvent', { eventId, event });
      console.log('✅ Event updated successfully');
      return updatedEvent;
    } catch (error) {
      console.error('❌ Failed to update event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    console.log('📅 Deleting event:', eventId);
    
    try {
      await this.makeApiCall('deleteEvent', { eventId });
      console.log('✅ Event deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete event:', error);
      throw error;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();