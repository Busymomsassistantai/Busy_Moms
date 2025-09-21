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
  private baseUrl = 'https://chic-duckanoo-b6e66f.netlify.app/.netlify/functions';
  private initialized = false;
  private available = false;
  private ready = false;
  private signedIn = false;

  async initialize(): Promise<void> {
    console.log('🔧 Initializing Google Calendar service...');
    
    try {
      // Check if the service is available by testing connection
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || `anon_${Date.now()}`;
      
      const response = await fetch(`${this.baseUrl}/google-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'isConnected',
          userId
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
    console.log('🔐 Starting Google Calendar sign-in...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || `anon_${Date.now()}`;
      
      // Build the auth URL and redirect
      const return_to = encodeURIComponent(window.location.origin);
      const authUrl = `${this.baseUrl}/google-auth-start?user_id=${userId}&return_to=${return_to}`;
      
      console.log('🚀 Redirecting to Google OAuth:', authUrl);
      window.location.href = authUrl;
    } catch (error) {
      console.error('❌ Sign-in failed:', error);
      throw new Error(`Sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async makeApiCall(action: string, params: any = {}): Promise<any> {
    if (!this.available) {
      throw new Error('Google Calendar service not available');
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || `anon_${Date.now()}`;

      const response = await fetch(`${this.baseUrl}/google-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          userId,
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