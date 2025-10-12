/*
  # Add Recipe Reference to Shopping Lists

  ## Overview
  This migration adds support for tracking which recipe a shopping item came from,
  allowing users to trace ingredients back to their source recipes.

  ## Changes

  1. **Modify shopping_lists table**
     - Add `recipe_id` column (uuid, nullable, references recipes table)
     - This allows shopping items to optionally link back to a recipe
     - Nullable because manually-added items won't have a recipe reference

  2. **Add Index**
     - Index on recipe_id for efficient lookups of shopping items by recipe

  ## Notes
  - Existing shopping list items will have NULL recipe_id (manually added items)
  - New items added from recipes will have the recipe_id populated
  - This enables features like "show all items from this recipe" in the future
*/

-- Add recipe_id column to shopping_lists table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'recipe_id'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for efficient recipe lookups
CREATE INDEX IF NOT EXISTS idx_shopping_lists_recipe_id ON shopping_lists(recipe_id);