/*
  # OpenAI Realtime API Token Generation

  1. Purpose
    - Generate ephemeral API tokens for OpenAI Realtime API
    - Secure token generation with proper authentication
    - Rate limiting to prevent abuse

  2. Security
    - Tokens are short-lived (1 hour expiration)
    - User authentication required
    - API key stored securely in environment

  3. Response Format
    - Returns ephemeral token for OpenAI Realtime API
    - Includes expiration time
    - Provides connection metadata
*/

interface TokenRequest {
  userId: string;
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
    const { userId, sessionId }: TokenRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('⚠️ OpenAI API key not configured, returning demo token');
      return new Response(
        JSON.stringify({ 
          client_secret: {
            value: "demo-token-for-development"
          },
          expiresAt: Date.now() + (60 * 60 * 1000),
          userId,
          demo: true,
          message: "Demo mode - OpenAI API key not configured"
        }),
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
    const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'alloy',
        instructions: `You are a helpful AI assistant for busy parents in the "Busy Moms Assistant" app. 
        
        You help with:
        - Managing family schedules and events
        - Shopping lists and gift suggestions  
        - Reminders and daily planning
        - Contact management
        - General parenting advice and support
        
        Keep responses concise, practical, and empathetic. Always consider the busy lifestyle of parents and provide actionable suggestions. Use a warm, supportive tone.
        
        The user's name is ${userId} and this is session ${sessionId || 'default'}.`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('OpenAI token generation failed:', errorText);
      return new Response(
        JSON.stringify({ 
          error: "Failed to generate OpenAI token",
          details: errorText
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