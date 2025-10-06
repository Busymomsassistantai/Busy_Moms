import { supabase } from '../lib/supabase';
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
    const { data: { session } } = await supabase.auth.getSession();

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

    const functionUrl = `${supabaseUrl}/functions/v1/store-google-tokens`;

    console.log('📡 Calling store-google-tokens function...');

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      },
      body: JSON.stringify(tokenInfo)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Failed to store tokens:', errorData);
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Tokens stored successfully:', result);
    return true;
  } catch (error) {
    console.error('❌ Error storing Google tokens:', error);
    return false;
  }
}

export async function checkGoogleTokensExist(userId: string): Promise<boolean> {
  console.log('🔍 Checking if Google tokens exist for user:', userId);

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      console.error('❌ VITE_SUPABASE_URL not configured');
      return false;
    }

    const functionUrl = `${supabaseUrl}/functions/v1/google-calendar`;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
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
