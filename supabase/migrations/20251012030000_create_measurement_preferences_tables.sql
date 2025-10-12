/*
  # Measurement Preferences and Metadata Tables

  1. New Tables
    - `user_measurement_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `preferred_system` (text) - 'metric' or 'imperial'
      - `default_volume_unit` (text) - default unit for volume measurements
      - `default_weight_unit` (text) - default unit for weight measurements
      - `auto_convert` (boolean) - whether to auto-convert units
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `measurement_overrides`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `recipe_ingredient_id` (uuid, references recipe_ingredients)
      - `original_quantity` (numeric)
      - `original_unit` (text)
      - `override_quantity` (numeric)
      - `override_unit` (text)
      - `reason` (text) - optional reason for override
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `unit` field to shopping_lists
    - Add `original_unit` field to shopping_lists for tracking conversions
    - Add `conversion_metadata` jsonb field to recipe_ingredients

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data
*/

-- Create user_measurement_preferences table
CREATE TABLE IF NOT EXISTS user_measurement_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  preferred_system text DEFAULT 'imperial' CHECK (preferred_system IN ('metric', 'imperial')),
  default_volume_unit text DEFAULT 'cup',
  default_weight_unit text DEFAULT 'pound',
  auto_convert boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_measurement_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own measurement preferences"
  ON user_measurement_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurement preferences"
  ON user_measurement_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurement preferences"
  ON user_measurement_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own measurement preferences"
  ON user_measurement_preferences
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create measurement_overrides table
CREATE TABLE IF NOT EXISTS measurement_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipe_ingredient_id uuid REFERENCES recipe_ingredients(id) ON DELETE CASCADE,
  shopping_list_id uuid REFERENCES shopping_lists(id) ON DELETE CASCADE,
  original_quantity numeric,
  original_unit text,
  override_quantity numeric NOT NULL,
  override_unit text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (recipe_ingredient_id IS NOT NULL OR shopping_list_id IS NOT NULL)
);

ALTER TABLE measurement_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own measurement overrides"
  ON measurement_overrides
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurement overrides"
  ON measurement_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurement overrides"
  ON measurement_overrides
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own measurement overrides"
  ON measurement_overrides
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add unit fields to shopping_lists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'unit'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN unit text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_lists' AND column_name = 'original_unit'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN original_unit text;
  END IF;
END $$;

-- Add conversion_metadata to recipe_ingredients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipe_ingredients' AND column_name = 'conversion_metadata'
  ) THEN
    ALTER TABLE recipe_ingredients ADD COLUMN conversion_metadata jsonb;
  END IF;
END $$;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_user_measurement_preferences_updated_at ON user_measurement_preferences;
CREATE TRIGGER update_user_measurement_preferences_updated_at
  BEFORE UPDATE ON user_measurement_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_measurement_overrides_updated_at ON measurement_overrides;
CREATE TRIGGER update_measurement_overrides_updated_at
  BEFORE UPDATE ON measurement_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
