/*
  # Create events table

  1. New Tables
    - `events`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `title` (text, required)
      - `description` (text, optional)
      - `event_date` (date, required)
      - `start_time` (time, optional)
      - `end_time` (time, optional)
      - `location` (text, optional)
      - `event_type` (text, enum-like values)
      - `participants` (text array, optional)
      - `rsvp_required` (boolean, default false)
      - `rsvp_status` (text, enum-like values)
      - `source` (text, enum-like values)
      - `whatsapp_message_id` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `events` table
    - Add policies for users to manage their own events
*/

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  event_date date NOT NULL,
  start_time time,
  end_time time,
  location text DEFAULT '',
  event_type text CHECK (event_type IN ('sports', 'party', 'meeting', 'medical', 'school', 'family', 'other')) DEFAULT 'other',
  participants text[] DEFAULT '{}',
  rsvp_required boolean DEFAULT false,
  rsvp_status text CHECK (rsvp_status IN ('pending', 'yes', 'no', 'maybe')) DEFAULT 'pending',
  source text CHECK (source IN ('manual', 'whatsapp', 'calendar_sync')) DEFAULT 'manual',
  whatsapp_message_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own events"
  ON events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON events
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_events_date ON events(user_id, event_date);