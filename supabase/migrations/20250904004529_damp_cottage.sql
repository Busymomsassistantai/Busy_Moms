/*
  # Add family member task assignments

  1. Database Changes
    - Add `assigned_to` column to shopping_lists table
    - Add `assigned_to` column to reminders table (already exists as family_member_id)
    - Add foreign key constraints for family member assignments
    - Update RLS policies to handle assigned tasks

  2. Security
    - Maintain existing RLS policies
    - Ensure users can only assign tasks to their own family members
    - Allow family members to view tasks assigned to them

  3. Features
    - Shopping list items can be assigned to specific family members
    - Reminders can be assigned to family members
    - Support for viewing tasks by assignee
*/

-- Add assigned_to column to shopping_lists table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN assigned_to uuid REFERENCES family_members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for assigned tasks
CREATE INDEX IF NOT EXISTS idx_shopping_assigned 
ON shopping_lists(user_id, assigned_to) 
WHERE assigned_to IS NOT NULL;

-- Add index for assigned reminders (family_member_id already exists)
CREATE INDEX IF NOT EXISTS idx_reminders_assigned 
ON reminders(user_id, family_member_id) 
WHERE family_member_id IS NOT NULL;

-- Update RLS policies for shopping lists to handle assignments
DROP POLICY IF EXISTS "Users can read own shopping items" ON shopping_lists;
CREATE POLICY "Users can read own shopping items"
  ON shopping_lists
  FOR SELECT
  TO authenticated
  USING (user_id = uid());

-- Add policy for assigned shopping items
CREATE POLICY IF NOT EXISTS "Users can read assigned shopping items"
  ON shopping_lists
  FOR SELECT
  TO authenticated
  USING (
    assigned_to IN (
      SELECT id FROM family_members WHERE user_id = uid()
    )
  );

-- Update insert policy to allow assignment
DROP POLICY IF EXISTS "Users can insert own shopping items" ON shopping_lists;
CREATE POLICY "Users can insert own shopping items"
  ON shopping_lists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = uid() AND (
      assigned_to IS NULL OR 
      assigned_to IN (
        SELECT id FROM family_members WHERE user_id = uid()
      )
    )
  );

-- Update update policy to allow assignment changes
DROP POLICY IF EXISTS "Users can update own shopping items" ON shopping_lists;
CREATE POLICY "Users can update own shopping items"
  ON shopping_lists
  FOR UPDATE
  TO authenticated
  USING (user_id = uid())
  WITH CHECK (
    user_id = uid() AND (
      assigned_to IS NULL OR 
      assigned_to IN (
        SELECT id FROM family_members WHERE user_id = uid()
      )
    )
  );