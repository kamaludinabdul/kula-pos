# Changelog

## [0.8.17] - 2026-01-08
### Added
- **Purchase Order**: Added "Duplicate PO" (Duplikat) button. Clones items and notes to a new draft, resetting the supplier.
- **Purchase Order**: Added "PDF Without Price" (PDF Tanpa Harga) option in a dropdown menu. Allows hiding price columns/totals for supplier copies.

## [0.8.16] - 2026-01-08
### Added
- **Purchase Order**: Added "Berat (Kg)" column to the item table. Displays calculated weight per item `(Qty * Weight) / 1000`.
- **Purchase Order**: Items with 0 Kg weight are highlighted in red for easy detection.
- **Purchase Order**: The Tonnage column is visible in the UI but hidden in Print/PDF mode.

## [0.8.15] - 2026-01-08
### Added
- **Subscription**: Enabled Custom Package Plans. Limits (products, users) are now dynamically enforced based on Firestore settings.
- **Stores**: Added "Duration" selection (1-12 Months) for standard plans.
- **Stores**: Added Auto-Downgrade logic. Stores with expired plans are automatically reverted to Free plan.
- **Purchase Order**: Added "Total Tonnage" (Total Berat) display calculated from item weight (Grams -> Kg/Ton).
- **Settings**: Added "Rental Mode" toggle in Plan Management.
- **Sidebar**: "Rental" menu now correctly appears based on Plan Feature availability + Role Permission.

### Fixed
- **Settings**: Fixed "Rental" menu visibility issue where it was hidden even if enabled in plan.
- **Lint**: Fixed unused variables in `SubscriptionSettings.jsx`.
- **Tests**: Added unit tests for Purchase Order Tonnage calculation.

## [0.8.10] - 2026-01-06
### Added
- **Products**: Barcode Label Printing feature with support for multiple label sizes (Thermal 58mm, 80mm, and standard label sizes).
- **Products**: Bulk select products and print barcode labels with customizable quantity per product.

### Fixed
- **POS**: Fixed shift closing not recording sales for backdated transactions. Changed query from date filter to shiftId filter.

## [0.8.9] - 2026-01-06
### Fixed
- **POS**: Fixed backdate transaction not being saved correctly - `DataContext.processSale` was overriding the date field.
- **POS**: Fixed backdate time showing 00:00:00 - now preserves current time when selecting a past date.
- **POS**: Fixed Firestore permission error for `store_settings` collection.
- **Transactions**: Fixed inconsistent status badge color - all "Berhasil" transactions now show green badge.

## [0.8.8] - 2026-01-06
### Added
- **POS**: Backdate Transaction feature for Admin/Super Admin. When enabled, admin users can create transactions with past dates for data migration or corrections.
- **Settings**: Added "Izinkan Backdate Transaksi" toggle in General Settings to enable/disable backdate feature.
- **Transaction**: Added `createdAt` field to track actual transaction creation time vs. transaction date.

## [0.8.6] - 2026-01-03
### Added
- **Products**: Added "Satuan PO" column in Product Table to display Purchase Unit (e.g., Sak, Dus).
- **Products**: Added "Satuan PO" filter grouped with Category filter for easier navigation.
- **Validation**: Added validation in Product Form to ensure "Isi per Satuan Beli" (Conversion) is filled if "Satuan Beli" is present.

### Fixed
- **Linting**: Fixed various lint errors in `GeneralSettings.jsx`, `ProfitLoss.jsx`, `ProductGrid.jsx`, and `dataCleanup.js`.
- **Layout**: Fixed layout issues with filter grouping in Products page.
- **Tests**: Verified all unit tests pass.

## [0.8.4] - 2025-12-29
### Fixed
- **Dashboard**: Fixed "Produk Terlaris" not updating `sold` count logic. Future transactions will now correctly increment this counter.
- **Dashboard**: Simplified "Produk Terlaris" card to remove confusing "Selamanya" tab. The list now strictly respects the global Date Filter (use "Semua Waktu" for All Time stats).

## [0.8.3] - 2025-12-29
### Fixed
- **Reports**: Fixed "Produk Terlaris" showing 0 values by supporting legacy data fields (`quantity` vs `qty`).

## [0.8.2] - 2025-12-29
### Fixed
- **Printer**: Further reduced logo size to 33% (128 dots) to resolve "Big Logo" issue in Production.

## [0.8.1] - 2025-12-29
### Added
- **Printer**: Added Auto-Connect feature. The POS will now confirm connection to the previously paired Bluetooth printer automatically on load.
- **Promotions**: Added "Berlaku Kelipatan" (Allow Multiples) toggle. Bundle and Fixed discounts can now be applied multiple times in a single transaction.
- **Store Branding**: Added Store Name and Logo to POS Header.
- **Printer**: Resized thermal receipt logo to 50% width for better fit.

### Fixed
- **POS**: Fixed dynamic discount calculation. Discount amounts now update automatically when cart quantities change.
- **Sidebar**: Fixed "Illegal constructor" crash by fixing `Lock` icon import.
- **Performance**: Fixed "400 Bad Request" error in Promo fetch logic.
- **Promo Form**: Fixed Layout issues (Grid structure).
- **Settings**: Fixed Image Compressor to support PNG transparency.

## [0.8.0] - 2025-12-29
### Added
- **Smart Strategy (AI Insights)**:
    - **Market Basket Analysis**: Menemukan pola bundling produk yang sering dibeli bersamaan.
    - **Sales Forecasting**: Prediksi omset 7 hari kedepan menggunakan analisis tren.
    - **Customer Segmentation (RFM)**: Mengelompokkan pelanggan menjadi Champions, Loyal, At Risk, dll.
- **Improved Sidebar**: Added "Smart Strategy" menu item.
- **Access Control**: Added `smart_insights` permission toggle in Settings.

## [0.7.5] - 2025-12-28
### Fixed
- **Receive Stock**: 
    - Fixed "Harga PO" display to use PO Unit Price (e.g. per Sak) instead of Base Unit Price.
    - Added "Total Harga" column in Receive Dialog.
    - Fixed `useEffect` crash in Receive Dialog.

## [0.7.4] - 2025-12-28
### Fixed
- **Purchase Order**: Perbaikan logika perhitungan Subtotal. Sekarang Subtotal dihitung berdasarkan `Harga Satuan (Base) x Total Pcs (Qty Base)`, bukan Qty PO. Ini memastikan perhitungan harga akurat saat menggunakan satuan konversi (misal: Sak).

## [0.7.3] - 2025-12-28
### Added
- **Purchase Order**:
    - "Saran Restock AI" feature based on Sales Velocity.
    - Added "Hitung Ulang Statistik Produk" in General Settings.
    - Sortable Columns in PO Table (QTY PO, QTY PCS, Price, Subtotal).
### Fixed
- **Dashboard**: Fixed "Periode Ini" vs "Selamanya" revenue calculation.
- **Data**: Robust transaction list parsing.
- **PO Form**: Fixed numeric sorting for quantity/price columns.

## [0.7.2] - 2025-12-28
### Fixed
- **Dashboard**: Fixed "Top Selling Products" chart connection to real data.
- **Context**: Fixed looping re-renders in DataContext stats calculation.

## [0.7.1] - 2025-12-25
### Added
- **PWA**: Added Installable PWA support with manifest and service worker.
- **Dashboard**: Added "Top Selling Products" pie chart (Mock Data).

## [0.7.0] - 2025-12-24
### Added
- **Receipt**: Added Browser Native Print support as fallback.
- **Settings**: Added "Printer Settings" (Bluetooth/Browser).

### Fixed
- **Receipt**: Fixed Total Item calculation tax.
- **Pagination**: Fixed pagination syncing in Transactions page.
