import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'create_pet_hotel_fee_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('SQL content loaded. Size:', sql.length, 'bytes');

        // Attempt to use exec_sql if available
        const { data, error } = await supabase.rpc('exec_sql', { query: sql });

        if (error) {
            console.log("Could not run via RPC, likely 'exec_sql' does not exist.");
            console.log("Error:", error.message);
            console.log("\n=======================================================");
            console.log("PLEASE RUN THE SQL SCRIPT IN SUPABASE SQL EDITOR:");
            console.log("File:", sqlPath);
            console.log("=======================================================\n");

            process.exit(1);
        } else {
            console.log('Migration completed successfully via exec_sql!');
        }

    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
