# 🍽️ Modul FnB — Spesifikasi Lengkap

> **Tujuan:** Dokumentasi blueprint fitur-fitur khusus F&B agar bisa langsung di-recall saat implementasi dimulai.  
> **Status:** Brainstorm / Pre-Implementation  
> **Tanggal:** 2026-03-09

---

## Prinsip Arsitektur

1. **Ikuti pola Pet Shop:** Toggle di `stores` → halaman baru → permission entry → sidebar conditional.
2. **Core POS tidak diubah secara struktural** — FnB menambah layer di atasnya.
3. **Semua fitur FnB bersifat opt-in** via toggle, tidak mempengaruhi toko non-FnB.

---

## Feature Map

```
┌─────────────────────────────────────────────┐
│              CORE (Sudah Ada)               │
│  POS · Inventory · Finance · Customers      │
│  Reports · Staff · Loyalty · Promotions     │
└───────────────────┬─────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌──────────┐
   │ Add-on  │ │  Table   │ │ Kitchen  │
   │ System  │ │  Mgmt    │ │ Display  │
   └─────────┘ └─────────┘ └──────────┘
    PRIORITY 1   PRIORITY 2   PRIORITY 3
```

---

## Fitur 1: Add-on / Modifier System ⭐⭐⭐

### Kenapa Prioritas 1?

Ini mengubah cara item di-record di transaksi. Harus dibangun pertama karena Table Management dan KDS bergantung padanya.

### Konsep

Produk FnB bisa punya **Modifier Group** yang masing-masing berisi **Modifier Options**:

```
Produk: Es Kopi Susu (Rp 25.000)
  ├── Group: Ukuran (Wajib, pilih 1)
  │     ├── Regular (+0)
  │     └── Large (+5.000)
  ├── Group: Gula (Wajib, pilih 1)
  │     ├── Normal
  │     ├── Less Sugar
  │     └── No Sugar
  └── Group: Topping (Opsional, pilih banyak)
        ├── Boba (+5.000)
        ├── Jelly (+3.000)
        └── Cream Cheese (+7.000)
```

### Schema Database

```sql
-- Modifier groups attached to products
CREATE TABLE modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  name TEXT NOT NULL,              -- "Ukuran", "Topping"
  is_required BOOLEAN DEFAULT false,
  max_selections INTEGER DEFAULT 1, -- 1 = single select, 0 = unlimited
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual modifier options
CREATE TABLE modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,              -- "Large", "Boba"
  price_adjustment NUMERIC DEFAULT 0, -- +5000, +0
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Link products to modifier groups (many-to-many)
CREATE TABLE product_modifier_groups (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  group_id UUID REFERENCES modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, group_id)
);
```

### Dampak ke POS

Saat item ditambahkan ke keranjang, struktur `cart item` berubah:

```javascript
// Sebelum (non-FnB):
{ productId, name, price, qty }

// Sesudah (FnB):
{ 
  productId, name, basePrice, qty,
  modifiers: [
    { groupName: "Ukuran", optionName: "Large", priceAdjustment: 5000 },
    { groupName: "Topping", optionName: "Boba", priceAdjustment: 5000 },
  ],
  totalPrice: 35000  // basePrice + sum(adjustments)
}
```

### Dampak ke `transactions.items` (JSONB)

Modifier disimpan di dalam array items yang sudah ada — **tidak perlu tabel baru** untuk transaksi.

### UI Baru

- **ProductForm.jsx**: Tab/section baru "Modifier Groups" untuk attach groups ke produk.
- **POS.jsx**: Modal popup saat add item yang punya modifier → pilih opsi → confirm.
- **Receipt**: Print modifier di bawah nama item.

---

## Fitur 2: Table / Meja Management ⭐⭐⭐

### Konsep

Resto buka meja → customer order → bisa tambah order → tutup meja → bayar.

### Schema Database

```sql
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  name TEXT NOT NULL,         -- "Meja 1", "Outdoor A"
  capacity INTEGER DEFAULT 4,
  zone TEXT,                  -- "Indoor", "Outdoor", "VIP"
  status TEXT DEFAULT 'available', -- available, occupied, reserved, cleaning
  current_order_id UUID,      -- FK to active order (nullable)
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE table_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  table_id UUID REFERENCES tables(id),
  status TEXT DEFAULT 'open', -- open, closed, cancelled
  items JSONB DEFAULT '[]',   -- Same format as transaction items + modifiers
  subtotal NUMERIC DEFAULT 0,
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  transaction_id UUID         -- Links to transaction when paid
);
```

### Alur

```
Pilih Meja → Open Order → Tambah Item (dari POS) → 
  ↕ (bisa tambah/edit item berkali-kali)
Close Order → Masuk ke POS sebagai transaksi → Bayar → Meja available
```

### UI Baru

- **`/fnb/tables`**: Grid meja (card view) dengan status warna-warni.
- **Table Order View**: Mirip POS tapi untuk 1 meja, bisa running/open bill.

### Settings

Disimpan di `stores.settings.fnb`:

```json
{
  "fnb": {
    "enableTableManagement": true,
    "defaultTableCount": 10,
    "zones": ["Indoor", "Outdoor", "VIP"],
    "autoCloseOnPay": true
  }
}
```

---

## Fitur 3: Kitchen Display System (KDS) ⭐⭐

### Konsep

Layar di dapur yang menampilkan order masuk secara real-time → staff dapur klik "Selesai" per item.

### Implementasi

- **Halaman baru**: `/fnb/kitchen` — tampilan full-screen, optimized for tablet.
- **Realtime**: Menggunakan Supabase Realtime subscription pada `table_orders`.
- **Status per item**: `pending → preparing → done`

### UI

```
┌──────────────────────────────────────────────┐
│  🔥 Kitchen Display          [Meja 3] 2 mnt │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Meja 1   │ │ Meja 3   │ │ Meja 7   │     │
│  │ ──────── │ │ ──────── │ │ ──────── │     │
│  │ Nasi Grg │ │ Es Kopi  │ │ Mie Ayam │     │
│  │ [DONE ✓] │ │ [START]  │ │ [START]  │     │
│  │ Teh Manis│ │ Roti Bkr │ │          │     │
│  │ [START]  │ │ [START]  │ │          │     │
│  └──────────┘ └──────────┘ └──────────┘     │
└──────────────────────────────────────────────┘
```

---

## Fitur 4: Fitur Ringan (Effort Kecil)

| Fitur | Implementasi | Effort |
|---|---|---|
| **Dine-in / Take-away flag** | Tambah field `order_type` di transaksi | 1 jam |
| **Nota dengan No. Meja** | Tambah `table_name` di receipt template | 30 menit |
| **Split Bill** | Bagi items dari 1 order ke beberapa transaksi | 1 hari |
| **Open Tab** | Order tanpa bayar dulu (sudah mirip table_orders) | Included |

---

## Toggle & Permission

### Store Toggle

```javascript
// Di Stores.jsx / GeneralSettings.jsx
enableFnB: true  // Master toggle, tampilkan semua menu FnB di sidebar
```

### Sidebar Items (Conditional)

```
📋 Manajemen Meja    → /fnb/tables     (if enableFnB && enableTableManagement)
🔥 Kitchen Display   → /fnb/kitchen    (if enableFnB && enableKDS)
```

### Permission Entries

```javascript
// AccessSettings.jsx
{ id: 'fnb.tables', label: 'Manajemen Meja' },
{ id: 'fnb.kitchen', label: 'Kitchen Display' },
{ id: 'fnb.modifiers', label: 'Kelola Modifier Produk' },
```

---

## Fase Implementasi

### Phase 1: Add-on System (3-5 hari)

- [ ] Schema: `modifier_groups`, `modifier_options`, `product_modifier_groups`
- [ ] UI: Modifier management di `ProductForm.jsx`
- [ ] POS: Modifier selection popup saat add item
- [ ] Receipt: Print modifiers
- [ ] RPC: Update `process_sale` untuk handle modifier pricing

### Phase 2: Table Management (3-5 hari)

- [ ] Schema: `tables`, `table_orders`
- [ ] UI: Table grid page (`/fnb/tables`)
- [ ] UI: Table order detail (add/remove items)
- [ ] Integration: Close order → create transaction di POS
- [ ] Settings: `stores.settings.fnb` config

### Phase 3: Kitchen Display (2-3 hari)

- [ ] UI: Full-screen kitchen view (`/fnb/kitchen`)
- [ ] Realtime: Supabase subscription on `table_orders`
- [ ] Item status tracking (pending → preparing → done)

### Phase 4: Polish (1-2 hari)

- [ ] Dine-in/Take-away flag
- [ ] Split bill
- [ ] Laporan khusus FnB (penjualan per meja, peak hours)

---

## File yang Akan Ditambah/Dimodifikasi

### File Baru

```
src/pages/fnb/
  ├── TableManagement.jsx
  ├── KitchenDisplay.jsx
  └── ModifierManager.jsx
sql/functions/
  └── fnb_helpers.sql
```

### File yang Dimodifikasi (Minimal)

```
src/pages/POS.jsx              → Modifier selection popup
src/pages/ProductForm.jsx      → Modifier groups tab
src/components/Sidebar.jsx     → FnB menu items
src/pages/settings/GeneralSettings.jsx → enableFnB toggle
src/pages/settings/AccessSettings.jsx  → FnB permissions
src/utils/receiptHelper.js     → Print modifiers on receipt
```

---

## Catatan untuk Apotek (Coming Soon)

Apotek akan butuh dokumen serupa. Fitur spesifik yang sudah teridentifikasi:

- Batch number tracking (sudah ada partial di stock opname)
- Expiry date alert yang lebih ketat
- Field "Dosis" dan "Keterangan Obat" di produk
- Catatan resep dokter (opsional)
- Label obat pada receipt

> Akan didokumentasikan di file terpisah: `docs/spec_module_pharmacy.md`
