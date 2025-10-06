import { supabase } from '../lib/supabase';
import type { Event } from '../lib/supabase';
import { googleCalendarService, GoogleCalendarEvent } from './googleCalendar';

// Types for sync system
export interface SyncMapping {
  id: string;
  user_id: string;
  local_event_id: string | null;
  google_event_id: string;
  sync_status: 'synced' | 'pending' | 'error';
  last_synced_at: string;
  local_hash: string | null;
  google_hash: string | null;
  sync_direction: 'bidirectional' | 'local_to_google' | 'google_to_local';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncConflict {
  id: string;
  user_id: string;
  local_event_id: string | null;
  google_event_id: string;
  conflict_type: 'modification' | 'deletion';
  local_event_data: any;
  google_event_data: any;
  local_modified_at: string | null;
  google_modified_at: string | null;
  detected_at: string;
  resolution_status: 'pending' | 'resolved' | 'ignored';
  resolution_choice: 'keep_local' | 'keep_google' | 'merge' | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface SyncLog {
  id: string;
  user_id: string;
  sync_operation: 'full_sync' | 'event_create' | 'event_update' | 'event_delete';
  sync_direction: 'local_to_google' | 'google_to_local' | 'bidirectional';
  status: 'in_progress' | 'completed' | 'failed';
  events_processed: number;
  events_created: number;
  events_updated: number;
  events_deleted: number;
  conflicts_detected: number;
  error_count: number;
  error_details: any;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

export interface UserSyncPreferences {
  user_id: string;
  sync_enabled: boolean;
  sync_frequency_minutes: number;
  sync_direction: 'bidirectional' | 'google_to_local' | 'local_to_google';
  auto_resolve_conflicts: boolean;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  sync_calendar_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  success: boolean;
  logId: string;
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  conflictsDetected: number;
  errors: string[];
}

// Event change detection with hash generation
export class CalendarSyncService {
  /**
   * Generate a hash for an event to detect changes
   */
  generateEventHash(event: Event | GoogleCalendarEvent): string {
    // For local events
    if ('event_date' in event) {
      const data = {
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        start_time: event.start_time,
        end_time: event.end_time,
        location: event.location,
        participants: event.participants,
        event_type: event.event_type,
      };
      return this.simpleHash(JSON.stringify(data));
    }

    // For Google Calendar events
    const data = {
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      location: event.location,
      attendees: event.attendees,
    };
    return this.simpleHash(JSON.stringify(data));
  }

  /**
   * Simple hash function for change detection
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Convert Google Calendar event to local event format
   */
  googleEventToLocal(googleEvent: GoogleCalendarEvent, userId: string): Partial<Event> {
    // Extract date and time from Google Calendar event
    let event_date = '';
    let start_time = null;
    let end_time = null;

    if (googleEvent.start?.date) {
      // All-day event
      event_date = googleEvent.start.date;
    } else if (googleEvent.start?.dateTime) {
      const startDateTime = new Date(googleEvent.start.dateTime);
      event_date = startDateTime.toISOString().split('T')[0];
      start_time = startDateTime.toTimeString().split(' ')[0];

      if (googleEvent.end?.dateTime) {
        const endDateTime = new Date(googleEvent.end.dateTime);
        end_time = endDateTime.toTimeString().split(' ')[0];
      }
    }

    return {
      user_id: userId,
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description || null,
      event_date,
      start_time,
      end_time,
      location: googleEvent.location || null,
      participants: googleEvent.attendees?.map(a => a.email || a.displayName || '') || null,
      event_type: 'other',
      source: 'google',
    };
  }

  /**
   * Convert local event to Google Calendar event format
   */
  localEventToGoogle(localEvent: Event): Partial<GoogleCalendarEvent> {
    const googleEvent: Partial<GoogleCalendarEvent> = {
      summary: localEvent.title,
      description: localEvent.description || undefined,
      location: localEvent.location || undefined,
    };

    // Set start and end times
    if (localEvent.start_time) {
      googleEvent.start = {
        dateTime: `${localEvent.event_date}T${localEvent.start_time}`,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      if (localEvent.end_time) {
        googleEvent.end = {
          dateTime: `${localEvent.event_date}T${localEvent.end_time}`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }
    } else {
      // All-day event
      googleEvent.start = {
        date: localEvent.event_date,
      };

      const nextDay = new Date(localEvent.event_date);
      nextDay.setDate(nextDay.getDate() + 1);
      googleEvent.end = {
        date: nextDay.toISOString().split('T')[0],
      };
    }

    // Add attendees if any
    if (localEvent.participants && localEvent.participants.length > 0) {
      googleEvent.attendees = localEvent.participants.map(p => ({
        email: p.includes('@') ? p : undefined,
        displayName: !p.includes('@') ? p : undefined,
      }));
    }

    return googleEvent;
  }

  /**
   * Get or create user sync preferences
   */
  async getUserSyncPreferences(userId: string): Promise<UserSyncPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('user_sync_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching sync preferences:', error);
        return null;
      }

      if (!data) {
        // Create default preferences
        const { data: newPrefs, error: insertError } = await supabase
          .from('user_sync_preferences')
          .insert([{
            user_id: userId,
            sync_enabled: true,
            sync_frequency_minutes: 15,
            sync_direction: 'bidirectional',
            auto_resolve_conflicts: false,
            sync_calendar_ids: ['primary'],
          }])
          .select()
          .single();

        if (insertError) {
          console.error('Error creating sync preferences:', insertError);
          return null;
        }

        return newPrefs as UserSyncPreferences;
      }

      return data as UserSyncPreferences;
    } catch (error) {
      console.error('Error in getUserSyncPreferences:', error);
      return null;
    }
  }

  /**
   * Update user sync preferences
   */
  async updateUserSyncPreferences(
    userId: string,
    updates: Partial<UserSyncPreferences>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sync_preferences')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating sync preferences:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateUserSyncPreferences:', error);
      return false;
    }
  }

  /**
   * Create a sync log entry
   */
  async createSyncLog(
    userId: string,
    operation: SyncLog['sync_operation'],
    direction: SyncLog['sync_direction']
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('calendar_sync_logs')
        .insert([{
          user_id: userId,
          sync_operation: operation,
          sync_direction: direction,
          status: 'in_progress',
          events_processed: 0,
          events_created: 0,
          events_updated: 0,
          events_deleted: 0,
          conflicts_detected: 0,
          error_count: 0,
          started_at: new Date().toISOString(),
        }])
        .select('id')
        .single();

      if (error) {
        console.error('Error creating sync log:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Error in createSyncLog:', error);
      return null;
    }
  }

  /**
   * Update a sync log entry
   */
  async updateSyncLog(
    logId: string,
    updates: Partial<SyncLog>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('calendar_sync_logs')
        .update(updates)
        .eq('id', logId);

      if (error) {
        console.error('Error updating sync log:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateSyncLog:', error);
      return false;
    }
  }

  /**
   * Get all sync mappings for a user
   */
  async getSyncMappings(userId: string): Promise<SyncMapping[]> {
    try {
      const { data, error } = await supabase
        .from('calendar_sync_mappings')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching sync mappings:', error);
        return [];
      }

      return data as SyncMapping[];
    } catch (error) {
      console.error('Error in getSyncMappings:', error);
      return [];
    }
  }

  /**
   * Get sync mapping by local event ID
   */
  async getSyncMappingByLocalId(userId: string, localEventId: string): Promise<SyncMapping | null> {
    try {
      const { data, error } = await supabase
        .from('calendar_sync_mappings')
        .select('*')
        .eq('user_id', userId)
        .eq('local_event_id', localEventId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sync mapping:', error);
        return null;
      }

      return data as SyncMapping | null;
    } catch (error) {
      console.error('Error in getSyncMappingByLocalId:', error);
      return null;
    }
  }

  /**
   * Get sync mapping by Google event ID
   */
  async getSyncMappingByGoogleId(userId: string, googleEventId: string): Promise<SyncMapping | null> {
    try {
      const { data, error } = await supabase
        .from('calendar_sync_mappings')
        .select('*')
        .eq('user_id', userId)
        .eq('google_event_id', googleEventId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sync mapping:', error);
        return null;
      }

      return data as SyncMapping | null;
    } catch (error) {
      console.error('Error in getSyncMappingByGoogleId:', error);
      return null;
    }
  }

  /**
   * Create or update a sync mapping
   */
  async upsertSyncMapping(mapping: Partial<SyncMapping>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('calendar_sync_mappings')
        .upsert([{
          ...mapping,
          updated_at: new Date().toISOString(),
        }]);

      if (error) {
        console.error('Error upserting sync mapping:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in upsertSyncMapping:', error);
      return false;
    }
  }

  /**
   * Get all pending conflicts for a user
   */
  async getPendingConflicts(userId: string): Promise<SyncConflict[]> {
    try {
      const { data, error } = await supabase
        .from('calendar_sync_conflicts')
        .select('*')
        .eq('user_id', userId)
        .eq('resolution_status', 'pending')
        .order('detected_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending conflicts:', error);
        return [];
      }

      return data as SyncConflict[];
    } catch (error) {
      console.error('Error in getPendingConflicts:', error);
      return [];
    }
  }

  /**
   * Create a conflict record
   */
  async createConflict(conflict: Partial<SyncConflict>): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('calendar_sync_conflicts')
        .insert([{
          ...conflict,
          detected_at: new Date().toISOString(),
          resolution_status: 'pending',
        }])
        .select('id')
        .single();

      if (error) {
        console.error('Error creating conflict:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Error in createConflict:', error);
      return null;
    }
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'keep_local' | 'keep_google' | 'merge',
    userId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('calendar_sync_conflicts')
        .update({
          resolution_status: 'resolved',
          resolution_choice: resolution,
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
        })
        .eq('id', conflictId);

      if (error) {
        console.error('Error resolving conflict:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in resolveConflict:', error);
      return false;
    }
  }
}

export const calendarSyncService = new CalendarSyncService();
