import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from localStorage or default URL
// Note: Environment variables are not available in browser builds
const SUPABASE_URL = window.localStorage.getItem('TV_SUPABASE_URL') || 
                     'https://eunaapesqbukbsrbgwna.supabase.co';

const SUPABASE_ANON = window.localStorage.getItem('TV_SUPABASE_ANON') || 
                      null; // Will be null if not configured

console.log('Supabase URL:', SUPABASE_URL);
console.log('Supabase configured:', !!SUPABASE_URL && !!SUPABASE_ANON);

// Only create client if we have valid credentials
export const supabase = SUPABASE_URL && SUPABASE_ANON && !SUPABASE_ANON.includes('placeholder')
  ? createClient(SUPABASE_URL, SUPABASE_ANON, { 
      auth: { persistSession: false },
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


