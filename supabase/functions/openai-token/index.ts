/*
  # OpenAI Realtime API Token Generation

  1. Purpose
    - Generate ephemeral API tokens for OpenAI Realtime API
    - Secure token generation with proper authentication
    - Session-based token management

  2. Security
    - Requires JWT authentication
    - Tokens are short-lived (1 hour expiration)
    - API key never exposed to clients
    - Proper auth validation through Supabase

  3. Response Format
    - Returns ephemeral token for OpenAI Realtime API
    - Includes expiration time
    - Provides connection metadata
*/

import { createClient } from 'npm:@supabase/supabase-js@2.55.0';

interface TokenRequest {
  sessionId?: string;
}

interface TokenResponse {
  client_secret: {
    value: string;
  };
  expiresAt: number;
  userId: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log(`🚀 OpenAI token request - ${req.method} ${req.url}`);

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ Authentication failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log('✅ Authenticated user:', user.id);

    let body: TokenRequest = {};
    try {
      body = await req.json();
    } catch (error) {
      console.log('⚠️ No JSON body provided, using defaults');
    }

    const { sessionId } = body;
    const userId = user.id;

    console.log('🔍 Processing token request for user:', userId, 'session:', sessionId);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not configured');
      return new Response(
        JSON.stringify({
          error: "Service unavailable",
          message: "OpenAI service is not configured"
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log("🤖 Generating OpenAI Realtime session...");

    const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'alloy',
        instructions: `You are Sara, a helpful AI assistant for busy parents in the "Busy Moms Assistant" app.

        You help with:
        - Managing family schedules and events
        - Shopping lists and gift suggestions
        - Reminders and daily planning
        - Contact management
        - General parenting advice and support

        Keep responses concise, practical, and empathetic. Always consider the busy lifestyle of parents and provide actionable suggestions. Use a warm, supportive tone.

        The user's ID is ${userId} and this is session ${sessionId || 'default'}.`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ OpenAI token generation failed:', tokenResponse.status, errorText.substring(0, 200));

      return new Response(
        JSON.stringify({
          error: "Failed to generate token",
          message: "Unable to create OpenAI session at this time"
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const tokenData = await tokenResponse.json();
    const expiresAt = Date.now() + (60 * 60 * 1000);

    const response: TokenResponse = {
      client_secret: {
        value: tokenData.client_secret?.value || tokenData.token
      },
      expiresAt,
      userId
    };

    console.log(`✅ Generated OpenAI Realtime token for user ${userId}`);

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('❌ OpenAI token generation error:', error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "An unexpected error occurred"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
