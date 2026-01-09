/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://jsylclofqbqdutccsrxb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NzExNiwiZXhwIjoyMDgzNDczMTE2fQ.Aqs2ODInyTyIYq_uzwuXpvZC4XdEzBU61Rc66deXUFs";

const supabase = createClient(supabaseUrl, supabaseKey);

const USER_ID = "8924c014-bb87-4146-97c6-9861779d8416";
const NEW_PASSWORD = "LenovoG40#123!";

async function updatePassword() {
    console.log("🔐 Updating password...");

    const { error } = await supabase.auth.admin.updateUserById(USER_ID, {
        password: NEW_PASSWORD
    });

    if (error) {
        console.error("❌ Failed:", error.message);
        process.exit(1);
    }

    console.log("✅ Password updated successfully!");
    console.log(`   New password: ${NEW_PASSWORD}`);
    process.exit(0);
}

updatePassword().catch(console.error);
