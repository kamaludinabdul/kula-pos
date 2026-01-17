/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://cuoayarlytvayhgyjuqb.supabase.co',
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function resetPassword() {
    // First, get the user ID
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error('Error listing users:', listError.message);
        return;
    }

    const adminUser = users.users.find(u => u.email === 'admin@kula.id');
    if (!adminUser) {
        console.log('User admin@kula.id not found');
        return;
    }

    console.log('Found user:', adminUser.id);

    // Update password
    const { data, error } = await supabase.auth.admin.updateUserById(adminUser.id, {
        password: 'LenovoG40'
    });

    if (error) {
        console.error('Error updating password:', error.message);
    } else {
        console.log('✅ Password updated successfully for admin@kula.id');
    }
}

resetPassword();
