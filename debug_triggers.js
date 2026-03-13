import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
    console.log("Querying pg_trigger via postgres logic... (Wait, REST API doesn't allow pg_trigger)");
    // Let's create an RPC to do it. We can create an RPC since we have the service role key!
    // Wait, no, we can't create RPCs via REST API. We can only call them.
    console.log("We need another way. Let's look at the transactions table rows that have this anomaly.");

    const shiftId = 'bcfbac67-2856-4277-bc68-da710c0aa236'; // Example anomaly shift
    console.log(`Checking transactions for shift ${shiftId}`);

    const { data: txs, error: txsErr } = await supabase
        .from('transactions')
        .select('id, total, created_at, date')
        .eq('shift_id', shiftId);

    if (txsErr) {
        console.error(txsErr);
        return;
    }

    console.log(`Found ${txs.length} transactions for this shift:`);
    console.log(txs.slice(0, 5));

    const { data: shift } = await supabase.from('shifts').select('total_sales, created_at').eq('id', shiftId).single();
    console.log("Shift Data:", shift);
}

checkTriggers();
