import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('ai_insights').upsert({
      store_id: 'ba68688c-1e24-4286-9ac7-05c04dfd8da1', // Example from active store
      period_type: 'yearly',
      period_year: 2026,
      period_month: -1,
      insight_text: 'Test Insight',
  }, { onConflict: 'store_id, period_type, period_year, period_month' });
  console.log("error:", error);
}
check();
