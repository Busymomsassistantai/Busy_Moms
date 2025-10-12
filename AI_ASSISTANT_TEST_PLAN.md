# Sarah AI Assistant - Test Plan

## Test Environment
- **Voice Mode**: Real-time voice interaction via OpenAI Realtime API
- **Text Mode**: Text-based chat via aiAssistantService
- **Database**: All operations write to Supabase tables

## Test Scenarios

### 1. Shopping List Management

#### Test 1A: Add Items
**Commands:**
- "Add milk to my shopping list"
- "Add 2 loaves of bread to shopping"
- "I need eggs"

**Expected Results:**
- Items added to `shopping_lists` table
- Success confirmation message
- Items visible in Shopping component

**Database Check:**
```sql
SELECT * FROM shopping_lists WHERE user_id = '<user_id>' ORDER BY created_at DESC;
```

#### Test 1B: Query Items
**Commands:**
- "What's on my shopping list?"
- "Show me my shopping items"
- "What do I need to buy?"

**Expected Results:**
- List of all shopping items with quantities
- Completed items marked with ✓
- Urgent items marked with 🔥

#### Test 1C: Update Items
**Commands:**
- "Mark milk as bought"
- "Change bread quantity to 3"
- "Make eggs urgent"

**Expected Results:**
- Item status/quantity updated in database
- Confirmation message
- Changes reflected in Shopping component

#### Test 1D: Delete Items
**Commands:**
- "Remove bread from shopping list"
- "Delete milk"

**Expected Results:**
- Item deleted from `shopping_lists` table
- Confirmation message
- Item no longer visible in Shopping component

---

### 2. Family Hub Management

#### Test 2A: Add Family Members
**Commands:**
- "Add my daughter Emma age 8"
- "Add my son Jack age 10"

**Expected Results:**
- Family members added to `family_members` table
- Success confirmation with name and age
- Members visible in Family Hub

**Database Check:**
```sql
SELECT * FROM family_members WHERE user_id = '<user_id>' ORDER BY created_at;
```

#### Test 2B: Query Family Members
**Commands:**
- "Who's in my family?"
- "Show me Emma's information"
- "List all family members"

**Expected Results:**
- List of family members with details
- Ages, schools, grades displayed
- Formatted natural language response

#### Test 2C: Update Family Members
**Commands:**
- "Update Emma's age to 9"
- "Set Emma's school to Lincoln Elementary"
- "Update Emma's grade to 4th grade"

**Expected Results:**
- Family member information updated
- Confirmation message
- Changes visible in Family Hub

#### Test 2D: Delete Family Members
**Commands:**
- "Remove Jack from family list"

**Expected Results:**
- Family member deleted from database
- Confirmation message
- Member no longer visible in Family Hub

---

### 3. Calendar Management

#### Test 3A: Create Events
**Commands:**
- "Schedule dentist appointment tomorrow at 2pm"
- "Add soccer practice on Friday at 4pm"
- "Create meeting next Monday at 10am at office"

**Expected Results:**
- Events created in `events` table with `source='ai'`
- Conflict detection if overlapping with existing events
- Success confirmation with date/time
- Events visible in Calendar and Dashboard

**Database Check:**
```sql
SELECT * FROM events WHERE user_id = '<user_id>' AND source = 'ai' ORDER BY event_date, start_time;
```

#### Test 3B: Query Events
**Commands:**
- "What's on my calendar today?"
- "Am I free tomorrow afternoon?"
- "When is my dentist appointment?"
- "Show me next week's schedule"

**Expected Results:**
- Natural language formatted schedule
- Availability status with free time slots
- Search results for specific events
- Conflict warnings if applicable

#### Test 3C: Update Events
**Commands:**
- "Move my dentist appointment to 3pm"
- "Change soccer practice to Saturday"
- "Update the location of my meeting to conference room B"

**Expected Results:**
- Event updated in database
- Conflict check performed
- Confirmation message
- Changes visible in Calendar component

#### Test 3D: Delete Events
**Commands:**
- "Cancel my dentist appointment"
- "Delete the meeting tomorrow"

**Expected Results:**
- Event deleted from `events` table
- Confirmation message
- Event no longer visible in Calendar

---

### 4. Combined Workflow Test

**Scenario:** Complete family task assignment workflow

**Commands (in sequence):**
1. "Add my daughter Emma age 8"
2. "Create a task for Emma to do homework due tomorrow"
3. "Add pencils to the shopping list for Emma's homework"
4. "Schedule Emma's soccer practice tomorrow at 4pm"
5. "What tasks does Emma have?"
6. "What's on my calendar tomorrow?"

**Expected Results:**
- Family member created
- Task assigned to Emma
- Shopping item added
- Calendar event created
- Query returns Emma's tasks
- Query shows tomorrow's schedule including soccer practice

**Database Verification:**
```sql
-- Check family member
SELECT * FROM family_members WHERE name ILIKE '%emma%';

-- Check tasks assigned to Emma
SELECT t.*, fm.name as assigned_to_name 
FROM tasks t 
JOIN family_members fm ON t.assigned_to = fm.id 
WHERE fm.name ILIKE '%emma%';

-- Check shopping items
SELECT * FROM shopping_lists WHERE item ILIKE '%pencil%';

-- Check calendar events
SELECT * FROM events WHERE title ILIKE '%soccer%';
```

---

## Test Execution Methods

### Voice Mode Testing
1. Click microphone icon in Dashboard
2. Wait for "Connected to Sarah"
3. Say "Hey, Sarah" (wake word)
4. Speak test commands
5. Verify responses and database changes

### Text Mode Testing
1. Click AI Assistant button
2. Switch to text mode (message icon)
3. Type test commands
4. Verify responses and database changes

---

## Success Criteria

### Shopping List
- ✅ Items can be added with correct category classification
- ✅ Items can be queried and listed with formatting
- ✅ Items can be updated (quantity, urgent, completed status)
- ✅ Items can be deleted by name search
- ✅ Multiple items with similar names require disambiguation

### Family Hub
- ✅ Family members can be added with name, age, gender
- ✅ Family members can be queried and listed
- ✅ Family member details can be updated (age, school, grade)
- ✅ Family members can be deleted
- ✅ Tasks can be assigned to family members

### Calendar
- ✅ Events can be created with date, time, location
- ✅ Conflict detection works for overlapping events
- ✅ Events can be queried (today, week, availability, search)
- ✅ Events can be updated (date, time, location)
- ✅ Events can be deleted
- ✅ Events appear in both Calendar and Dashboard

### Integration
- ✅ All operations persist to Supabase
- ✅ Changes are reflected in UI components
- ✅ Error handling provides clear feedback
- ✅ Conversation context is maintained
- ✅ Natural language processing works reliably

---

## Known Limitations

1. **Multiple Results**: If multiple items match a search term, Sarah asks for clarification
2. **Date Parsing**: Natural language dates work (today, tomorrow, Friday) but complex expressions may require specific dates
3. **Time Zones**: All times are in the user's local timezone
4. **Voice Recognition**: Wake word detection requires clear audio in quiet environment
5. **Conflict Resolution**: For calendar conflicts, Sarah suggests alternatives but doesn't auto-reschedule

---

## Troubleshooting

### Issue: Sarah doesn't respond to voice
**Solution:** Check microphone permissions, ensure browser supports WebRTC, try text mode

### Issue: Items not appearing in UI
**Solution:** Refresh the component, check database for record, verify user_id matches

### Issue: Ambiguous search results
**Solution:** Be more specific in commands (use full names, include dates)

### Issue: Calendar conflicts not detected
**Solution:** Ensure events have proper start_time and end_time values

---

## Database Tables Reference

- `shopping_lists` - Shopping items
- `family_members` - Family member profiles
- `events` - Calendar events
- `tasks` - Family tasks and chores
- `reminders` - User reminders
- `calendar_sync_mappings` - Google Calendar sync tracking
