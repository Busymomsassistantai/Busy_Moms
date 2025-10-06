import { supabase } from '../lib/supabase';
import { getActiveSession } from '../lib/sessionHelper';
import type { Session } from '@supabase/supabase-js';

export interface GoogleTokenInfo {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  providerUserId?: string;
  scope?: string;
}

export async function captureAndStoreGoogleTokens(session: Session): Promise<boolean> {
  console.log('🔍 Checking session for Google provider tokens...');

  const providerToken = session.provider_token;
  const providerRefreshToken = session.provider_refresh_token;

  if (!providerToken) {
    console.log('⚠️ No provider_token found in session');
    return false;
  }

  if (!providerRefreshToken) {
    console.log('⚠️ No provider_refresh_token found in session');
    return false;
  }

  console.log('✅ Found Google provider tokens in session');
  console.log('Provider token present:', !!providerToken);
  console.log('Provider refresh token present:', !!providerRefreshToken);

  try {
    const tokenInfo: GoogleTokenInfo = {
      userId: session.user.id,
      accessToken: providerToken,
      refreshToken: providerRefreshToken,
      expiresIn: session.expires_in || 3600,
      providerUserId: session.user.user_metadata?.provider_id || session.user.user_metadata?.sub,
      scope: session.user.user_metadata?.iss
    };

    return await storeGoogleTokens(tokenInfo);
  } catch (error) {
    console.error('❌ Failed to capture and store Google tokens:', error);
    return false;
  }
}

export async function storeGoogleTokens(tokenInfo: GoogleTokenInfo): Promise<boolean> {
  console.log('💾 Storing Google tokens via Edge Function...');

  try {
    const session = await getActiveSession();

    if (!session) {
      console.error('❌ No active session found');
      return false;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      console.error('❌ VITE_SUPABASE_URL not configured');
      return false;
    }

    if (!anonKey) {
      console.error('❌ VITE_SUPABASE_ANON_KEY not configured');
      return false;
    }

    const functionUrl = `${supabaseUrl}/functions/v1/store-google-tokens`;

    console.log('📡 Calling store-google-tokens Edge Function...');
    console.log(`🔗 Function URL: ${functionUrl}`);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': anonKey
      },
      body: JSON.stringify(tokenInfo)
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorData;

      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
      } else {
        const errorText = await response.text();
        errorData = { error: `Server error: ${errorText || response.statusText}` };
      }

      console.error(`❌ Failed to store tokens (HTTP ${response.status}):`, errorData);

      if (response.status === 500 && errorData.details?.includes('google_tokens')) {
        console.error('💡 Database table issue detected. Verify google_tokens table exists and RLS policies are correct.');
      } else if (response.status === 500) {
        console.error('💡 Edge Function error. Check Supabase Edge Functions logs for details.');
        console.error('💡 Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured in Edge Functions secrets.');
      }

      throw new Error(errorData.error || errorData.message || errorData.details || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Tokens stored successfully:', result);
    return true;
  } catch (error) {
    console.error('❌ Error storing Google tokens:', error);
    console.error('💡 Troubleshooting steps:');
    console.error('  1. Check that store-google-tokens Edge Function is deployed');
    console.error('  2. Verify google_tokens table exists in database');
    console.error('  3. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in Supabase Edge Functions secrets');
    console.error('  4. Run diagnostics: fetch your Supabase URL + "/functions/v1/google-diagnostics")');
    return false;
  }
}

export async function checkGoogleTokensExist(userId: string): Promise<boolean> {
  console.log('🔍 Checking if Google tokens exist for user:', userId);

  try {
    const session = await getActiveSession();

    if (!session) {
      console.log('⚠️ No active session');
      return false;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      console.error('❌ VITE_SUPABASE_URL not configured');
      return false;
    }

    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!anonKey) {
      console.error('❌ VITE_SUPABASE_ANON_KEY not configured');
      return false;
    }

    const functionUrl = `${supabaseUrl}/functions/v1/google-calendar`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        action: 'isConnected',
        userId
      })
    });

    if (!response.ok) {
      console.log('⚠️ Could not check token status');
      return false;
    }

    const data = await response.json();
    console.log('Token check result:', data.connected);
    return data.connected || false;
  } catch (error) {
    console.error('❌ Error checking Google tokens:', error);
    return false;
  }
}
