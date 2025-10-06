# Google Calendar Bidirectional Sync System

## Overview

This system provides automatic bidirectional synchronization between your local calendar database and Google Calendar, with intelligent conflict detection and manual resolution.

## Features

### 1. Bidirectional Sync
- Events sync from Google Calendar to local database
- Events sync from local database to Google Calendar
- Automatic change detection using hash-based fingerprinting
- Configurable sync direction (bidirectional, one-way)

### 2. Conflict Detection & Resolution
- Detects when events are modified in both places since last sync
- Manual conflict resolution with side-by-side comparison
- Options to keep local version, keep Google version, or skip
- Visual diff showing what changed in each version

### 3. Periodic Automatic Sync
- Configurable sync frequency (5 minutes to 4 hours)
- Background sync timer checks every minute
- Automatic sync disabled when conflicts are pending
- Syncs only when changes are detected

### 4. Sync Monitoring & Control
- Real-time sync status display
- Last sync time and next scheduled sync
- Sync statistics (events processed, created, updated)
- Error reporting with detailed messages
- Sync history logging

## Architecture

### Database Schema

#### `calendar_sync_mappings`
Links local events to Google Calendar events:
- `local_event_id` - References events table
- `google_event_id` - Google Calendar event ID
- `local_hash` - Hash of local event data
- `google_hash` - Hash of Google event data
- `sync_status` - synced, pending, or error
- `last_synced_at` - Timestamp of last successful sync

#### `calendar_sync_conflicts`
Stores detected conflicts for manual resolution:
- `local_event_data` - JSON snapshot of local version
- `google_event_data` - JSON snapshot of Google version
- `conflict_type` - modification or deletion
- `resolution_status` - pending, resolved, or ignored
- `resolution_choice` - keep_local, keep_google, or merge

#### `calendar_sync_logs`
Audit trail of all sync operations:
- `sync_operation` - full_sync, event_create, etc.
- `events_processed` - Count of events processed
- `conflicts_detected` - Count of conflicts found
- `error_details` - JSON with error messages
- `duration_ms` - Sync operation duration

#### `user_sync_preferences`
Per-user sync configuration:
- `sync_enabled` - Enable/disable automatic sync
- `sync_frequency_minutes` - How often to sync
- `sync_direction` - bidirectional, google_to_local, or local_to_google
- `last_sync_at` - Last sync attempt timestamp
- `last_successful_sync_at` - Last successful sync

### Services

#### `calendarSync.ts`
Core sync utilities:
- `generateEventHash()` - Creates fingerprints for change detection
- `googleEventToLocal()` - Converts Google Calendar format to local format
- `localEventToGoogle()` - Converts local format to Google Calendar format
- CRUD operations for mappings, conflicts, logs, and preferences

#### `syncOrchestrator.ts`
Manages the full sync workflow:
- `performFullSync()` - Executes complete bidirectional sync
- `syncGoogleToLocal()` - Syncs Google events to local database
- `syncLocalToGoogle()` - Syncs local events to Google Calendar
- `syncSingleEvent()` - Syncs individual event immediately

#### `useCalendarSync.ts` (React Hook)
Provides sync functionality to React components:
- Periodic sync timer management
- Sync state management (isSyncing, lastSyncResult, etc.)
- Conflict management and resolution
- User preference updates

### UI Components

#### `SyncStatus.tsx`
Displays current sync status:
- Last sync time (e.g., "5m ago")
- Next scheduled sync (e.g., "in 10m")
- Sync result with statistics
- Pending conflicts count
- Manual sync button

#### `SyncSettings.tsx`
Sync configuration modal:
- Enable/disable automatic sync
- Sync frequency selection
- Sync direction choice (bidirectional, one-way)
- Save preferences

#### `ConflictResolutionModal.tsx`
Conflict resolution interface:
- Side-by-side comparison of conflicting versions
- Shows local calendar version vs Google Calendar version
- Displays modification timestamps
- Resolution buttons (Keep Local, Keep Google, Skip)
- Navigation between multiple conflicts

## How It Works

### Sync Process Flow

1. **Initialization**
   - Check user sync preferences
   - Verify Google Calendar connection
   - Create sync log entry

2. **Fetch Data**
   - Load local events from database
   - Fetch Google Calendar events via API
   - Retrieve existing sync mappings

3. **Change Detection**
   - For each event, generate current hash
   - Compare current hash with last synced hash
   - Identify new, modified, and unchanged events

4. **Conflict Detection**
   - If both local and Google versions changed
   - Create conflict record with both versions
   - Mark for manual resolution

5. **Sync Execution**
   - **Google to Local**: Create/update local events from Google
   - **Local to Google**: Create/update Google events from local
   - Update sync mappings with new hashes

6. **Completion**
   - Update sync log with results
   - Update last sync timestamp
   - Load any new conflicts

### Hash-Based Change Detection

Events are fingerprinted using a hash of their key fields:
- Title, description, date, time
- Location, participants
- Event type

When syncing:
1. Calculate current hash
2. Compare to stored hash from last sync
3. If different, event was modified

This allows detecting changes without timestamps, which can be unreliable.

### Conflict Resolution

When a conflict is detected:

1. **Create Conflict Record**
   - Store both versions as JSON
   - Include modification timestamps
   - Set status to "pending"

2. **Display to User**
   - Show side-by-side comparison
   - Highlight what changed
   - Present resolution options

3. **User Chooses Resolution**
   - Keep Local: Update Google with local data
   - Keep Google: Update local with Google data
   - Skip: Resolve later

4. **Apply Resolution**
   - Sync chosen version to other side
   - Update sync mappings
   - Mark conflict as resolved

## Usage

### Initial Setup

1. **Connect Google Calendar**
   - Click "Connect Google Calendar" button
   - Authorize with Google OAuth
   - System creates default sync preferences

2. **Configure Sync**
   - Click "Sync Settings" button
   - Choose sync frequency (default: 15 minutes)
   - Select sync direction (default: bidirectional)
   - Save preferences

3. **First Sync**
   - Click "Sync Now" button
   - System syncs all events
   - May detect conflicts if events exist in both places

### Daily Use

1. **Automatic Sync**
   - System syncs automatically at configured intervals
   - No action required
   - Sync status widget shows progress

2. **Manual Sync**
   - Click "Sync Now" anytime
   - Useful after making bulk changes
   - Shows immediate feedback

3. **Resolving Conflicts**
   - Orange badge shows pending conflicts
   - Click "Resolve X Conflicts" button
   - Review each conflict
   - Choose which version to keep

### Best Practices

1. **Sync Frequency**
   - Set to 15-30 minutes for active use
   - Longer intervals (1-2 hours) for light use
   - Shorter intervals increase API usage

2. **Conflict Prevention**
   - Edit events in one place at a time
   - Wait for sync to complete before editing elsewhere
   - Use manual sync after bulk changes

3. **Monitoring**
   - Check sync status widget regularly
   - Resolve conflicts promptly
   - Review sync errors if they occur

## Troubleshooting

### Sync Not Working

1. **Check Connection**
   - Verify "Connected" status in Calendar view
   - Reconnect if needed

2. **Check Sync Settings**
   - Ensure sync is enabled
   - Verify sync frequency is set
   - Check sync direction matches intent

3. **Check for Errors**
   - Look at sync status widget
   - Read error messages
   - Try manual sync

### Conflicts Not Resolving

1. **Verify Resolution**
   - Ensure you clicked resolution button
   - Check conflict was marked as resolved
   - Try manual sync after resolution

2. **Check Sync Logs**
   - Review sync history in database
   - Look for error details
   - Check sync mappings

### Events Not Syncing

1. **Check Sync Mappings**
   - Verify mapping exists for event
   - Check sync status in mapping
   - Look for error messages

2. **Verify Event Data**
   - Ensure event has required fields
   - Check date format is valid
   - Verify Google Calendar permissions

## Technical Details

### API Rate Limits

Google Calendar API limits:
- 1,000,000 queries per day
- 10 queries per second per user

The sync system:
- Batches event updates
- Uses delta sync when possible
- Implements exponential backoff on errors

### Data Privacy

- Sync mappings and conflicts stored in Supabase
- Row Level Security (RLS) protects user data
- Users can only access their own sync data
- Google tokens stored securely in separate table

### Performance

- Sync typically takes 2-5 seconds for 50 events
- Hash comparison is fast (O(n) where n = events)
- Database indexes optimize mapping lookups
- Conflict detection adds minimal overhead

## Future Enhancements

Potential improvements:
- Bulk conflict resolution
- Conflict auto-resolution rules
- Sync specific calendar collections
- Webhook-based instant sync
- Sync preview before applying changes
- Undo last sync operation
