# Changelog

## [0.16.17] - 2026-02-22
### Changed
- Bumped version to 0.16.17

## [0.16.16] - 2026-02-21
### Changed
- Bumped version to 0.16.16

## [0.16.15] - 2026-02-21
### Changed
- Bumped version to 0.16.15

## [0.16.14] - 2026-02-21
### Changed
- Bumped version to 0.16.14

## [0.16.13] - 2026-02-21
### Changed
- Bumped version to 0.16.13

## [0.16.12] - 2026-02-20
### Changed
- Bumped version to 0.16.12

## [0.16.11] - 2026-02-20
### Changed
- Bumped version to 0.16.11

## [0.16.10] - 2026-02-17
### Changed
- Bumped version to 0.16.10

## [0.16.9] - 2026-02-17
### Changed
- Bumped version to 0.16.9

## [0.16.8] - 2026-02-16
### Changed
- Bumped version to 0.16.8

## [0.16.7] - 2026-02-16
### Changed
- Bumped version to 0.16.7

## [0.16.6] - 2026-02-15
### Changed
- Bumped version to 0.16.6

## [0.16.1] - 2026-02-15
### Changed
- Bumped version to 0.16.1

## [0.16.0] - 2026-02-12
### Changed
- Bumped version to 0.16.0

## [0.15.0] - 2026-02-10
### Changed
- Bumped version to 0.15.0

## [0.14.0] - 2026-02-09
### Changed
- Bumped version to 0.14.0

## [0.13.5] - 2026-02-08
### Changed
- Bumped version to 0.13.5

## [0.13.4] - 2026-02-08
### Added
- **POS**: Added "Quick Add Customer" button (+) in the cart panel. Allows creating new customers directly without leaving the transaction screen.

## [0.13.3] - 2026-02-08
### Improved
- **Scanner**: Enhanced Barcode Scanner integration. Fast input ending with "Enter" (typical scanner behavior) now automatically triggers "Add to Cart" and clears the search field, even if the search bar is not focused.
- **PWA**: Fixed PWA Orientation lock. The application now supports auto-rotation (Portrait/Landscape) on mobile devices.

## [0.13.2] - 2026-02-03
### Fixed
- **Receipt Discount**: Corrected logic in POS and Receipt to accurately display item-level discounts, fixing discrepancies between screen and print.
- **Lint**: Resolved various unused variable and import linting errors.

### Improved
- **Codebase**: Refactored POS transaction logic into `src/lib/transactionLogic.js` and receipt generation into `src/lib/receiptHelper.js` for better maintainability.
- **Testing**: Added comprehensive unit tests for transaction calculation and receipt HTML generation (100+ tests passing).

## [0.13.2] - 2026-02-02
### Added
- **Staff Onboarding**: Implemented secure Supabase Edge Function (`create-user`) to allow adding new staff without requiring email confirmation. Staff can now login immediately with Email or Username.
- **POS**: Added manual **Refresh Button** to POS Header (Desktop & Mobile) to reload product data without refreshing the page.

### Fixed
- **Profit Report**: Fixed "Laba" column calculation in Profit/Loss report. It was incorrectly showing Total Sales due to a case-sensitivity issue (`buy_price` vs `buyPrice`).
- **Barcode Validation**: Strengthened duplicate barcode check in Product Form to directly query the database, preventing duplicates even if the local product list wasn't fully loaded.

## [0.13.1] - 2026-01-31
### Added
- **UI Enhancements**: Added manual "Refresh" buttons to Transactions, Rental Dashboard, Products, Login History, Cash Flow, and all Report/Insight pages to allow data reloading without refreshing the browser.
- **Subscription**: Added "Subscription History" table in Settings to view past invoices and status.
- **Subscription**: Added "Rejection Reason" dialog for admins to provide feedback when rejecting payment proofs.

### Fixed
- **Transactions**: Fixed critical `ReferenceError` crash and regained standard functionality.
- **Subscription**: Fixed issue where re-uploaded payment proofs did not correctly update invoice status to "Pending" (Implemented remote `reupload_payment_proof` RPC).
- **Code Quality**: Resolved multiple linting errors across the codebase.

## [0.13.0] - 2026-01-30
### Improved
- **UI Design System**: Standardized "Stats Cards" across the entire application using a unified `InfoCard` component (Transactions, Login History, Category Sales, etc.).
- **Visual Consistency**: updated all Table and Status components to use new `Badge` variants (`success-subtle`, `warning-subtle`, etc.) for a modern, clean look.
- **Transactions Page**: Refactored transaction summary stats to match the new design system.
- **Login History**: Enhanced readability with role-based coloring (Owner, Admin, Staff) and improved mobile view.
- **Category Sales**: Optimized layout by positioning stats cards below the header for better hierarchy.

## [0.12.0] - 2026-01-30
### Added
- **Multi-Store**: Implemented Per-Owner Subscription model and global Store Branching logic.
- **Owner Dashboard**: Added comprehensive dashboard for store owners with aggregated financial summaries, daily sales charts (hourly/daily), and cross-store low stock alerts.
- **Database (RPC)**: Added `get_owner_dashboard_stats`, `get_owner_low_stock_alerts`, `get_owner_financial_summary`, and `get_owner_daily_sales` to support multi-store analytics.
- **Security**: Hardened transactions with `process_sale` stock protection and implemented staff email conflict checks to prevent account hijacking.

### Fixed
- **Registration**: Fixed critical error in `handle_new_user` trigger that blocked staff registration.
- **Permissions (RLS)**: Fixed Row Level Security policies to allow Owners to correctly view and manage their staff across all branch stores.
- **Sync**: Implemented automatic plan synchronization from owner profile to all managed stores.

## [0.11.1] - 2026-01-28
### Added
- **Subscription**: Added "Approval Langganan" page for Super Admin to review and approve PRO/Enterprise subscriptions.
- **Subscription**: Enabled Direct Checkout for Enterprise Plan (previously required WhatsApp contact).
- **Settings**: Added 1MB max file size limit for payment proof uploads to ensure performance.
- **Security**: Implemented Signed URLs for secure viewing of private payment proof files.

## [0.11.0] - 2026-01-28
### Improved
- **UI/UX Overhaul**: Successfully refactored 7 major pages (Dashboard, Products, Stores, Categories, Staff, Settings, Login) to use **shadcn/ui** components and Tailwind CSS.
- **Design**: Implemented a consistent, modern, mobile-first design system with professional card-based layouts and dark mode readiness.
- **Components**: Added reusable `dialog.jsx` and `textarea.jsx` components.
- **Codebase**: Removed legacy CSS files (`Dashboard.css`, `Products.css`, etc.) in favor of utility classes.

## [0.10.0] - 2026-01-27
### Added
- **Shopping Recommendations**: Added premium AI/Excel configuration modal with responsive padding and optimized layouts.
- **Purchase Order**: Re-enabled and refined **Restock AI** (AI Sales Analysis) suggestions UI and logic.

### Improved
- **Mobile UI**: Enhanced "Shopping Recommendations" header with wrapping buttons and full-width mobile actions.
- **Mobile UI**: Optimized Purchase Order Form for smaller screens, including responsive item cards and full-width action buttons.
- **Mobile POS**: Improved haptic feedback and interaction flow.
- **Layout**: Applied consistent `px-6` padding to configuration modals for better visual balance.

### Fixed
- **Stability**: Fixed 10+ critical lint errors and reference errors (`addToCart`, `Icon`, etc.) in `Dashboard.jsx`, `MobilePOS.jsx`, and `PurchaseOrderForm.jsx`.
- **UI Bug**: Fixed button cut-off issues on mobile across multiple screens.


## [0.9.0] - 2026-01-27
### Added
- **Wholesale Price**: Added Strategy B (Wholesale/Grosir Bertingkat). Uses threshold replacement logic (e.g. qty >= 10, price becomes Rp 8.000 for all items).
- **Rental Penalty**: Added Overtime Penalty (Denda) for Daily service products.
- **Universal Strategy**: Both Bundling and Wholesale strategies are now available for all product types (Retail & Service/Rental).

### Improved
- **Stability**: Implemented "API-First" strategy in `supabaseHelper.js` to bypass SDK connection issues.
- **Resilience**: Enhanced `robustFetch` to retry on common network errors (Failed to fetch, Timeout).
- **UI UX**: Improved `ProductForm` labels for tiered pricing (Minimal Qty & Harga Grosir).

### Fixed
- **Persistence**: Fixed `is_wholesale` field not saving in `DataContext`.
- **UI Bug**: Fixed strategy selector hidden in Edit mode due to `pricingType` mismatch.
- **Linting**: Fixed 8 critical lint errors in `RentalDashboard.jsx` and `GeneralSettings.jsx`.

## [0.8.19] - 2026-01-24
### Fixed
- **Linting**: Fixed 12 lint errors across multiple files including `DataContext.jsx`, `CategorySales.jsx`, `Dashboard.jsx`, and others.
- **Data Cleanup**: Removed unused `supabase` imports and resolved undefined `error` variables.


## [0.8.18] - 2026-01-19
### Added
- **Unit Tests**: Added comprehensive unit tests for `smartCashier.js` (13 tests) and `dataCleanup.js` (5 tests). Total tests: 87.
- **SQL Scripts**: Added `fix-profile-timeout.sql` to fix profile query timeout issues.
- **SQL Scripts**: Added `add-logo-column.sql` to add missing logo column to stores table.

### Fixed
- **RPC Functions**: Fixed `get_product_sales_report` to handle both `buyPrice` (camelCase) and `buy_price` (snake_case) in transaction items JSON.
- **Profile Query Timeout**: Fixed 25+ second profile fetch timeout caused by complex RLS policies with recursive subqueries. Replaced with simple `USING(true)` policies.
- **Sidebar**: Fixed icon alignment in collapsed state (icons were not properly centered).
- **Store Logo**: Fixed logo not persisting after upload - added `logo` field mapping in `updateStore` function in `DataContext.jsx`.
- **Store Logo**: Added `logo`, `latitude`, `longitude`, and `email` fields to store update mapping.
- **Store Settings**: Added `printerPaperSize` field mapping from database to frontend.
- **Receipt**: Fixed store logo not appearing in receipts by adding `logo` field mapping in `fetchStores`.

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
