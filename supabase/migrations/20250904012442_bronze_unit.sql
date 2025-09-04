/*
  # Add foreign key relationships for shopping lists and tasks

  1. Changes
    - Add foreign key constraint from shopping_lists.assigned_to to family_members.id
    - Add foreign key constraint from tasks.assigned_to to family_members.id (if tasks table exists)
    - Add assigned_to column to shopping_lists if it doesn't exist

  2. Security
    - Maintains existing RLS policies
    - No changes to security model
*/

-- Add assigned_to column to shopping_lists if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN assigned_to uuid;
  END IF;
END $$;

-- Add foreign key constraint for shopping_lists -> family_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'shopping_lists' AND constraint_name = 'shopping_lists_assigned_to_fkey'
  ) THEN
    ALTER TABLE shopping_lists 
    ADD CONSTRAINT shopping_lists_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES family_members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key constraint for tasks -> family_members (if tasks table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'tasks' AND table_schema = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'tasks' AND constraint_name = 'tasks_assigned_to_fkey'
    ) THEN
      ALTER TABLE tasks 
      ADD CONSTRAINT tasks_assigned_to_fkey 
      FOREIGN KEY (assigned_to) REFERENCES family_members(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;