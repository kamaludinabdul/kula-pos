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
