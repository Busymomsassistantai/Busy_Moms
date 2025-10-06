/*
  # Fix Events Table Time Columns
  
  ## Problem
  The start_time and end_time columns were incorrectly created as `timestamptz NOT NULL` 
  instead of `time` and nullable as intended in the original migration.
  
  ## Changes
  1. Alter start_time column:
     - Change type from `timestamptz` to `time`
     - Make it nullable (allow NULL values)
  
  2. Alter end_time column:
     - Change type from `timestamptz` to `time`
     - Make it nullable (allow NULL values)
  
  ## Impact
  - Allows events to be created without specific times (all-day events)
  - Fixes the "invalid input syntax for type timestamp" error when inserting time values like "22:00"
  - Matches the intended schema design from the original migration
*/

-- Alter start_time column to be time type and nullable
ALTER TABLE events 
  ALTER COLUMN start_time TYPE time USING start_time::time,
  ALTER COLUMN start_time DROP NOT NULL;

-- Alter end_time column to be time type and nullable
ALTER TABLE events 
  ALTER COLUMN end_time TYPE time USING end_time::time,
  ALTER COLUMN end_time DROP NOT NULL;
