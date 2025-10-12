/*
  # Update Shopping Lists Category Constraint

  ## Overview
  This migration updates the category constraint on the shopping_lists table to include
  all categories that are used in the application. The original constraint was too
  restrictive and missing several categories.

  ## Changes

  1. **Drop Old Constraint**
     - Remove the restrictive category check constraint

  2. **Add New Constraint**
     - Add updated constraint with all supported categories:
       - dairy, produce, meat, bakery, baby, household, other (original)
       - beverages, frozen, snacks, health, pantry (new)

  ## Notes
  - This fixes insert errors when using categories like 'beverages', 'frozen', etc.
  - Existing data is not affected since the constraint is only being expanded
  - The ShoppingForm component already uses all these categories in the UI
*/

-- Drop the old restrictive constraint
ALTER TABLE shopping_lists DROP CONSTRAINT IF EXISTS shopping_lists_category_check;

-- Add the updated constraint with all categories
ALTER TABLE shopping_lists ADD CONSTRAINT shopping_lists_category_check
  CHECK (category IN (
    'dairy',
    'produce',
    'meat',
    'bakery',
    'baby',
    'beverages',
    'frozen',
    'household',
    'snacks',
    'health',
    'pantry',
    'other'
  ) OR category IS NULL);