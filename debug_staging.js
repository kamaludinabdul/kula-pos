import { createClient } from '@supabase/supabase-js';

// STAGING ENVIRONMENT
const SUPABASE_URL = 'https://jsylclofqbqdutccsrxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTcxMTYsImV4cCI6MjA4MzQ3MzExNn0.D36mKeJ-jBaJXKQ5f0uLCHY3H31t8nB2NMRQfWrjfF8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORE_ID = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'; // Need to verify if this store exists in staging

async function testRpc() {
    console.log("=== Testing [STAGING] get_dashboard_monthly_summary (2026) ===");
    const resp1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_dashboard_monthly_summary`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            p_store_id: STORE_ID,
            p_year: 2026
        })
    });

    const data1 = await resp1.json();
    if (!resp1.ok) {
        console.error("Error Monthly:", data1);
    } else {
        const withData = data1.filter(m => m.totalRevenue > 0 || m.totalOpEx > 0 || m.totalProfit !== 0);
        console.log("Months with data (2026):");
        console.dir(withData, { depth: null });
    }

    console.log("\n=== Testing [STAGING] get_dashboard_stats (March 2026) ===");
    const resp2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_dashboard_stats`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            p_store_id: STORE_ID,
            p_start_date: '2026-03-01T00:00:00.000Z',
            p_end_date: '2026-03-31T23:59:59.999Z',
            p_period: 'day',
            p_timezone: 'Asia/Jakarta'
        })
    });

    const data2 = await resp2.json();
    if (!resp2.ok) {
        console.error("Error Stats:", data2);
    } else {
        console.log("Key stats:");
        console.log({
            totalRevenue: data2.totalSales, // get_dashboard_stats returns totalSales
            totalGrossProfit: data2.totalGrossProfit,
            totalNetProfit: data2.totalNetProfit,
            totalTransactions: data2.totalTransactions
        });
    }
}

testRpc();
