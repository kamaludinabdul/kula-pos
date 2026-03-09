import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jsylclofqbqdutccsrxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTcxMTYsImV4cCI6MjA4MzQ3MzExNn0.D36mKeJ-jBaJXKQ5f0uLCHY3H31t8nB2NMRQfWrjfF8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORE_ID = 'b5b56789-1960-7bd0-1f54-abee9db1ee37';

async function checkData() {
    console.log("Checking massive expenses in staging...");
    const { data: expenses, error } = await supabase
        .from('cash_flow')
        .select('id, amount, description, type, expense_group, date')
        .eq('store_id', STORE_ID)
        .eq('type', 'out')
        .gte('amount', 1000000000) // 1 Billion or more
        .order('amount', { ascending: false });

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Found large expenses:");
        console.dir(expenses, { depth: null });
    }
}

checkData();
