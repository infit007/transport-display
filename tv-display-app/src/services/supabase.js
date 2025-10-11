import { createClient } from '@supabase/supabase-js';

// Use the same Supabase credentials as the main app
// This ensures the TV Display App connects to the same database automatically
const SUPABASE_URL = 'https://eunaapesqbukbsrbgwna.supabase.co';

// IMPORTANT: Replace this with your actual Supabase anon key
// To get it: Go to your Supabase Dashboard → Settings → API → Copy "anon public" key
// The key should start with "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1bmFhcGVzcWJ1a2JzcmJnd25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTMwNjcsImV4cCI6MjA3NTMyOTA2N30.8_dWkhtHw8UkfeB4SBSYmdKE4zb7abBE0wC_U5cjC60';

console.log('Supabase URL:', SUPABASE_URL);
console.log('Supabase configured:', !!SUPABASE_URL && !!SUPABASE_ANON);

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


