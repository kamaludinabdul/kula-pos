
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// HARDCODED PRODUCTION CREDENTIALS (User Provided)
const PROD_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(PROD_URL, PROD_KEY);
const adminClient = supabase;

console.log(`🔌 Connecting to Production: ${PROD_URL}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const FILE_PATH = path.join(rootDir, 'migration_template.xlsx');

// Helper: Convert Excel serial date to JS Date
function excelDateToJSDate(serial) {
    if (typeof serial === 'string') {
        return new Date(serial);
    }
    // Excel epoch is Jan 0, 1900 (but it treats 1900 as leap year incorrectly)
    const utcDays = Math.floor(serial - 25569); // 25569 = days from 1900 to 1970
    const utcValue = utcDays * 86400; // seconds
    const fractionalDay = serial - Math.floor(serial);
    const totalSeconds = Math.round(86400 * fractionalDay);
    return new Date((utcValue + totalSeconds) * 1000);
}

// Helper: Fuzzy match product name (case insensitive, trim, remove trailing punctuation)
function normalizeProductName(name) {
    return (name || '').toLowerCase().trim().replace(/[,.\s]+$/, '');
}

async function runImport() {
    console.log("🚀 Memulai Import Transaksi ke PRODUCTION...");

    if (!fs.existsSync(FILE_PATH)) {
        console.error(`❌ File tidak ditemukan: ${FILE_PATH}`);
        return;
    }
    const wb = xlsx.readFile(FILE_PATH);
    const sheetName = wb.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    const [_headers, ...rows] = rawData;

    console.log(`📊 File memiliki ${rows.length} baris data.`);

    const storeIdArg = process.argv[2];
    if (!storeIdArg) {
        console.error("❌ Mohon jalankan dengan Store ID sebagai argumen.");
        return;
    }
    const STORE_ID = storeIdArg;

    console.log(`📦 Mengambil data produk untuk Store ID: ${STORE_ID}...`);

    const { data: products, error: prodError } = await adminClient
        .from('products')
        .select('*')
        .eq('store_id', STORE_ID);

    if (prodError) throw prodError;

    const { data: customers, error: custError } = await adminClient
        .from('customers')
        .select('id, name')
        .eq('store_id', STORE_ID);

    if (custError) throw custError;

    console.log(`✅ Ditemukan ${products.length} produk dan ${customers.length} pelanggan.`);

    // Build normalized product lookup
    const productLookup = {};
    products.forEach(p => {
        productLookup[normalizeProductName(p.name)] = p;
        if (p.barcode) productLookup[p.barcode] = p;
    });

    // Process each row as SEPARATE transaction (not grouped)
    let successCount = 0;
    let skipCount = 0;

    for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        if (!row[0]) continue;

        // Parse Excel date
        let dateVal = row[0];
        const parsedDate = excelDateToJSDate(dateVal);

        const customerName = (row[1] || 'Umum').toString().trim() || 'Umum';
        const productName = (row[2] || '').toString().trim();
        const qty = parseFloat(row[3]) || 1;
        let price = parseFloat(row[4]);
        const method = (row[5] || 'cash').toString().toLowerCase();
        const discount = parseFloat(row[6]) || 0;

        // Find product
        const normalizedInput = normalizeProductName(productName);
        const product = productLookup[normalizedInput] || productLookup[productName];

        if (!product) {
            console.warn(`⚠️ Baris ${idx + 2}: Produk tidak ditemukan: "${productName}" - SKIP`);
            skipCount++;
            continue;
        }

        if (isNaN(price) || price === 0) {
            price = product.selling_price || product.price || 0;
        }

        // Resolve Customer
        let customerId = null;
        if (customerName.toLowerCase() !== 'umum') {
            const existCust = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
            if (existCust) {
                customerId = existCust.id;
            } else {
                const { data: newCust } = await adminClient
                    .from('customers')
                    .insert({ store_id: STORE_ID, name: customerName, phone: '-' })
                    .select().single();
                if (newCust) {
                    customerId = newCust.id;
                    customers.push(newCust);
                }
            }
        }

        const total = price * qty;

        const payload = {
            p_store_id: STORE_ID,
            p_customer_id: customerId,
            p_total: total,
            p_discount: discount,
            p_payment_method: method,
            p_items: [{ id: product.id, qty, price, name: product.name }],
            p_type: 'sale',
            p_date: parsedDate.toISOString(),
            p_amount_paid: total - discount
        };

        try {
            const { error } = await adminClient.rpc('process_sale', payload);
            if (error) {
                console.error(`❌ Baris ${idx + 2}: Gagal - ${error.message}`);
            } else {
                successCount++;
                if (successCount % 10 === 0) {
                    console.log(`✅ ${successCount} transaksi berhasil...`);
                }
            }
        } catch (e) {
            console.error(`❌ Baris ${idx + 2}: Exception -`, e.message);
        }
    }

    console.log(`\n🏁 Import Selesai!`);
    console.log(`✅ Berhasil: ${successCount} transaksi`);
    console.log(`⚠️ Dilewati: ${skipCount} baris (produk tidak ditemukan)`);
}

runImport().catch(e => console.error("Fatal:", e));
