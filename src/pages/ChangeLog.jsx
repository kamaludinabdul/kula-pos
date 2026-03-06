import React from 'react';
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { GitCommit, Tag, Calendar } from 'lucide-react';
import { APP_VERSION } from '../version';

// This data would ideally come from a database or a markdown file
// For now, we'll maintain it here as a structured constant
const CHANGELOG_DATA = [
    {
        "version": "0.19.5",
        "date": "2026-03-06",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.19.5"
        ]
    },
    {
        "version": "0.19.5",
        "date": "2026-03-07",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Expiry Management**:",
            "**Testing**: Added comprehensive unit test suite for `utils`, `AI`, `permissions`, and `planLimits`.",
            "**Dashboard Optimization**:",
            "**Formatting**: Standardized `formatCompactNumber` to use Indonesian decimal separators (`,`) and suffixes (`rb`, `jt`).",
            "**Finance**: Updated `get_profit_loss_report` and `get_owner_financial_summary` RPCs to support dual profit metrics and timezone-aware calculations."
        ]
    },
    {
        "version": "0.19.4",
        "date": "2026-03-06",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**POS**: Fixed a bug where searching for a non-existent product resulted in a blank screen. The \"Empty State\" message is now correctly displayed."
        ]
    },
    {
        "version": "0.19.3",
        "date": "2026-03-05",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.19.3"
        ]
    },
    {
        "version": "0.19.2",
        "date": "2026-03-05",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.19.2"
        ]
    },
    {
        "version": "0.19.1",
        "date": "2026-03-04",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.19.1"
        ]
    },
    {
        "version": "0.19.1",
        "date": "2026-03-05",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**UI Standardization**: Standardized component padding to a consistent `p-4` layout across multiple heavily-used pages including Dashboard, Purchase Orders, Settings, Transactions, and Reports.",
            "**Typography Consistency**: Uniformly adjusted major page titles to `text-2xl` for a cleaner, unified header hierarchy.",
            "**Code Stability**: Fixed HTML tag mismatches (e.g. invalid nested headings inside text spans) in the Product Form.",
            "Bumped version to 0.19.1"
        ]
    },
    {
        "version": "0.19.0",
        "date": "2026-03-03",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "**Loyalty Enhancement (Major)**: Implementasi penuh sistem poin dan kartu stamp digital.",
            "**Manajemen Staf**: Sistem penjadwalan Pet Hotel hybrid (Pola Mingguan + Override Harian), memungkinkan pengaturan shift fleksibel per tanggal tanpa merusak template mingguan.",
            "**Stok Opname**: Sinkronisasi otomatis dengan data FIFO (Batches). Stok fisik sekarang selalu selaras dengan jumlah total di tabel batches.",
            "**UI/UX Stability**: Fix bug browser freeze di halaman POS akibat konflik dialog penagihan.",
            "**Peningkatan UX**: Penambahan tombol \"Selesai\" pada editor shift harian untuk merapikan tampilan setelah proses edit.",
            "Bumped version to 0.19.0"
        ]
    },
    {
        "version": "0.18.10",
        "date": "2026-02-28",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Smart Strategy**: Introduced a dual-mode algorithm for \"Rekomendasi Belanja\" (Shopping Recommendations). Manual budget input now aggressively maximizes spending to optimize transport layout, while the AI budget maintains a conservative 14-day stock approach.",
            "**Finance**: Fixed a critical timezone casting bug (`::DATE`) in the Profit & Loss RPC (`get_profit_loss_report`) that caused phantom operational expenses from previous days to bleed into the current month's report.",
            "Bumped version to 0.18.10"
        ]
    },
    {
        "version": "0.18.9",
        "date": "2026-02-27",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Finance**: Replaced native `window.confirm` with custom `ConfirmDialog` in Cash Flow for better stability and UI consistency.",
            "**UI**: Fixed calendar icon alignment in date and time inputs by removing `flex` display for those input types.",
            "**Stability**: Standardized pagination reset logic across Stock Management, Transactions, Customers, and Purchase Orders to ensure the current page resets to 1 upon search or filter changes.",
            "Bumped version to 0.18.9"
        ]
    },
    {
        "version": "0.18.8",
        "date": "2026-02-27",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**UI Standardization**: Unified component rounding to `rounded-[10px]` (10px) across the entire application.",
            "**Design System**: Integrated rounding defaults into core `Button`, `Input`, and `Select` components for better maintainability.",
            "**Search Precision**: Implemented standardized search styling with `pl-10` padding and precisely centered icons (`left-3.5`).",
            "**Alignment**: Right-aligned `SmartDatePicker` in Shift and Expense reports for improved layout balance.",
            "**Cleanup**: Removed redundant `rounded-full` and explicit styling overrides from Transactions, Products, Customers, Suppliers, and Report pages.",
            "Bumped version to 0.18.8"
        ]
    },
    {
        "version": "0.18.7",
        "date": "2026-02-27",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Margin Priority**: Scoring now gives a boost to products with higher profit margins.",
            "**Urgency Badges**: Visual indicators for items that are 'Kritis' (<3 days) or 'Menipis' (<7 days).",
            "**Supplier Filter**: Users can now filter recommendations to specific suppliers based on purchase history."
        ]
    },
    {
        "version": "0.18.6",
        "date": "2026-02-26",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Algorithm Improvement**: Excluded dead stock (no sales in 90 days) from shopping recommendations.",
            "**Stock Sufficiency**: Products with stock lasting >14 days are no longer recommended for restock.",
            "**Restock AI**: Refined 'Below Min Stock' logic to prioritize items with active sales history.",
            "Bumped version to 0.18.6"
        ]
    },
    {
        "version": "0.18.5",
        "date": "2026-02-26",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**AI Recommendation**: Fixed empty shopping list bug by explicitly fetching product data on page load.",
            "**Dashboard**: Corrected chart labels from 'Laba Bersih' to 'Laba Kotor' (Gross Profit) to reflect actual data.",
            "**Purchase Order**: Fixed 'ReferenceError: DropdownMenu is not defined' due to missing imports.",
            "**Stability**: Performed global audit and fixed missing product data fetching in Dashboard, Market Basket Analysis, and Profit & Loss pages.",
            "Bumped version to 0.18.5"
        ]
    },
    {
        "version": "0.18.4",
        "date": "2026-02-26",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.18.4"
        ]
    },
    {
        "version": "0.18.4",
        "date": "2026-02-26",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Telegram**: Added Customer Name to the transaction receipt template for better clarity.",
            "**Telegram**: Included AI-generated shift analysis summaries in the shift closing notification messages.",
            "**Stability**: Fixed a double-submission bug when opening or closing shifts that caused duplicate Telegram alerts.",
            "**Smart Restock**: Resolved a mathematical error (`Infinity` budget) that occurred when the product recommendation list was empty.",
            "Bumped version to 0.18.4"
        ]
    },
    {
        "version": "0.18.3",
        "date": "2026-02-26",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Loyalty**: Fixed \"stuck\" history by bypassing transaction cache and fetching directly from Supabase for selected date ranges.",
            "**Loyalty**: Improved point history display to include spendings (redemptions) and void reversals.",
            "**Loyalty**: Enhanced transaction mapping in `DataContext` to support legacy point data formats.",
            "**UI**: Added refresh button and loading indicators to Loyalty Points Report.",
            "**Stability**: Fixed loyalty points reversal in `void_transaction` RPC to ensure total lifetime points are correctly adjusted.",
            "Bumped version to 0.18.3"
        ]
    },
    {
        "version": "0.18.2",
        "date": "2026-02-26",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Rental Dashboard**: Refined Note Save UI by moving the 'Save' button below the input field for better accessibility.",
            "**Stability**: Fixed 'Too many re-renders' infinite loop in Rental Session Details Dialog by consistent null-check logic.",
            "**Rental**: Added 'Catatan' (Notes) support for capturing extra info like Down Payments (DP) during sessions.",
            "**Store Management**: Fixed Pet Hotel toggle persistence by correcting database columns and frontend mapping.",
            "**Stability**: Resolved 400 errors during auto-downgrade by switching from upsert to update logic.",
            "**UI Polish**: Fixed Select dropdown text alignment and moved checkmark indicators to the right for better visual balance.",
            "Bumped version to 0.18.2"
        ]
    },
    {
        "version": "0.18.1",
        "date": "2026-02-26",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Rental**: Added 'Catatan' (Notes) support for capturing extra info like Down Payments (DP) during sessions.",
            "**Rental Dashboard**: Added ability to edit notes/DP for active rental sessions directly from the details dialog.",
            "**Rental Dashboard**: Synchronized search and filter UI styling with Transactions and Products pages for a unified design.",
            "**Store Management**: Fixed Pet Hotel toggle persistence by correcting database columns and frontend mapping.",
            "**Stability**: Resolved 400 errors during auto-downgrade by switching from upsert to update logic.",
            "**UI Polish**: Fixed Select dropdown text alignment and moved checkmark indicators to the right for better visual balance.",
            "**Products**: Fixed a bug where 'Stock Type' and 'Pricing Model' dropdowns would show incorrect values in Edit Mode.",
            "Bumped version to 0.18.1"
        ]
    },
    {
        "version": "0.17.0",
        "date": "2026-02-24",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "Bumped version to 0.17.0"
        ]
    },
    {
        "version": "0.16.18",
        "date": "2026-02-22",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.18"
        ]
    },
    {
        "version": "0.16.17",
        "date": "2026-02-22",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.17"
        ]
    },
    {
        "version": "0.16.16",
        "date": "2026-02-21",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.16"
        ]
    },
    {
        "version": "0.16.15",
        "date": "2026-02-21",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.15"
        ]
    },
    {
        "version": "0.16.14",
        "date": "2026-02-21",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.14"
        ]
    },
    {
        "version": "0.16.13",
        "date": "2026-02-21",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.13"
        ]
    },
    {
        "version": "0.16.12",
        "date": "2026-02-20",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.12"
        ]
    },
    {
        "version": "0.16.11",
        "date": "2026-02-20",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.11"
        ]
    },
    {
        "version": "0.16.10",
        "date": "2026-02-17",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.10"
        ]
    },
    {
        "version": "0.16.9",
        "date": "2026-02-17",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.9"
        ]
    },
    {
        "version": "0.16.8",
        "date": "2026-02-16",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.8"
        ]
    },
    {
        "version": "0.16.7",
        "date": "2026-02-16",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.7"
        ]
    },
    {
        "version": "0.16.6",
        "date": "2026-02-15",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.6"
        ]
    },
    {
        "version": "0.16.1",
        "date": "2026-02-15",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.16.1"
        ]
    },
    {
        "version": "0.16.0",
        "date": "2026-02-12",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "Bumped version to 0.16.0"
        ]
    },
    {
        "version": "0.15.0",
        "date": "2026-02-10",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "Bumped version to 0.15.0"
        ]
    },
    {
        "version": "0.14.0",
        "date": "2026-02-09",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "Bumped version to 0.14.0"
        ]
    },
    {
        "version": "0.13.5",
        "date": "2026-02-08",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.13.5"
        ]
    },
    {
        "version": "0.13.4",
        "date": "2026-02-08",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**POS**: Added \"Quick Add Customer\" button (+) in the cart panel. Allows creating new customers directly without leaving the transaction screen."
        ]
    },
    {
        "version": "0.13.3",
        "date": "2026-02-08",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Scanner**: Enhanced Barcode Scanner integration. Fast input ending with \"Enter\" (typical scanner behavior) now automatically triggers \"Add to Cart\" and clears the search field, even if the search bar is not focused.",
            "**PWA**: Fixed PWA Orientation lock. The application now supports auto-rotation (Portrait/Landscape) on mobile devices."
        ]
    },
    {
        "version": "0.13.2",
        "date": "2026-02-03",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Receipt Discount**: Corrected logic in POS and Receipt to accurately display item-level discounts, fixing discrepancies between screen and print.",
            "**Lint**: Resolved various unused variable and import linting errors.",
            "**Codebase**: Refactored POS transaction logic into `src/lib/transactionLogic.js` and receipt generation into `src/lib/receiptHelper.js` for better maintainability.",
            "**Testing**: Added comprehensive unit tests for transaction calculation and receipt HTML generation (100+ tests passing)."
        ]
    },
    {
        "version": "0.13.2",
        "date": "2026-02-02",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Staff Onboarding**: Implemented secure Supabase Edge Function (`create-user`) to allow adding new staff without requiring email confirmation. Staff can now login immediately with Email or Username.",
            "**POS**: Added manual **Refresh Button** to POS Header (Desktop & Mobile) to reload product data without refreshing the page.",
            "**Profit Report**: Fixed \"Laba\" column calculation in Profit/Loss report. It was incorrectly showing Total Sales due to a case-sensitivity issue (`buy_price` vs `buyPrice`).",
            "**Barcode Validation**: Strengthened duplicate barcode check in Product Form to directly query the database, preventing duplicates even if the local product list wasn't fully loaded."
        ]
    },
    {
        "version": "0.13.1",
        "date": "2026-01-31",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**UI Enhancements**: Added manual \"Refresh\" buttons to Transactions, Rental Dashboard, Products, Login History, Cash Flow, and all Report/Insight pages to allow data reloading without refreshing the browser.",
            "**Subscription**: Added \"Subscription History\" table in Settings to view past invoices and status.",
            "**Subscription**: Added \"Rejection Reason\" dialog for admins to provide feedback when rejecting payment proofs.",
            "**Transactions**: Fixed critical `ReferenceError` crash and regained standard functionality.",
            "**Subscription**: Fixed issue where re-uploaded payment proofs did not correctly update invoice status to \"Pending\" (Implemented remote `reupload_payment_proof` RPC).",
            "**Code Quality**: Resolved multiple linting errors across the codebase."
        ]
    },
    {
        "version": "0.13.0",
        "date": "2026-01-30",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "**UI Design System**: Standardized \"Stats Cards\" across the entire application using a unified `InfoCard` component (Transactions, Login History, Category Sales, etc.).",
            "**Visual Consistency**: updated all Table and Status components to use new `Badge` variants (`success-subtle`, `warning-subtle`, etc.) for a modern, clean look.",
            "**Transactions Page**: Refactored transaction summary stats to match the new design system.",
            "**Login History**: Enhanced readability with role-based coloring (Owner, Admin, Staff) and improved mobile view.",
            "**Category Sales**: Optimized layout by positioning stats cards below the header for better hierarchy."
        ]
    },
    {
        "version": "0.12.0",
        "date": "2026-01-30",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "**Multi-Store**: Implemented Per-Owner Subscription model and global Store Branching logic.",
            "**Owner Dashboard**: Added comprehensive dashboard for store owners with aggregated financial summaries, daily sales charts (hourly/daily), and cross-store low stock alerts.",
            "**Database (RPC)**: Added `get_owner_dashboard_stats`, `get_owner_low_stock_alerts`, `get_owner_financial_summary`, and `get_owner_daily_sales` to support multi-store analytics.",
            "**Security**: Hardened transactions with `process_sale` stock protection and implemented staff email conflict checks to prevent account hijacking.",
            "**Registration**: Fixed critical error in `handle_new_user` trigger that blocked staff registration.",
            "**Permissions (RLS)**: Fixed Row Level Security policies to allow Owners to correctly view and manage their staff across all branch stores.",
            "**Sync**: Implemented automatic plan synchronization from owner profile to all managed stores."
        ]
    },
    {
        "version": "0.11.1",
        "date": "2026-01-28",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Subscription**: Added \"Approval Langganan\" page for Super Admin to review and approve PRO/Enterprise subscriptions.",
            "**Subscription**: Enabled Direct Checkout for Enterprise Plan (previously required WhatsApp contact).",
            "**Settings**: Added 1MB max file size limit for payment proof uploads to ensure performance.",
            "**Security**: Implemented Signed URLs for secure viewing of private payment proof files."
        ]
    },
    {
        "version": "0.11.0",
        "date": "2026-01-28",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "**UI/UX Overhaul**: Successfully refactored 7 major pages (Dashboard, Products, Stores, Categories, Staff, Settings, Login) to use **shadcn/ui** components and Tailwind CSS.",
            "**Design**: Implemented a consistent, modern, mobile-first design system with professional card-based layouts and dark mode readiness.",
            "**Components**: Added reusable `dialog.jsx` and `textarea.jsx` components.",
            "**Codebase**: Removed legacy CSS files (`Dashboard.css`, `Products.css`, etc.) in favor of utility classes."
        ]
    },
    {
        "version": "0.10.0",
        "date": "2026-01-27",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "**Shopping Recommendations**: Added premium AI/Excel configuration modal with responsive padding and optimized layouts.",
            "**Purchase Order**: Re-enabled and refined **Restock AI** (AI Sales Analysis) suggestions UI and logic.",
            "**Mobile UI**: Enhanced \"Shopping Recommendations\" header with wrapping buttons and full-width mobile actions.",
            "**Mobile UI**: Optimized Purchase Order Form for smaller screens, including responsive item cards and full-width action buttons.",
            "**Mobile POS**: Improved haptic feedback and interaction flow.",
            "**Layout**: Applied consistent `px-6` padding to configuration modals for better visual balance.",
            "**Stability**: Fixed 10+ critical lint errors and reference errors (`addToCart`, `Icon`, etc.) in `Dashboard.jsx`, `MobilePOS.jsx`, and `PurchaseOrderForm.jsx`.",
            "**UI Bug**: Fixed button cut-off issues on mobile across multiple screens."
        ]
    },
    {
        "version": "0.9.0",
        "date": "2026-01-27",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "**Wholesale Price**: Added Strategy B (Wholesale/Grosir Bertingkat). Uses threshold replacement logic (e.g. qty >= 10, price becomes Rp 8.000 for all items).",
            "**Rental Penalty**: Added Overtime Penalty (Denda) for Daily service products.",
            "**Universal Strategy**: Both Bundling and Wholesale strategies are now available for all product types (Retail & Service/Rental).",
            "**Stability**: Implemented \"API-First\" strategy in `supabaseHelper.js` to bypass SDK connection issues.",
            "**Resilience**: Enhanced `robustFetch` to retry on common network errors (Failed to fetch, Timeout).",
            "**UI UX**: Improved `ProductForm` labels for tiered pricing (Minimal Qty & Harga Grosir).",
            "**Persistence**: Fixed `is_wholesale` field not saving in `DataContext`.",
            "**UI Bug**: Fixed strategy selector hidden in Edit mode due to `pricingType` mismatch.",
            "**Linting**: Fixed 8 critical lint errors in `RentalDashboard.jsx` and `GeneralSettings.jsx`."
        ]
    },
    {
        "version": "0.8.19",
        "date": "2026-01-24",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Linting**: Fixed 12 lint errors across multiple files including `DataContext.jsx`, `CategorySales.jsx`, `Dashboard.jsx`, and others.",
            "**Data Cleanup**: Removed unused `supabase` imports and resolved undefined `error` variables."
        ]
    },
    {
        "version": "0.8.18",
        "date": "2026-01-19",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Unit Tests**: Added comprehensive unit tests for `smartCashier.js` (13 tests) and `dataCleanup.js` (5 tests). Total tests: 87.",
            "**SQL Scripts**: Added `fix-profile-timeout.sql` to fix profile query timeout issues.",
            "**SQL Scripts**: Added `add-logo-column.sql` to add missing logo column to stores table.",
            "**RPC Functions**: Fixed `get_product_sales_report` to handle both `buyPrice` (camelCase) and `buy_price` (snake_case) in transaction items JSON.",
            "**Profile Query Timeout**: Fixed 25+ second profile fetch timeout caused by complex RLS policies with recursive subqueries. Replaced with simple `USING(true)` policies.",
            "**Sidebar**: Fixed icon alignment in collapsed state (icons were not properly centered).",
            "**Store Logo**: Fixed logo not persisting after upload - added `logo` field mapping in `updateStore` function in `DataContext.jsx`.",
            "**Store Logo**: Added `logo`, `latitude`, `longitude`, and `email` fields to store update mapping.",
            "**Store Settings**: Added `printerPaperSize` field mapping from database to frontend.",
            "**Receipt**: Fixed store logo not appearing in receipts by adding `logo` field mapping in `fetchStores`."
        ]
    },
    {
        "version": "0.8.17",
        "date": "2026-01-08",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Purchase Order**: Added \"Duplicate PO\" (Duplikat) button. Clones items and notes to a new draft, resetting the supplier.",
            "**Purchase Order**: Added \"PDF Without Price\" (PDF Tanpa Harga) option in a dropdown menu. Allows hiding price columns/totals for supplier copies."
        ]
    },
    {
        "version": "0.8.16",
        "date": "2026-01-08",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Purchase Order**: Added \"Berat (Kg)\" column to the item table. Displays calculated weight per item `(Qty * Weight) / 1000`.",
            "**Purchase Order**: Items with 0 Kg weight are highlighted in red for easy detection.",
            "**Purchase Order**: The Tonnage column is visible in the UI but hidden in Print/PDF mode."
        ]
    },
    {
        "version": "0.8.15",
        "date": "2026-01-08",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Subscription**: Enabled Custom Package Plans. Limits (products, users) are now dynamically enforced based on Firestore settings.",
            "**Stores**: Added \"Duration\" selection (1-12 Months) for standard plans.",
            "**Stores**: Added Auto-Downgrade logic. Stores with expired plans are automatically reverted to Free plan.",
            "**Purchase Order**: Added \"Total Tonnage\" (Total Berat) display calculated from item weight (Grams -> Kg/Ton).",
            "**Settings**: Added \"Rental Mode\" toggle in Plan Management.",
            "**Sidebar**: \"Rental\" menu now correctly appears based on Plan Feature availability + Role Permission.",
            "**Settings**: Fixed \"Rental\" menu visibility issue where it was hidden even if enabled in plan.",
            "**Lint**: Fixed unused variables in `SubscriptionSettings.jsx`.",
            "**Tests**: Added unit tests for Purchase Order Tonnage calculation."
        ]
    },
    {
        "version": "0.8.10",
        "date": "2026-01-06",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Products**: Barcode Label Printing feature with support for multiple label sizes (Thermal 58mm, 80mm, and standard label sizes).",
            "**Products**: Bulk select products and print barcode labels with customizable quantity per product.",
            "**POS**: Fixed shift closing not recording sales for backdated transactions. Changed query from date filter to shiftId filter."
        ]
    },
    {
        "version": "0.8.9",
        "date": "2026-01-06",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**POS**: Fixed backdate transaction not being saved correctly - `DataContext.processSale` was overriding the date field.",
            "**POS**: Fixed backdate time showing 00:00:00 - now preserves current time when selecting a past date.",
            "**POS**: Fixed Firestore permission error for `store_settings` collection.",
            "**Transactions**: Fixed inconsistent status badge color - all \"Berhasil\" transactions now show green badge."
        ]
    },
    {
        "version": "0.8.8",
        "date": "2026-01-06",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**POS**: Backdate Transaction feature for Admin/Super Admin. When enabled, admin users can create transactions with past dates for data migration or corrections.",
            "**Settings**: Added \"Izinkan Backdate Transaksi\" toggle in General Settings to enable/disable backdate feature.",
            "**Transaction**: Added `createdAt` field to track actual transaction creation time vs. transaction date."
        ]
    },
    {
        "version": "0.8.6",
        "date": "2026-01-03",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Products**: Added \"Satuan PO\" column in Product Table to display Purchase Unit (e.g., Sak, Dus).",
            "**Products**: Added \"Satuan PO\" filter grouped with Category filter for easier navigation.",
            "**Validation**: Added validation in Product Form to ensure \"Isi per Satuan Beli\" (Conversion) is filled if \"Satuan Beli\" is present.",
            "**Linting**: Fixed various lint errors in `GeneralSettings.jsx`, `ProfitLoss.jsx`, `ProductGrid.jsx`, and `dataCleanup.js`.",
            "**Layout**: Fixed layout issues with filter grouping in Products page.",
            "**Tests**: Verified all unit tests pass."
        ]
    },
    {
        "version": "0.8.4",
        "date": "2025-12-29",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Dashboard**: Fixed \"Produk Terlaris\" not updating `sold` count logic. Future transactions will now correctly increment this counter.",
            "**Dashboard**: Simplified \"Produk Terlaris\" card to remove confusing \"Selamanya\" tab. The list now strictly respects the global Date Filter (use \"Semua Waktu\" for All Time stats)."
        ]
    },
    {
        "version": "0.8.3",
        "date": "2025-12-29",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Reports**: Fixed \"Produk Terlaris\" showing 0 values by supporting legacy data fields (`quantity` vs `qty`)."
        ]
    },
    {
        "version": "0.8.2",
        "date": "2025-12-29",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Printer**: Further reduced logo size to 33% (128 dots) to resolve \"Big Logo\" issue in Production."
        ]
    },
    {
        "version": "0.8.1",
        "date": "2025-12-29",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Printer**: Added Auto-Connect feature. The POS will now confirm connection to the previously paired Bluetooth printer automatically on load.",
            "**Promotions**: Added \"Berlaku Kelipatan\" (Allow Multiples) toggle. Bundle and Fixed discounts can now be applied multiple times in a single transaction.",
            "**Store Branding**: Added Store Name and Logo to POS Header.",
            "**Printer**: Resized thermal receipt logo to 50% width for better fit.",
            "**POS**: Fixed dynamic discount calculation. Discount amounts now update automatically when cart quantities change.",
            "**Sidebar**: Fixed \"Illegal constructor\" crash by fixing `Lock` icon import.",
            "**Performance**: Fixed \"400 Bad Request\" error in Promo fetch logic.",
            "**Promo Form**: Fixed Layout issues (Grid structure).",
            "**Settings**: Fixed Image Compressor to support PNG transparency."
        ]
    },
    {
        "version": "0.8.0",
        "date": "2025-12-29",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "**Smart Strategy (AI Insights)**:",
            "**Improved Sidebar**: Added \"Smart Strategy\" menu item.",
            "**Access Control**: Added `smart_insights` permission toggle in Settings."
        ]
    },
    {
        "version": "0.7.5",
        "date": "2025-12-28",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Receive Stock**:"
        ]
    },
    {
        "version": "0.7.4",
        "date": "2025-12-28",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Purchase Order**: Perbaikan logika perhitungan Subtotal. Sekarang Subtotal dihitung berdasarkan `Harga Satuan (Base) x Total Pcs (Qty Base)`, bukan Qty PO. Ini memastikan perhitungan harga akurat saat menggunakan satuan konversi (misal: Sak)."
        ]
    },
    {
        "version": "0.7.3",
        "date": "2025-12-28",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Purchase Order**:",
            "**Dashboard**: Fixed \"Periode Ini\" vs \"Selamanya\" revenue calculation.",
            "**Data**: Robust transaction list parsing.",
            "**PO Form**: Fixed numeric sorting for quantity/price columns."
        ]
    },
    {
        "version": "0.7.2",
        "date": "2025-12-28",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Dashboard**: Fixed \"Top Selling Products\" chart connection to real data.",
            "**Context**: Fixed looping re-renders in DataContext stats calculation."
        ]
    },
    {
        "version": "0.7.1",
        "date": "2025-12-25",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**PWA**: Added Installable PWA support with manifest and service worker.",
            "**Dashboard**: Added \"Top Selling Products\" pie chart (Mock Data)."
        ]
    },
    {
        "version": "0.7.0",
        "date": "2025-12-24",
        "type": "minor",
        "title": "Feature Release",
        "changes": [
            "**Receipt**: Added Browser Native Print support as fallback.",
            "**Settings**: Added \"Printer Settings\" (Bluetooth/Browser).",
            "**Receipt**: Fixed Total Item calculation tax.",
            "**Pagination**: Fixed pagination syncing in Transactions page."
        ]
    }
];

const ChangeLog = () => {
    return (
        <div className="p-4 max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Changelog</h1>
                <p className="text-muted-foreground">
                    Riwayat pembaruan dan perubahan sistem KULA.
                    Versi saat ini: <span className="font-semibold text-foreground">v{APP_VERSION}</span>
                </p>
            </div>

            <div className="relative border-l border-slate-200 ml-3 space-y-12">
                {CHANGELOG_DATA.map((log, index) => (
                    <div key={index} className="relative pl-8">
                        {/* Timeline Dot */}
                        <div className={`absolute - left - [5px] top - 2 h - 2.5 w - 2.5 rounded - full border border - white ring - 4 ring - white ${log.type === 'major' ? 'bg-indigo-600' :
                            log.type === 'minor' ? 'bg-blue-500' : 'bg-slate-400'
                            } `} />

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <div className="flex items-center gap-2">
                                    <Badge variant={log.type === 'major' ? 'default' : 'secondary'} className={
                                        log.type === 'major' ? 'bg-indigo-600 hover:bg-indigo-700' :
                                            log.type === 'minor' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                                'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }>
                                        v{log.version}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Calendar size={14} />
                                        {new Date(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                                <h2 className="text-lg font-semibold text-slate-900">{log.title}</h2>
                            </div>

                            <Card>
                                <CardContent className="p-4">
                                    <ul className="space-y-3">
                                        {log.changes.map((change, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                                                <GitCommit size={16} className="mt-0.5 text-slate-400 shrink-0" />
                                                <span className="leading-relaxed">{change}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChangeLog;
