import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jsylclofqbqdutccsrxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTcxMTYsImV4cCI6MjA4MzQ3MzExNn0.D36mKeJ-jBaJXKQ5f0uLCHY3H31t8nB2NMRQfWrjfF8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORE_ID = 'b5b56789-1960-7bd0-1f54-abee9db1ee37';

async function auditExpenses() {
    console.log("Auditing March 2026 expenses in staging...");

    // 1. Get total sums by expense_group
    const { data: groups, error: err1 } = await supabase
        .from('cash_flow')
        .select('expense_group, amount.sum()')
        .eq('store_id', STORE_ID)
        .eq('type', 'out')
        .gte('date', '2026-03-01T00:00:00Z')
        .lte('date', '2026-03-31T23:59:59Z');

    // Supabase JS doesn't support .sum() directly in select easily, using a direct query or rpc or just fetch all
    const { data: allOut, error: err2 } = await supabase
        .from('cash_flow')
        .select('id, amount, expense_group, description, date')
        .eq('store_id', STORE_ID)
        .eq('type', 'out')
        .gte('date', '2026-03-01T00:00:00Z')
        .lte('date', '2026-03-31T23:59:59Z');

    if (err2) {
        console.error("Error:", err2);
        return;
    }

    let totalByGroup = {};
    let grandTotal = 0;

    allOut.forEach(item => {
        const group = item.expense_group || 'NULL';
        totalByGroup[group] = (totalByGroup[group] || 0) + Number(item.amount);
        grandTotal += Number(item.amount);
        if (Number(item.amount) > 1000000) {
            console.log(`Large item: ${item.amount} - ${item.description} (${group})`);
        }
    });

    console.log("\nSummary by Group:");
    console.dir(totalByGroup);
    console.log("Grand Total Out:", grandTotal);

    // Check if any item has scientific notation or weird characters
    console.log(`\nTotal items found: ${allOut.length}`);
}

auditExpenses();
