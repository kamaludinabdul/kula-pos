
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log('Checking Purchase Orders Data...');
  
  // 1. Total Count
  const { count, error: countError } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error fetching count:', countError);
  } else {
    console.log('Total Count:', count);
  }

  // 2. Group by Store ID
  const { data: stores, error: storeError } = await supabase
    .from('purchase_orders')
    .select('store_id');
    
  if (storeError) {
      console.error('Error fetching stores:', storeError);
  } else {
      const counts = {};
      stores.forEach(s => {
          counts[s.store_id] = (counts[s.store_id] || 0) + 1;
      });
      console.log('Counts by Store ID:', counts);
  }

    // 3. fetch at least one PO
    const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .limit(1);
    
    if (poError) {
        console.error('Error fetching PO:', poError);
    } else {
        console.log('Example PO:', po);
    }
}

checkData();
