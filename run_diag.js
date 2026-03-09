import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jsylclofqbqdutccsrxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTcxMTYsImV4cCI6MjA4MzQ3MzExNn0.D36mKeJ-jBaJXKQ5f0uLCHY3H31t8nB2NMRQfWrjfF8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORE_ID = 'b5b56789-1960-7bd0-1f54-abee9db1ee37';

async function runDiag() {
    console.log("Calling diag_massive_expenses in staging...");

    // Call the RPC
    const { data, error } = await supabase.rpc('diag_massive_expenses', {
        p_store_id: STORE_ID
    });

    if (error) {
        console.error("Error from RPC:", error);
    } else {
        console.log("Top massive expenses:");
        console.dir(data, { depth: null });
    }
}

runDiag();
