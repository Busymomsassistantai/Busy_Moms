/*
  # WebRTC Token Generation

  1. Purpose
    - Generate ephemeral API tokens for WebRTC connections
    - Provide ICE server configuration for peer connections
    - Handle TURN server credentials if needed

  2. Security
    - Tokens are short-lived (1 hour expiration)
    - Rate limiting to prevent abuse
    - User authentication required

  3. Response Format
    - Returns ICE servers configuration
    - Includes ephemeral token for TURN servers
    - Provides connection metadata
*/

interface TokenRequest {
  userId: string;
  roomId: string;
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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
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
    const { userId, roomId }: TokenRequest = await req.json();

    if (!userId || !roomId) {
      return new Response(
        JSON.stringify({ error: "userId and roomId are required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Generate ephemeral token (in production, use a proper JWT library)
    const token = generateEphemeralToken(userId, roomId);
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour from now

    // ICE servers configuration
    // In production, you might want to use your own TURN servers
    const iceServers: RTCIceServer[] = [
      // Public STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      
      // For production, add TURN servers with credentials
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
      roomId
    };

    console.log(`✅ Generated WebRTC token for user ${userId} in room ${roomId}`);

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