/*
  # Create shopping_lists table

  1. New Tables
    - `shopping_lists`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `item` (text, required)
      - `category` (text, enum-like values)
      - `completed` (boolean, default false)
      - `urgent` (boolean, default false)
      - `quantity` (integer, default 1)
      - `notes` (text, optional)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `shopping_lists` table
    - Add policies for users to manage their own shopping items
*/

CREATE TABLE IF NOT EXISTS shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item text NOT NULL,
  category text CHECK (category IN ('dairy', 'produce', 'meat', 'bakery', 'baby', 'household', 'other')) DEFAULT 'other',
  completed boolean DEFAULT false,
  urgent boolean DEFAULT false,
  quantity integer DEFAULT 1 CHECK (quantity > 0),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own shopping items"
  ON shopping_lists
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shopping items"
  ON shopping_lists
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shopping items"
  ON shopping_lists
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shopping items"
  ON shopping_lists
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for better performance on completed status queries
CREATE INDEX IF NOT EXISTS idx_shopping_completed ON shopping_lists(user_id, completed);