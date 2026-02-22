import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('shopping_recommendations').select('*').limit(1);
  console.log("data:", JSON.stringify(data, null, 2));
  console.log("error:", error);
}
check();
