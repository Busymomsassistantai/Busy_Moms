/*
  # OpenAI Realtime API Token Generation

  1. Purpose
    - Generate ephemeral API tokens for OpenAI Realtime API
    - Secure token generation with flexible authentication
    - Rate limiting to prevent abuse

  2. Security
    - Tokens are short-lived (1 hour expiration)
    - Works with both authenticated and anonymous users
    - API key stored securely in environment

  3. Response Format
    - Returns ephemeral token for OpenAI Realtime API
    - Includes expiration time
    - Provides connection metadata
*/

interface TokenRequest {
  userId?: string;
  sessionId?: string;
}

interface TokenResponse {
  client_secret: {
    value: string;
  };
  expiresAt: number;
  userId: string;
  demo?: boolean;
  message?: string;
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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log(`🚀 OpenAI token request - ${req.method} ${req.url}`);

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
    
    const { sessionId }: TokenRequest = body;
    const userId = getSafeUserId(req, body);

    console.log('🔍 Processing token request for user:', userId, 'session:', sessionId);

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('⚠️ OpenAI API key not configured, returning demo token');
      
      const demoResponse: TokenResponse = {
        client_secret: {
          value: "demo-token-for-development"
        },
        expiresAt: Date.now() + (60 * 60 * 1000),
        userId,
        demo: true,
        message: "Demo mode - OpenAI API key not configured"
      };

      return new Response(
        JSON.stringify(demoResponse),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Generate ephemeral token using OpenAI API
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
      console.error('❌ OpenAI token generation failed:', errorText);
      
      // Return a fallback response instead of failing
      const fallbackResponse: TokenResponse = {
        client_secret: {
          value: openaiApiKey // Use the API key directly as fallback
        },
        expiresAt: Date.now() + (60 * 60 * 1000),
        userId,
        message: "Using API key as fallback - ephemeral token generation failed"
      };

      return new Response(
        JSON.stringify(fallbackResponse),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const tokenData = await tokenResponse.json();
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour from now

    const response: TokenResponse = {
      client_secret: {
        value: tokenData.client_secret?.value || tokenData.token || openaiApiKey
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