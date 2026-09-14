// ---------------------------------------------------------------------------
// SUPABASE CLIENT
// ---------------------------------------------------------------------------
// This file creates and exports a single Supabase client instance.
//
// HOW IT WORKS:
// - Supabase is a backend-as-a-service (like Firebase) that gives you
//   a database, authentication, and more — all through a simple API.
// - The "anon key" is a PUBLIC key — it's safe to use in the browser.
//   It only allows operations that your Row Level Security policies permit.
// - The client handles session tokens, refresh tokens, and persistence
//   automatically — you don't need to manage any of that yourself.
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create the Supabase client — this is used everywhere in the app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
