# Google OAuth Troubleshooting Guide

## Error: "Unable to exchange external code"

This error occurs when Supabase cannot exchange the Google authorization code for an access token. Here's how to fix it:

### Step 1: Verify Supabase Configuration

Go to your Supabase Dashboard: https://supabase.com/dashboard/project/[your-project-id]/auth/providers

1. Click on **Authentication** → **Providers** → **Google**
2. Verify the following:
   - [ ] Google provider is **enabled**
   - [ ] **Client ID** is entered correctly (no extra spaces, no line breaks)
   - [ ] **Client Secret** is entered correctly (no extra spaces, no line breaks)
   - [ ] Click **Save** after making any changes

**Common Issue:** Copy-paste can add extra spaces. Try these steps:
- Copy Client ID from Google Cloud Console
- Paste into a plain text editor (like Notepad)
- Verify there are no spaces before or after
- Copy from text editor and paste into Supabase

### Step 2: Verify Google Cloud Console Configuration

Go to: https://console.cloud.google.com/apis/credentials

#### 2a. Check OAuth 2.0 Client ID

1. Click on your OAuth 2.0 Client ID
2. Verify **Authorized JavaScript origins** includes:
   ```
   https://chic-duckanoo-b6e66f.netlify.app
   ```

3. Verify **Authorized redirect URIs** includes EXACTLY:
   ```
   https://0ec90b57d6e95fcbda19832f.supabase.co/auth/v1/callback
   ```

**Critical:** The redirect URI must match EXACTLY. Check:
- [ ] No trailing slash
- [ ] Correct project reference ID
- [ ] `/auth/v1/callback` path is correct
- [ ] Using `https://` not `http://`

#### 2b. Verify the Client ID and Secret Match

1. In Google Cloud Console, copy your **Client ID**
2. Compare it character-by-character with what's in Supabase
3. Do the same for **Client Secret**

**Common Issue:** Using Client ID/Secret from a different OAuth client or project.

### Step 3: Check OAuth Consent Screen

Go to: https://console.cloud.google.com/apis/credentials/consent

1. Verify OAuth consent screen is configured
2. For testing, you can use **External** user type
3. Add your test email addresses under **Test users** (if using External type)
4. Verify these scopes are added (or allow all):
   - `userinfo.email`
   - `userinfo.profile`
   - `calendar` (if using Google Calendar API)

### Step 4: Verify Google Calendar API is Enabled

Go to: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com

1. Click **Enable** if not already enabled
2. Verify it shows as enabled in your project

### Step 5: Check for Common Configuration Errors

- [ ] Using the correct Google Cloud Project (check project name in top bar)
- [ ] Not mixing OAuth clients (Web, iOS, Android - use Web Application type)
- [ ] Supabase project URL matches what's configured
- [ ] No firewall or VPN blocking the OAuth flow
- [ ] Cookies are enabled in your browser

### Step 6: Try a Fresh OAuth Flow

1. In Supabase Dashboard, click **Save** on the Google provider config (even if nothing changed)
2. Wait 30 seconds for changes to propagate
3. Clear your browser cookies for your app
4. Try signing in with Google again

### Step 7: Verify Environment Variables

Check your `.env` file has:
```
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

After updating `.env`:
1. Stop your dev server
2. Run `npm run dev` again
3. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)

### Debugging Checklist

Print this checklist and verify each item:

**Supabase Dashboard:**
- [ ] Google provider is enabled
- [ ] Client ID has no extra spaces
- [ ] Client Secret has no extra spaces
- [ ] Clicked Save after configuration

**Google Cloud Console - Credentials:**
- [ ] Using correct project (check top bar)
- [ ] OAuth client type is "Web application"
- [ ] Authorized JavaScript origins: `https://chic-duckanoo-b6e66f.netlify.app`
- [ ] Authorized redirect URI: `https://0ec90b57d6e95fcbda19832f.supabase.co/auth/v1/callback`
- [ ] Client ID matches what's in Supabase (character-by-character)
- [ ] Client Secret matches what's in Supabase

**Google Cloud Console - APIs:**
- [ ] Google Calendar API is enabled
- [ ] OAuth consent screen is configured
- [ ] Test users are added (if using External type)

**Local Environment:**
- [ ] .env file has correct VITE_SUPABASE_URL
- [ ] .env file has correct VITE_SUPABASE_ANON_KEY
- [ ] Dev server restarted after .env changes
- [ ] Browser cache cleared

### Still Not Working?

If you've verified all the above and it's still not working:

1. **Create a new OAuth Client ID in Google Cloud Console:**
   - Go to Credentials → Create Credentials → OAuth client ID
   - Choose "Web application"
   - Add the authorized origins and redirect URIs
   - Copy the NEW Client ID and Secret to Supabase

2. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Logs → Auth Logs
   - Look for detailed error messages about the OAuth exchange

3. **Test with a minimal setup:**
   - Try with ONLY these scopes: `userinfo.email` and `userinfo.profile`
   - If that works, add `calendar` scope back

### Contact Support

If none of the above works, gather this information:
- Screenshot of Google OAuth client configuration (hide sensitive data)
- Screenshot of Supabase Google provider settings (hide Client Secret)
- The exact error message from console
- Your Supabase project ID
