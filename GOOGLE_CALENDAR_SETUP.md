# Google Calendar Integration Setup Guide

## Overview

This guide provides step-by-step instructions to set up Google Calendar integration in your Busy Moms application using Supabase Edge Functions.

## Architecture

```
Frontend (React)
  → Supabase Auth (OAuth with Google)
  → Supabase Edge Functions
    ├── store-google-tokens (Store OAuth tokens)
    ├── google-calendar (Proxy Google Calendar API calls)
    └── google-diagnostics (Self-test endpoint)
  → Supabase Database (google_tokens table)
  → Google Calendar API
```

## Prerequisites

- Supabase project created and configured
- Google Cloud Console account
- Supabase CLI installed (for deploying Edge Functions)

---

## Step 1: Google Cloud Console Configuration

### 1.1 Create/Select Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Note your project ID for reference

### 1.2 Enable Google Calendar API

1. Navigate to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click **Enable**

### 1.3 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: External (for testing) or Internal (for organization)
   - App name: "Busy Moms App" (or your app name)
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add the following:
     - `userinfo.email`
     - `userinfo.profile`
     - `https://www.googleapis.com/auth/calendar`
   - Save and continue

4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: "Busy Moms Web Client"
   - Authorized JavaScript origins:
     ```
     http://localhost:5173
     https://your-app-domain.com
     ```
   - Authorized redirect URIs:
     ```
     https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
     http://localhost:5173
     ```
     Replace `[YOUR_PROJECT_REF]` with your Supabase project reference (e.g., `0ec90b57d6e95fcbda19832f`)

5. Click **Create**
6. **Copy the Client ID and Client Secret** (you'll need these next)

⚠️ **Important**: Make sure there are NO extra spaces or newlines when copying credentials!

---

## Step 2: Supabase Configuration

### 2.1 Configure Authentication Provider

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and click to expand
5. Enable the Google provider:
   - Toggle **Enabled** to ON
   - Paste **Client ID** from Google Cloud Console
   - Paste **Client Secret** from Google Cloud Console
   - Ensure no extra spaces or newlines
6. Click **Save**

### 2.2 Configure Edge Functions Secrets

Edge Functions need Google OAuth credentials to refresh tokens and make API calls.

**Option A: Via Supabase Dashboard**

1. Go to **Project Settings** → **Edge Functions**
2. Scroll to **Secrets** section
3. Add the following secrets:
   - **Name**: `GOOGLE_CLIENT_ID`
     **Value**: (paste Client ID from Google Cloud Console)
   - **Name**: `GOOGLE_CLIENT_SECRET`
     **Value**: (paste Client Secret from Google Cloud Console)

**Option B: Via Supabase CLI**

```bash
# Set Google Client ID
supabase secrets set GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"

# Set Google Client Secret
supabase secrets set GOOGLE_CLIENT_SECRET="your-client-secret-here"

# Verify secrets are set (values will be hidden)
supabase secrets list
```

### 2.3 Verify Database Migration

Check that the `google_tokens` table exists:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'google_tokens'
ORDER BY ordinal_position;
```

Expected columns:
- `user_id` (uuid, primary key)
- `provider_user_id` (text)
- `access_token` (text)
- `refresh_token` (text)
- `expiry_ts` (timestamptz)
- `scope` (text)
- `token_type` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

If the table doesn't exist, the migration should have been applied automatically. Check migration status:

```bash
supabase migration list
```

---

## Step 3: Deploy Edge Functions

### 3.1 Deploy All Google-Related Functions

```bash
# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy store-google-tokens
supabase functions deploy google-calendar
supabase functions deploy google-diagnostics
```

### 3.2 Verify Deployment

List deployed functions:

```bash
supabase functions list
```

You should see:
- `store-google-tokens`
- `google-calendar`
- `google-diagnostics`

---

## Step 4: Testing & Verification

### 4.1 Run Diagnostics

Test your configuration using the diagnostics endpoint:

**Via Browser Console:**

```javascript
// Replace with your Supabase URL
const supabaseUrl = "https://[YOUR_PROJECT_REF].supabase.co";

fetch(`${supabaseUrl}/functions/v1/google-diagnostics`)
  .then(r => r.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error("Diagnostics failed:", err));
```

**Via cURL:**

```bash
curl https://[YOUR_PROJECT_REF].supabase.co/functions/v1/google-diagnostics | jq
```

### 4.2 Check Diagnostic Results

The diagnostics endpoint checks:

✅ **Pass**: All checks succeeded
- Environment variables configured
- Database connection works
- Google OAuth credentials valid

⚠️ **Warning**: Some issues detected
- Check the `details` object for specific problems

❌ **Fail**: Critical issues
- Follow the `setup_instructions` in the response

### 4.3 Test OAuth Flow

1. **Sign In with Google**
   - Open your application
   - Click "Connect Google Calendar"
   - Authorize the app with your Google account
   - Should redirect back to your app

2. **Check Browser Console**
   - Look for these log messages:
     ```
     ✅ Found Google provider tokens in session
     💾 Storing Google tokens via Edge Function...
     📡 Calling store-google-tokens Edge Function...
     ✅ Tokens stored successfully
     ```

3. **Verify in Database**
   ```sql
   SELECT user_id, expiry_ts, created_at
   FROM google_tokens
   WHERE user_id = 'YOUR_USER_ID';
   ```

4. **Test Calendar Operations**
   - Try listing upcoming events
   - Try creating a test event
   - Verify events appear in Google Calendar

---

## Troubleshooting

### Issue: "Database error checking existing tokens"

**Symptoms:**
```
❌ Error storing Google tokens: Database error checking existing tokens
```

**Causes:**
1. `google_tokens` table doesn't exist
2. RLS policies blocking service role access
3. Edge Functions missing `SUPABASE_SERVICE_ROLE_KEY`

**Solutions:**
1. Apply migration: `supabase db push`
2. Check RLS policy allows service role:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'google_tokens';
   ```
3. Service role key should be auto-provided by Supabase

---

### Issue: "Google Calendar not configured"

**Symptoms:**
```
❌ Google Calendar Edge Function error: Google Calendar not configured
Missing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables
```

**Causes:**
1. Google OAuth secrets not set in Edge Functions
2. Secrets set but functions not redeployed

**Solutions:**
1. Set secrets via Dashboard or CLI (see Step 2.2)
2. Redeploy functions after setting secrets:
   ```bash
   supabase functions deploy
   ```

---

### Issue: "Unable to exchange external code"

**Symptoms:**
```
OAuth error: server_error
Unable to exchange external code
```

**Causes:**
1. Client ID/Secret mismatch between Supabase Auth and Google Cloud Console
2. Extra spaces or newlines in credentials
3. Redirect URI not authorized in Google Cloud Console

**Solutions:**
1. Verify credentials match exactly:
   - Supabase Dashboard → Authentication → Providers → Google
   - Google Cloud Console → Credentials
2. Copy credentials carefully (no extra spaces!)
3. Add redirect URI to Google Cloud Console:
   ```
   https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
   ```

---

### Issue: "Google Calendar service not available"

**Symptoms:**
```
❌ Failed to get events: Google Calendar service not available
```

**Causes:**
1. Edge Functions not deployed
2. User not connected to Google Calendar
3. Edge Functions configuration issues

**Solutions:**
1. Deploy functions: `supabase functions deploy`
2. Connect Google Calendar from app settings
3. Run diagnostics: `/functions/v1/google-diagnostics`
4. Check Edge Function logs:
   ```bash
   supabase functions logs google-calendar
   ```

---

### Issue: Token refresh fails

**Symptoms:**
```
❌ Token refresh failed: 400 invalid_grant
```

**Causes:**
1. Refresh token expired or revoked
2. User revoked access from Google account
3. Invalid Google OAuth credentials

**Solutions:**
1. Reconnect Google Calendar (user must re-authenticate)
2. Check user's Google account security settings
3. Verify credentials in diagnostics endpoint

---

## Monitoring & Maintenance

### View Edge Function Logs

```bash
# View logs for specific function
supabase functions logs google-calendar

# Stream logs in real-time
supabase functions logs google-calendar --follow

# View logs for all functions
supabase functions logs
```

### Monitor Token Health

```sql
-- Check token expiry status
SELECT
  user_id,
  expiry_ts,
  expiry_ts < NOW() as expired,
  updated_at
FROM google_tokens
ORDER BY updated_at DESC;

-- Count active connections
SELECT COUNT(*) as active_connections
FROM google_tokens
WHERE expiry_ts > NOW();
```

### Check Sync Status

```sql
-- View recent sync activity
SELECT
  user_id,
  sync_operation,
  status,
  events_processed,
  started_at,
  completed_at
FROM calendar_sync_logs
ORDER BY started_at DESC
LIMIT 20;
```

---

## Security Best Practices

1. **Never expose secrets in frontend code**
   - Always use Edge Functions for API calls
   - Never log access tokens or refresh tokens

2. **Rotate credentials periodically**
   - Update Google OAuth credentials every 6-12 months
   - Update Supabase secrets after rotation

3. **Monitor for unauthorized access**
   - Review Edge Function logs regularly
   - Set up alerts for repeated failures

4. **Use HTTPS everywhere**
   - Ensure all redirect URIs use HTTPS in production
   - Only use HTTP for local development

5. **Implement rate limiting**
   - Edge Functions include basic rate limiting
   - Monitor API usage in Google Cloud Console

---

## Environment Variables Reference

### Frontend (.env)

```bash
VITE_SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Edge Functions (Supabase Secrets)

```bash
# Auto-provided by Supabase
SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Must be manually configured
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## Support & Resources

- **Supabase Documentation**: https://supabase.com/docs
- **Google Calendar API**: https://developers.google.com/calendar
- **Google OAuth 2.0**: https://developers.google.com/identity/protocols/oauth2

---

## Quick Reference Commands

```bash
# Deploy functions
supabase functions deploy

# View logs
supabase functions logs google-calendar --follow

# Set secrets
supabase secrets set GOOGLE_CLIENT_ID="..."
supabase secrets set GOOGLE_CLIENT_SECRET="..."

# List secrets
supabase secrets list

# Run diagnostics
curl https://[YOUR_PROJECT_REF].supabase.co/functions/v1/google-diagnostics

# Check database
supabase db pull
supabase migration list
```

---

## Appendix: Manual Token Testing

For debugging, you can manually test token storage:

```javascript
// Get current session
const { data: { session } } = await supabase.auth.getSession();

// Call store-google-tokens directly
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-tokens`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      userId: session.user.id,
      accessToken: session.provider_token,
      refreshToken: session.provider_refresh_token,
      expiresIn: 3600
    })
  }
);

const result = await response.json();
console.log(result);
```

---

**Last Updated**: 2025-10-06
**Version**: 1.0
