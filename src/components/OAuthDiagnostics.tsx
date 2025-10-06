import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Copy } from 'lucide-react';
import { getOAuthRedirectUrl, getSupabaseAuthCallbackUrl, getGoogleOAuthScopes } from '../lib/auth-config';

export function OAuthDiagnostics() {
  const [copied, setCopied] = useState<string | null>(null);
  const [urlParams, setUrlParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash ? new URLSearchParams(window.location.hash.substring(1)) : null;

    const allParams: Record<string, string> = {};
    params.forEach((value, key) => allParams[`query.${key}`] = value);
    if (hash) {
      hash.forEach((value, key) => allParams[`hash.${key}`] = value);
    }

    setUrlParams(allParams);
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const redirectUrl = getOAuthRedirectUrl();
  const callbackUrl = getSupabaseAuthCallbackUrl();
  const scopes = getGoogleOAuthScopes();

  const ConfigItem = ({
    label,
    value,
    status = 'info',
    copyable = true
  }: {
    label: string;
    value: string;
    status?: 'success' | 'error' | 'warning' | 'info';
    copyable?: boolean;
  }) => {
    const statusIcons = {
      success: <CheckCircle className="w-5 h-5 text-green-500" />,
      error: <XCircle className="w-5 h-5 text-red-500" />,
      warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
      info: <AlertTriangle className="w-5 h-5 text-blue-500" />
    };

    return (
      <div className="p-3 bg-theme-bg rounded-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {statusIcons[status]}
              <span className="font-medium text-sm text-gray-700">{label}</span>
            </div>
            <code className="text-xs text-theme-fg opacity-70 break-all">{value}</code>
          </div>
          {copyable && (
            <button
              onClick={() => copyToClipboard(value, label)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="Copy to clipboard"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
        {copied === label && (
          <span className="text-xs text-green-600 mt-1 block">Copied!</span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-theme-bg p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-theme-surface rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">Google OAuth Configuration Diagnostics</h1>
          <p className="text-theme-fg opacity-70 mb-6">
            Use this page to verify your OAuth configuration and troubleshoot issues.
          </p>

          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold mb-3">Environment Configuration</h2>
              <div className="space-y-2">
                <ConfigItem
                  label="Supabase URL"
                  value={supabaseUrl || 'NOT SET'}
                  status={supabaseUrl ? 'success' : 'error'}
                />
                <ConfigItem
                  label="Supabase Anon Key"
                  value={supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'NOT SET'}
                  status={supabaseKey ? 'success' : 'error'}
                  copyable={false}
                />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">OAuth URLs</h2>
              <div className="space-y-2">
                <ConfigItem
                  label="Current App Origin"
                  value={redirectUrl}
                  status="success"
                />
                <ConfigItem
                  label="Supabase OAuth Callback URL (Add to Google Cloud Console)"
                  value={callbackUrl}
                  status="warning"
                />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Google OAuth Scopes</h2>
              <div className="space-y-2">
                <div className="p-3 bg-theme-bg rounded-lg">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-5 h-5 text-blue-500" />
                        <span className="font-medium text-sm text-gray-700">Requested Scopes (space-separated)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(scopes, 'Requested Scopes')}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  <code className="text-xs text-theme-fg opacity-70 block whitespace-pre-wrap break-all mb-3">{scopes}</code>
                  {copied === 'Requested Scopes' && (
                    <span className="text-xs text-green-600 mt-1 block">Copied!</span>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-theme-fg opacity-70 font-medium mb-2">Individual scopes:</p>
                    <ul className="space-y-1">
                      {scopes.split(' ').map((scope, idx) => (
                        <li key={idx} className="text-xs text-theme-fg opacity-70 flex items-start">
                          <span className="mr-2">•</span>
                          <code className="break-all">{scope}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-theme-fg opacity-60 italic">
                      Note: These scopes are automatically included in the OAuth request.
                      You don't need to configure them separately in Google Cloud Console.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {Object.keys(urlParams).length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Current URL Parameters</h2>
                <div className="space-y-2">
                  {Object.entries(urlParams).map(([key, value]) => (
                    <ConfigItem
                      key={key}
                      label={key}
                      value={value}
                      status={key.includes('error') ? 'error' : 'info'}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-3">Setup Checklist</h2>
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">1. Supabase Dashboard Configuration</h3>
                  <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                    <li>Go to Authentication → Providers → Google</li>
                    <li>Enable Google provider</li>
                    <li>Enter Client ID (check for extra spaces)</li>
                    <li>Enter Client Secret (check for extra spaces)</li>
                    <li>Save configuration</li>
                  </ul>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-900 mb-2">2. Google Cloud Console Configuration</h3>
                  <ul className="list-disc list-inside text-sm text-purple-800 space-y-1">
                    <li>Go to APIs & Services → Credentials</li>
                    <li>Select your OAuth 2.0 Client ID (or create one)</li>
                    <li>Add Authorized JavaScript origins: <code className="bg-theme-surface px-1">{redirectUrl}</code></li>
                    <li>Add Authorized redirect URI: <code className="bg-theme-surface px-1">{callbackUrl}</code></li>
                    <li>Enable Google Calendar API in your project</li>
                    <li>Configure OAuth consent screen</li>
                  </ul>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">3. Common Issues</h3>
                  <ul className="list-disc list-inside text-sm text-green-800 space-y-1">
                    <li>Extra spaces in Client ID or Secret</li>
                    <li>Redirect URI mismatch between Supabase and Google</li>
                    <li>OAuth consent screen not configured</li>
                    <li>Google Calendar API not enabled</li>
                    <li>App not verified (only affects production)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-3 text-red-600">Error: "Unable to exchange external code"</h2>
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <p className="text-sm text-red-900 mb-3 font-medium">
                  This error means Supabase cannot exchange the Google authorization code for an access token.
                  Here's how to fix it:
                </p>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-red-900 text-sm mb-2">Step 1: Verify Client ID and Secret</h4>
                    <ul className="list-decimal list-inside text-sm text-red-800 space-y-1 ml-2">
                      <li>Copy Client ID from Google Cloud Console to plain text editor</li>
                      <li>Check for extra spaces or line breaks</li>
                      <li>Copy clean text to Supabase (no spaces before/after)</li>
                      <li>Repeat for Client Secret</li>
                      <li>Click Save in Supabase Dashboard</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-red-900 text-sm mb-2">Step 2: Verify Redirect URI Matches Exactly</h4>
                    <p className="text-sm text-red-800 mb-2">In Google Cloud Console, the redirect URI must be EXACTLY:</p>
                    <div className="bg-theme-surface p-2 rounded border border-red-300 mb-2">
                      <code className="text-xs text-red-900 break-all">{callbackUrl}</code>
                      <button
                        onClick={() => copyToClipboard(callbackUrl, 'Redirect URI')}
                        className="ml-2 text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Copy
                      </button>
                    </div>
                    <ul className="list-disc list-inside text-sm text-red-800 space-y-1 ml-2">
                      <li>No trailing slash</li>
                      <li>Must use https:// not http://</li>
                      <li>Correct project reference ID</li>
                      <li>/auth/v1/callback path</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-red-900 text-sm mb-2">Step 3: Verify OAuth Client Type</h4>
                    <ul className="list-disc list-inside text-sm text-red-800 space-y-1 ml-2">
                      <li>Must be "Web application" type (not iOS, Android, or Desktop)</li>
                      <li>Check you're using the correct Google Cloud Project</li>
                      <li>Verify you copied credentials from the same OAuth client</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-red-900 text-sm mb-2">Step 4: Wait and Retry</h4>
                    <ul className="list-disc list-inside text-sm text-red-800 space-y-1 ml-2">
                      <li>Click Save in Supabase Dashboard</li>
                      <li>Wait 30-60 seconds for changes to propagate</li>
                      <li>Clear browser cookies</li>
                      <li>Try OAuth flow again</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-red-900 text-sm mb-2">Still not working?</h4>
                    <ul className="list-disc list-inside text-sm text-red-800 space-y-1 ml-2">
                      <li>Create a NEW OAuth client in Google Cloud Console</li>
                      <li>Use the new Client ID and Secret in Supabase</li>
                      <li>Check Supabase Dashboard → Logs → Auth Logs for details</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-red-300">
                  <a
                    href="https://supabase.com/dashboard/project/_/auth/providers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-red-600 hover:text-red-800 underline font-medium"
                  >
                    Open Supabase Auth Providers →
                  </a>
                  <span className="mx-2">|</span>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-red-600 hover:text-red-800 underline font-medium"
                  >
                    Open Google Cloud Console →
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="text-center">
          <a
            href="/"
            className="text-theme-primary hover:underline"
          >
            Back to App
          </a>
        </div>
      </div>
    </div>
  );
}
