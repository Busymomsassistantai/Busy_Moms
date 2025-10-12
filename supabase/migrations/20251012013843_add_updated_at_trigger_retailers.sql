/*
  # Add updated_at Trigger for User Preferred Retailers

  1. Changes
    - Add trigger function to automatically update updated_at timestamp
    - Apply trigger to user_preferred_retailers table

  2. Benefits
    - Automatic timestamp management
    - Consistent data tracking
    - No manual timestamp updates needed
*/

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_user_preferred_retailers_updated_at'
  ) THEN
    CREATE TRIGGER update_user_preferred_retailers_updated_at
      BEFORE UPDATE ON user_preferred_retailers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;