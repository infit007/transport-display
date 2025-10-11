import { createClient } from '@supabase/supabase-js';

// Use the same Supabase configuration as the main app
// This should match your main app's Supabase URL and anon key
const SUPABASE_URL = 'https://eunaapesqbukbsrbgwna.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1bmFhcGVzcWJ1a2JzcmJnd25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYxNjQ4MzMsImV4cCI6MjA1MTc0MDgzM30.placeholder';

console.log('Supabase URL:', SUPABASE_URL);
console.log('Supabase configured:', !!SUPABASE_URL && !!SUPABASE_ANON);

export const supabase = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON, { 
      auth: { persistSession: false },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : null;


