
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv'; // We need dotenv to load env vars

// Initialize environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Load .env manually if not in process
if (fs.existsSync(path.join(rootDir, '.env'))) {
    dotenv.config({ path: path.join(rootDir, '.env') });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY; // OR SERVICE_ROLE_KEY for admin bypass

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// CONFIG
const FILE_PATH = path.join(rootDir, 'migration_template.xlsx');
const STORE_ID = "YOUR_STORE_ID_HERE"; // We need to fetch this or ask user
// Or better, we login the user via email/password if needed, OR we just ask for their UUID.
// For now, let's try to get the first store of the authenticated user if we can, 
// BUT this is a node script, so we might need the Service Role Key or just hardcode a store ID.
// Let's ask the user to provide their Store ID or we can try to find it via fuzzy logic if we use Service Role.
// Use SERVICE_ROLE if available for easier admin
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminClient = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : supabase;


async function runImport() {
    console.log("🚀 Memulai Import Transaksi...");

    if (!fs.existsSync(FILE_PATH)) {
        console.error(`❌ File tidak ditemukan: ${FILE_PATH}`);
        return;
    }

    // 1. Read File
    const wb = xlsx.readFile(FILE_PATH);
    const sheetName = wb.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

    // Remove headers
    const [_headers, ...rows] = rawData;

    // Map Columns safely
    // Index: 0=Date, 1=Customer, 2=Product, 3=Qty, 4=Price, 5=Method, 6=Discount

    // 2. Fetch Master Data (Products & Customers) - Optimally we should do this via Admin client
    // BUT we need a Store ID. 
    // Let's assume the user edits this script or we pass it as arg?
    // Let's prompt or accept arg.
    const storeIdArg = process.argv[2];
    if (!storeIdArg) {
        console.error("❌ Mohon jalankan dengan Store ID sebagai argumen.");
        console.error("Contoh: node scripts/import_transactions.js <STORE_UUID>");
        return;
    }
    const STORE_ID = storeIdArg;

    console.log(`📦 Mengambil data produk untuk Store ID: ${STORE_ID}...`);

    const { data: products, error: prodError } = await adminClient
        .from('products')
        .select('*') // Select all to avoid column error
        .eq('store_id', STORE_ID);

    if (prodError) throw prodError;

    const { data: customers, error: custError } = await adminClient
        .from('customers')
        .select('id, name')
        .eq('store_id', STORE_ID);

    if (custError) throw custError;

    console.log(`✅ Ditemukan ${products.length} produk dan ${customers.length} pelanggan.`);

    // 3. Group Rows by Transaction (Date + Customer + Method)
    const transactions = {}; // Key: "Date|Customer|Method"

    rows.forEach((row, idx) => {
        if (!row[0]) return; // Skip empty rows

        // Excel date might be a number or string. Handle safely.
        let dateVal = row[0];
        // If number (Excel serial date), convert? 
        // xlsx library usually handles this if we don't specify raw:true, but let's assume string for simplicity or ISO.
        // Actually best is to treat as text in Excel.

        const customerName = (row[1] || 'Umum').trim();
        const productName = (row[2] || '').trim();
        const qty = parseFloat(row[3]) || 1;

        let price = parseFloat(row[4]); // Can be NaN

        const method = (row[5] || 'cash').toLowerCase();
        const discount = parseFloat(row[6]) || 0;

        // Verify product
        const product = products.find(p =>
            p.name.toLowerCase() === productName.toLowerCase() ||
            (p.barcode && p.barcode === productName)
        );

        if (!product) {
            console.warn(`⚠️ Baris ${idx + 2}: Produk tidak ditemukan: "${productName}" - SKIP`);
            return;
        }

        // Use database price if Excel price is empty
        if (isNaN(price)) {
            price = product.price || product.selling_price || 0;
        }

        // Group Key
        const key = `${dateVal}|${customerName}|${method}`;

        if (!transactions[key]) {
            transactions[key] = {
                date: dateVal,
                customer_name: customerName,
                payment_method: method,
                items: [],
                total_discount: 0
            };
        }

        transactions[key].items.push({
            id: product.id,
            qty: qty,
            price: price || product.price || product.selling_price || 0, // Fallback to selling_price
            name: product.name
        });

        // Accumulate discount (assuming discount is per row? or per transaction?)
        // Let's assume provided discount is total for transaction if repeated, or sum? 
        // Simple logic: Sum them up.
        transactions[key].total_discount += discount;
    });

    // 4. Execute Process Sale
    const transKeys = Object.keys(transactions);
    console.log(`🔄 Memproses ${transKeys.length} transaksi...`);

    for (const key of transKeys) {
        const tr = transactions[key];

        // Resolve Customer
        let customerId = null;
        const existCust = customers.find(c => c.name.toLowerCase() === tr.customer_name.toLowerCase());
        if (existCust) {
            customerId = existCust.id;
        } else {
            // Create new customer? Or map to null?
            // Let's Auto-Create for better experience
            if (tr.customer_name.toLowerCase() !== 'umum') {
                const { data: newCust, error: _createError } = await adminClient
                    .from('customers')
                    .insert({ store_id: STORE_ID, name: tr.customer_name, phone: '-' })
                    .select()
                    .single();

                if (newCust) {
                    customerId = newCust.id;
                    customers.push(newCust); // Add to cache
                    console.log(`✨ Pelanggan baru dibuat: ${tr.customer_name}`);
                }
            }
        }

        // Calculate Totals
        const total = tr.items.reduce((sum, item) => sum + (item.price * item.qty), 0);

        // Call RPC
        const payload = {
            p_store_id: STORE_ID,
            p_customer_id: customerId,
            p_total: total,
            p_discount: tr.total_discount,
            p_payment_method: tr.payment_method,
            p_items: tr.items, // RPC needs [ {id, qty, price, name} ]
            p_type: 'sale',
            p_date: new Date(tr.date).toISOString(), // Ensure ISO format
            p_amount_paid: total - tr.total_discount // Assume full payment
        };

        try {
            const { data: _data, error } = await adminClient.rpc('process_sale', payload);
            if (error) {
                console.error(`❌ Gagal Transaksi ${tr.date} ${tr.customer_name}:`, error.message);
            } else {
                console.log(`✅ Sukses: ${tr.date} - ${tr.customer_name} - Rp ${total}`);
            }
        } catch (e) {
            console.error(`❌ Exception:`, e);
        }
    }

    console.log("🏁 Import Selesai.");
}

runImport().catch(e => {
    console.error("💥 Fatal Error during import:", e);

    if (e && e.code === 'PGRST116') {
        process.stdout.write("Error: Data tidak ditemukan (JSON object requested, multiple (or no) rows returned)\n");
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("\n⚠️  HINT: Anda tidak memiliki SUPABASE_SERVICE_ROLE_KEY di .env.");
        console.warn("   Script ini mungkin gagal karena Row Level Security (RLS).");
        console.warn("   Pastikan tabel 'products' dan 'customers' bisa dibaca public, atau tambahkan Service Key.");
    }
});
