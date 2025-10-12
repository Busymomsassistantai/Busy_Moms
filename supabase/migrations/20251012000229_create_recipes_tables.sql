/*
  # Create Recipes Tables for Instacart Integration

  ## Overview
  This migration creates the necessary tables to support recipe browsing, saving, and Instacart integration.
  All tables follow Instacart Developer Platform API specifications and best practices.

  ## New Tables

  ### 1. `recipes`
  Stores recipe information with Instacart-compliant fields
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users) - User who created/saved the recipe
  - `title` (text) - Recipe title
  - `author` (text) - Recipe author/creator
  - `description` (text) - Recipe description
  - `image_url` (text) - Recipe image URL (optimized for 500x500px per Instacart)
  - `servings` (integer) - Number of servings
  - `cooking_time_minutes` (integer) - Total cooking time
  - `instructions` (jsonb) - Array of step-by-step instructions
  - `source_url` (text) - Original recipe source URL
  - `instacart_recipe_url` (text) - Cached Instacart recipe page URL
  - `url_expires_at` (timestamptz) - Expiration date for Instacart URL
  - `instacart_metadata` (jsonb) - Additional Instacart API response data
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `recipe_ingredients`
  Stores ingredients for each recipe following Instacart naming conventions
  - `id` (uuid, primary key)
  - `recipe_id` (uuid, references recipes)
  - `name` (text) - Generic product name for Instacart matching (required)
  - `display_text` (text) - User-friendly display text
  - `quantity` (decimal) - Ingredient quantity (must be > 0)
  - `unit` (text) - Measurement unit (cups, teaspoons, tablespoons, etc.)
  - `category` (text) - Ingredient category for organization
  - `display_order` (integer) - Order to display ingredient
  - `brand_filters` (jsonb) - Array of brand preferences
  - `health_filters` (jsonb) - Array of health attributes (organic, gluten-free, etc.)
  - `is_pantry_item` (boolean) - User may already have this item
  - `created_at` (timestamptz)

  ### 3. `user_saved_recipes`
  Junction table tracking which recipes users have saved
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `recipe_id` (uuid, references recipes)
  - `saved_at` (timestamptz)
  - Unique constraint on (user_id, recipe_id)

  ## Security
  - Enable RLS on all tables
  - Users can only view and manage their own recipes
  - Recipes can be shared if explicitly marked as public (future enhancement)
  - Policies ensure data isolation between users

  ## Indexes
  - Index on recipe title for search performance
  - Index on recipe author for filtering
  - Index on user_saved_recipes for quick lookup
  - Index on recipe_ingredients recipe_id for joins
*/

-- Create recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  author text,
  description text,
  image_url text,
  servings integer DEFAULT 4,
  cooking_time_minutes integer,
  instructions jsonb DEFAULT '[]'::jsonb,
  source_url text,
  instacart_recipe_url text,
  url_expires_at timestamptz,
  instacart_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create recipe_ingredients table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  display_text text NOT NULL,
  quantity decimal(10,2) CHECK (quantity > 0),
  unit text,
  category text,
  display_order integer DEFAULT 0,
  brand_filters jsonb DEFAULT '[]'::jsonb,
  health_filters jsonb DEFAULT '[]'::jsonb,
  is_pantry_item boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create user_saved_recipes junction table
CREATE TABLE IF NOT EXISTS user_saved_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  saved_at timestamptz DEFAULT now(),
  UNIQUE(user_id, recipe_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_recipes_author ON recipes(author);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_recipes_user_id ON user_saved_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_recipes_recipe_id ON user_saved_recipes(recipe_id);

-- Enable Row Level Security
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_recipes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recipes table
CREATE POLICY "Users can view their own recipes"
  ON recipes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recipes"
  ON recipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes"
  ON recipes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes"
  ON recipes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for recipe_ingredients table
CREATE POLICY "Users can view ingredients for their recipes"
  ON recipe_ingredients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ingredients for their recipes"
  ON recipe_ingredients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update ingredients for their recipes"
  ON recipe_ingredients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete ingredients for their recipes"
  ON recipe_ingredients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

-- RLS Policies for user_saved_recipes table
CREATE POLICY "Users can view their saved recipes"
  ON user_saved_recipes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save recipes"
  ON user_saved_recipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave recipes"
  ON user_saved_recipes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on recipes
DROP TRIGGER IF EXISTS update_recipes_updated_at ON recipes;
CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();