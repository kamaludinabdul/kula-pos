## [0.26.8] - 2026-03-27
### Changed
- Bumped version to 0.26.8

## [0.26.8] - 2026-03-28
### Fixed
- **Laporan Shift (Crash Fix)**: Memperbaiki `TypeError: Cannot read properties of null (reading 'toLocaleString')` yang terjadi saat membuka halaman Laporan Shift dengan shift yang masih aktif. Pengecekan sebelumnya menggunakan `!== undefined`, sehingga nilai `null` dari database (Uang Akhir belum tersedia di shift aktif) tidak tertangkap dan menyebabkan crash. Sekarang menggunakan `!= null` yang lebih ketat.
- **Layout Card Info Penjualan**: Mengembalikan tata letak grid Info Cards di halaman Penjualan ke format 4-kolom (`xl:grid-cols-4`) yang mencegah teks terpotong di layar lebar. Menambahkan `data-testid="summary-cards-container"` pada container grid untuk memudahkan testing.
- **Default Tanggal Halaman Penjualan**: Mengembalikan default tanggal halaman Penjualan ke "Hari Ini" (sesuai aslinya), sementara halaman-halaman Laporan lainnya tetap default ke "Bulan Ini" untuk konsistensi.

### Added
- **Unit Tests — Regression Guard (8 file baru, +40 test cases)**:
  - `ShiftReport.test.jsx`: Guard eksplisit agar crash `null.toLocaleString()` pada shift aktif tidak pernah lolos ke production lagi.
  - `Products.test.jsx`: Smoke test untuk halaman Produk (heading, search, filter, tabel, pagination).
  - `ProfitLoss.test.jsx`: Smoke test halaman Laba Rugi (heading, date picker, filter, tabel).
  - `CashFlow.test.jsx`: Smoke test halaman Arus Kas (heading, InfoCards, date picker, filter, tombol Tambah).
  - `Customers.test.jsx`: Smoke test + validasi filter pencarian pelanggan (by name & phone number).
  - `Dashboard.test.jsx`: Smoke test halaman Dashboard (crash check, date picker, charts).
  - `OwnerDashboard.test.jsx`: Smoke test halaman Dashboard Owner (heading, filter toko, crash check).
  - `SmartDatePicker.test.jsx`: Validasi konversi format tanggal `{from, to}` ↔ `{startDate, endDate}`, memastikan `from` = 00:00:00 dan `to` = 23:59:59.
- **Layout Regression Guard**: Test case `[LAYOUT REGRESSION GUARD]` ditambahkan ke `Transactions.test.jsx` — secara otomatis gagal jika grid Info Cards berubah dari `xl:grid-cols-4` ke nilai lain, mencegah regresi layout terulang.

## [0.26.7] - 2026-03-27
### Fixed
- **Sinkronisasi Fee Pet Hotel**: Memperbaiki bug di mana fee karyawan lama (yang menggunakan batas maksimal 3 shift) tidak terhapus saat melakukan sinkronisasi ulang. Proses rilis ini kini secara otomatis menghapus rekaman biaya sistem dan menghitungnya kembali menggunakan batas 2 shift per daftar masuk per hari.
- **Ringkasan Laporan Transaksi**: Merestrukturisasi pengambilan data statistik "Card" total untuk menggunakan query pada tingkat klien dan bebas batas dibandingkan metode RPC sebelumnya. Hal ini memastikan "Total Penjualan", "Pendapatan Barang/"Jasa", dll dapat memfilter angka *real-time* dari tipe stok, metode pembayaran, status, dan rentang tanggal untuk histori pembelian di atas batas default Supabase (1000 baris).
- Mengupdate tata letak Antarmuka Filter Transaksi agar lebih nyaman digunakan.
## [0.26.6] - 2026-03-27
### Changed
- Bumped version to 0.26.6

## [0.26.6] - 2026-03-27
### Fixed
- **POS Rental Dialog**: Label dan preset durasi sewa kini dinamis berdasarkan `product.unit` (Menit/Jam/Hari), tidak lagi hardcoded "Jam".
- **POS Keranjang**: Nama item rental di keranjang dan struk kini menampilkan unit asli (contoh: "PS 3 (30 Menit)"), bukan selalu "(X Jam)".
- **POS Stok Unlimited**: Memperbaiki validasi stok yang memblokir item `isUnlimited` (contoh: PS 3) dengan pesan "Stok Habis" palsu.
- **Laporan Transaksi**: Pendapatan Jasa/Sewa kini dihitung secara case-insensitive (`jasa`, `Jasa`, `sewa` semuanya masuk "Pendapatan Jasa").
- **Laporan Defecta**: Item bertipe Jasa/Sewa tidak lagi muncul di peringatan stok menipis.
- **Laporan Laba Rugi (RPC)**: Query SQL `get_profit_loss_report` dipatch agar revenue split Jasa/Sewa case-insensitive. Debug fields dihapus untuk production.

### Changed
- **Fee Pet Hotel**: Pembagian fee harian dipatenkan maksimal 2 shift (0.5 + 0.5). Shift ke-3 dan seterusnya tidak dihitung untuk menghindari pembulatan pecahan.

### Added
- **Production SQL Script**: `scripts/production_deploy_2026-03-27.sql` siap dijalankan di Supabase SQL Editor.

## [0.26.5] - 2026-03-26
### Added
- **AI Smart Insight**: Laporan tutup shift Telegram kini lebih pintar dengan perbandingan data historis (kemarin, minggu lalu, bulan lalu) dan analisis kondisi cuaca lokal untuk evaluasi performa yang lebih akurat.
- Bumped version to 0.26.5

## [0.26.4] - 2026-03-26
### Fixed
- **Shift Report**: Memperbaiki masalah perhitungan ganda (*double-counting*) pada total penjualan, tunai, dan non-tunai di tabel shift. Sistem kini menimpa nilai agregat dengan data riil dari tabel transaksi saat penutupan shift untuk akurasi 100%.
- **Inventory Reporting**: Mengecualikan item jasa/unlimited (stok 999999) dari laporan Nilai Stok/Aset Modal untuk mencegah penggelembungan nilai modal yang tidak akurat.
- **UI/UX**: Memindahkan posisi tombol melayang (*Bug Report FAB*) agar tidak menutupi navigasi halaman (pagination) di bagian bawah layar.

### Added
- **Pet Hotel Automation**: Integrasi otomatisasi pembuatan komisi (*Fee*) Pet Hotel langsung saat checkout transaksi rental di POS.

## [0.26.3] - 2026-03-25
### Changed
- Bumped version to 0.26.3
...
