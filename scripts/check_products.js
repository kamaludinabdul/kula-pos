
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env Variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
    console.log("Checking Products...");

    const { data, error } = await supabase
        .from('products')
        .select('id, name, pricing_type, type')
        .limit(50);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Found Products:", data.length);
    const dailyProducts = data.filter(p => p.pricingType === 'daily' || p.pricing_type === 'daily');

    console.log("\n--- Daily Rate Products ---");
    if (dailyProducts.length === 0) {
        console.log("NONE FOUND! Have you actually saved a product with 'Per Hari' type?");
    } else {
        dailyProducts.forEach(p => {
            console.log(`- [${p.name}] Type: ${p.pricingType || p.pricing_type}`);
        });
    }

    console.log("\n--- Hourly Rate Products (For Comparison) ---");
    data.filter(p => p.pricingType === 'hourly' || p.pricing_type === 'hourly').forEach(p => {
        console.log(`- [${p.name}] Type: ${p.pricingType || p.pricing_type}`);
    });
}

checkProducts();
