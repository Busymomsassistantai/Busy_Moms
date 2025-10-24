# Environment Configuration Guide

This guide explains how to configure environment variables for the Busy Moms Assistant AI application.

## Overview

The application requires Supabase credentials to function. These are configured differently for local development versus Bolt Cloud deployment.

## Environment Variables Required

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

## Local Development Setup

### Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### Step 2: Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace the placeholder values:
   ```
   VITE_SUPABASE_URL=https://your-actual-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...your-actual-key
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

## Bolt Cloud Deployment Setup

Since `.env` files are not deployed to Bolt Cloud, you must configure environment variables in your Bolt project settings.

### Step 1: Access Bolt Project Settings

1. Go to your Bolt project at `busymomsassistantai.bolt.host`
2. Navigate to **Project** → **Secrets**

### Step 2: Add Environment Variables

Add the following secrets (case-sensitive):

| Secret Name | Value |
|------------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

**Important:**
- Ensure there are NO extra spaces before or after the values
- Ensure there are NO newlines at the end
- Variable names must be EXACTLY as shown (including the `VITE_` prefix)

### Step 3: Redeploy

After adding the secrets:
1. Commit and push your changes
2. Bolt will automatically redeploy with the new environment variables

## Troubleshooting

### Error: "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY"

This error occurs when environment variables are not properly configured.

**For Local Development:**
1. Verify `.env` file exists in the project root
2. Check that variables are named correctly (must start with `VITE_`)
3. Ensure no quotes around values in `.env` file
4. Restart the dev server

**For Bolt Cloud:**
1. Verify secrets are added in Project → Secrets
2. Check for typos in secret names
3. Ensure values don't have extra whitespace
4. Redeploy the application

### Configuration Error Screen

If you see a red "Configuration Error" screen:
1. Read the detailed error message
2. Follow the instructions provided
3. Click "Retry Configuration" after fixing the issue

### Verifying Configuration

After the app loads, check the browser console for:
```
🔧 Environment Configuration Status
✅ Configuration is valid
📍 Supabase URL: https://xxxxx.supabase.co
🔑 Supabase Key: ✓ Set
```

## Security Notes

- Never commit `.env` files to git (already in `.gitignore`)
- Never share your `VITE_SUPABASE_ANON_KEY` publicly
- The anon key is safe for client-side use (it's public by design)
- Sensitive operations are protected by Row Level Security (RLS) in Supabase

## File Structure

```
project/
├── .env                 # Local development (gitignored)
├── .env.example         # Template file (tracked in git)
├── .gitignore           # Ensures .env is not committed
├── vite.config.ts       # Vite configuration for env vars
└── src/
    ├── lib/
    │   ├── config.ts    # Environment validation utility
    │   └── supabase.ts  # Supabase client with error handling
    ├── components/
    │   └── ConfigurationError.tsx  # Error screen for config issues
    └── main.tsx         # App entry with lazy config loading
```

## Next Steps

Once environment variables are configured:
1. The app should load without errors
2. You can sign up/sign in with email
3. All Supabase features will be available

For further assistance, check the other documentation files:
- `GOOGLE_CALENDAR_SETUP.md` - Google Calendar integration
- `RECIPE_FEATURE_GUIDE.md` - Recipe and shopping features
- `SYNC_SYSTEM_GUIDE.md` - Calendar sync configuration
