/*
  # Create additional supporting tables

  1. New Tables
    - `auto_reorders` - For automatic reordering of items
    - `event_actions` - For tracking actions related to events
    - `gift_suggestions` - For storing AI-generated gift suggestions
    - `user_preferences` - For storing user preferences and settings
    - `whatsapp_messages` - For storing parsed WhatsApp messages

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
*/

-- Auto Reorders Table
CREATE TABLE IF NOT EXISTS auto_reorders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  frequency_days integer NOT NULL CHECK (frequency_days > 0),
  last_ordered date,
  next_order_date date NOT NULL,
  price numeric(10,2),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE auto_reorders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own auto reorders"
  ON auto_reorders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Event Actions Table
CREATE TABLE IF NOT EXISTS event_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('buy_gift', 'rsvp', 'schedule_ride', 'set_reminder')),
  action_status text NOT NULL CHECK (action_status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
  due_date date,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE event_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own event actions"
  ON event_actions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Gift Suggestions Table
CREATE TABLE IF NOT EXISTS gift_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  recipient_age integer,
  recipient_gender text CHECK (recipient_gender IN ('Boy', 'Girl', 'Other')),
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  suggestions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gift_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own gift suggestions"
  ON gift_suggestions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_events boolean DEFAULT true,
  notification_shopping boolean DEFAULT true,
  notification_reminders boolean DEFAULT true,
  notification_whatsapp boolean DEFAULT false,
  whatsapp_integration_enabled boolean DEFAULT false,
  smartwatch_connected boolean DEFAULT false,
  background_check_alerts boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON user_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- WhatsApp Messages Table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  sender text NOT NULL,
  message_content text NOT NULL,
  parsed_event_data jsonb,
  processed boolean DEFAULT false,
  event_created boolean DEFAULT false,
  created_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  received_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own whatsapp messages"
  ON whatsapp_messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add triggers for updated_at columns
CREATE TRIGGER update_auto_reorders_updated_at
  BEFORE UPDATE ON auto_reorders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_actions_updated_at
  BEFORE UPDATE ON event_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auto_reorders_next_order ON auto_reorders(user_id, next_order_date) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_event_actions_status ON event_actions(user_id, action_status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_processed ON whatsapp_messages(user_id, processed);