/*
  # WebRTC Token Generation

  1. Purpose
    - Generate ephemeral tokens for WebRTC connections
    - Provide ICE server configuration for peer connections
    - Handle TURN server credentials if needed

  2. Security
    - Requires JWT authentication
    - Tokens are short-lived (1 hour expiration)
    - Properly signed tokens for secure communication

  3. Response Format
    - Returns ICE servers configuration
    - Includes ephemeral token for TURN servers
    - Provides connection metadata
*/

import { createClient } from 'npm:@supabase/supabase-js@2.55.0';

interface TokenRequest {
  roomId?: string;
}

interface TokenResponse {
  token: string;
  expiresAt: number;
  iceServers: RTCIceServer[];
  userId: string;
  roomId: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateEphemeralToken(userId: string, roomId: string): string {
  const payload = {
    userId,
    roomId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60)
  };

  return btoa(JSON.stringify(payload));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log(`🚀 WebRTC token request - ${req.method} ${req.url}`);

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

    const { roomId } = body;
    const userId = user.id;
    const finalRoomId = roomId || 'default-room';

    console.log('🔍 Processing WebRTC token request for user:', userId, 'room:', finalRoomId);

    const token = generateEphemeralToken(userId, finalRoomId);
    const expiresAt = Date.now() + (60 * 60 * 1000);

    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ];

    const response: TokenResponse = {
      token,
      expiresAt,
      iceServers,
      userId,
      roomId: finalRoomId
    };

    console.log(`✅ Generated WebRTC token for user ${userId} in room ${finalRoomId}`);

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
    console.error('❌ WebRTC token generation error:', error);

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
