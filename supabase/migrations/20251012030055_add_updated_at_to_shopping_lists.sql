/*
  # Add updated_at Column to Shopping Lists

  ## Overview
  This migration adds the `updated_at` column to the `shopping_lists` table to track
  when shopping items are last modified. This brings the table in line with other
  tables in the system and ensures the TypeScript types match the database schema.

  ## Changes

  1. **Add updated_at Column**
     - `updated_at` (timestamptz, default now()) - Timestamp of last update
     - Automatically updated via trigger when any row is modified

  2. **Add Trigger**
     - Create trigger to automatically update the `updated_at` timestamp on row updates
     - Uses the existing `update_updated_at_column()` function

  ## Notes
  - Existing shopping list items will have their `updated_at` set to the current timestamp
  - The trigger ensures `updated_at` is automatically maintained going forward
  - This fixes the insert error when adding recipe ingredients to shopping list
*/

-- Add updated_at column to shopping_lists table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create trigger to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS update_shopping_lists_updated_at ON shopping_lists;
CREATE TRIGGER update_shopping_lists_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();