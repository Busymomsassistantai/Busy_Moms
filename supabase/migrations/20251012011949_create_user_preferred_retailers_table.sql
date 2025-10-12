/*
  # Create User Preferred Retailers Table

  1. New Tables
    - `user_preferred_retailers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `retailer_key` (text, Instacart retailer identifier)
      - `retailer_name` (text, display name)
      - `retailer_logo_url` (text, logo URL)
      - `is_primary` (boolean, marks the default retailer)
      - `display_order` (integer, for sorting)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_preferred_retailers` table
    - Add policies for authenticated users to manage their own retailers

  3. Indexes
    - Index on user_id for fast lookups
    - Unique constraint on user_id + retailer_key to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS user_preferred_retailers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  retailer_key text NOT NULL,
  retailer_name text NOT NULL,
  retailer_logo_url text,
  is_primary boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_retailer UNIQUE (user_id, retailer_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferred_retailers_user_id 
  ON user_preferred_retailers(user_id);

ALTER TABLE user_preferred_retailers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferred retailers"
  ON user_preferred_retailers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferred retailers"
  ON user_preferred_retailers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferred retailers"
  ON user_preferred_retailers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferred retailers"
  ON user_preferred_retailers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);