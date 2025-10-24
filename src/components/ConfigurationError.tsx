import { AlertCircle, ExternalLink } from 'lucide-react'

interface ConfigurationErrorProps {
  error: Error
}

export function ConfigurationError({ error }: ConfigurationErrorProps) {
  const isEnvironmentError = error.message.includes('VITE_SUPABASE')

  if (!isEnvironmentError) {
    throw error
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Configuration Error
            </h1>
            <p className="text-gray-600">
              The application cannot start because environment variables are not properly configured.
            </p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <pre className="text-sm text-red-800 whitespace-pre-wrap font-mono">
            {error.message}
          </pre>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              For Local Development:
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Copy <code className="bg-gray-100 px-2 py-1 rounded">.env.example</code> to <code className="bg-gray-100 px-2 py-1 rounded">.env</code></li>
              <li>
                Get your Supabase credentials from{' '}
                <a
                  href="https://app.supabase.com/project/_/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  Supabase Dashboard
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Fill in <code className="bg-gray-100 px-2 py-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-gray-100 px-2 py-1 rounded">VITE_SUPABASE_ANON_KEY</code></li>
              <li>Restart the development server</li>
            </ol>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              For Bolt Cloud Deployment:
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Go to your Bolt project at <code className="bg-gray-100 px-2 py-1 rounded">busymomsassistantai.bolt.host</code></li>
              <li>Navigate to <strong>Project → Secrets</strong></li>
              <li>Add both <code className="bg-gray-100 px-2 py-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-gray-100 px-2 py-1 rounded">VITE_SUPABASE_ANON_KEY</code></li>
              <li>Ensure there are no extra spaces or newlines in the values</li>
              <li>Redeploy your application</li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
            <p className="text-blue-800 text-sm">
              If you continue to experience issues, verify that:
            </p>
            <ul className="list-disc list-inside text-blue-800 text-sm mt-2 space-y-1">
              <li>Your Supabase project is active and accessible</li>
              <li>The URL starts with <code className="bg-blue-100 px-1 rounded">https://</code></li>
              <li>The anon key is a valid JWT token (long string)</li>
              <li>Environment variable names are exactly <code className="bg-blue-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-blue-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code></li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Retry Configuration
          </button>
        </div>
      </div>
    </div>
  )
}
