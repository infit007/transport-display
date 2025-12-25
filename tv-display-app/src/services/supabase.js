import { createClient } from '@supabase/supabase-js';

// Use the same Supabase credentials as the main app
// This ensures the TV Display App connects to the same database automatically
// Load from env (injected by Webpack DefinePlugin), with safe localStorage fallback in browser
const envUrl = process.env.TV_SUPABASE_URL || '';
const envAnon = process.env.TV_SUPABASE_ANON || '';

let lsUrl = '';
let lsAnon = '';
if (typeof window !== 'undefined') {
  try { lsUrl = window.localStorage.getItem('TV_SUPABASE_URL') || ''; } catch {}
  try { lsAnon = window.localStorage.getItem('TV_SUPABASE_ANON') || ''; } catch {}
}

const SUPABASE_URL = envUrl || lsUrl || '';
const SUPABASE_ANON = envAnon || lsAnon || '';

// Only create client if we have valid credentials
export const supabase = SUPABASE_URL && SUPABASE_ANON && !SUPABASE_ANON.includes('placeholder')
  ? createClient(SUPABASE_URL, SUPABASE_ANON, { 
      auth: { persistSession: false },
      global: {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON
        }
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : null;

// Helper function to configure Supabase credentials
export const configureSupabase = (url, anonKey) => {
  window.localStorage.setItem('TV_SUPABASE_URL', url);
  window.localStorage.setItem('TV_SUPABASE_ANON', anonKey);
  console.log('Supabase credentials saved to localStorage');
  console.log('Please refresh the page to use the new credentials');
};


