/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://jsylclofqbqdutccsrxb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NzExNiwiZXhwIjoyMDgzNDczMTE2fQ.Aqs2ODInyTyIYq_uzwuXpvZC4XdEzBU61Rc66deXUFs";

const supabase = createClient(supabaseUrl, supabaseKey);

const EMAIL = "admin@kula.id";
const PASSWORD = "LenovoG40#123!";

async function resetAdmin() {
    console.log(`🔍 Checking for user: ${EMAIL}...`);

    // 1. List users to find the admin by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error("❌ Error listing users:", listError.message);
        process.exit(1);
    }

    const adminUser = users.find(u => u.email === EMAIL);

    if (adminUser) {
        console.log(`✅ User found (ID: ${adminUser.id}). Resetting password...`);

        const { error: updateError } = await supabase.auth.admin.updateUserById(adminUser.id, {
            password: PASSWORD,
            email_confirm: true,
            user_metadata: { role: 'super_admin', name: 'Super Admin' }
        });

        if (updateError) {
            console.error("❌ Failed to update password:", updateError.message);
            process.exit(1);
        }

        // Also ensure profile exists
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: adminUser.id,
                email: EMAIL,
                name: 'Super Admin',
                role: 'super_admin'
            });

        if (profileError) console.warn("⚠️ Warning updating profile:", profileError.message);

        console.log("🎉 Password reset successfully!");
    } else {
        console.log("⚠️ User not found. Creating new Super Admin...");
        const { data, error: createError } = await supabase.auth.admin.createUser({
            email: EMAIL,
            password: PASSWORD,
            email_confirm: true,
            user_metadata: { role: 'super_admin', name: 'Super Admin' }
        });

        if (createError) {
            console.error("❌ Failed to create user:", createError.message);
            process.exit(1);
        }

        // Create profile
        await supabase.from('profiles').insert({
            id: data.user.id,
            email: EMAIL,
            name: 'Super Admin',
            role: 'super_admin'
        });

        console.log("🎉 User created successfully!");
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`   Email:    ${EMAIL}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

resetAdmin().catch(console.error);
