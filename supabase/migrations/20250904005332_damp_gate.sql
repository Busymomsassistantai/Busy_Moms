/*
  # Create tasks table with family member relationships

  1. New Tables
    - `tasks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `assigned_to` (uuid, foreign key to family_members)
      - `title` (text, required)
      - `description` (text, optional)
      - `category` (text, with predefined options)
      - `priority` (text, low/medium/high)
      - `status` (text, pending/in_progress/completed/cancelled)
      - `due_date` (date, optional)
      - `due_time` (time, optional)
      - `recurring` (boolean, default false)
      - `recurring_pattern` (text, optional)
      - `points` (integer, for gamification)
      - `notes` (text, optional)
      - `completed_at` (timestamp, optional)
      - `created_at` (timestamp, default now)
      - `updated_at` (timestamp, default now)

  2. Security
    - Enable RLS on `tasks` table
    - Add policies for users to manage their own tasks
    - Add policies for AI service to manage tasks

  3. Indexes
    - Index on user_id and status for performance
    - Index on assigned_to for family member queries
    - Index on due_date for deadline tracking
*/

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES family_members(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT 'other' CHECK (category IN ('chores', 'homework', 'sports', 'music', 'health', 'social', 'other')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date date,
  due_time time,
  recurring boolean DEFAULT false,
  recurring_pattern text CHECK (recurring_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
  points integer DEFAULT 0 CHECK (points >= 0),
  notes text DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for users to manage their own tasks
CREATE POLICY "Users can read own tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (user_id = uid());

CREATE POLICY "Users can insert own tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = uid());

CREATE POLICY "Users can update own tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (user_id = uid())
  WITH CHECK (user_id = uid());

CREATE POLICY "Users can delete own tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (user_id = uid());

-- Create policy for AI service to manage tasks
CREATE POLICY "AI service can manage tasks for authenticated users"
  ON tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(user_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(user_id, priority, status);

-- Create trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();