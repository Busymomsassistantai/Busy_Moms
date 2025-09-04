/*
  # Create tasks table with family member relationships

  1. New Tables
    - `tasks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `assigned_to` (uuid, foreign key to family_members, nullable)
      - `title` (text, required)
      - `description` (text, optional)
      - `category` (text, with constraints)
      - `priority` (text, with constraints)
      - `status` (text, with constraints, default 'pending')
      - `due_date` (date, optional)
      - `due_time` (time, optional)
      - `recurring` (boolean, default false)
      - `recurring_pattern` (text, optional, with constraints)
      - `points` (integer, optional)
      - `notes` (text, optional)
      - `completed_at` (timestamp, optional)
      - `created_at` (timestamp, default now())
      - `updated_at` (timestamp, default now())

  2. Security
    - Enable RLS on `tasks` table
    - Add policies for authenticated users to manage their own tasks
    - Add policy for AI service to manage tasks

  3. Relationships
    - Foreign key to profiles table via user_id
    - Foreign key to family_members table via assigned_to
    - Cascade delete when user is deleted
    - Set null when family member is deleted

  4. Constraints
    - Category must be one of: chores, homework, sports, music, health, social, other
    - Priority must be one of: low, medium, high
    - Status must be one of: pending, in_progress, completed, cancelled
    - Recurring pattern must be one of: daily, weekly, monthly, yearly
*/

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES family_members(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT 'other',
  priority text DEFAULT 'medium',
  status text DEFAULT 'pending',
  due_date date,
  due_time time,
  recurring boolean DEFAULT false,
  recurring_pattern text,
  points integer DEFAULT 0,
  notes text DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tasks' AND constraint_name = 'tasks_category_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_category_check 
    CHECK (category = ANY (ARRAY['chores'::text, 'homework'::text, 'sports'::text, 'music'::text, 'health'::text, 'social'::text, 'other'::text]));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tasks' AND constraint_name = 'tasks_priority_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check 
    CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tasks' AND constraint_name = 'tasks_status_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
    CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tasks' AND constraint_name = 'tasks_recurring_pattern_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_recurring_pattern_check 
    CHECK (recurring_pattern = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text]));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can read own tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- AI service policy
CREATE POLICY "AI service can manage tasks for authenticated users"
  ON tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(user_id, due_date) WHERE due_date IS NOT NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();