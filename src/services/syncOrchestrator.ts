import { supabase } from '../lib/supabase';
import type { Event } from '../lib/supabase';
import { googleCalendarService, GoogleCalendarEvent } from './googleCalendar';
import { calendarSyncService, SyncResult } from './calendarSync';

export class SyncOrchestrator {
  private syncInProgress = false;

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * Perform a full bidirectional sync
   */
  async performFullSync(userId: string): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        logId: '',
        eventsProcessed: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        conflictsDetected: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    let logId: string | null = null;

    const result: SyncResult = {
      success: false,
      logId: '',
      eventsProcessed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      conflictsDetected: 0,
      errors: [],
    };

    try {
      console.log('🔄 Starting full bidirectional sync for user:', userId);

      // Get user preferences
      const prefs = await calendarSyncService.getUserSyncPreferences(userId);
      if (!prefs || !prefs.sync_enabled) {
        result.errors.push('Sync is disabled for this user');
        return result;
      }

      // Initialize Google Calendar service
      await googleCalendarService.initialize();
      if (!googleCalendarService.isSignedIn()) {
        result.errors.push('Google Calendar not connected');
        return result;
      }

      // Create sync log
      logId = await calendarSyncService.createSyncLog(userId, 'full_sync', prefs.sync_direction);
      if (!logId) {
        result.errors.push('Failed to create sync log');
        return result;
      }
      result.logId = logId;

      // Fetch local events
      const { data: localEvents, error: localError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId);

      if (localError) {
        result.errors.push(`Failed to fetch local events: ${localError.message}`);
        return result;
      }

      // Fetch Google Calendar events (last 3 months to future 6 months)
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 3);
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 6);

      const googleEvents = await googleCalendarService.getEvents({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 250,
      });

      console.log(`📊 Found ${localEvents?.length || 0} local events and ${googleEvents.length} Google events`);

      // Get existing sync mappings
      const mappings = await calendarSyncService.getSyncMappings(userId);
      const mappingsByLocalId = new Map(
        mappings.filter(m => m.local_event_id).map(m => [m.local_event_id!, m])
      );
      const mappingsByGoogleId = new Map(
        mappings.map(m => [m.google_event_id, m])
      );

      // Process events based on sync direction
      if (prefs.sync_direction === 'bidirectional' || prefs.sync_direction === 'google_to_local') {
        const googleResult = await this.syncGoogleToLocal(
          userId,
          googleEvents,
          localEvents || [],
          mappingsByGoogleId
        );
        result.eventsCreated += googleResult.created;
        result.eventsUpdated += googleResult.updated;
        result.conflictsDetected += googleResult.conflicts;
        result.errors.push(...googleResult.errors);
      }

      if (prefs.sync_direction === 'bidirectional' || prefs.sync_direction === 'local_to_google') {
        const localResult = await this.syncLocalToGoogle(
          userId,
          localEvents || [],
          googleEvents,
          mappingsByLocalId
        );
        result.eventsCreated += localResult.created;
        result.eventsUpdated += localResult.updated;
        result.conflictsDetected += localResult.conflicts;
        result.errors.push(...localResult.errors);
      }

      result.eventsProcessed = (localEvents?.length || 0) + googleEvents.length;
      result.success = result.errors.length === 0;

      // Update sync preferences
      await calendarSyncService.updateUserSyncPreferences(userId, {
        last_sync_at: new Date().toISOString(),
        last_successful_sync_at: result.success ? new Date().toISOString() : prefs.last_successful_sync_at,
      });

      // Update sync log
      const duration = Date.now() - startTime;
      await calendarSyncService.updateSyncLog(logId, {
        status: result.success ? 'completed' : 'failed',
        events_processed: result.eventsProcessed,
        events_created: result.eventsCreated,
        events_updated: result.eventsUpdated,
        events_deleted: result.eventsDeleted,
        conflicts_detected: result.conflictsDetected,
        error_count: result.errors.length,
        error_details: result.errors.length > 0 ? { errors: result.errors } : null,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
      });

      console.log('✅ Sync completed:', result);
      return result;
    } catch (error) {
      console.error('❌ Sync failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');

      if (logId) {
        await calendarSyncService.updateSyncLog(logId, {
          status: 'failed',
          error_count: result.errors.length,
          error_details: { errors: result.errors },
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        });
      }

      return result;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync Google Calendar events to local database
   */
  private async syncGoogleToLocal(
    userId: string,
    googleEvents: GoogleCalendarEvent[],
    localEvents: Event[],
    mappingsByGoogleId: Map<string, any>
  ): Promise<{ created: number; updated: number; conflicts: number; errors: string[] }> {
    const result = { created: 0, updated: 0, conflicts: 0, errors: [] as string[] };

    for (const googleEvent of googleEvents) {
      if (!googleEvent.id) continue;

      try {
        const mapping = mappingsByGoogleId.get(googleEvent.id);

        if (!mapping) {
          // New Google event - create locally
          const localEventData = calendarSyncService.googleEventToLocal(googleEvent, userId);
          const { data: newEvent, error } = await supabase
            .from('events')
            .insert([localEventData])
            .select()
            .single();

          if (error) {
            result.errors.push(`Failed to create local event: ${error.message}`);
            continue;
          }

          // Create mapping
          await calendarSyncService.upsertSyncMapping({
            user_id: userId,
            local_event_id: newEvent.id,
            google_event_id: googleEvent.id,
            sync_status: 'synced',
            local_hash: calendarSyncService.generateEventHash(newEvent),
            google_hash: calendarSyncService.generateEventHash(googleEvent),
            last_synced_at: new Date().toISOString(),
          });

          result.created++;
          console.log(`✅ Created local event from Google: ${googleEvent.summary}`);
        } else {
          // Existing mapping - check for changes
          const currentGoogleHash = calendarSyncService.generateEventHash(googleEvent);

          if (currentGoogleHash !== mapping.google_hash) {
            // Google event changed - check local event
            const { data: localEvent, error: fetchError } = await supabase
              .from('events')
              .select('*')
              .eq('id', mapping.local_event_id)
              .maybeSingle();

            if (fetchError || !localEvent) {
              result.errors.push(`Failed to fetch local event: ${mapping.local_event_id}`);
              continue;
            }

            const currentLocalHash = calendarSyncService.generateEventHash(localEvent);

            if (currentLocalHash !== mapping.local_hash) {
              // Both changed - conflict!
              console.log('⚠️ Conflict detected:', googleEvent.summary);

              await calendarSyncService.createConflict({
                user_id: userId,
                local_event_id: mapping.local_event_id,
                google_event_id: googleEvent.id,
                conflict_type: 'modification',
                local_event_data: localEvent,
                google_event_data: googleEvent,
                local_modified_at: localEvent.updated_at,
                google_modified_at: googleEvent.updated,
              });

              result.conflicts++;
            } else {
              // Only Google changed - update local
              const localEventData = calendarSyncService.googleEventToLocal(googleEvent, userId);
              const { error: updateError } = await supabase
                .from('events')
                .update(localEventData)
                .eq('id', mapping.local_event_id);

              if (updateError) {
                result.errors.push(`Failed to update local event: ${updateError.message}`);
                continue;
              }

              // Update mapping
              await calendarSyncService.upsertSyncMapping({
                ...mapping,
                local_hash: currentGoogleHash,
                google_hash: currentGoogleHash,
                last_synced_at: new Date().toISOString(),
                sync_status: 'synced',
              });

              result.updated++;
              console.log(`✅ Updated local event from Google: ${googleEvent.summary}`);
            }
          }
        }
      } catch (error) {
        result.errors.push(`Error processing Google event ${googleEvent.id}: ${error}`);
      }
    }

    return result;
  }

  /**
   * Sync local events to Google Calendar
   */
  private async syncLocalToGoogle(
    userId: string,
    localEvents: Event[],
    googleEvents: GoogleCalendarEvent[],
    mappingsByLocalId: Map<string, any>
  ): Promise<{ created: number; updated: number; conflicts: number; errors: string[] }> {
    const result = { created: 0, updated: 0, conflicts: 0, errors: [] as string[] };

    const googleEventsById = new Map(googleEvents.map(e => [e.id!, e]));

    for (const localEvent of localEvents) {
      try {
        const mapping = mappingsByLocalId.get(localEvent.id);

        if (!mapping) {
          // New local event - create in Google Calendar
          const googleEventData = calendarSyncService.localEventToGoogle(localEvent);

          try {
            const createdGoogleEvent = await googleCalendarService.insertEvent(googleEventData);

            // Create mapping
            await calendarSyncService.upsertSyncMapping({
              user_id: userId,
              local_event_id: localEvent.id,
              google_event_id: createdGoogleEvent.id!,
              sync_status: 'synced',
              local_hash: calendarSyncService.generateEventHash(localEvent),
              google_hash: calendarSyncService.generateEventHash(createdGoogleEvent),
              last_synced_at: new Date().toISOString(),
            });

            result.created++;
            console.log(`✅ Created Google event from local: ${localEvent.title}`);
          } catch (error) {
            result.errors.push(`Failed to create Google event: ${error}`);
          }
        } else {
          // Existing mapping - check for changes
          const currentLocalHash = calendarSyncService.generateEventHash(localEvent);

          if (currentLocalHash !== mapping.local_hash) {
            // Local event changed - check Google event
            const googleEvent = googleEventsById.get(mapping.google_event_id);

            if (!googleEvent) {
              result.errors.push(`Google event not found: ${mapping.google_event_id}`);
              continue;
            }

            const currentGoogleHash = calendarSyncService.generateEventHash(googleEvent);

            if (currentGoogleHash !== mapping.google_hash) {
              // Both changed - conflict already detected in Google to local sync
              // Skip to avoid duplicate conflict
              continue;
            } else {
              // Only local changed - update Google
              const googleEventData = calendarSyncService.localEventToGoogle(localEvent);

              try {
                const updatedGoogleEvent = await googleCalendarService.updateEvent(
                  mapping.google_event_id,
                  googleEventData
                );

                // Update mapping
                await calendarSyncService.upsertSyncMapping({
                  ...mapping,
                  local_hash: currentLocalHash,
                  google_hash: calendarSyncService.generateEventHash(updatedGoogleEvent),
                  last_synced_at: new Date().toISOString(),
                  sync_status: 'synced',
                });

                result.updated++;
                console.log(`✅ Updated Google event from local: ${localEvent.title}`);
              } catch (error) {
                result.errors.push(`Failed to update Google event: ${error}`);
              }
            }
          }
        }
      } catch (error) {
        result.errors.push(`Error processing local event ${localEvent.id}: ${error}`);
      }
    }

    return result;
  }

  /**
   * Sync a single event immediately
   */
  async syncSingleEvent(
    userId: string,
    eventId: string,
    direction: 'local_to_google' | 'google_to_local'
  ): Promise<boolean> {
    try {
      console.log(`🔄 Syncing single event: ${eventId}, direction: ${direction}`);

      if (direction === 'local_to_google') {
        // Get local event
        const { data: localEvent, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .eq('user_id', userId)
          .single();

        if (error || !localEvent) {
          console.error('Failed to fetch local event:', error);
          return false;
        }

        // Check if mapping exists
        const mapping = await calendarSyncService.getSyncMappingByLocalId(userId, eventId);

        if (mapping) {
          // Update existing Google event
          const googleEventData = calendarSyncService.localEventToGoogle(localEvent);
          await googleCalendarService.updateEvent(mapping.google_event_id, googleEventData);

          // Update mapping
          await calendarSyncService.upsertSyncMapping({
            ...mapping,
            local_hash: calendarSyncService.generateEventHash(localEvent),
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced',
          });
        } else {
          // Create new Google event
          const googleEventData = calendarSyncService.localEventToGoogle(localEvent);
          const createdEvent = await googleCalendarService.insertEvent(googleEventData);

          // Create mapping
          await calendarSyncService.upsertSyncMapping({
            user_id: userId,
            local_event_id: eventId,
            google_event_id: createdEvent.id!,
            sync_status: 'synced',
            local_hash: calendarSyncService.generateEventHash(localEvent),
            google_hash: calendarSyncService.generateEventHash(createdEvent),
            last_synced_at: new Date().toISOString(),
          });
        }

        console.log('✅ Single event synced successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to sync single event:', error);
      return false;
    }
  }
}

export const syncOrchestrator = new SyncOrchestrator();
