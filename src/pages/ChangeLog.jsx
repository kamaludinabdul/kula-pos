import React from 'react';
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { GitCommit, Tag, Calendar } from 'lucide-react';
import { APP_VERSION } from '../version';

// This data would ideally come from a database or a markdown file
// For now, we'll maintain it here as a structured constant
const CHANGELOG_DATA = [
    {
        version: "0.16.1",
        date: "2026-02-16",
        type: "patch",
        title: "Stock Filtering & Bug Fixes",
        changes: [
            "Stock Management: Added Category Filter — kini bisa filter produk berdasarkan kategori di halaman stok.",
            "Login History: Fixed empty history — menampilkan log login meskipun data store belum ter-load (null store_id).",
            "Cash Flow: Fixed deletion bug — transaksi dari POS kini bisa dihapus dengan benar dari database.",
            "Stability: Removed debug logs and fixed linting issues."
        ]
    },
    {
        version: "0.15.0",
        date: "2026-02-10",
        type: "minor",
        title: "Dashboard Data Fix & Smart Date Picker",
        changes: [
            "Dashboard: Replaced dropdown date filter with SmartDatePicker — pilih tanggal bebas dengan shortcuts (Hari Ini, Kemarin, 7/30 Hari, Bulan Ini).",
            "Dashboard: Fixed all empty stats cards — Total Penjualan, Rata-rata Order, Produk Terlaris, Transaksi Terakhir kini tampil dengan benar.",
            "Dashboard: Added Penjualan per Kategori chart — query baru kalkulasi sales per kategori dari item transaksi.",
            "Database: Fixed duplicate RPC function signatures yang menyebabkan HTTP 300 'Multiple Choices' error.",
            "Database: Fixed NanoID product ID compatibility — menggunakan TEXT comparison alih-alih UUID cast di query kategori.",
            "Database: Relaxed transaction status filter — kini include NULL, 'completed', 'success', dan 'paid'.",
            "Security: Rebuilt semua RLS policies dan RPC functions dengan SECURITY DEFINER yang benar.",
            "Stability: Fixed get_my_store_id() dan get_store_initial_snapshot() untuk memastikan data selalu accessible."
        ]
    },
    {
        version: "0.14.0",
        date: "2026-02-08",
        type: "minor",
        title: "Version Management & Dashboard Charts Fix",
        changes: [
            "Version: Centralized version management ke src/version.js — semua komponen baca dari satu sumber.",
            "Dashboard Charts: Fixed monthly charts kosong — menggunakan RPC get_dashboard_monthly_summary dengan SECURITY DEFINER untuk bypass RLS.",
            "Cash Flow: Fixed tanggal Rekap Penjualan yang rusak akibat fitur 'Perbaiki Tanggal' — script repair untuk restore tanggal dari deskripsi.",
            "POS: Fixed process_sale RPC error — standardisasi camelCase parameter antara frontend dan database."
        ]
    },
    {
        version: "0.13.5",
        date: "2026-02-06",
        type: "patch",
        title: "POS Quick Add Customer & Release Tooling",
        changes: [
            "POS: Quick Add Customer — tambah pelanggan baru langsung dari halaman kasir tanpa berpindah menu.",
            "Tooling: Standardized release script (scripts/release.cjs) untuk otomasi version bump.",
            "Discount: Fixed item-level discount persistence — diskon kini tersimpan dan tampil di receipt, laporan, dan cash flow."
        ]
    },
    {
        version: "0.13.3",
        date: "2026-02-03",
        type: "patch",
        title: "Scanner Auto-Add & PWA Orientation",
        changes: [
            "Scanner: Auto-add product ke cart setelah scan barcode — tidak perlu klik manual lagi.",
            "PWA: Fixed orientation issue — landscape mode kini bekerja dengan benar di tablet.",
            "Receipt: Breakdown item discounts secara eksplisit di struk thermal.",
            "Unit Tests: Added integration tests untuk proses transaksi (processSale)."
        ]
    },
    {
        version: "0.13.2",
        date: "2026-02-02",
        type: "patch",
        title: "Staff Onboarding & Critical Fixes",
        changes: [
            "Staff Onboarding: Added secure Edge Function to bypass email confirmation, allowing immediate staff login.",
            "POS: Added manual Refresh Button to reload product data instantly.",
            "Profit Report: Fixed 'Laba' column calculation (snake_case mismatch resolution).",
            "Stability: Enhanced duplicate barcode validation with direct database checks."
        ]
    },
    {
        version: "0.13.1",
        date: "2026-01-31",
        type: "patch",
        title: "Refresh Controls & Stability Fixes",
        changes: [
            "UI Enhancements: Added manual 'Refresh' buttons to Transactions, Rental, Products, and Report pages.",
            "Subscription: Added 'Subscription History' and 'Rejection Reason' features.",
            "Stability: Fixed critical Transaction page crash and re-upload logic for payment proofs.",
            "Code Quality: Resolved linting errors across the codebase."
        ]
    },
    {
        version: "0.13.0",
        date: "2026-01-30",
        type: "minor",
        title: "Standardized UI & Visual Consistency",
        changes: [
            "Experience: Standardized 'Stats Cards' across the entire application using a unified design.",
            "Visuals: Updated all Table and Status components with modern subtle badges.",
            "Transactions: Refactored transaction summary stats.",
            "Login History: Enhanced readability with role-based coloring (Owner, Admin, Staff).",
            "Reports: Optimized stats layout in Category Sales report."
        ]
    },
    {
        version: "0.12.0",
        date: "2026-01-30",
        type: "minor",
        title: "Multi-Store Architecture & Security Hardening",
        changes: [
            "Multi-Store: Implemented Per-Owner Subscription model and global Store Branching logic.",
            "Owner Dashboard: Added comprehensive dashboard for store owners with aggregated financial summaries, daily sales charts, and low stock alerts.",
            "Security: Hardened transactions with process_sale stock protection.",
            "Security: Implemented staff email conflict checks to prevent account hijacking.",
            "Sync: Automatic plan synchronization from owner profile to all managed stores."
        ]
    },
    {
        version: "0.11.1",
        date: "2026-01-28",
        type: "patch",
        title: "Subscription Approval Workflow",
        changes: [
            "Subscription: Added 'Approval Langganan' page for Super Admin to review and approve PRO/Enterprise subscriptions.",
            "Subscription: Enabled Direct Checkout for Enterprise Plan.",
            "Security: Implemented Signed URLs for secure viewing of private payment proof files."
        ]
    },
    {
        version: "0.11.0",
        date: "2026-01-28",
        type: "minor",
        title: "UI/UX Overhaul with shadcn/ui",
        changes: [
            "UI/UX Overhaul: Refactored 7 major pages to use modern shadcn/ui components.",
            "Design: Implemented a consistent, modern, mobile-first design system.",
            "Codebase: Large-scale cleanup of legacy CSS files in favor of Tailwind CSS."
        ]
    },
    {
        version: "0.10.0",
        date: "2026-01-27",
        type: "minor",
        title: "Mobile UI Premium Optimization & AI Refinement",
        changes: [
            "POS: Overhauled POS Header for ultra-responsive mobile experience.",
            "POS: Implemented 'Focus-Switch' logic for better small-screen usability.",
            "Purchase Order: Refined 'Restock AI' calculations and UI.",
            "Stability: Fixed multiple critical reference errors across Dashboard and PO Form."
        ]
    },
    {
        version: "0.9.0",
        date: "2026-01-27",
        type: "feature",
        title: "Wholesale Strategy & Advanced Resilience",
        changes: [
            "Wholesale: Added 'Wholesale/Grosir Bertingkat' (Strategy B) with threshold-based pricing.",
            "Rental: Added Overtime Penalty (Denda) for Daily service products.",
            "Universal Strategy: Bundling and Wholesale strategies now support all product types.",
            "Persistence: Implemented 'API-First' strategy in supabaseHelper.js to bypass SDK connection issues.",
            "Resilience: Enhanced robustFetch with intelligent retries for network stability."
        ]
    },
    {
        version: "0.8.20",
        date: "2026-01-24",
        type: "minor",
        title: "Rental Dashboard & F&B Menu UX Improvements",
        changes: [
            "Rental: Replaced browser 'confirm' with custom confirmation popup for unit deletion.",
            "Rental: Fixed z-index layering and focus trap issues in management dialogs.",
            "Rental: Added automatic UI refresh after unit addition/deletion.",
            "F&B Menu: Implemented server-side search in ProductSelectorDialog to bypass pagination limits.",
            "F&B Menu: Auto-load default items on dialog open for immediate browsing.",
            "F&B Menu: Optimized loading states to reduce UI flickering.",
            "Stability: Fixed 500 parse errors and build syntax issues in RentalDashboard.jsx.",
            "Cleanup: Resolved linting errors (unused vars, missing dependencies) across critical files."
        ]
    },
    {
        version: "0.8.14",
        date: "2026-01-08",
        type: "feature",
        title: "Super Admin Plan & Features Management",
        changes: [
            "Management: Dedicated page for Super Admin to manage subscription plan details.",
            "Dynamic Features: Configure feature access (Reports, Staff, Settings, Advanced) per plan level.",
            "Dynamic Pricing: Update monthly and 'original' prices directly from the UI.",
            "Firestore Sync: All plan and feature configurations are stored in system settings and applied globally.",
            "Sidebar & Routing: Dynamic access checks for menu items and routes based on current store plan settings."
        ]
    },
    {
        version: "0.8.13",
        date: "2026-01-08",
        type: "patch",
        title: "Unlimited Stock & Rental Discount",
        changes: [
            "Unlimited Stock: Fixed display across POS, Products, Stock Management, and LowStockAlert.",
            "POS: Unlimited stock products now show '∞' badge (blue) and are clickable.",
            "Products: Unlimited stock shows 'Unlimited' status with distinct blue color.",
            "Stock Management: Sorting now correctly handles unlimited stock products.",
            "Rental: Added discount feature at checkout (percent or fixed amount).",
            "Rental: Discount is now saved to transaction and displayed on receipt.",
            "Reports: Verified discount integration across P&L, Transactions, and Cash Flow."
        ]
    },
    {
        version: "0.8.12",
        date: "2026-01-08",
        type: "patch",
        title: "Fix Rental Mode Visibility",
        changes: [
            "Fixed 'Rental' menu appearing in sidebar even when disabled in settings.",
            "Ensured proper Store Setting check for all top-level menu items."
        ]
    },
    {
        version: "0.8.11",
        date: "2026-01-08",
        type: "patch",
        title: "Rental Turnover & UI Fixes",
        changes: [
            "Turnover: Fixed reporting to include rental transactions with missing/legacy statuses.",
            "Rental: Added 'completed' status to new rental transactions for better tracking.",
            "UI: Improved Rental Card layout to prevent 'Total Tagihan' truncation.",
            "UI: Added visual distinction between Members (Indigo) and Guests (Gray) in Rental Cards.",
            "Code: General linting fixes and performance improvements."
        ]
    },
    {
        version: "0.8.7",
        date: "2026-01-05",
        type: "patch",
        title: "Report Accuracy & Void Transaction Fixes",
        changes: [
            "Fixed Shift Closing: Total Penjualan, Tunai Diterima, and Payment Method breakdown now correctly exclude voided/refunded transactions.",
            "Fixed Category Sales Report: Now excludes voided/refunded transactions from calculations.",
            "Fixed Top Selling Products Report: Now excludes voided/refunded transactions from rankings.",
            "Fixed Sales Forecast: Predictions now exclude voided/refunded transactions for more accurate forecasting.",
            "Fixed Product Page Access: Restored access for admins with missing 'products.manage' permission."
        ]
    },
    {
        version: "0.7.0",
        date: "2025-12-24",
        type: "minor",
        title: "Purchase Order, Stock Opname & Notifications",
        changes: [
            "Purchase Order: Added Bidirectional Unit Conversion (e.g., Box <-> Pcs) and Smart Supplier Price History.",
            "Stock Opname: Full stock reconciliation feature with difference analysis (Unit & Value) and history.",
            "Telegram Integration: Real-time notifications for Shift (Open/Close), Transactions, and Low Stock alerts.",
            "Performance: Optimized product image compression (reduced size by ~40%) and cleaned up unused code."
        ]
    },
    {
        version: "0.6.0",
        date: "2025-12-20",
        type: "minor",
        title: "Real-time Data, Alerts & Professional Reporting",
        changes: [
            "Dashboard: 'New Customers' metric now calculates real data based on the selected date range.",
            "POS: Added Proactive Low Stock Alert (Stock <= Min Stock) when adding items to cart.",
            "Reports: Enhanced 'Profit & Loss' and 'Transactions' with professional PDF export (jspdf-autotable).",
            "Performance: Implemented Route-based Code Splitting (React.lazy) for faster initial load.",
            "Stability: Fixed multiple lint errors and removed unused legacy variables."
        ]
    },
    {
        version: "0.5.0",
        date: "2025-12-20",
        type: "minor",
        title: "Daily Book Closing & Summary Cards",
        changes: [
            "Transactions: Added 'Tutup Buku Harian' to aggregate daily sales into Cash Flow.",
            "Transactions: Added Real-time Summary Cards (Sales, COGS, Gross Profit).",
            "UI: Replaced browser alerts with custom AlertDialog components."
        ]
    },
    {
        version: "0.4.3",
        date: "2025-12-12",
        type: "patch",
        title: "Thermal Printer & ID Enhancements",
        changes: [
            "Fixed receipt printing: Logo now prints correctly on thermal receipts.",
            "Optimized receipt layout: Reduced top and bottom margins for paper saving.",
            "Visual Sync: Synced thermal print content with screen preview (Discounts, Service Charge, Points).",
            "Improved Transaction IDs: Switched to Numeric Timestamp format (e.g., #251212...) for better readability and searchability.",
            "Fixed Printing Bugs: Resolved 'undefined slice' crash and '#000000' ID issue on receipts.",
            "Enhanced Transaction History: 'Cetak' button now auto-connects to Bluetooth printer if disconnected.",
            "Stability: Fixed '500 Internal Server Error' and 'ReferenceError' crashes."
        ]
    },
    {
        version: "0.4.0",
        date: "2025-12-06",
        type: "minor",
        title: "Loyalty Points Enhancement",
        changes: [
            "Added Manual Point Adjustment: Admin can manually add or deduct customer loyalty points with mandatory reason for audit trail.",
            "Added Point Adjustment History: View complete history of all point adjustments with date, type, amount, reason, and performer details.",
            "Added Point Expiry Settings: Set expiry date for automatic point reset with last reset date tracking.",
            "Added Lifetime Points Tracking: Separate columns for 'Total Poin Sepanjang Masa' (cumulative from transactions) and 'Poin Saat Ini' (current balance after adjustments).",
            "Enhanced Leaderboard: Added 'Sesuaikan' button for point adjustment and 'History' button to view adjustment logs per customer.",
            "Improved Backward Compatibility: Handles both old 'points' and new 'loyaltyPoints' fields for existing customers.",
            "Added Firestore Index: Composite index for efficient point adjustment history queries.",
            "Fixed UI Refresh: Leaderboard now updates immediately after point adjustments.",
            "Added Audit Trail: All point adjustments are logged with immutable records for compliance and tracking."
        ]
    },
    {
        version: "0.3.1",
        date: "2025-12-03",
        type: "minor",
        title: "Transaction & Shift Management Enhancements",
        changes: [
            "Added dedicated Transactions page with filtering and void functionality.",
            "Enhanced POS Shift Management: Added Open/Close Shift buttons, shift summary, and admin terminate capability.",
            "Implemented Debt Payment: Customers can now pay off debts directly from their transaction history.",
            "Improved Transaction Saving: Fixed issues with service items and stock validation.",
            "Added Category Sorting: Products table now supports sorting by category.",
            "Updated Firestore Rules: Optimized permissions for smoother transaction and shift operations.",
            "Fixed Bulk Import: Resolved issues with category handling during product import."
        ]
    },
    {
        version: "0.3.0",
        date: "2025-12-01",
        type: "major",
        title: "Major Security & Import Update",
        changes: [
            "Migrated Authentication System: Fully integrated with Firebase Authentication for enhanced security.",
            "Refined Security Rules: Comprehensive Firestore rules for all collections (Users, Stores, Products, etc.).",
            "Added Excel Import Support: Import products using .xlsx files with auto-mapping.",
            "Added Template Download: Downloadable Excel template for product import.",
            "Fixed Permission Errors: Resolved 'Missing or insufficient permissions' across various modules.",
            "Updated WhatsApp Integration: Direct WhatsApp link for plan upgrades."
        ]
    },
    {
        version: "0.2.9",
        date: "2025-12-01",
        type: "patch",
        title: "Bug Fixes & Cleanup",
        changes: [
            "Fixed initialization errors in Shift Report and Stock Opname.",
            "Removed unused Rentals feature to reduce bundle size.",
            "Added pending checkout state for discount PIN authorization.",
            "Fixed date parsing error in Sales Forecast.",
            "General code cleanup and conflict resolution."
        ]
    },
    {
        version: "0.2.8",
        date: "2025-12-01",
        type: "patch",
        title: "Deployment & Cache Fixes",
        changes: [
            "Bumped version to ensure fresh deployment.",
            "Verified PWA auto-update configuration.",
            "Minor UI adjustments."
        ]
    },
    {
        version: "0.2.7",
        date: "2025-11-30",
        type: "patch",
        title: "Stability & Feature Control Updates",
        changes: [
            "Fixed Super Admin login crash by handling missing store context safely.",
            "Implemented conditional visibility for 'Sales' menu based on store settings.",
            "Optimized Telegram Settings page to prevent unnecessary re-renders.",
            "Code cleanup and linting fixes for better stability."
        ]
    },
    {
        version: "0.2.2",
        date: "2025-11-30",
        type: "patch",
        title: "Performance Optimization & Security Enhancements",
        changes: [
            "Enhanced Profit & Loss Report: Added transaction status column and ability to cancel transactions directly from the report.",
            "Added 'CANCELLED' watermark to receipts for voided transactions.",
            "Added Cancel Transaction feature: Admins can now void transactions with mandatory reason input.",
            "Implemented automatic stock reversal for cancelled transactions.",
            "Optimized Database Usage: Implemented Optimistic UI updates to significantly reduce Firestore reads and prevent quota limits.",
            "Enhanced Security: Migrated from PIN to Password system for stronger account security.",
            "Improved UX: Added Show/Hide Password toggle on Login and Staff Management forms.",
            "Refined Stock Management: Added comprehensive sorting, sticky columns, and fixed image sizing.",
            "Fixed various bugs in pagination and data fetching logic."
        ]
    },
    {
        version: "0.2.1",
        date: "2025-11-30",
        type: "minor",
        title: "FIFO Inventory System & POS Refinements",
        changes: [
            "Implemented FIFO (First-In-First-Out) inventory system for accurate COGS calculation",
            "Added Batch Tracking for all stock movements (Manual Add, Bulk Import, Stock Management)",
            "Refined POS Product Grid: Fixed card heights, 4:3 image ratio, and consistent category chips",
            "Enhanced Stock Management: Added sorting, search by barcode/code, and history view",
            "Improved Product Form: Disabled stock editing (must use Stock Management) and added informative notes",
            "Fixed various bugs in product filtering and stock reduction logic",
            "Added PWA Support: Installable on devices and basic Offline Mode",
            "Enabled Firestore Offline Persistence for reliable offline transactions",
            "Enhanced Shift Management: Petty Cash (In/Out), Payment Method Breakdown, and Detailed Shift Report",
            "Added Detailed Shift View: View list of transactions and cash movements per shift",
            "Enhanced Shift Closing: Input for Non-Cash verification and detailed Telegram report (Expenses & Deposits)",
            "Added Expense Report: View and export detailed expense reports by date range",
            "Added Top Selling Products Report: View best-selling products with ranking and revenue analysis",
            "Added Customer Transaction History: View complete purchase history per customer",
            "Added Low Stock Alert: Automatic alerts on Dashboard for products running low or out of stock",
            "Added PDF Export: Export reports to PDF format (Expense, Top Selling Products, and more)",
            "Added Stock Opname: Physical stock counting with system comparison and automatic adjustment",
            "Added Login History Tracking: Track all login/logout activities with detailed logs",
            "Added User Status Indicator: Real-time online/offline status for staff members",
            "Enhanced Stock Opname: Added history/report view, value difference in Rupiah, and quick adjustment actions",
            "Fixed Login History: Simplified query to avoid Firestore composite index requirement"
        ]
    },
    {
        version: "0.2.0",
        date: "2025-11-29",
        type: "minor",
        title: "Subscription Plans & Multi-Device Support",
        changes: [
            "Introduced Subscription Plans (Free, Pro, Enterprise)",
            "Added Subscription Settings page for plan management",
            "Implemented strict limits for Users and Products based on plan",
            "Updated Store Management for Super Admin to manage plans",
            "Enabled network access for multi-device testing (host: true)",
            "Fixed Registration functionality and AuthContext bugs"
        ]
    },
    {
        version: "0.1.0",
        date: "2025-11-28",
        type: "minor", // major, minor, patch
        title: "Tablet & POS Optimization Update",
        changes: [
            "Added camera barcode scanner integration for tablet devices",
            "Implemented collapsible sidebar for both Dashboard and POS Cart",
            "Optimized POS layout for tablet screens (responsive cart width)",
            "Refined product card design (16:9 aspect ratio, compact text)",
            "Improved Dashboard responsiveness and font sizing for tablets",
            "Added version display in sidebar footer"
        ]
    },
    {
        version: "0.0.5",
        date: "2025-11-27",
        type: "patch",
        title: "UI Refactoring & Modernization",
        changes: [
            "Migrated POS page to Tailwind CSS and Shadcn UI",
            "Refactored POS components (Header, Grid, Cart) into separate files",
            "Implemented modern glassmorphism design language",
            "Fixed layout issues in product grid rendering"
        ]
    },
    {
        version: "0.0.1",
        date: "2025-11-20",
        type: "major",
        title: "Initial Release",
        changes: [
            "Initial project setup with React and Vite",
            "Basic POS functionality (Add to cart, Checkout)",
            "Dashboard with basic statistics",
            "Product and Category management"
        ]
    }
];

const ChangeLog = () => {
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Changelog</h1>
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
                                <CardContent className="p-6">
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
