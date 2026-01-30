
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUser(email) {
    console.log(`Checking existence of ${email}...`);
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: 'some-dummy-password-123'
    });

    if (error) {
        console.log('Result:', error.message);
    } else {
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            console.log('Result: User exists (Identity returned empty, meaning already registered provider or email)');
        } else {
            console.log('Result: User created (WARNING: I just created a dummy user if they didnt exist!)');
        }
    }
}

checkUser('rhpetshop25@gmail.com');
