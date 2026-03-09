import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jsylclofqbqdutccsrxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTcxMTYsImV4cCI6MjA4MzQ3MzExNn0.D36mKeJ-jBaJXKQ5f0uLCHY3H31t8nB2NMRQfWrjfF8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkFunctions() {
    console.log("Checking function overloading in staging...");
    const { data: functions, error } = await supabase
        .rpc('get_dashboard_stats', {
            p_store_id: 'b5b56789-1960-7bd0-1f54-abee9db1ee37',
            p_start_date: '2026-03-01T00:00:00.000Z',
            p_end_date: '2026-03-31T23:59:59.999Z',
            p_period: 'day'
            // NOT passing p_timezone to see if it hits the 4-param version
        });

    if (error) {
        console.error("Error (likely overloading):", error);
    } else {
        console.log("Stats result (if it worked):", !!functions);
    }
}

checkFunctions();
