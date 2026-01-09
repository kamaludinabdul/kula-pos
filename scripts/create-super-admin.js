/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://jsylclofqbqdutccsrxb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NzExNiwiZXhwIjoyMDgzNDczMTE2fQ.Aqs2ODInyTyIYq_uzwuXpvZC4XdEzBU61Rc66deXUFs";

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// --- SUPER ADMIN CREDENTIALS ---
const SUPER_ADMIN_EMAIL = "admin@kula.id";
const SUPER_ADMIN_PASSWORD = "SuperAdmin123!";
const SUPER_ADMIN_NAME = "Super Admin";

async function createSuperAdmin() {
    console.log("🔐 Creating Super Admin account...\n");

    // 1. Create user in Supabase Auth
    console.log("1️⃣ Creating auth user...");
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
            name: SUPER_ADMIN_NAME,
            role: 'super_admin'
        }
    });

    if (authError) {
        console.error("❌ Failed to create auth user:", authError.message);
        process.exit(1);
    }

    console.log("   ✅ Auth user created:", authData.user.id);

    // 2. Update profile to super_admin role
    console.log("2️⃣ Setting super_admin role in profiles...");
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: authData.user.id,
            email: SUPER_ADMIN_EMAIL,
            name: SUPER_ADMIN_NAME,
            role: 'super_admin',
            store_id: null
        });

    if (profileError) {
        console.error("❌ Failed to update profile:", profileError.message);
        process.exit(1);
    }

    console.log("   ✅ Profile updated with super_admin role");

    console.log("\n🎉 Super Admin created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`   Email:    ${SUPER_ADMIN_EMAIL}`);
    console.log(`   Password: ${SUPER_ADMIN_PASSWORD}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    process.exit(0);
}

createSuperAdmin().catch(console.error);
