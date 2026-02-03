
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// PRODUCTION CREDENTIALS
const PROD_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(PROD_URL, PROD_KEY);

console.log(`🔌 Connecting to Production: ${PROD_URL}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const FILE_PATH = path.join(rootDir, 'migration_template.xlsx');

// Helper: Convert Excel serial date to JS Date
function excelDateToJSDate(serial) {
    if (typeof serial === 'string') return new Date(serial);
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const fractionalDay = serial - Math.floor(serial);
    const totalSeconds = Math.round(86400 * fractionalDay);
    return new Date((utcValue + totalSeconds) * 1000);
}

// Helper: Normalize product name
function normalizeProductName(name) {
    return (name || '').toLowerCase().trim().replace(/[,.\s]+$/, '');
}

// Generate transaction ID (same format as RPC)
function generateTransactionId() {
    const now = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const mi = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    const random = Math.floor(Math.random() * 1000);
    return `${yy}${mm}${dd}${hh}${mi}${ss}${random}`;
}

async function runDirectImport() {
    console.log("🚀 Memulai DIRECT Import ke PRODUCTION...");

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

    const { data: products, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', STORE_ID);

    if (prodError) throw prodError;

    console.log(`✅ Ditemukan ${products.length} produk.`);

    // Build product lookup
    const productLookup = {};
    products.forEach(p => {
        productLookup[normalizeProductName(p.name)] = p;
        if (p.barcode) productLookup[p.barcode] = p;
    });

    let successCount = 0;
    let skipCount = 0;

    for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        if (!row[0]) continue;

        // Parse data
        const parsedDate = excelDateToJSDate(row[0]);
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
            price = product.sell_price || 0; // Correct column name!
        }

        const total = price * qty;
        const transactionId = generateTransactionId();

        // Prepare items JSON - MUST include buy_price for profit calculation!
        const items = [{
            id: product.id,
            qty: qty,
            price: price,
            buy_price: product.buy_price || 0, // CRITICAL for Laba calculation!
            name: product.name
        }];

        // 1. INSERT into transactions table DIRECTLY
        const { error: insertError } = await supabase
            .from('transactions')
            .insert({
                id: transactionId,
                store_id: STORE_ID,
                customer_id: null,
                total: total,
                discount: discount,
                subtotal: total + discount,
                payment_method: method,
                amount_paid: total - discount,
                change: 0,
                type: 'sale',
                items: items,
                date: parsedDate.toISOString(),
                created_at: parsedDate.toISOString(), // Set created_at same as date!
                status: 'completed',
                points_earned: 0
            });

        if (insertError) {
            console.error(`❌ Baris ${idx + 2}: Gagal INSERT - ${insertError.message}`);
            continue;
        }

        // 2. Update product stock
        const { error: stockError } = await supabase
            .from('products')
            .update({
                stock: product.stock - qty,
                sold: (product.sold || 0) + qty,
                revenue: (product.revenue || 0) + total
            })
            .eq('id', product.id);

        if (stockError) {
            console.warn(`⚠️ Baris ${idx + 2}: Stok tidak terupdate - ${stockError.message}`);
        }

        // 3. Insert stock movement
        await supabase.from('stock_movements').insert({
            store_id: STORE_ID,
            product_id: product.id,
            type: 'sale',
            qty: -qty,
            date: parsedDate.toISOString(),
            note: 'Import Transaksi #' + transactionId.slice(-6),
            ref_id: transactionId
        });

        successCount++;
        if (successCount % 10 === 0) {
            console.log(`✅ ${successCount} transaksi berhasil...`);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 50));
    }

    console.log(`\n🏁 Import Selesai!`);
    console.log(`✅ Berhasil: ${successCount} transaksi`);
    console.log(`⚠️ Dilewati: ${skipCount} baris`);
}

runDirectImport().catch(e => console.error("Fatal:", e));
