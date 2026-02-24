import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function check() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error) { console.error(error); return; }
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  }
}
check();
