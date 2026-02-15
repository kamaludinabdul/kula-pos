
import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
// Using Service Key to bypass RLS, simulating SQL Editor privilege
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(PROD_URL, PROD_KEY);

async function debugDelete() {
    const id = '260212090223302';
    console.log(`🗑️ Attempting to DELETE Transaction ID: ${id}`);

    // 1. Try Delete
    const { error, data } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .select();

    if (error) {
        console.error("❌ DELETE FAILED:");
        console.error(`Status: ${error.status} ${error.statusText}`);
        console.error(`Message: ${error.message}`);
        console.error(`Details: ${error.details}`);
        console.error(`Hint: ${error.hint}`);
    } else {
        console.log("✅ DELETE SUCCESS");
        console.log(`Deleted rows: ${data.length}`);
    }
}

debugDelete();
