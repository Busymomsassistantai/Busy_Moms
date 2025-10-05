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
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {statusIcons[status]}
              <span className="font-medium text-sm text-gray-700">{label}</span>
            </div>
            <code className="text-xs text-gray-600 break-all">{value}</code>
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">Google OAuth Configuration Diagnostics</h1>
          <p className="text-gray-600 mb-6">
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
                <ConfigItem
                  label="Requested Scopes"
                  value={scopes}
                  status="info"
                />
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
                    <li>Add Authorized JavaScript origins: <code className="bg-white px-1">{redirectUrl}</code></li>
                    <li>Add Authorized redirect URI: <code className="bg-white px-1">{callbackUrl}</code></li>
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
          </div>
        </div>

        <div className="text-center">
          <a
            href="/"
            className="text-blue-600 hover:underline"
          >
            Back to App
          </a>
        </div>
      </div>
    </div>
  );
}
