/*
  # Add External Source Tracking to Recipes

  ## Overview
  This migration adds fields to track recipes imported from external sources like TheMealDB.

  ## Changes
  1. Add `external_id` column to recipes table - stores the ID from the external source
  2. Add `external_source` column to recipes table - stores the name of the external source (e.g., 'themealdb')
  3. Add `prep_time_minutes` column to recipes table - stores preparation time separate from cooking time

  ## Purpose
  - Track which recipes were imported from external sources
  - Prevent duplicate imports of the same recipe
  - Support proper attribution to original recipe sources
  - Allow for re-syncing with external sources if needed
*/

-- Add external tracking fields to recipes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE recipes ADD COLUMN external_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'external_source'
  ) THEN
    ALTER TABLE recipes ADD COLUMN external_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'prep_time_minutes'
  ) THEN
    ALTER TABLE recipes ADD COLUMN prep_time_minutes integer;
  END IF;
END $$;

-- Create index for external_id to quickly check for duplicates
CREATE INDEX IF NOT EXISTS idx_recipes_external_id ON recipes(external_id, external_source);

-- Add comment for documentation
COMMENT ON COLUMN recipes.external_id IS 'ID from external recipe source (e.g., TheMealDB ID)';
COMMENT ON COLUMN recipes.external_source IS 'Name of external source (e.g., themealdb)';
COMMENT ON COLUMN recipes.prep_time_minutes IS 'Recipe preparation time in minutes';
