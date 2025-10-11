import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from localStorage or environment
const SUPABASE_URL = window.localStorage.getItem('TV_SUPABASE_URL') || 
                     process.env.TV_SUPABASE_URL || 
                     'https://eunaapesqbukbsrbgwna.supabase.co';

// Use a placeholder key for now - you'll need to replace this with your real anon key
const SUPABASE_ANON = window.localStorage.getItem('TV_SUPABASE_ANON') || 
                      process.env.TV_SUPABASE_ANON || 
                      null; // Set to null to disable Supabase for now

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


