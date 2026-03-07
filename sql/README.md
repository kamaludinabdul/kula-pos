# Kula POS - SQL Governance

Folder ini berisi master source code untuk semua SQL Functions (RPC) yang ada di Supabase.

### 🛡 SINGLE SOURCE OF TRUTH

Mulai sekarang, **JANGAN** mengedit function langsung di SQL Editor Supabase tanpa mengupdate file di sini.
Setiap kali ada update, edit file `.sql` yang sesuai di folder ini, lalu copy-paste isinya ke Supabase.

### 📁 Struktur Folder

- `sql/functions/`: Berisi satu file `.sql` per function.
- `sql/deploy_all_functions.sql`: Script gabungan untuk mendeploy semua function sekaligus.

### 🚀 Cara Update / Deploy Baru

1. Edit file function di `sql/functions/[nama_function].sql`.
2. Jalankan isi file tersebut di SQL Editor Supabase.
3. Jika ada penambahan function baru, tambahkan filenya di sini dan update `deploy_all_functions.sql`.

### 📝 Daftar Function Utama

- `process_sale.sql`: Logika inti transaksi (Stok, Loyalty, Piutang).
- `get_profit_loss_report.sql`: Laporan Laba Rugi (termasuk fix QRIS summary).
- `get_dashboard_stats.sql`: Data dashboard toko.
- `get_owner_dashboard_stats.sql`: Data dashboard multi-toko (Owner).
- `get_products_page.sql`: Pagination produk server-side.

---
**PENTING**: Selalu gunakan `SECURITY DEFINER` untuk function yang dipanggil dari frontend (RPC) agar tidak terbentur RLS.
