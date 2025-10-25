// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabase';
import { ConfigurationError } from './components/ConfigurationError';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabase ? (
      <SessionContextProvider supabaseClient={supabase}>
        <App />
      </SessionContextProvider>
    ) : (
      <ConfigurationError error={new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not configured.')} />
    )}
  </StrictMode>
);
