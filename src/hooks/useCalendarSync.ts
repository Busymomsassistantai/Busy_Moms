import { useState, useEffect, useCallback, useRef } from 'react';
import { syncOrchestrator } from '../services/syncOrchestrator';
import { calendarSyncService } from '../services/calendarSync';
import type { SyncResult, SyncConflict } from '../services/calendarSync';
import { useAuth } from './useAuth';

export function useCalendarSync() {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<SyncConflict[]>([]);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [syncFrequencyMinutes, setSyncFrequencyMinutes] = useState(15);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [nextSyncTime, setNextSyncTime] = useState<Date | null>(null);

  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncAttemptRef = useRef<Date | null>(null);

  /**
   * Load sync preferences
   */
  const loadSyncPreferences = useCallback(async () => {
    if (!user?.id) return;

    const prefs = await calendarSyncService.getUserSyncPreferences(user.id);
    if (prefs) {
      setSyncEnabled(prefs.sync_enabled);
      setSyncFrequencyMinutes(prefs.sync_frequency_minutes);
      if (prefs.last_sync_at) {
        setLastSyncTime(new Date(prefs.last_sync_at));
      }
    }
  }, [user?.id]);

  /**
   * Load pending conflicts
   */
  const loadPendingConflicts = useCallback(async () => {
    if (!user?.id) return;

    const conflicts = await calendarSyncService.getPendingConflicts(user.id);
    setPendingConflicts(conflicts);
  }, [user?.id]);

  /**
   * Perform manual sync
   */
  const performSync = useCallback(async () => {
    if (!user?.id || isSyncing) return;

    console.log('🔄 Starting manual sync...');
    setIsSyncing(true);
    lastSyncAttemptRef.current = new Date();

    try {
      const result = await syncOrchestrator.performFullSync(user.id);
      setLastSyncResult(result);
      setLastSyncTime(new Date());

      // Reload conflicts if any were detected
      if (result.conflictsDetected > 0) {
        await loadPendingConflicts();
      }

      return result;
    } catch (error) {
      console.error('❌ Sync failed:', error);
      const errorResult: SyncResult = {
        success: false,
        logId: '',
        eventsProcessed: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        conflictsDetected: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
      setLastSyncResult(errorResult);
      return errorResult;
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id, isSyncing, loadPendingConflicts]);

  /**
   * Update sync preferences
   */
  const updateSyncPreferences = useCallback(async (
    updates: {
      sync_enabled?: boolean;
      sync_frequency_minutes?: number;
      sync_direction?: 'bidirectional' | 'google_to_local' | 'local_to_google';
    }
  ) => {
    if (!user?.id) return false;

    const success = await calendarSyncService.updateUserSyncPreferences(user.id, updates);

    if (success) {
      if (updates.sync_enabled !== undefined) {
        setSyncEnabled(updates.sync_enabled);
      }
      if (updates.sync_frequency_minutes !== undefined) {
        setSyncFrequencyMinutes(updates.sync_frequency_minutes);
      }
    }

    return success;
  }, [user?.id]);

  /**
   * Resolve a conflict
   */
  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'keep_local' | 'keep_google' | 'merge'
  ) => {
    if (!user?.id) return false;

    const success = await calendarSyncService.resolveConflict(conflictId, resolution, user.id);

    if (success) {
      // Remove from pending conflicts
      setPendingConflicts(prev => prev.filter(c => c.id !== conflictId));

      // If resolution was chosen, apply it
      const conflict = pendingConflicts.find(c => c.id === conflictId);
      if (conflict) {
        if (resolution === 'keep_google') {
          // Update local event with Google data
          await syncOrchestrator.syncSingleEvent(user.id, conflict.google_event_id, 'google_to_local');
        } else if (resolution === 'keep_local' && conflict.local_event_id) {
          // Update Google event with local data
          await syncOrchestrator.syncSingleEvent(user.id, conflict.local_event_id, 'local_to_google');
        }
      }
    }

    return success;
  }, [user?.id, pendingConflicts]);

  /**
   * Calculate next sync time
   */
  const calculateNextSyncTime = useCallback(() => {
    if (!lastSyncTime || !syncEnabled) {
      setNextSyncTime(null);
      return;
    }

    const next = new Date(lastSyncTime);
    next.setMinutes(next.getMinutes() + syncFrequencyMinutes);
    setNextSyncTime(next);
  }, [lastSyncTime, syncEnabled, syncFrequencyMinutes]);

  /**
   * Check if sync is needed
   */
  const checkSyncNeeded = useCallback(() => {
    if (!syncEnabled || !user?.id || isSyncing) return false;

    // Don't sync if we just attempted
    if (lastSyncAttemptRef.current) {
      const timeSinceLastAttempt = Date.now() - lastSyncAttemptRef.current.getTime();
      if (timeSinceLastAttempt < 60000) { // Wait at least 1 minute between attempts
        return false;
      }
    }

    if (!lastSyncTime) return true;

    const now = new Date();
    const timeSinceLastSync = now.getTime() - lastSyncTime.getTime();
    const syncIntervalMs = syncFrequencyMinutes * 60 * 1000;

    return timeSinceLastSync >= syncIntervalMs;
  }, [syncEnabled, user?.id, isSyncing, lastSyncTime, syncFrequencyMinutes]);

  /**
   * Setup periodic sync timer
   */
  useEffect(() => {
    if (!syncEnabled || !user?.id) {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      return;
    }

    // Check every minute if sync is needed
    syncTimerRef.current = setInterval(() => {
      if (checkSyncNeeded()) {
        console.log('⏰ Automatic sync triggered');
        performSync();
      }
    }, 60000); // Check every minute

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [syncEnabled, user?.id, checkSyncNeeded, performSync]);

  /**
   * Update next sync time when dependencies change
   */
  useEffect(() => {
    calculateNextSyncTime();
  }, [calculateNextSyncTime]);

  /**
   * Load preferences and conflicts on mount
   */
  useEffect(() => {
    loadSyncPreferences();
    loadPendingConflicts();
  }, [loadSyncPreferences, loadPendingConflicts]);

  return {
    // State
    isSyncing,
    lastSyncResult,
    pendingConflicts,
    syncEnabled,
    syncFrequencyMinutes,
    lastSyncTime,
    nextSyncTime,

    // Actions
    performSync,
    updateSyncPreferences,
    resolveConflict,
    loadPendingConflicts,
  };
}
