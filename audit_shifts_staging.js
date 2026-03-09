import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jsylclofqbqdutccsrxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTcxMTYsImV4cCI6MjA4MzQ3MzExNn0.D36mKeJ-jBaJXKQ5f0uLCHY3H31t8nB2NMRQfWrjfF8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORE_ID = 'b5b56789-1960-7bd0-1f54-abee9db1ee37';

async function auditShiftMovements() {
    console.log("Auditing March 2026 shift_movements in staging...");

    const { data: allMovements, error } = await supabase
        .from('shift_movements')
        .select('id, amount, expense_group, type, date')
        .eq('store_id', STORE_ID)
        .gte('date', '2026-03-01T00:00:00Z')
        .lte('date', '2026-03-31T23:59:59Z');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${allMovements.length} movements.`);
    let total = 0;
    allMovements.forEach(m => {
        total += Number(m.amount);
        if (Number(m.amount) > 1000000) {
            console.log(`Large movement: ${m.amount} (${m.type}) [${m.expense_group}]`);
        }
    });
    console.log("Grand Total Movements:", total);
}

auditShiftMovements();
