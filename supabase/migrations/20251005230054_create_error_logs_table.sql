-- Error Logs Table for Application Error Tracking
--
-- 1. New Tables
--    - error_logs
--      - id (uuid, primary key) - Unique identifier for each error log
--      - user_id (uuid, foreign key) - References auth.users, nullable for unauthenticated errors
--      - error_type (text) - Category of error (NetworkError, ValidationError, DatabaseError, etc.)
--      - severity (text) - Error severity level (CRITICAL, ERROR, WARNING, INFO)
--      - message (text) - Human-readable error message
--      - stack_trace (text, nullable) - Full error stack trace for debugging
--      - context (jsonb, nullable) - Additional context data (component, action, request data)
--      - component (text, nullable) - Name of component where error occurred
--      - url (text, nullable) - URL where error occurred
--      - user_agent (text, nullable) - Browser user agent string
--      - resolved (boolean) - Whether error has been resolved
--      - resolved_at (timestamptz, nullable) - When error was marked resolved
--      - resolution_notes (text, nullable) - Notes about error resolution
--      - created_at (timestamptz) - When error was logged
--      - count (integer) - Number of times this error occurred (for deduplication)
--
-- 2. Security
--    - Enable RLS on error_logs table
--    - Add policy for authenticated users to insert their own error logs
--    - Add policy for authenticated users to read their own error logs
--
-- 3. Indexes
--    - Index on user_id for efficient user error queries
--    - Index on created_at for time-based queries
--    - Index on error_type and severity for filtering
--    - Index on resolved for dashboard queries

-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_type text NOT NULL,
  severity text NOT NULL DEFAULT 'ERROR',
  message text NOT NULL,
  stack_trace text,
  context jsonb,
  component text,
  url text,
  user_agent text,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  count integer DEFAULT 1
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_component ON error_logs(component);

-- Enable Row Level Security
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own error logs
CREATE POLICY "Users can insert own error logs"
  ON error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Users can read their own error logs
CREATE POLICY "Users can read own error logs"
  ON error_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Allow anonymous error logging (for critical errors before auth)
CREATE POLICY "Allow anonymous error logging"
  ON error_logs
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Policy: Users can update resolution status of their own errors
CREATE POLICY "Users can update own error logs"
  ON error_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);