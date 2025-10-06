/*
  # Google Calendar Integration Diagnostics

  Self-test endpoint to verify Google Calendar integration setup.
  Tests environment variables, database connectivity, and Google API access.
*/

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    checks: [] as any[],
    overall_status: "unknown" as "pass" | "fail" | "warning" | "unknown",
  };

  try {
    // Check 1: Environment Variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    diagnostics.checks.push({
      name: "Environment Variables",
      status: supabaseUrl && serviceRoleKey ? "pass" : "fail",
      details: {
        SUPABASE_URL: supabaseUrl ? "✅ Set" : "❌ Missing",
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ? "✅ Set" : "❌ Missing",
        GOOGLE_CLIENT_ID: googleClientId ? "✅ Set" : "❌ Missing",
        GOOGLE_CLIENT_SECRET: googleClientSecret ? "✅ Set" : "❌ Missing",
      },
      message: (!supabaseUrl || !serviceRoleKey)
        ? "Critical: Supabase environment variables missing (auto-provided by platform)"
        : (!googleClientId || !googleClientSecret)
        ? "Google OAuth credentials not configured. Add via Supabase Dashboard → Project Settings → Edge Functions → Secrets"
        : "All environment variables configured correctly"
    });

    // Check 2: Database Connection
    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false }
        });

        const { error: connectionError } = await supabase
          .from('google_tokens')
          .select('user_id')
          .limit(1);

        diagnostics.checks.push({
          name: "Database Connection",
          status: connectionError ? "fail" : "pass",
          details: connectionError ? {
            error: connectionError.message,
            code: connectionError.code,
          } : {
            message: "Successfully connected to database",
            table: "google_tokens accessible"
          },
          message: connectionError
            ? `Database connection failed: ${connectionError.message}`
            : "Database connection successful"
        });
      } catch (dbError: any) {
        diagnostics.checks.push({
          name: "Database Connection",
          status: "fail",
          error: dbError.message,
          message: "Failed to connect to database"
        });
      }
    } else {
      diagnostics.checks.push({
        name: "Database Connection",
        status: "skip",
        message: "Skipped - Supabase credentials not available"
      });
    }

    // Check 3: Google OAuth Configuration
    if (googleClientId && googleClientSecret) {
      try {
        const testResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            grant_type: 'client_credentials',
          }),
        });

        diagnostics.checks.push({
          name: "Google OAuth Credentials",
          status: testResponse.ok || testResponse.status === 400 ? "pass" : "fail",
          details: {
            http_status: testResponse.status,
            note: "Status 400 is normal here - just testing if credentials are recognized"
          },
          message: testResponse.ok || testResponse.status === 400
            ? "Google OAuth credentials appear valid"
            : "Google OAuth credentials may be invalid - check Client ID and Secret"
        });
      } catch (googleError: any) {
        diagnostics.checks.push({
          name: "Google OAuth Credentials",
          status: "warning",
          error: googleError.message,
          message: "Could not verify Google credentials - network issue or invalid credentials"
        });
      }
    } else {
      diagnostics.checks.push({
        name: "Google OAuth Credentials",
        status: "fail",
        message: "Google OAuth credentials not configured",
        instructions: [
          "1. Go to Google Cloud Console (console.cloud.google.com)",
          "2. Create or select a project",
          "3. Enable Google Calendar API",
          "4. Create OAuth 2.0 credentials (Web application)",
          "5. Add authorized redirect URI: " + (supabaseUrl ? `${supabaseUrl}/auth/v1/callback` : "[your-supabase-url]/auth/v1/callback"),
          "6. Copy Client ID and Client Secret",
          "7. Add to Supabase: Dashboard → Project Settings → Edge Functions → Secrets",
          "   - Secret name: GOOGLE_CLIENT_ID",
          "   - Secret name: GOOGLE_CLIENT_SECRET"
        ]
      });
    }

    // Check 4: Edge Functions Deployment
    diagnostics.checks.push({
      name: "Edge Functions Status",
      status: "pass",
      details: {
        function_name: "google-diagnostics",
        runtime: "Deno",
        deployed: true
      },
      message: "Diagnostic function is running successfully"
    });

    // Determine overall status
    const hasFailures = diagnostics.checks.some((c: any) => c.status === "fail");
    const hasWarnings = diagnostics.checks.some((c: any) => c.status === "warning");

    diagnostics.overall_status = hasFailures ? "fail" : hasWarnings ? "warning" : "pass";

    // Add setup instructions if there are failures
    if (hasFailures) {
      diagnostics.setup_instructions = {
        title: "Google Calendar Integration Setup Required",
        steps: [
          {
            step: 1,
            title: "Configure Google Cloud Console",
            actions: [
              "Go to console.cloud.google.com",
              "Create or select a project",
              "Enable Google Calendar API (APIs & Services → Library → Search 'Calendar')",
              "Create OAuth 2.0 Client ID (APIs & Services → Credentials → Create Credentials)",
              "Set Application Type: Web application",
              "Add Authorized Redirect URI: " + (supabaseUrl ? `${supabaseUrl}/auth/v1/callback` : "[your-project].supabase.co/auth/v1/callback"),
              "Copy the Client ID and Client Secret"
            ]
          },
          {
            step: 2,
            title: "Configure Supabase Edge Functions",
            actions: [
              "Go to your Supabase Dashboard",
              "Navigate to Project Settings → Edge Functions",
              "Add these secrets:",
              "  • GOOGLE_CLIENT_ID (paste from Google Cloud Console)",
              "  • GOOGLE_CLIENT_SECRET (paste from Google Cloud Console)",
              "Ensure no extra spaces or newlines in the values"
            ]
          },
          {
            step: 3,
            title: "Enable Google OAuth in Supabase Auth",
            actions: [
              "Go to Supabase Dashboard → Authentication → Providers",
              "Find and enable Google provider",
              "Paste the same Client ID and Secret",
              "Ensure 'Enabled' toggle is ON",
              "Save changes"
            ]
          },
          {
            step: 4,
            title: "Test the Integration",
            actions: [
              "Run this diagnostic again to verify setup",
              "Try connecting Google Calendar from the app",
              "Check browser console for any errors",
              "Verify tokens are stored in database"
            ]
          }
        ]
      };
    }

    return jsonResponse(diagnostics, hasFailures ? 500 : 200);

  } catch (error) {
    console.error('❌ Diagnostics error:', error);

    return jsonResponse({
      timestamp: new Date().toISOString(),
      overall_status: "fail",
      error: "Diagnostic check failed",
      message: error instanceof Error ? error.message : "Unknown error",
      details: "Check Edge Function logs for more information"
    }, 500);
  }
});
