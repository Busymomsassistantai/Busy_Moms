/*
  # Calendar Sync System Database Schema

  1. New Tables
    - `calendar_sync_mappings`
      - Links local events to Google Calendar events
      - Tracks sync status and change detection hashes
      - Stores last sync timestamp for each mapping
    
    - `calendar_sync_conflicts`
      - Stores detected conflicts between local and Google events
      - Contains both versions of conflicting data
      - Tracks conflict resolution status
    
    - `calendar_sync_logs`
      - Audit trail of all sync operations
      - Records successes and failures with details
      - Enables debugging and monitoring
    
    - `user_sync_preferences`
      - Per-user sync configuration
      - Stores last successful sync timestamp
      - Controls sync frequency and behavior

  2. Security
    - Enable RLS on all tables
    - Users can only access their own sync data
    - Authenticated users only

  3. Indexes
    - Optimized for lookup by user_id, event_id, and google_event_id
    - Efficient querying of pending conflicts
*/

-- Calendar sync mappings table
CREATE TABLE IF NOT EXISTS calendar_sync_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  sync_status text NOT NULL DEFAULT 'synced', -- synced, pending, error
  last_synced_at timestamptz DEFAULT now(),
  local_hash text,
  google_hash text,
  sync_direction text DEFAULT 'bidirectional', -- bidirectional, local_to_google, google_to_local
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, local_event_id),
  UNIQUE(user_id, google_event_id)
);

-- Calendar sync conflicts table
CREATE TABLE IF NOT EXISTS calendar_sync_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  conflict_type text NOT NULL DEFAULT 'modification', -- modification, deletion
  local_event_data jsonb NOT NULL,
  google_event_data jsonb NOT NULL,
  local_modified_at timestamptz,
  google_modified_at timestamptz,
  detected_at timestamptz DEFAULT now(),
  resolution_status text DEFAULT 'pending', -- pending, resolved, ignored
  resolution_choice text, -- keep_local, keep_google, merge
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Calendar sync logs table
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_operation text NOT NULL, -- full_sync, event_create, event_update, event_delete
  sync_direction text NOT NULL, -- local_to_google, google_to_local, bidirectional
  status text NOT NULL DEFAULT 'in_progress', -- in_progress, completed, failed
  events_processed integer DEFAULT 0,
  events_created integer DEFAULT 0,
  events_updated integer DEFAULT 0,
  events_deleted integer DEFAULT 0,
  conflicts_detected integer DEFAULT 0,
  error_count integer DEFAULT 0,
  error_details jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

-- User sync preferences table
CREATE TABLE IF NOT EXISTS user_sync_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_enabled boolean DEFAULT true,
  sync_frequency_minutes integer DEFAULT 15,
  sync_direction text DEFAULT 'bidirectional', -- bidirectional, google_to_local, local_to_google
  auto_resolve_conflicts boolean DEFAULT false,
  last_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  sync_calendar_ids text[] DEFAULT ARRAY['primary'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE calendar_sync_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sync_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_sync_mappings
CREATE POLICY "Users can view own sync mappings"
  ON calendar_sync_mappings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync mappings"
  ON calendar_sync_mappings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync mappings"
  ON calendar_sync_mappings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync mappings"
  ON calendar_sync_mappings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for calendar_sync_conflicts
CREATE POLICY "Users can view own sync conflicts"
  ON calendar_sync_conflicts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync conflicts"
  ON calendar_sync_conflicts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync conflicts"
  ON calendar_sync_conflicts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync conflicts"
  ON calendar_sync_conflicts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for calendar_sync_logs
CREATE POLICY "Users can view own sync logs"
  ON calendar_sync_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync logs"
  ON calendar_sync_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_sync_preferences
CREATE POLICY "Users can view own sync preferences"
  ON user_sync_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync preferences"
  ON user_sync_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync preferences"
  ON user_sync_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync preferences"
  ON user_sync_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sync_mappings_user_id ON calendar_sync_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_local_event_id ON calendar_sync_mappings(local_event_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_google_event_id ON calendar_sync_mappings(google_event_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_status ON calendar_sync_mappings(sync_status);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user_id ON calendar_sync_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON calendar_sync_conflicts(resolution_status);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_detected_at ON calendar_sync_conflicts(detected_at);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id ON calendar_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON calendar_sync_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON calendar_sync_logs(status);
