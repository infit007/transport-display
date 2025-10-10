import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = window.localStorage.getItem('TV_SUPABASE_URL') || process.env.TV_SUPABASE_URL;
const SUPABASE_ANON = window.localStorage.getItem('TV_SUPABASE_ANON') || process.env.TV_SUPABASE_ANON;

export const supabase = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } })
  : null;


