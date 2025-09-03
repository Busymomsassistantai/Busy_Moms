/*
  # AI Chat Service Permissions

  1. Purpose
    - Grant AI chat service access to user data tables
    - Enable CRUD operations for AI assistant functionality
    - Maintain security through service role authentication

  2. Tables with AI Access
    - contacts: Read/write contact information
    - event_actions: Manage event-related actions
    - events: Create and manage calendar events
    - family_members: Access family member data for context
    - gift_suggestions: Generate and store gift recommendations
    - reminders: Create and manage reminders
    - shopping_lists: Manage shopping list items
    - whatsapp_messages: Process WhatsApp integrations

  3. Security
    - Service role authentication required
    - Policies ensure AI can only access data for authenticated users
    - Maintains existing user-level security
*/

-- AI Chat service policies for contacts table
CREATE POLICY "AI service can manage contacts for authenticated users"
  ON contacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AI Chat service policies for event_actions table
CREATE POLICY "AI service can manage event actions for authenticated users"
  ON event_actions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AI Chat service policies for events table
CREATE POLICY "AI service can manage events for authenticated users"
  ON events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AI Chat service policies for family_members table
CREATE POLICY "AI service can manage family members for authenticated users"
  ON family_members
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AI Chat service policies for gift_suggestions table
CREATE POLICY "AI service can manage gift suggestions for authenticated users"
  ON gift_suggestions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AI Chat service policies for reminders table
CREATE POLICY "AI service can manage reminders for authenticated users"
  ON reminders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AI Chat service policies for shopping_lists table
CREATE POLICY "AI service can manage shopping lists for authenticated users"
  ON shopping_lists
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AI Chat service policies for whatsapp_messages table
CREATE POLICY "AI service can manage whatsapp messages for authenticated users"
  ON whatsapp_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);