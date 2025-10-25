// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabase';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabase ? (
      <SessionContextProvider supabaseClient={supabase}>
        <App />
      </SessionContextProvider>
    ) : (
      <App />
    )}
  </StrictMode>
);
