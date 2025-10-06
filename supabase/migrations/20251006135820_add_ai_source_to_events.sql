/*
  # Add 'ai' as valid source for events table

  1. Changes
    - Drop existing events_source_check constraint
    - Add new constraint allowing 'ai' as a valid source value
    - Enables voice AI to create calendar events with source='ai'

  2. Impact
    - Allows voice AI assistant to properly create events in the calendar
    - Maintains all existing source values: 'manual', 'whatsapp', 'calendar_sync'
    - No data migration needed as we're adding a new allowed value
*/

-- Drop the old constraint
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_source_check'
  ) THEN
    ALTER TABLE events DROP CONSTRAINT events_source_check;
  END IF;
END $$;

-- Add new constraint with 'ai' included
ALTER TABLE events ADD CONSTRAINT events_source_check 
  CHECK (source IN ('manual', 'whatsapp', 'calendar_sync', 'ai'));
