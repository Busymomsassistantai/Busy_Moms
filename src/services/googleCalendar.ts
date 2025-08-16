// Google Calendar API integration using Google Identity Services
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
}

export class GoogleCalendarService {
  private isInitialized = false;
  private accessToken: string | null = null;
  private clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  
  // Google Calendar API configuration
  private readonly DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private readonly SCOPES = 'https://www.googleapis.com/auth/calendar';

  constructor() {
    if (!this.clientId) {
      console.warn('Google Client ID not found. Please set VITE_GOOGLE_CLIENT_ID in your environment variables.');
    }
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      // Wait for Google APIs to load
      await this.waitForGoogleAPIs();
      
      // Initialize gapi
      await new Promise<void>((resolve, reject) => {
        window.gapi.load('client', {
          callback: resolve,
          onerror: reject
        });
      });

      // Initialize the Google API client
      await window.gapi.client.init({
        discoveryDocs: [this.DISCOVERY_DOC],
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Calendar API:', error);
      return false;
    }
  }

  private waitForGoogleAPIs(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkAPIs = () => {
        if (window.google && window.gapi) {
          resolve();
        } else {
          setTimeout(checkAPIs, 100);
        }
      };
      
      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Google APIs failed to load')), 10000);
      checkAPIs();
    });
  }

  async signIn(): Promise<boolean> {
    if (!this.clientId) {
      throw new Error('Google Client ID is required. Please set VITE_GOOGLE_CLIENT_ID environment variable.');
    }

    try {
      await this.initialize();

      return new Promise((resolve, reject) => {
        window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: this.SCOPES,
          callback: (response: any) => {
            if (response.error) {
              console.error('Google OAuth error:', response.error);
              reject(new Error(response.error));
              return;
            }
            
            this.accessToken = response.access_token;
            window.gapi.client.setToken({ access_token: this.accessToken });
            resolve(true);
          },
        }).requestAccessToken();
      });
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    if (this.accessToken) {
      window.google.accounts.oauth2.revoke(this.accessToken);
      this.accessToken = null;
      window.gapi.client.setToken(null);
    }
  }

  isSignedIn(): boolean {
    return !!this.accessToken;
  }

  async getEvents(timeMin?: string, timeMax?: string): Promise<GoogleCalendarEvent[]> {
    if (!this.isSignedIn()) {
      throw new Error('Not signed in to Google Calendar');
    }

    try {
      const now = new Date();
      const response = await window.gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin || now.toISOString(),
        timeMax: timeMax || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        showDeleted: false,
        singleEvents: true,
        maxResults: 50,
        orderBy: 'startTime',
      });

      return response.result.items || [];
    } catch (error) {
      console.error('Failed to fetch Google Calendar events:', error);
      throw error;
    }
  }

  async createEvent(event: {
    summary: string;
    description?: string;
    start: { dateTime: string } | { date: string };
    end: { dateTime: string } | { date: string };
    location?: string;
    attendees?: Array<{ email: string }>;
  }): Promise<GoogleCalendarEvent> {
    if (!this.isSignedIn()) {
      throw new Error('Not signed in to Google Calendar');
    }

    try {
      const response = await window.gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      return response.result;
    } catch (error) {
      console.error('Failed to create Google Calendar event:', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, event: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent> {
    if (!this.isSignedIn()) {
      throw new Error('Not signed in to Google Calendar');
    }

    try {
      const response = await window.gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: event,
      });

      return response.result;
    } catch (error) {
      console.error('Failed to update Google Calendar event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!this.isSignedIn()) {
      throw new Error('Not signed in to Google Calendar');
    }

    try {
      await window.gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
    } catch (error) {
      console.error('Failed to delete Google Calendar event:', error);
      throw error;
    }
  }

  // Convert Google Calendar event to our app's event format
  convertToAppEvent(googleEvent: GoogleCalendarEvent): any {
    const startDateTime = googleEvent.start.dateTime || googleEvent.start.date;
    const endDateTime = googleEvent.end.dateTime || googleEvent.end.date;
    
    const startDate = new Date(startDateTime!);
    const endDate = new Date(endDateTime!);

    return {
      id: googleEvent.id,
      title: googleEvent.summary,
      description: googleEvent.description || '',
      event_date: startDate.toISOString().split('T')[0],
      start_time: googleEvent.start.dateTime ? startDate.toTimeString().slice(0, 5) : null,
      end_time: googleEvent.end.dateTime ? endDate.toTimeString().slice(0, 5) : null,
      location: googleEvent.location || '',
      event_type: 'other' as const,
      participants: googleEvent.attendees?.map(a => a.displayName || a.email) || [],
      source: 'calendar_sync' as const,
    };
  }

  // Convert our app's event to Google Calendar format
  convertToGoogleEvent(appEvent: any): any {
    const eventDate = new Date(appEvent.event_date);
    
    let start, end;
    
    if (appEvent.start_time) {
      const [hours, minutes] = appEvent.start_time.split(':');
      const startDateTime = new Date(eventDate);
      startDateTime.setHours(parseInt(hours), parseInt(minutes));
      
      start = { dateTime: startDateTime.toISOString() };
      
      if (appEvent.end_time) {
        const [endHours, endMinutes] = appEvent.end_time.split(':');
        const endDateTime = new Date(eventDate);
        endDateTime.setHours(parseInt(endHours), parseInt(endMinutes));
        end = { dateTime: endDateTime.toISOString() };
      } else {
        // Default to 1 hour duration
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
        end = { dateTime: endDateTime.toISOString() };
      }
    } else {
      // All-day event
      start = { date: appEvent.event_date };
      const nextDay = new Date(eventDate);
      nextDay.setDate(nextDay.getDate() + 1);
      end = { date: nextDay.toISOString().split('T')[0] };
    }

    return {
      summary: appEvent.title,
      description: appEvent.description,
      start,
      end,
      location: appEvent.location,
      attendees: appEvent.participants?.map((name: string) => ({ displayName: name })) || [],
    };
  }
}

export const googleCalendarService = new GoogleCalendarService();