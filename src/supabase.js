import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Check your .env file.");
}

// Global handler to suppress Supabase SDK's internal AbortError
// This error occurs in _acquireLock and is not catchable by our code
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AbortError' ||
    event.reason?.message?.includes('signal is aborted')) {
    console.warn('Supabase SDK internal AbortError suppressed');
    event.preventDefault(); // Prevent the error from appearing in console
  }
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'kula-pos-auth',
    storage: window.localStorage,
    flowType: 'pkce',
    // Disable the lock to prevent AbortError from _acquireLock
    lock: false
  }
});
