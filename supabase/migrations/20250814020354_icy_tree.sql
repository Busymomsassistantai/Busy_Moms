/*
  # Create contacts table

  1. New Tables
    - `contacts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `name` (text, required)
      - `role` (text, required)
      - `phone` (text, optional)
      - `email` (text, optional)
      - `category` (text, enum-like values)
      - `rating` (numeric, 0-5 scale)
      - `notes` (text, optional)
      - `verified` (boolean, default false)
      - `background_check_date` (date, optional)
      - `background_check_status` (text, enum-like values)
      - `available` (boolean, default true)
      - `last_contact` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `contacts` table
    - Add policies for users to manage their own contacts
*/

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  phone text,
  email text,
  category text CHECK (category IN ('babysitter', 'coach', 'doctor', 'tutor', 'teacher', 'other')) DEFAULT 'other',
  rating numeric(2,1) CHECK (rating >= 0 AND rating <= 5) DEFAULT 0,
  notes text DEFAULT '',
  verified boolean DEFAULT false,
  background_check_date date,
  background_check_status text CHECK (background_check_status IN ('pending', 'passed', 'failed', 'expired')),
  available boolean DEFAULT true,
  last_contact text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
  ON contacts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for better performance on category queries
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(user_id, category);