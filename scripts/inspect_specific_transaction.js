
import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(PROD_URL, PROD_KEY);

async function inspect() {
    const id = '260212090223302'; // ID from screenshot
    console.log(`🔍 Inspecting Transaction ID: ${id}`);

    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error("Error finding transaction:", error.message);
        return;
    }

    if (data) {
        console.log("---------------------------------------------------");
        console.log(`ID            : ${data.id}`);
        console.log(`Raw Date      : ${data.date}`);
        console.log(`Raw CreatedAt : ${data.created_at}`);
        console.log(`Store ID      : ${data.store_id}`);
        console.log("---------------------------------------------------");

        // Check filtering logic
        const targetDate = new Date('2026-02-10');
        const recordDate = new Date(data.date);

        console.log(`Comparison:`);
        console.log(`Query Date (2026-02-10) as ISO: ${targetDate.toISOString()}`);
        console.log(`Record Date as ISO            : ${recordDate.toISOString()}`);
        console.log(`Is Record Date >= Query Date? : ${recordDate >= targetDate}`);
    } else {
        console.log("Transaction not found.");
    }
}

inspect();
