import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    console.log(`Fetching latest 5 closed shifts globally...`);

    const { data: shifts, error: shiftsErr } = await supabase
        .from('shifts')
        .select('*')
        .eq('status', 'closed')
        .order('start_time', { ascending: false })
        .limit(5);

    if (shiftsErr || !shifts) {
        console.error("Error fetching shifts:", shiftsErr);
        return;
    }

    for (const shift of shifts) {
        const { data: txs, error: txsErr } = await supabase
            .from('transactions')
            .select('total, payment_method')
            .eq('shift_id', shift.id)
            .eq('status', 'completed');

        if (txsErr) continue;

        let sumTotal = 0;

        txs.forEach(tx => {
            sumTotal += Number(tx.total) || 0;
        });

        const isMatched = Number(shift.total_sales) === sumTotal;
        const diff = Number(shift.total_sales) - sumTotal;

        console.log(`\n--- Shift ${shift.id} (Store: ${shift.store_id}) ---`);
        console.log(`SHIFT table total_sales: ${shift.total_sales}`);
        console.log(`TXS sum total:           ${sumTotal}`);
        console.log(`Match?                   ${isMatched ? 'YES' : 'NO (Diff: ' + diff + ')'}`);

        if (diff === sumTotal && sumTotal > 0) {
            console.log(`⚠️ ANOMALY DETECTED: Shift total is EXACTLY DOUBLE the transaction sum!`);
        }
    }
}

runTest();
