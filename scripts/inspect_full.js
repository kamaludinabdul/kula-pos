
import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(PROD_URL, PROD_KEY);

async function inspectFull() {
    // This ID was allegedly deleted
    const id = '260212090223302';
    console.log(`🔍 Inspecting DELETED Transaction ID: ${id}`);

    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (data) {
        console.log("✅ Row still exists in DB (Soft Deleted?)");
        console.log("Data Keys:", Object.keys(data));
        console.log("is_deleted:", data.is_deleted);
        console.log("deleted_at:", data.deleted_at);
        console.log("status:", data.status);
    } else {
        console.log("❌ Row is completely GONE from DB (Hard Delete).");
    }
}

inspectFull();
