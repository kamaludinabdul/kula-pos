import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jsylclofqbqdutccsrxb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDI5MjYxMSwiZXhwIjoyMDU1ODYwNjExfQ.9yN0KkM2o_L-2q60mH_2iQ5_gN43v4bYfKxQ4P2Y1mE';

// Wait, the key I found earlier in .env was for project 'cuoayarlytvayhgyjuqb'. That might be wrong!
// Let me just see if I can get the real service key from .env or just use the ANON key but with a real user session.
