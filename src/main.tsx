import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import App from './App.tsx';
import './index.css';
import { ConfigurationError } from './components/ConfigurationError';
import { SupabaseClient } from '@supabase/supabase-js';

function Root() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [configError, setConfigError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('./lib/supabase')
      .then((module) => {
        setSupabase(module.supabase);
        setLoading(false);
      })
      .catch((error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        setConfigError(err);
        setLoading(false);
        console.error('Failed to initialize Supabase client:', err);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  if (configError) {
    return <ConfigurationError error={configError} />;
  }

  if (!supabase) {
    return (
      <ConfigurationError
        error={new Error('Supabase client could not be initialized')}
      />
    );
  }

  return (
    <SessionContextProvider supabaseClient={supabase}>
      <App />
    </SessionContextProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
