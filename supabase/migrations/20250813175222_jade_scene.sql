/*
  # Load Sample Data for Testing

  1. Sample Data
    - Creates demo user profile
    - Adds family members (Emma and Tom)
    - Creates sample events, contacts, shopping items
    - Adds reminders and preferences
  
  2. Testing Data
    - Realistic family scenarios
    - Various event types and contacts
    - Shopping lists with different categories
    - Background check examples
*/

-- Insert sample profile (this will be created automatically when user signs up)
-- The profile will be linked to the authenticated user

-- Sample family members
INSERT INTO family_members (user_id, name, age, gender, allergies, medical_notes, school, grade) VALUES
  (auth.uid(), 'Emma Johnson', 7, 'Girl', ARRAY['Peanuts'], 'Inhaler for asthma', 'Lincoln Elementary', '2nd Grade'),
  (auth.uid(), 'Tom Johnson', 5, 'Boy', ARRAY['Dairy'], 'Lactose intolerant', 'Lincoln Elementary', 'Kindergarten');

-- Sample events
INSERT INTO events (user_id, title, description, event_date, start_time, end_time, location, event_type, participants, rsvp_required, rsvp_status) VALUES
  (auth.uid(), 'Emma''s Soccer Practice', 'Weekly soccer practice with Coach Johnson', '2025-03-15', '09:00', '10:30', 'Riverside Park', 'sports', ARRAY['Emma'], false, 'pending'),
  (auth.uid(), 'Jessica''s Birthday Party', 'Birthday celebration for Jessica turning 7', '2025-03-15', '16:00', '18:00', 'Community Center', 'party', ARRAY['Emma', 'Tom'], true, 'yes'),
  (auth.uid(), 'Parent-Teacher Conference', 'Meeting with Tom''s teacher', '2025-03-15', '14:00', '14:30', 'Lincoln Elementary', 'meeting', ARRAY['Tom'], false, 'pending'),
  (auth.uid(), 'Pediatrician Appointment', 'Annual checkup for Emma', '2025-03-16', '10:00', '11:00', 'Dr. Smith''s Office', 'medical', ARRAY['Emma'], false, 'pending'),
  (auth.uid(), 'Family Movie Night', 'Weekly family movie night', '2025-03-17', '19:00', '21:00', 'Home', 'family', ARRAY['Emma', 'Tom'], false, 'pending');

-- Sample contacts
INSERT INTO contacts (user_id, name, role, phone, email, category, rating, notes, verified, available, last_contact) VALUES
  (auth.uid(), 'Maria Rodriguez', 'Babysitter', '(555) 123-4567', 'maria@email.com', 'babysitter', 4.9, 'Kids love her mac & cheese. Always arrives early. Great with bedtime routine.', true, true, '2025-03-13'),
  (auth.uid(), 'Coach Johnson', 'Soccer Coach', '(555) 234-5678', 'coach.johnson@soccerclub.com', 'coach', 4.7, 'Emma''s soccer coach. Very encouraging and patient with kids.', false, true, '2025-03-08'),
  (auth.uid(), 'Dr. Sarah Smith', 'Pediatrician', '(555) 345-6789', 'dr.smith@clinic.com', 'doctor', 4.8, 'Great with kids. Office hours Mon-Fri 9-5. Accepts our insurance.', true, false, '2025-02-25'),
  (auth.uid(), 'Jennifer Kim', 'Math Tutor', '(555) 456-7890', 'jennifer.kim@tutoring.com', 'tutor', 5.0, 'Excellent at explaining concepts. Tom''s grades improved significantly.', true, true, '2025-03-10'),
  (auth.uid(), 'Mrs. Anderson', 'Teacher', '(555) 567-8901', 'anderson@lincolnelem.edu', 'teacher', 4.6, 'Emma''s 2nd grade teacher. Very supportive and communicative.', true, true, '2025-03-12');

-- Sample shopping list items
INSERT INTO shopping_lists (user_id, item, category, completed, urgent, quantity, notes) VALUES
  (auth.uid(), 'Milk', 'dairy', false, true, 2, 'Organic whole milk'),
  (auth.uid(), 'Bananas', 'produce', false, false, 6, 'For school lunches'),
  (auth.uid(), 'Huggies Diapers', 'baby', true, false, 1, 'Size 3 - already bought'),
  (auth.uid(), 'Bread', 'bakery', false, false, 2, 'Whole wheat for sandwiches'),
  (auth.uid(), 'Chicken Breast', 'meat', false, true, 2, 'For dinner tonight'),
  (auth.uid(), 'Peanut-free snacks', 'other', false, false, 5, 'For Emma''s school - nut-free zone'),
  (auth.uid(), 'Lactose-free cheese', 'dairy', false, false, 1, 'For Tom''s lunches');

-- Sample auto-reorders
INSERT INTO auto_reorders (user_id, item_name, frequency_days, last_ordered, next_order_date, price, enabled) VALUES
  (auth.uid(), 'Huggies Size 3', 14, '2025-03-06', '2025-03-20', 42.99, true),
  (auth.uid(), 'Formula Powder', 7, '2025-03-11', '2025-03-18', 28.99, true),
  (auth.uid(), 'Organic Milk', 3, '2025-03-13', '2025-03-16', 6.99, true);

-- Sample reminders
INSERT INTO reminders (user_id, title, description, reminder_date, reminder_time, priority, completed, recurring, recurring_pattern) VALUES
  (auth.uid(), 'Pack Emma''s water bottle', 'Don''t forget water bottle for soccer practice', '2025-03-15', '08:00', 'medium', false, false, null),
  (auth.uid(), 'Buy birthday gift for Jessica', 'Need to get gift for Jessica''s party', '2025-03-14', '10:00', 'high', false, false, null),
  (auth.uid(), 'Schedule parent-teacher conference', 'Call school to schedule meeting', '2025-03-16', '09:00', 'medium', false, false, null),
  (auth.uid(), 'Refill prescription for Tom', 'Lactase enzyme supplements running low', '2025-03-18', '14:00', 'high', false, false, null),
  (auth.uid(), 'Weekly meal prep', 'Prepare lunches for the week', '2025-03-16', '10:00', 'low', false, true, 'weekly');

-- Sample gift suggestions
INSERT INTO gift_suggestions (user_id, recipient_age, recipient_gender, budget_min, budget_max, suggestions) VALUES
  (auth.uid(), 7, 'Girl', 15.00, 25.00, '[
    {"name": "Art Supplies Set", "price": "$19.99", "rating": 4.8, "link": "#"},
    {"name": "Princess Dress-up Kit", "price": "$24.99", "rating": 4.6, "link": "#"},
    {"name": "Children''s Book Collection", "price": "$16.99", "rating": 4.9, "link": "#"}
  ]'::jsonb);

-- Sample WhatsApp messages (for testing parsing)
INSERT INTO whatsapp_messages (user_id, message_id, sender, content, parsed_event_data, processed, event_created) VALUES
  (auth.uid(), 'msg_001', 'Mom''s Group', 'Hi everyone! Sophia''s 7th birthday party this Saturday 2-5pm at Chuck E. Cheese on Main Street. RSVP by Thursday! 🎂🎉', 
   '{"title": "Sophia''s Birthday Party", "date": "2025-03-15", "time": "2:00 PM - 5:00 PM", "location": "Chuck E. Cheese on Main Street"}'::jsonb, 
   true, false),
  (auth.uid(), 'msg_002', 'Soccer Team', 'Practice moved to 10am tomorrow due to field maintenance. Same location - Riverside Park.', 
   '{"title": "Soccer Practice", "date": "2025-03-16", "time": "10:00 AM", "location": "Riverside Park"}'::jsonb, 
   true, false);

-- Create default user preferences
INSERT INTO user_preferences (user_id, notification_events, notification_shopping, notification_reminders, whatsapp_integration, smartwatch_connected, voice_commands_enabled) VALUES
  (auth.uid(), true, true, true, false, false, false);