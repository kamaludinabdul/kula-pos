/* eslint-env node */
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// --- CONFIGURATION ---
const serviceAccount = JSON.parse(
  readFileSync('./scripts/kula-pos-staging-firebase-adminsdk-fbsvc-7bec409b0a.json', 'utf8')
);

const supabaseUrl = "https://jsylclofqbqdutccsrxb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NzExNiwiZXhwIjoyMDgzNDczMTE2fQ.Aqs2ODInyTyIYq_uzwuXpvZC4XdEzBU61Rc66deXUFs";
// Using Service Role Key to bypass RLS for migration RLS

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// ID Mapping cache (Firestore ID -> Supabase UUID)
const idMap = {};

// Helper to generate deterministic UUID from Firestore ID
import crypto from 'crypto';
function firestoreIdToUuid(firestoreId) {
  if (!firestoreId) return null;
  // Check if already valid UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firestoreId)) {
    return firestoreId;
  }
  // Check cache
  if (idMap[firestoreId]) return idMap[firestoreId];
  // Generate deterministic UUID from hash
  const hash = crypto.createHash('md5').update(firestoreId).digest('hex');
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  idMap[firestoreId] = uuid;
  return uuid;
}


// Utility to convert Firestore timestamps to ISO string
const toDate = (ts) => {
  if (!ts) return null;
  // Handle numeric timestamp (e.g. 1767776937113)
  if (typeof ts === 'number') return new Date(ts).toISOString();
  // Handle stringified number (e.g. "1767776937113")
  if (typeof ts === 'string') {
    if (/^\d{10,13}$/.test(ts)) return new Date(Number(ts)).toISOString();
    return ts;
  }
  if (ts.toDate) return ts.toDate().toISOString();
  if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
  return ts;
};

// --- CONFIGURATION ---
const TARGET_COLLECTIONS = ['all']; // Set to 'all' for complete migration

async function migrateCollection(firestoreName, supabaseName, mapper) {
  if (!TARGET_COLLECTIONS.includes(firestoreName) && !TARGET_COLLECTIONS.includes('all')) return;
  console.log(`📦 Fetching ${firestoreName} from Firestore...`);
  try {
    const snapshot = await db.collection(firestoreName).get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`✅ Found ${docs.length} ${firestoreName}.`);

    if (docs.length === 0) return;

    console.log(`💾 Uploading ${docs.length} ${supabaseName} to Supabase...`);
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const item of docs) {
      const mappedData = mapper(item);

      // Skip if mapper returns null or if store_id is required but missing
      if (!mappedData) {
        skippedCount++;
        continue;
      }

      const { error } = await supabase.from(supabaseName).upsert(mappedData);
      if (error) {
        // Handle Foreign Key Violations (Orphan Data) gracefully
        if (error.message.includes("violates foreign key constraint")) {
          console.warn(`   ⚠️ Skipped ${firestoreName} (${item.id}): Parent record not found (Orphan).`);
          skippedCount++;
        } else {
          console.error(`❌ Error migrating ${firestoreName} (${item.id}):`, error.message);
          errorCount++;
        }
      } else {
        successCount++;
      }
    }
    console.log(`   ✅ Success: ${successCount}, ❌ Errors: ${errorCount}, ⏭️ Skipped: ${skippedCount}`);
  } catch (err) {
    console.error(`❌ Failed to migrate ${firestoreName}:`, err.message);
  }
}

async function migrate() {
  console.log("🚀 Starting Full Migration with Admin SDK...");

  // Fetch a default store for orphans
  const { data: defaultStores } = await supabase.from('stores').select('id').limit(1);
  const DEFAULT_STORE_ID = defaultStores?.[0]?.id;
  if (DEFAULT_STORE_ID) {
    console.log(`ℹ️  Using Default Store ID for orphans: ${DEFAULT_STORE_ID}`);
  } else {
    console.warn("⚠️  No stores found in Supabase! Orphans will be skipped.");
  }

  // Pre-fetch for linking
  console.log("🔍 Fetching existing data for linking...");
  const { data: qProfiles } = await supabase.from('profiles').select('id, email');
  const profileEmailMap = {};
  qProfiles?.forEach(p => { profileEmailMap[p.email] = p.id; });

  // Build profileIdMap: Firestore UID -> Supabase UUID
  const profileIdMap = {};
  const userSnapshot = await db.collection('users').get();
  userSnapshot.forEach(doc => {
    const data = doc.data();
    const email = data.email || `${(data.uid || doc.id)}@kula.placeholder`;
    if (profileEmailMap[email]) {
      profileIdMap[data.uid || doc.id] = profileEmailMap[email];
    }
  });
  console.log(`✅ Mapped ${Object.keys(profileIdMap).length} profiles for linking.`);

  const { data: qCategories } = await supabase.from('categories').select('id, name, store_id');
  const categoryNameMap = {}; // store_id -> name -> id
  qCategories?.forEach(c => {
    if (!categoryNameMap[c.store_id]) categoryNameMap[c.store_id] = {};
    categoryNameMap[c.store_id][c.name] = c.id;
  });

  const { data: qStores } = await supabase.from('stores').select('id');
  const validStoreIds = new Set(qStores?.map(s => s.id) || []);

  // 1. Stores (owner_id set to null - Firebase Auth users don't exist in Supabase)
  await migrateCollection("stores", "stores", (doc) => ({
    id: firestoreIdToUuid(doc.id),
    name: doc.name,
    owner_id: null, // Firebase Auth UID not compatible with Supabase
    owner_name: doc.ownerName || doc.owner_name,
    email: doc.email,
    plan: doc.plan || 'free',
    status: doc.status || 'active',
    address: doc.address,
    phone: doc.phone,
    settings: doc.settings || {},

    // New fields mapping
    telegram_bot_token: doc.telegramBotToken || doc.telegram_bot_token || null,
    telegram_chat_id: doc.telegramChatId || doc.telegram_chat_id || null,
    enable_sales_performance: doc.enableSalesPerformance || doc.enable_sales_performance || false,
    pet_care_enabled: doc.petCareEnabled || doc.pet_care_enabled || false,

    created_at: toDate(doc.createdAt || doc.created_at)
  }));

  // 2. Customers (keep string ID as per schema)
  await migrateCollection("customers", "customers", (doc) => ({
    id: doc.id,
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    address: doc.address,
    store_id: firestoreIdToUuid(doc.storeId || doc.store_id),
    total_spent: doc.totalSpent || 0,
    debt: doc.debt || 0,
    loyalty_points: doc.loyaltyPoints || 0,
    total_lifetime_points: doc.totalLifetimePoints || 0,
    created_at: toDate(doc.createdAt || doc.created_at)
  }));

  // 3. Suppliers
  await migrateCollection("suppliers", "suppliers", (doc) => ({
    id: firestoreIdToUuid(doc.id),
    name: doc.name,
    contact_person: doc.contactPerson,
    phone: doc.phone,
    email: doc.email,
    address: doc.address,
    store_id: firestoreIdToUuid(doc.storeId || doc.store_id),
    created_at: toDate(doc.createdAt || doc.created_at)
  }));

  // 4. Categories (skip if no store_id)
  await migrateCollection("categories", "categories", (doc) => {
    const storeId = doc.storeId || doc.store_id;
    if (!storeId) return null; // Skip orphan categories
    return {
      id: firestoreIdToUuid(doc.id),
      name: doc.name,
      store_id: firestoreIdToUuid(storeId),
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });

  // 5. Products (skip if no store_id)
  await migrateCollection("products", "products", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null; // Skip orphan products

    // Find category ID by name if categoryId is missing
    let categoryId = (doc.categoryId || doc.category_id) ? firestoreIdToUuid(doc.categoryId || doc.category_id) : null;
    if (!categoryId && doc.category && categoryNameMap[storeId]) {
      categoryId = categoryNameMap[storeId][doc.category] || null;
    }

    // Map Firestore fields to Supabase snake_case columns
    return {
      id: firestoreIdToUuid(doc.id),
      name: doc.name,
      barcode: doc.barcode || doc.code || '',
      buy_price: Number(doc.buyPrice || doc.buy_price || doc.cost || 0),
      sell_price: Number(doc.sellPrice || doc.sell_price || doc.price || 0),
      stock: Number(doc.stock || doc.qty || 0),
      unit: doc.unit || 'pcs',
      category_id: categoryId,
      store_id: storeId,
      is_deleted: doc.isDeleted || false,
      created_at: toDate(doc.createdAt || doc.created_at),

      // New fields
      min_stock: Number(doc.minStock || doc.min_stock || 0),
      type: doc.type || (doc.isService ? 'service' : 'product'),
      sold: Number(doc.sold || 0),
      revenue: Number(doc.revenue || 0),
      image_url: doc.imageUrl || doc.image || null,
      discount: Number(doc.discount || 0),
      discount_type: doc.discountType || 'percent',
      is_unlimited: doc.isUnlimited || false,
      purchase_unit: doc.purchaseUnit || null,
      conversion_to_unit: Number(doc.conversionToUnit || 0),
      weight: Number(doc.weight || 0),
      rack_location: doc.rackLocation || null
    };
  });

  // 6. Transactions
  await migrateCollection("transactions", "transactions", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null; // Skip orphan transactions

    // Lookup cashier by original UID
    const cashierId = profileIdMap[doc.cashierId || doc.cashier_id] || null;

    return {
      id: doc.id,
      store_id: storeId,
      customer_id: doc.customerId || doc.customer_id,
      customer_name: doc.customerName || doc.customer_name,
      cashier: doc.cashier,
      cashier_id: cashierId,
      date: toDate(doc.date),
      total: doc.total || 0,
      discount: doc.discount || 0,
      tax: doc.tax || 0,
      payment_method: doc.paymentMethod || doc.payment_method,
      status: doc.status || 'success',
      items: doc.items || [],
      created_at: toDate(doc.createdAt || doc.created_at),

      // New fields
      shift_id: doc.shiftId ? firestoreIdToUuid(doc.shiftId) : null,
      void_reason: doc.voidReason || null,
      payment_details: doc.paymentDetails || {}
    };
  });

  // 7. Expenses (Cash Flow)
  await migrateCollection("expenses", "cash_flow", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null;
    return {
      id: firestoreIdToUuid(doc.id),
      store_id: storeId,
      type: 'out',
      category: doc.category || 'General',
      amount: doc.amount || 0,
      description: doc.description || doc.note,
      date: toDate(doc.date),
      expense_group: doc.group || 'operational',
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });

  // 8. Purchase Orders (PO)
  await migrateCollection("purchase_orders", "purchase_orders", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null;
    return {
      id: firestoreIdToUuid(doc.id),
      store_id: storeId,
      supplier_id: firestoreIdToUuid(doc.supplierId || doc.supplier_id),
      supplier_name: doc.supplierName || doc.supplier_name,
      date: toDate(doc.date),
      due_date: toDate(doc.dueDate || doc.due_date),
      status: doc.status || 'draft',
      total_amount: Number(doc.totalAmount || doc.total || 0),
      paid_amount: Number(doc.paidAmount || doc.paid || 0),
      items: doc.items || [],
      note: doc.notes || doc.note || '', // Match schema 'note'
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });


  // 9. Staff (Profiles)
  // Skip Super Admin (already created manually via script)
  await migrateCollection("users", "profiles", (doc) => {
    if (doc.email === 'admin@kula.id') return null;

    // Derived email for placeholders
    const derivedEmail = doc.email || `${(doc.uid || doc.id)}@kula.placeholder`;
    const targetId = profileEmailMap[derivedEmail] || firestoreIdToUuid(doc.uid || doc.id);

    let storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!validStoreIds.has(storeId)) {
      storeId = DEFAULT_STORE_ID || null;
    }

    return {
      id: targetId,
      email: derivedEmail,
      name: doc.name || doc.displayName,
      role: doc.role || 'staff',
      store_id: storeId,
      status: doc.status || 'active',
      pin: doc.pin || null,
      permissions: doc.permissions || [],
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });


  // 10. Shifts
  await migrateCollection("shifts", "shifts", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null;

    // Link cashier to existing profile ID if possible
    const cashierId = profileIdMap[doc.cashierId || doc.cashier_id] || null;

    return {
      id: firestoreIdToUuid(doc.id),
      store_id: storeId,
      cashier_id: cashierId,
      cashier_name: doc.cashierName || doc.cashier_name,
      start_time: toDate(doc.startTime || doc.start_time),
      end_time: toDate(doc.endTime || doc.end_time),
      initial_cash: Number(doc.initialCash || 0),
      final_cash: Number(doc.finalCash || 0),
      expected_cash: Number(doc.expectedCash || 0),
      total_sales: Number(doc.totalSales || 0),
      status: doc.status || 'active',
      notes: doc.notes || '',
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });

  // 11. Pets (Vet)
  await migrateCollection("pets", "pets", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null;
    return {
      id: firestoreIdToUuid(doc.id),
      store_id: storeId,
      customer_id: doc.customerId || doc.customer_id,
      name: doc.name,
      type: doc.type || 'Cat',
      breed: doc.breed,
      gender: doc.gender,
      birth_date: toDate(doc.birthDate || doc.birth_date),
      weight: Number(doc.weight || 0),
      notes: doc.notes,
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });

  // 12. Medical Records (Vet)
  await migrateCollection("medical_records", "medical_records", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null;
    return {
      id: firestoreIdToUuid(doc.id),
      store_id: storeId,
      pet_id: firestoreIdToUuid(doc.petId || doc.pet_id),
      date: toDate(doc.date),
      diagnosis: doc.diagnosis,
      treatment: doc.treatment,
      notes: doc.notes,
      doctor_name: doc.doctorName || doc.doctor_name,
      next_visit: toDate(doc.nextVisit || doc.next_visit),
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });

  // 13. Rooms (Hotel)
  await migrateCollection("rooms", "rooms", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null;
    return {
      id: firestoreIdToUuid(doc.id),
      store_id: storeId,
      name: doc.name,
      type: doc.type,
      capacity: Number(doc.capacity || 1),
      price_per_night: Number(doc.pricePerNight || doc.price || 0),
      status: doc.status || 'available',
      features: doc.features || [],
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });

  // 14. Bookings (Hotel)
  await migrateCollection("bookings", "bookings", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null;
    return {
      id: firestoreIdToUuid(doc.id),
      store_id: storeId,
      customer_id: doc.customerId || doc.customer_id,
      room_id: firestoreIdToUuid(doc.roomId || doc.room_id),
      room_name: doc.roomName || doc.room_name,
      start_date: toDate(doc.checkIn || doc.check_in),
      end_date: toDate(doc.checkOut || doc.check_out),
      status: doc.status || 'booked',
      total_price: Number(doc.totalPrice || doc.total || 0),
      notes: doc.notes,
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });

  // 15. Rental Units
  await migrateCollection("rental_units", "rental_units", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null;
    return {
      id: firestoreIdToUuid(doc.id),
      store_id: storeId,
      name: doc.name,
      linked_product_id: firestoreIdToUuid(doc.linkedProductId || doc.linked_product_id),
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });

  // 16. Rental Sessions
  await migrateCollection("rental_sessions", "rental_sessions", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null;
    return {
      id: firestoreIdToUuid(doc.id),
      store_id: storeId,
      unit_id: firestoreIdToUuid(doc.unitId || doc.unit_id),
      customer_id: doc.customerId || doc.customer_id,
      start_time: toDate(doc.startTime || doc.start_time),
      end_time: toDate(doc.endTime || doc.end_time),
      status: doc.status || 'active',
      agreed_total: Number(doc.totalCost || doc.agreedTotal || 0),
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });

  // 17. Stock Movements
  await migrateCollection("stock_movements", "stock_movements", (doc) => {
    const storeId = firestoreIdToUuid(doc.storeId || doc.store_id);
    if (!storeId) return null;
    return {
      id: firestoreIdToUuid(doc.id),
      store_id: storeId,
      product_id: firestoreIdToUuid(doc.productId || doc.product_id),
      type: doc.type || 'adjustment',
      qty: Number(doc.quantity || 0),
      date: toDate(doc.date),
      note: doc.reason || '',
      created_at: toDate(doc.createdAt || doc.created_at)
    };
  });

  console.log("🎉 Full Migration Complete!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});




