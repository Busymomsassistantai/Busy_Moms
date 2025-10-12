/*
  # Create addresses table for multi-location support

  ## Overview
  This migration creates a new addresses table to store multiple addresses per user (home, work, etc.)
  with support for address validation and default location selection.

  ## New Tables
  
  ### `addresses`
  Stores user addresses with validation status and location type
  
  - `id` (uuid, primary key) - Unique identifier for each address
  - `user_id` (uuid, foreign key) - References auth.users, the owner of this address
  - `address_type` (text) - Type of address: 'home', 'work', 'other'
  - `display_name` (text) - User-friendly label for the address (e.g., "Home", "Office", "Mom's House")
  - `street_address` (text) - Street address line 1
  - `apartment_unit` (text, optional) - Apartment, unit, suite number
  - `city` (text) - City name
  - `state_province` (text) - State or province
  - `postal_code` (text) - Postal/ZIP code
  - `country` (text) - Country code (e.g., 'US', 'CA')
  - `is_default` (boolean) - Whether this is the user's default address
  - `validated` (boolean) - Whether address has been validated via external service
  - `validation_metadata` (jsonb, optional) - Stores validation results and geocoding data
  - `created_at` (timestamptz) - Timestamp of address creation
  - `updated_at` (timestamptz) - Timestamp of last update

  ## Security
  
  - Enable RLS on `addresses` table
  - Add policy for users to read their own addresses
  - Add policy for users to insert their own addresses
  - Add policy for users to update their own addresses
  - Add policy for users to delete their own addresses
  
  ## Important Notes
  
  1. Each user can have multiple addresses
  2. Only one address per user can be marked as default (is_default = true)
  3. When a new address is set as default, all other addresses for that user are unmarked
  4. Address validation is optional but recommended before marking as default
  5. The validation_metadata field stores geocoding results from Google Maps API or similar services
*/

CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_type text NOT NULL CHECK (address_type IN ('home', 'work', 'other')) DEFAULT 'home',
  display_name text NOT NULL,
  street_address text NOT NULL,
  apartment_unit text,
  city text NOT NULL,
  state_province text NOT NULL,
  postal_code text NOT NULL,
  country text NOT NULL DEFAULT 'US',
  is_default boolean DEFAULT false,
  validated boolean DEFAULT false,
  validation_metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own addresses"
  ON addresses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses"
  ON addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON addresses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON addresses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_is_default ON addresses(user_id, is_default) WHERE is_default = true;

CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE addresses
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_address
  BEFORE INSERT OR UPDATE ON addresses
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_address();