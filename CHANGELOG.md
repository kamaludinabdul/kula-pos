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
