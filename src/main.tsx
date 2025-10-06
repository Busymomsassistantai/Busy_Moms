import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import App from './App.tsx';
import './index.css';
import { supabase } from './lib/supabase';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionContextProvider supabaseClient={supabase}>
      <App />
    </SessionContextProvider>
  </StrictMode>
);
