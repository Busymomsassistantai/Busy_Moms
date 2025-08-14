/*
  # Create reminders table

  1. New Tables
    - `reminders`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `title` (text, required)
      - `description` (text, optional)
      - `reminder_date` (date, required)
      - `reminder_time` (time, optional)
      - `priority` (text, enum-like values)
      - `completed` (boolean, default false)
      - `recurring` (boolean, default false)
      - `recurring_pattern` (text, enum-like values)
      - `family_member_id` (uuid, optional foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `reminders` table
    - Add policies for users to manage their own reminders
*/

CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  reminder_date date NOT NULL,
  reminder_time time,
  priority text CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  completed boolean DEFAULT false,
  recurring boolean DEFAULT false,
  recurring_pattern text CHECK (recurring_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
  family_member_id uuid REFERENCES family_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reminders"
  ON reminders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON reminders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
  ON reminders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(user_id, reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(user_id, completed);