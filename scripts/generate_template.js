
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generateTemplate = () => {
    // Define headers
    const headers = [
        "Tanggal (YYYY-MM-DD HH:mm)",
        "Nama Pelanggan",
        "Nama Produk (Harus Persis / Barcode)",
        "Qty",
        "Harga Satuan (Opsional - Jika kosong pakai harga database)",
        "Metode Pembayaran (cash/transfer/qris)",
        "Diskon (Rp)"
    ];

    // Dummy Data
    const data = [
        ["2025-12-01 10:30", "Budi Santoso", "Beras Premium 5kg", 2, "", "cash", 0],
        ["2025-12-01 10:30", "Budi Santoso", "Minyak Goreng 2L", 1, 28000, "cash", 0],
        ["2025-12-02 14:15", "Siti Aminah", "Gula Pasir 1kg", 5, "", "transfer", 5000],
        ["2025-12-03 09:00", "Umum", "Telur Ayam 1kg", 1, "", "qris", 0]
    ];

    // Create Worksheet
    const ws = xlsx.utils.aoa_to_sheet([headers, ...data]);

    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, // Date
        { wch: 20 }, // Customer
        { wch: 40 }, // Product
        { wch: 10 }, // Qty
        { wch: 25 }, // Price
        { wch: 20 }, // Method
        { wch: 15 }  // Discount
    ];

    // Create Workbook
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Template Transaksi");

    // Initialize root path (parent of scripts/)
    const rootDir = path.join(__dirname, '..');
    const filePath = path.join(rootDir, 'migration_template.xlsx');

    // Write file
    xlsx.writeFile(wb, filePath);

    console.log(`✅ Template berhasil dibuat: ${filePath}`);
    console.log("Silakan buka file ini, isi dengan data Anda, lalu jalankan script import.");
};

generateTemplate();
