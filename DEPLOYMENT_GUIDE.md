# 🚀 Panduan Deployment Lengkap - Multi-Store System

Dokumen ini berisi **SEMUA** SQL scripts yang perlu dijalankan untuk setup multi-store dari awal.

---

## ⚠️ PENTING: Urutan Eksekusi

Jalankan scripts di Supabase SQL Editor **sesuai urutan di bawah ini**.

---

## Fase 0: Pre-Deployment Verification (WAJIB)

Sebelum melakukan deployment, pastikan kode aman dengan menjalankan test berikut:

1.  **Cek Kualitas Kode (Lint)**:
    ```bash
    npm run lint
    ```
    *Harus bersih (0 errors).*

2.  **Cek Keamanan & Transaksi (Integration Test)**:
    ```bash
    npm test src/context/DataContext.staff.test.jsx
    npm test src/context/DataContext.transaction.test.jsx
    ```
    *Semua tes harus ✅ PASS.*

---

## Fase 1: Schema & Migrasi Dasar

### 1.1 Migrasi Plan ke Owner (Per-Owner Subscription)
**File:** `scripts/migrate-plan-to-owner.sql`
- Menambahkan kolom `plan` dan `plan_expiry_date` ke tabel `profiles`
- Migrasi data plan dari stores ke owner profiles

```
☐ Jalankan: scripts/migrate-plan-to-owner.sql
```

### 1.2 Trigger Sinkronisasi Plan
**File:** `scripts/sync-owner-plan-to-stores.sql`
- Trigger untuk auto-sync plan dari owner ke semua toko miliknya

```
☐ Jalankan: scripts/sync-owner-plan-to-stores.sql
```

---

## Fase 2: RPCs Dasar (Store Dashboard)

### 2.1 Dashboard RPC (Per-Store)
**File:** `scripts/create_dashboard_rpc.sql`
- `get_dashboard_stats` untuk dashboard per-toko

```
☐ Jalankan: scripts/create_dashboard_rpc.sql
```

### 2.2 Copy Products RPC
**File:** `scripts/simplified_copy_products.sql`
- `copy_products_to_store` untuk menyalin produk antar toko

```
☐ Jalankan: scripts/simplified_copy_products.sql
```

---

## Fase 3: Owner Dashboard RPCs

### 3.1 Owner Dashboard Stats
**File:** `scripts/create-owner-dashboard-rpc.sql`
- `get_owner_dashboard_stats` untuk statistik lintas toko

```
☐ Jalankan: scripts/create-owner-dashboard-rpc.sql
```

### 3.2 Owner Low Stock Alerts
**File:** `scripts/create-owner-low-stock-rpc.sql`
- `get_owner_low_stock_alerts` untuk notifikasi stok rendah

```
☐ Jalankan: scripts/create-owner-low-stock-rpc.sql
```

### 3.3 Financial Summary (with active_days)
**File:** `scripts/financial_summary_rpc.sql`
- `get_owner_financial_summary` untuk ringkasan keuangan bulanan

```
☐ Jalankan: scripts/financial_summary_rpc.sql
```

### 3.4 Multi-Store Daily Sales + Hourly Chart
**File:** `scripts/update_owner_rpcs_multistore.sql`
- `get_owner_daily_sales(p_start_date, p_end_date, p_period)`
- `get_owner_dashboard_stats(p_start_date, p_end_date)`
- **(TERBARU - support grafik per jam/hari)**

```
☐ Jalankan: scripts/update_owner_rpcs_multistore.sql
```

---

## Fase 4: Subscription & Approval

### 4.1 Fix Approval RPC (Per-Owner)
**File:** `scripts/fix-approval-rpc-per-owner.sql`
- `approve_subscription_invoice` yang diupdate untuk per-owner model

```
☐ Jalankan: scripts/fix-approval-rpc-per-owner.sql
```

---

## Fase 5: Process Sale & RLS

### 5.1 Harden Process Sale
**File:** `scripts/harden_process_sale.sql`
- `process_sale` dengan proteksi stok negatif

```
☐ Jalankan: scripts/harden_process_sale.sql
```

### 5.2 Fix Process Sale RLS (Opsional)
**File:** `scripts/fix_process_sale_rls.sql`
- Perbaikan Row Level Security jika ada masalah akses

```
☐ Jalankan jika diperlukan: scripts/fix_process_sale_rls.sql
```

---

## Fase 6: Staff & Security Fixes (CRITICAL)

### 6.1 Fix Staff List Visibility (RLS)
**File:** `scripts/fix_profiles_rls.sql`
- Memperbaiki RLS agar Owner bisa melihat list staff.

```
☐ Jalankan: scripts/fix_profiles_rls.sql
```

### 6.2 Fix Staff Registration (Database Error)
**File:** `scripts/fix_registration_trigger.sql`
- Memperbaiki trigger `handle_new_user` yang error 500 saat add staff.

```
☐ Jalankan: scripts/fix_registration_trigger.sql
```

### 6.3 Prevent Staff Hijacking (Security)
**File:** `scripts/create_check_conflict_rpc.sql`
- Mencegah akun staff diambil alih oleh toko lain.

```
☐ Jalankan: scripts/create_check_conflict_rpc.sql
```

---

## Checklist Final

```
☐ migrate-plan-to-owner.sql
☐ sync-owner-plan-to-stores.sql
☐ create_dashboard_rpc.sql
☐ simplified_copy_products.sql
☐ create-owner-dashboard-rpc.sql
☐ create-owner-low-stock-rpc.sql
☐ financial_summary_rpc.sql
☐ update_owner_rpcs_multistore.sql ⭐ (WAJIB - fitur terbaru)
☐ fix-approval-rpc-per-owner.sql
☐ harden_process_sale.sql
☐ fix_profiles_rls.sql (New)
☐ fix_registration_trigger.sql (New)
☐ create_check_conflict_rpc.sql (New)
☐ npm run build
☐ Deploy ke hosting
```

---

## Tips

1. **Jika sudah pernah deploy sebagian:** Hanya jalankan script yang belum pernah dieksekusi.
2. **CREATE OR REPLACE:** Sebagian besar script menggunakan ini, jadi aman untuk dijalankan ulang.
3. **ALTER TABLE ADD ... IF NOT EXISTS:** Juga aman untuk dijalankan ulang.

---

## Verifikasi Setelah Deploy

1. ✅ Login sebagai Owner
2. ✅ Buka Owner Dashboard
3. ✅ Pilih "Hari Ini" → Grafik per jam muncul
4. ✅ Pilih "7 Hari" → Grafik per hari muncul
5. ✅ Cek kopas produk antar toko berfungsi
6. ✅ Cek approval subscription berfungsi
7. ✅ Coba add staff dengan email yang sudah ada (harus diblokir "Email sudah terdaftar")
