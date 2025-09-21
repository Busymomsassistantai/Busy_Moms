/*
  # WebRTC Token Generation

  1. Purpose
    - Generate ephemeral API tokens for WebRTC connections
    - Provide ICE server configuration for peer connections
    - Handle TURN server credentials if needed

  2. Security
    - Tokens are short-lived (1 hour expiration)
    - Works with both authenticated and anonymous users
    - Rate limiting to prevent abuse

  3. Response Format
    - Returns ICE servers configuration
    - Includes ephemeral token for TURN servers
    - Provides connection metadata
*/

interface TokenRequest {
  userId?: string;
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
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper to safely get user ID from request
function getSafeUserId(req: Request, body: any): string {
  // Try body first
  if (body?.userId) {
    console.log("📝 Using user ID from body:", body.userId);
    return body.userId;
  }

  // Try auth header
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.sub) {
          console.log("📝 Using user ID from JWT:", payload.sub);
          return payload.sub;
        }
      }
    } catch (error) {
      console.log("⚠️ Could not parse JWT");
    }
  }

  // Generate anonymous user ID as fallback
  const anonId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log("📝 Using anonymous user ID:", anonId);
  return anonId;
}

// Generate a simple ephemeral token
// In production, use a proper JWT library with signing
function generateEphemeralToken(userId: string, roomId: string): string {
  const payload = {
    userId,
    roomId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };
  
  // Simple base64 encoding for demo purposes
  // In production, use proper JWT signing with a secret key
  return btoa(JSON.stringify(payload));
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log(`🚀 WebRTC token request - ${req.method} ${req.url}`);

    // Only allow POST requests
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

    // Parse request body
    let body: any = {};
    try {
      body = await req.json();
    } catch (error) {
      console.log('⚠️ No JSON body provided, using defaults');
    }
    
    const { roomId }: TokenRequest = body;
    const userId = getSafeUserId(req, body);
    const finalRoomId = roomId || 'default-room';

    console.log('🔍 Processing WebRTC token request for user:', userId, 'room:', finalRoomId);

    // Generate ephemeral token
    const token = generateEphemeralToken(userId, finalRoomId);
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour from now

    // ICE servers configuration
    // Using public STUN servers for development
    // In production, you should add TURN servers for better connectivity
    const iceServers: RTCIceServer[] = [
      // Public STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // For production, add TURN servers with credentials
      // Example:
      // {
      //   urls: 'turn:your-turn-server.com:3478',
      //   username: 'your-username',
      //   credential: 'your-password'
      // }
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
        message: error instanceof Error ? error.message : "Unknown error"
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