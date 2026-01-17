/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';
import { normalizePermissions } from '../utils/permissions';
import { checkPlanLimit, PLAN_LIMITS } from '../utils/planLimits';
import { offlineService } from '../services/offlineService';
import { PLANS } from '../utils/plans';

const DataContext = createContext(null);

// Helper to safely fetch and log errors
// We use an object signature { tableName, setterFn, queryBuilder, processFn }
// to make it more resilient to minification parameter-shifting.
const safeFetchSupabase = async (options) => {
    const { supabase, activeStoreId, tableName, setterFn, queryBuilder, processFn } = options || {};

    if (!supabase || !tableName || !setterFn) {
        console.error("safeFetchSupabase: missing required options", { tableName, hasSetter: !!setterFn });
        return [];
    }

    try {
        let query = supabase.from(tableName).select('*').eq('store_id', activeStoreId);

        // Robust check: only call if it exists and is a function
        if (queryBuilder && typeof queryBuilder === 'function') {
            query = queryBuilder(query);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Robust check: ensure data is an array before processing
        let processed = data;
        if (Array.isArray(data)) {
            if (typeof processFn === 'function') {
                processed = processFn(data);
            }
        } else {
            console.warn(`safeFetchSupabase: Data for ${tableName} is not an array:`, data);
            processed = [];
        }

        if (typeof setterFn === 'function') {
            setterFn(processed || []);
        }
        return processed || [];
    } catch (e) {
        console.error(`Failed to fetch ${tableName}:`, e);
        return [];
    }
};

export const DataProvider = ({ children }) => {
    // Debug log to verify if the latest code is running
    useEffect(() => {
        console.log("DataContext: v0.8.20-robust-fetch (" + new Date().toLocaleTimeString() + ")");
    }, []);

    const { user, checkPermission } = useAuth();
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [stores, setStores] = useState([]);
    const [stockMovements, setStockMovements] = useState([]);
    const [salesTargets, setSalesTargets] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const isFetchingRef = useRef(false);

    const [suppliers, setSuppliers] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [plans, setPlans] = useState(PLANS);
    const [loading, setLoading] = useState(true);
    const [storesLoading, setStoresLoading] = useState(true);
    const [lastFetchError, setLastFetchError] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // For Super Admin to switch views
    const [selectedStoreId, setSelectedStoreIdState] = useState(() => {
        return localStorage.getItem('superAdminSelectedStoreId') || null;
    });

    const setSelectedStoreId = (id) => {
        setSelectedStoreIdState(id);
        if (id) {
            localStorage.setItem('superAdminSelectedStoreId', id);
        } else {
            localStorage.removeItem('superAdminSelectedStoreId');
        }
    };

    // Determine the effective store ID to use for queries
    const activeStoreId = (user?.role === 'super_admin' && selectedStoreId)
        ? selectedStoreId
        : user?.store_id;
    const currentStore = stores.find(s => s.id === activeStoreId) || null;

    // Sync across tabs
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'superAdminSelectedStoreId') {
                setSelectedStoreIdState(e.newValue);
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Network Status Listener
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (activeStoreId) {
                console.log("Online: Syncing offline transactions...");
                offlineService.syncTransactions(activeStoreId, processSale);
            }
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeStoreId]); // Re-bind if store changes




    const addStore = async (storeData) => {
        try {
            const { data, error } = await supabase
                .from('stores')
                .insert({
                    ...storeData,
                })
                .select()
                .single();

            if (error) throw error;
            fetchData();
            return { success: true, id: data.id };
        } catch (error) {
            console.error("Error adding store:", error);
            return { success: false, error };
        }
    };

    const updateStore = React.useCallback(async (id, updates) => {
        if (!id || !user) return { success: false, error: 'Authorization required' };
        setStoresLoading(true);
        try {
            // Check specific settings updates that require validation
            if (updates.taxRate && (isNaN(updates.taxRate) || Number(updates.taxRate) < 0)) {
                throw new Error("Tax rate must be a valid positive number");
            }

            // --- Permission Check ---
            // Only 'owner', 'super_admin' or 'admin' can update store settings
            if (user.role !== 'owner' && user.role !== 'super_admin' && user.role !== 'admin') {
                // Failsafe: check if user is the store owner
                const { data: storeCheck } = await supabase.from('stores').select('owner_id').eq('id', id).single();
                if (storeCheck && storeCheck.owner_id !== user.id) {
                    return { success: false, error: 'Insufficient permissions to update store settings' };
                }
            }
            // ------------------------

            // Map frontend camelCase to snake_case for DB
            const dbUpdates = {};
            if (updates.name) dbUpdates.name = updates.name;
            if (updates.address) dbUpdates.address = updates.address;
            if (updates.phone) dbUpdates.phone = updates.phone;

            // Boolean flags
            if (typeof updates.enableSalesPerformance !== 'undefined') dbUpdates.enable_sales_performance = updates.enableSalesPerformance;
            if (typeof updates.enableRental !== 'undefined') dbUpdates.enable_rental = updates.enableRental;
            if (typeof updates.enableDiscount !== 'undefined') dbUpdates.enable_discount = updates.enableDiscount;
            if (typeof updates.petCareEnabled !== 'undefined') dbUpdates.pet_care_enabled = updates.pet_care_enabled;

            // Values
            if (updates.discountPin) dbUpdates.discount_pin = updates.discountPin;
            if (updates.taxRate) dbUpdates.tax_rate = updates.taxRate;
            if (updates.serviceCharge) dbUpdates.service_charge = updates.serviceCharge;
            if (updates.taxType) dbUpdates.tax_type = updates.taxType;
            if (updates.telegramBotToken) dbUpdates.telegram_bot_token = updates.telegramBotToken;
            if (updates.telegramChatId) dbUpdates.telegram_chat_id = updates.telegramChatId;

            // Handle nested JSON settings (like loyalty)
            // Note: This is a shallow merge for 'settings' column. 
            // In a real app, you might want deeper merging or dedicated JSONB patching.
            if (updates.loyaltySettings || updates.shiftOpenTime || updates.shiftCloseTime || updates.lastShiftOpenReminderDate || updates.lastShiftCloseReminderDate) {
                // Fetch current settings first to merge
                const { data: currentMeta } = await supabase.from('stores').select('settings').eq('id', id).single();
                const currentSettings = currentMeta?.settings || {};

                dbUpdates.settings = {
                    ...currentSettings,
                    ...(updates.loyaltySettings ? { loyaltySettings: updates.loyaltySettings } : {}),
                    // Flatten other settings if stored in JSON
                };

                // For legacy compatibility, some fields might be top level or in settings.
                // Here we assume new fields go into settings column if not schema-defined.
                // But for now, we just update what we can.
            }

            // Direct column updates take precedence
            const { error } = await supabase
                .from('stores')
                .update(dbUpdates)
                .eq('id', id);

            if (error) throw error;

            // Simple Optimistic Update
            setStores(prev => prev.map(store => {
                if (store.id === id) {
                    return { ...store, ...updates };
                }
                return store;
            }));

            // setRefreshKey(prev => prev + 1); // Force deep refresh in background
            return { success: true };
        } catch (error) {
            console.error("Error updating store:", error);
            setStoresLoading(false);
            return { success: false, error: error.message };
        } finally {
            setStoresLoading(false);
            setStoresLoading(false);
        }
    }, [user]);

    /**
     * Check and reset expired points if expiry date has passed
     * Defined here because it depends on updateStore
     */
    const checkAndResetExpiredPoints = React.useCallback(async (store) => {
        if (!activeStoreId || !store) {
            return { success: false, error: 'No active store' };
        }

        const loyaltySettings = store.loyaltySettings || {};

        if (!loyaltySettings.expiryEnabled || !loyaltySettings.expiryDate) {
            return { success: false, error: 'Point expiry not enabled' };
        }

        const expiryDate = new Date(loyaltySettings.expiryDate);
        const now = new Date();

        if (now < expiryDate) {
            return { success: false, error: 'Expiry date not reached yet' };
        }

        try {
            const { error: rpcError } = await supabase.rpc('reset_loyalty_points', {
                p_store_id: activeStoreId
            });
            if (rpcError) throw rpcError;

            // Updated local state
            updateStore(activeStoreId, {
                loyaltySettings: {
                    ...loyaltySettings,
                    expiryDate: null // Reset expiry date after processing
                }
            });

            return { success: true };
        } catch (error) {
            console.error('Error resetting loyalty points:', error);
            return { success: false, error: error.message };
        }
    }, [activeStoreId, updateStore]);

    // Apply expiry check when store loads
    useEffect(() => {
        if (user?.role === 'super_admin') {
            console.log("Super Admin Store Logic:", {
                userStoreId: user.store_id,
                selectedStoreId,
                activeStoreId,
                currentStoreName: currentStore?.name
            });
        }
        if (activeStoreId && currentStore) {
            checkAndResetExpiredPoints(currentStore);
        }
    }, [activeStoreId, currentStore, checkAndResetExpiredPoints, user, selectedStoreId]);

    const deleteStore = async (id) => {
        try {
            const { error } = await supabase
                .from('stores')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchData();
            return { success: true };
        } catch (error) {
            console.error("Error deleting store:", error);
            return { success: false, error };
        }
    };

    const updateStoreSettings = async (settings) => {
        if (!activeStoreId) {
            console.error('ERROR: No active store ID!');
            return { success: false, error: 'No active store ID' };
        }

        try {
            // Get current settings to merge
            const currentStoreObj = stores.find(s => s.id === activeStoreId);
            const currentSettings = currentStoreObj?.settings || {};

            // Prepare merged settings
            const mergedSettings = {
                ...currentSettings,
                ...settings
            };

            // Prepare top-level fields if any (some settings are also columns)
            const updatePayload = { settings: mergedSettings };
            if (settings.enableSalesPerformance !== undefined) {
                updatePayload.enable_sales_performance = settings.enableSalesPerformance;
            }

            // Optimistic update
            setStores(prev => prev.map(s => s.id === activeStoreId ? {
                ...s,
                settings: mergedSettings,
                // Map top-level fields too
                enableSalesPerformance: settings.enableSalesPerformance !== undefined ? settings.enableSalesPerformance : s.enableSalesPerformance,
                loyaltySettings: mergedSettings.loyaltySettings,
                autoPrintReceipt: mergedSettings.autoPrintReceipt
            } : s));

            const { error } = await supabase
                .from('stores')
                .update(updatePayload)
                .eq('id', activeStoreId);

            if (error) throw error;

            // Silent background sync
            fetchStores(true);

            return { success: true };
        } catch (error) {
            console.error("Error updating store settings:", error);
            // Revert on error if needed, but fetchStores will handle it
            fetchStores(true);
            return { success: false, error };
        }
    };



    const fetchStockMovements = useCallback(async () => {
        if (!activeStoreId) return;
        try {
            const { data, error } = await supabase
                .from('stock_movements')
                .select('*')
                .eq('store_id', activeStoreId)
                .order('date', { ascending: false })
                .limit(500);

            if (error) throw error;

            // Robust check: ensure data is an array
            if (!Array.isArray(data)) {
                setStockMovements([]);
                return [];
            }

            const mappedData = data.map(m => ({
                ...m,
                storeId: m.store_id,
                productId: m.product_id,
                refId: m.ref_id,
                performedBy: m.performed_by
            }));
            setStockMovements(mappedData);
            return mappedData;
        } catch (error) {
            console.error("Failed to fetch stock movements:", error);
            return [];
        }
    }, [activeStoreId]);



    const fetchData = useCallback(async (shouldSetLoading = false) => {
        if (!user) {
            setLoading(false);
            return;
        }

        if (isFetchingRef.current) {
            console.log("DataContext: Fetch already in progress, skipping redundant call");
            return;
        }

        isFetchingRef.current = true;
        if (shouldSetLoading) setLoading(true);
        try {
            console.log("DataContext: Fetching data for user:", user?.email, "Role:", user?.role, "StoreId:", activeStoreId, "State:", { productsCount: products.length, categoriesCount: categories.length });

            if (activeStoreId) {
                setLastFetchError(null);

                // --- PHASE 1: INITIAL SNAPSHOT ---
                const phase1Start = performance.now();
                try {
                    console.log("DataContext: Starting Phase 1 (Snapshot)...");
                    const snapshotQuery = supabase.rpc('get_store_initial_snapshot', {
                        p_store_id: activeStoreId
                    });

                    const snapshotTimeout = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Snapshot RPC timeout')), 10000)
                    );

                    const { data: snapshot, error: snapshotError } = await Promise.race([snapshotQuery, snapshotTimeout]);

                    if (snapshotError) {
                        console.warn("DataContext: Initial snapshot RPC error:", snapshotError);
                    } else if (snapshot) {
                        console.log("DataContext: Initial snapshot loaded successfully");
                        if (snapshot.categories && Array.isArray(snapshot.categories)) {
                            setCategories(snapshot.categories);
                        }
                    }
                } catch (e) {
                    console.warn("DataContext: Initial snapshot RPC failed:", e);
                }
                console.log(`DataContext: Phase 1 (Snapshot) took: ${((performance.now() - phase1Start) / 1000).toFixed(2)}s`);

                // --- PHASE 2: CRITICAL DATA (Products) ---
                const phase2Start = performance.now();
                const fetchedProducts = await (async () => {
                    try {
                        console.log("DataContext: Starting Phase 2 (Products)...");
                        const productsQuery = supabase
                            .from('products')
                            .select('*, categories(id, name)')
                            .eq('store_id', activeStoreId)
                            .eq('is_deleted', false)
                            .limit(2000);

                        const productsTimeout = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Products fetch timeout')), 15000)
                        );

                        const { data, error } = await Promise.race([productsQuery, productsTimeout]);
                        if (error) throw error;

                        const processed = data.map(p => ({
                            ...p,
                            buyPrice: p.buy_price,
                            sellPrice: p.sell_price,
                            minStock: p.min_stock,
                            discountType: p.discount_type,
                            isUnlimited: p.is_unlimited,
                            purchaseUnit: p.purchase_unit,
                            conversionToUnit: p.conversion_to_unit,
                            rackLocation: p.rack_location,
                            imageUrl: p.image_url,
                            categoryId: p.category_id,
                            storeId: p.store_id,
                            isDeleted: p.is_deleted,
                            createdAt: p.created_at,
                            pricingType: p.pricing_type,
                            pricingTiers: p.pricing_tiers,
                            isBundlingEnabled: p.is_bundling_enabled,
                            price: p.sell_price,
                            category: p.categories?.name || null
                        }));
                        setProducts(processed);
                        return processed;
                    } catch (e) {
                        console.error('DataContext: Failed to fetch products:', e);
                        return [];
                    }
                })();
                console.log(`DataContext: Phase 2 (Products) took: ${((performance.now() - phase2Start) / 1000).toFixed(2)}s`);

                // Unblock UI for POS
                if (shouldSetLoading) setLoading(false);

                // Update Offline Cache
                if (fetchedProducts?.length > 0) {
                    offlineService.cacheData(activeStoreId, fetchedProducts || [], categories || [], []);
                }

                // --- PHASE 3: BACKGROUND DATA (Reports, History, Customers) ---
                console.log("DataContext: Starting Phase 3 (Background Data)...");
                const phase3Start = performance.now();

                await Promise.all([
                    safeFetchSupabase({
                        supabase, activeStoreId,
                        tableName: 'transactions',
                        setterFn: setTransactions,
                        queryBuilder: (q) => q.order('date', { ascending: false }).limit(500),
                        processFn: (data) => data.map(t => ({
                            ...t,
                            customerId: t.customer_id,
                            customerName: t.customer_name,
                            pointsEarned: t.points_earned,
                            voidedAt: t.voided_at,
                            shiftId: t.shift_id,
                            amountPaid: t.amount_paid
                        }))
                    }),
                    safeFetchSupabase({
                        supabase, activeStoreId,
                        tableName: 'customers',
                        setterFn: setCustomers,
                        queryBuilder: (q) => q.limit(2000),
                        processFn: (data) => data.map(c => ({
                            ...c,
                            loyaltyPoints: c.loyalty_points || 0,
                            totalSpent: c.total_spent || 0,
                            totalLifetimePoints: c.total_lifetime_points || 0
                        }))
                    }),
                    safeFetchSupabase({
                        supabase, activeStoreId,
                        tableName: 'sales_targets',
                        setterFn: setSalesTargets,
                        processFn: (data) => data.map(t => ({
                            ...t,
                            storeId: t.store_id,
                            targetAmount: t.target_amount,
                            startDate: t.start_date,
                            endDate: t.end_date
                        }))
                    }),
                    safeFetchSupabase({
                        supabase, activeStoreId,
                        tableName: 'suppliers',
                        setterFn: setSuppliers,
                        processFn: (data) => data.map(s => ({
                            ...s,
                            contactPerson: s.contact_person,
                            storeId: s.store_id
                        }))
                    }),
                    safeFetchSupabase({
                        supabase, activeStoreId,
                        tableName: 'promotions',
                        setterFn: setPromotions,
                        queryBuilder: (q) => q.eq('is_active', true),
                        processFn: (data) => data.map(p => ({
                            ...p,
                            storeId: p.store_id,
                            discountValue: p.discount_value,
                            targetIds: p.target_ids,
                            startDate: p.start_date,
                            endDate: p.end_date,
                            isActive: p.is_active,
                            minPurchase: p.min_purchase,
                            usageLimit: p.usage_limit,
                            currentUsage: p.current_usage,
                            allowMultiples: p.allow_multiples
                        }))
                    }),
                    safeFetchSupabase({
                        supabase, activeStoreId,
                        tableName: 'purchase_orders',
                        setterFn: setPurchaseOrders,
                        queryBuilder: (q) => q.order('date', { ascending: false }).limit(100),
                        processFn: (data) => data.map(po => ({
                            ...po,
                            storeId: po.store_id,
                            supplierId: po.supplier_id,
                            supplierName: po.supplier_name,
                            totalAmount: po.total_amount,
                            createdAt: po.created_at
                        }))
                    }),
                    fetchStockMovements()
                ]).catch(err => console.error("DataContext: Phase 3 failed:", err));
                console.log(`DataContext: Phase 3 (Background) took: ${((performance.now() - phase3Start) / 1000).toFixed(2)}s`);

            } else {
                setCategories([]);
                setProducts([]);
                setTransactions([]);
                setCustomers([]);
                setStockMovements([]);
                setSalesTargets([]);
            }
        } catch (error) {
            console.error("DataContext: Failed to fetch data from Supabase:", error);
            setLastFetchError(error.message);

            // Fallback to Offline Cache
            if (activeStoreId) {
                console.log("DataContext: Attempting to load from offline cache...");
                const cached = await offlineService.loadFromCache(activeStoreId);
                if (cached.products.length > 0) {
                    setProducts(cached.products);
                    setCategories(cached.categories);
                    setCustomers(cached.customers);
                    console.log("DataContext: Loaded from offline cache:", cached.products.length, "products");
                }
            }
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, activeStoreId, fetchStockMovements]);

    useEffect(() => {
        const fetchPlans = async () => {
            const { data, error } = await supabase.from('subscription_plans').select('*');
            if (!error && data) {
                const plansMap = {};
                data.forEach(p => {
                    // Map snake_case to camelCase for frontend
                    plansMap[p.id] = {
                        ...p,
                        maxProducts: p.max_products,
                        maxUsers: p.max_staff,
                        maxStores: p.max_stores,
                        label: p.name,
                        priceId: p.price_id,
                        price: p.price || 0,
                        originalPrice: p.original_price
                    };
                });
                setPlans(plansMap);
            }
        };
        fetchPlans();
    }, []);

    const updatePlans = async (newPlans) => {
        try {
            for (const planId in newPlans) {
                const plan = newPlans[planId];
                // Map camelCase to snake_case for Supabase
                const supabaseData = {
                    name: plan.label || plan.name,
                    max_products: plan.maxProducts,
                    max_staff: plan.maxUsers,
                    max_stores: plan.maxStores,
                    price_id: plan.priceId,
                    price: plan.price || 0,
                    original_price: plan.originalPrice,
                    features: plan.features || []
                };
                const { error } = await supabase
                    .from('subscription_plans')
                    .update(supabaseData)
                    .eq('id', planId);
                if (error) throw error;
            }
            setPlans(newPlans);
            return { success: true };
        } catch (error) {
            console.error("Error updating plans:", error);
            return { success: false, error: error.message };
        }
    };

    const fetchStores = useCallback(async (isSilent = false) => {
        if (!user) {
            setStores([]);
            setStoresLoading(false);
            return;
        }
        if (!isSilent) setStoresLoading(true);
        try {
            // OPTIMIZATION: If AuthContext already fetched the current store, use it!
            if (user.stores && user.stores.id === activeStoreId && user.role !== 'super_admin') {
                console.log("DataContext: Using pre-fetched store data from AuthContext");
                const s = user.stores;
                setStores([{
                    ...s,
                    planExpiryDate: s.plan_expiry_date,
                    enableSalesPerformance: s.enable_sales_performance,
                    enableRental: s.enable_rental,
                    enableDiscount: s.enable_discount,
                    discountPin: s.discount_pin,
                    taxRate: s.tax_rate,
                    serviceCharge: s.service_charge,
                    taxType: s.tax_type,
                    petCareEnabled: s.pet_care_enabled,
                    telegramBotToken: s.telegram_bot_token,
                    telegramChatId: s.telegram_chat_id,
                    ownerName: s.owner_name,
                    ownerId: s.owner_id,
                    createdAt: s.created_at,
                    loyaltySettings: s.settings?.loyaltySettings,
                    autoPrintReceipt: s.settings?.autoPrintReceipt,
                    printerType: s.settings?.printerType,
                    printerWidth: s.settings?.printerWidth,
                    receiptHeader: s.settings?.receiptHeader,
                    receiptFooter: s.settings?.receiptFooter,
                    permissions: normalizePermissions(s.settings?.permissions)
                }]);
                setStoresLoading(false);
                return;
            }

            let query = supabase.from('stores').select('*');
            if (user.role !== 'super_admin' && activeStoreId) {
                query = query.eq('id', activeStoreId);
            }
            const { data, error } = await query;
            if (!error && data) {
                setStores(data.map(s => ({
                    ...s,
                    // Map snake_case to camelCase for frontend compatibility
                    planExpiryDate: s.plan_expiry_date,
                    enableSalesPerformance: s.enable_sales_performance,
                    enableRental: s.enable_rental,
                    enableDiscount: s.enable_discount,
                    discountPin: s.discount_pin,
                    taxRate: s.tax_rate,
                    serviceCharge: s.service_charge,
                    taxType: s.tax_type,
                    petCareEnabled: s.pet_care_enabled,
                    telegramBotToken: s.telegram_bot_token,
                    telegramChatId: s.telegram_chat_id,
                    ownerName: s.owner_name,
                    ownerId: s.owner_id,
                    createdAt: s.created_at,
                    // Extract settings for easier access
                    loyaltySettings: s.settings?.loyaltySettings,
                    autoPrintReceipt: s.settings?.autoPrintReceipt,
                    printerType: s.settings?.printerType,
                    printerWidth: s.settings?.printerWidth,
                    receiptHeader: s.settings?.receiptHeader,
                    receiptFooter: s.settings?.receiptFooter,
                    permissions: normalizePermissions(s.settings?.permissions)
                })));
            } else if (error) {
                console.error("Store fetch query error:", error);
            }
        } catch (err) {
            console.error("Store fetch exception:", err);
        } finally {
            if (!isSilent) setStoresLoading(false);
        }
    }, [user, activeStoreId]);

    // Real-time Store Subscription
    useEffect(() => {
        if (!user) {
            // No user - reset loading states to prevent stuck loading screen
            setLoading(false);
            setStoresLoading(false);
            setStores([]);
            return;
        }

        fetchStores();

        // Check for point expiry automatically
        checkAndResetExpiredPoints();

        const channel = supabase.channel('stores-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'stores',
                filter: user.role !== 'super_admin' && activeStoreId ? `id=eq.${activeStoreId}` : undefined
            }, (payload) => {
                const { eventType, new: newRow, old: oldRow } = payload;
                if (eventType === 'INSERT' || eventType === 'UPDATE') {
                    setStores(prev => {
                        const index = prev.findIndex(s => s.id === newRow.id);
                        const processedRow = {
                            ...newRow,
                            // Map snake_case to camelCase for frontend compatibility
                            planExpiryDate: newRow.plan_expiry_date,
                            enableSalesPerformance: newRow.enable_sales_performance,
                            enableRental: newRow.enable_rental,
                            enableDiscount: newRow.enable_discount,
                            discountPin: newRow.discount_pin,
                            taxRate: newRow.tax_rate,
                            serviceCharge: newRow.service_charge,
                            taxType: newRow.tax_type,
                            petCareEnabled: newRow.pet_care_enabled,
                            telegramBotToken: newRow.telegram_bot_token,
                            telegramChatId: newRow.telegram_chat_id,
                            ownerName: newRow.owner_name,
                            ownerId: newRow.owner_id,
                            createdAt: newRow.created_at,
                            loyaltySettings: newRow.settings?.loyaltySettings,
                            autoPrintReceipt: newRow.settings?.autoPrintReceipt,
                            printerType: newRow.settings?.printerType,
                            printerWidth: newRow.settings?.printerWidth,
                            receiptHeader: newRow.settings?.receiptHeader,
                            receiptFooter: newRow.settings?.receiptFooter,
                            permissions: normalizePermissions(newRow.settings?.permissions)
                        };
                        if (index >= 0) {
                            const updated = [...prev];
                            updated[index] = processedRow;
                            return updated;
                        }
                        return [...prev, processedRow];
                    });
                } else if (eventType === 'DELETE') {
                    setStores(prev => prev.filter(s => s.id !== oldRow.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, activeStoreId, fetchStores, checkAndResetExpiredPoints]);

    // Real-time Products Subscription
    useEffect(() => {
        if (!user || !activeStoreId) return;

        const ch = supabase.channel('products-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'products',
                filter: `store_id=eq.${activeStoreId}`
            }, (payload) => {
                const { eventType, new: newRow, old: oldRow } = payload;
                if (eventType === 'INSERT' || eventType === 'UPDATE') {
                    const processed = {
                        ...newRow,
                        buyPrice: newRow.buy_price,
                        sellPrice: newRow.sell_price,
                        minStock: newRow.min_stock,
                        price: newRow.sell_price,
                        categoryId: newRow.category_id,
                        storeId: newRow.store_id
                    };
                    setProducts(prev => {
                        const index = prev.findIndex(p => p.id === newRow.id);
                        if (index >= 0) {
                            // Preserve existing joined data (like category name)
                            const updated = [...prev];
                            updated[index] = {
                                ...prev[index], // Keep old derived data (e.g. category)
                                ...processed    // Overwrite with new DB values
                            };
                            return updated;
                        }
                        return [processed, ...prev];
                    });
                } else if (eventType === 'DELETE') {
                    setProducts(prev => prev.filter(p => p.id !== oldRow.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ch);
        };
    }, [user, activeStoreId]);
    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    // Check for Plan Expiry
    useEffect(() => {
        if (!stores || stores.length === 0) return;

        const checkExpiry = async () => {
            const now = new Date();
            const expiredStores = stores
                .filter(store =>
                    store.plan !== 'free' &&
                    store.plan_expiry_date &&
                    now > new Date(store.plan_expiry_date)
                )
                .map(store => ({
                    id: store.id,
                    plan: 'free',
                    plan_expiry_date: null
                }));

            if (expiredStores.length > 0) {
                try {
                    const { error } = await supabase
                        .from('stores')
                        .upsert(expiredStores);
                    if (error) throw error;
                    console.log("Auto-downgraded expired plans:", expiredStores.length);
                } catch (error) {
                    console.error("Failed to auto-downgrade plans:", error);
                }
            }
        };

        checkExpiry();
    }, [stores]);

    // --- User Management ---
    const addUser = async (userData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            // Staff creation in Supabase usually requires an Edge Function or Admin Access
            // For now, we'll just insert/update the profile if we have an ID
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    ...userData,
                    store_id: activeStoreId,
                    created_at: new Date().toISOString()
                }, { onConflict: 'email', ignoreDuplicates: false });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error("Error adding user:", error);
            return { success: false, error: error.message };
        }
    };

    const fetchUsersByStore = async (storeId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('store_id', storeId);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Error fetching users:", error);
            return [];
        }
    };

    // --- Operational Data Management ---

    const addCategory = async (categoryData) => {
        if (!activeStoreId) return { success: false, error: "No active store selected" };
        try {
            const name = typeof categoryData === 'string' ? categoryData : categoryData.name;
            const { data, error } = await supabase
                .from('categories')
                .insert({ name, store_id: activeStoreId })
                .select()
                .single();

            if (error) throw error;

            // Optimistic update
            setCategories(prev => [...prev, data]);
            return { success: true };
        } catch (error) {
            console.error("Error adding category:", error);
            return { success: false, error: error.message };
        }
    };

    const updateCategory = async (id, name) => {
        try {
            const { error } = await supabase
                .from('categories')
                .update({ name })
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, name } : cat));
        } catch (error) {
            console.error("Error updating category:", error);
        }
    };

    const deleteCategory = async (id) => {
        try {
            const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setCategories(prev => prev.filter(cat => cat.id !== id));
        } catch (error) {
            console.error("Error deleting category:", error);
        }
    };

    const addProduct = async (product) => {
        if (!activeStoreId) return { success: false, error: "No active store" };
        try {
            const storePlan = currentStore?.plan || 'free';
            const limitCheck = checkPlanLimit(storePlan, 'products', products.length, plans);

            if (!limitCheck.allowed) {
                return {
                    success: false,
                    error: 'Plan limit reached.Upgrade to add more products. (Limit: ' + limitCheck.limit + ')'
                };
            }

            // Check for duplicate barcode
            if (product.barcode) {
                const { data: existing } = await supabase
                    .from('products')
                    .select('id')
                    .eq('barcode', product.barcode)
                    .eq('store_id', activeStoreId)
                    .eq('is_deleted', false)
                    .maybeSingle();

                if (existing) {
                    return {
                        success: false,
                        error: 'Barcode \'' + product.barcode + '\' sudah digunakan oleh produk lain.'
                    };
                }
            }

            // Map camelCase to snake_case for Supabase
            const productData = {
                store_id: activeStoreId,
                name: product.name,
                barcode: product.barcode || product.code || null,
                buy_price: product.buyPrice || 0,
                sell_price: product.sellPrice || product.price || 0,
                stock: product.stock || 0,
                unit: product.unit || 'pcs',
                min_stock: product.minStock || 0,
                type: product.type || 'product',
                discount: product.discount || 0,
                discount_type: product.discountType || 'percent',
                is_unlimited: product.isUnlimited || false,
                category_id: product.categoryId || product.category_id || null,
                image_url: product.image || product.imageUrl || null,
                pricing_type: product.pricingType || 'standard',
                pricing_tiers: product.pricingTiers || [],
                is_bundling_enabled: product.isBundlingEnabled || false,
                rack_location: product.shelf || product.rackLocation || null,
                weight: product.weight || 0,
                is_deleted: false
            };

            // Add product
            const { data: newProductData, error: productError } = await supabase
                .from('products')
                .insert(productData)
                .select()
                .single();

            if (productError) throw productError;

            // If product has initial stock, create movement and batch
            if (product.stock && product.stock > 0) {
                await Promise.all([
                    supabase.from('stock_movements').insert({
                        store_id: activeStoreId,
                        product_id: newProductData.id,
                        type: 'in',
                        qty: product.stock,
                        date: new Date().toISOString(),
                        note: 'Initial Stock',
                        ref_id: newProductData.id
                    }),
                    supabase.from('batches').insert({
                        store_id: activeStoreId,
                        product_id: newProductData.id,
                        initial_qty: product.stock,
                        current_qty: product.stock,
                        buy_price: product.buyPrice || 0,
                        date: new Date().toISOString(),
                        note: 'Initial Stock'
                    })
                ]);
            }

            // Optimistic update
            setProducts(prev => [...prev, newProductData]);

            return { success: true };
        } catch (error) {
            console.error("Error adding product:", error);
            return { success: false, error: error.message || "Gagal menambahkan produk" };
        }
    };

    const updateProduct = async (id, data) => {
        try {
            const { stock: _stock, ...rawData } = data;

            // Map camelCase to snake_case for Supabase
            const updateData = {
                name: rawData.name,
                barcode: rawData.barcode || rawData.code,
                buy_price: rawData.buyPrice ?? rawData.buy_price,
                sell_price: rawData.sellPrice ?? rawData.sell_price,
                unit: rawData.unit,
                min_stock: rawData.minStock ?? rawData.min_stock,
                type: rawData.type,
                discount: rawData.discount,
                discount_type: rawData.discountType ?? rawData.discount_type,
                is_unlimited: rawData.isUnlimited ?? rawData.is_unlimited,
                purchase_unit: rawData.purchaseUnit ?? rawData.purchase_unit,
                conversion_to_unit: rawData.conversionToUnit ?? rawData.conversion_to_unit,
                weight: rawData.weight,
                rack_location: (rawData.shelf || rawData.rackLocation) ?? rawData.rack_location,
                image_url: rawData.image || rawData.imageUrl,
                pricing_type: rawData.pricingType || rawData.pricing_type,
                pricing_tiers: rawData.pricingTiers || rawData.pricing_tiers,
                is_bundling_enabled: rawData.isBundlingEnabled || rawData.is_bundling_enabled,
                category_id: rawData.categoryId ?? rawData.category_id
            };

            // Remove undefined values
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) delete updateData[key];
            });

            // Check for duplicate barcode
            if (updateData.barcode) {
                const { data: existing } = await supabase
                    .from('products')
                    .select('id')
                    .eq('barcode', updateData.barcode)
                    .eq('store_id', activeStoreId)
                    .eq('is_deleted', false)
                    .neq('id', id)
                    .maybeSingle();

                if (existing) {
                    return {
                        success: false,
                        error: 'Barcode \'' + updateData.barcode + '\' sudah digunakan oleh produk lain.'
                    };
                }
            }

            const { error } = await supabase
                .from('products')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            // Optimistic update with camelCase for frontend
            setProducts(prev => prev.map(prod => prod.id === id ? { ...prod, ...rawData } : prod));

            return { success: true };
        } catch (error) {
            console.error("Error updating product:", error);
            if (error.code === '42703') {
                return { success: false, error: "Database schema mismatch: missing columns. Please run the fix-product-schema.sql script." };
            }
            return { success: false, error: error.message || "Gagal memperbarui produk", details: error };
        }
    };

    const deleteProduct = async (id) => {
        try {
            const { error } = await supabase
                .from('products')
                .update({
                    is_deleted: true,
                    deleted_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setProducts(prev => prev.filter(prod => prod.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting product:", error);
            return { success: false, error };
        }
    };

    const addTransaction = async (transaction) => {
        if (!activeStoreId) return;
        const numericId = new Date().getTime().toString();
        try {
            const { error } = await supabase
                .from('transactions')
                .insert({
                    ...transaction,
                    id: numericId,
                    store_id: activeStoreId,
                    date: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            fetchData();
            return { success: true, id: numericId };
        } catch (error) {
            console.error("Error adding transaction:", error);
            return { success: false, error: error.message };
        }
    };

    const processRefund = async (transactionId, reason) => {
        if (!activeStoreId) return;

        // Permission Check
        if (!checkPermission('transactions.refund')) {
            return { success: false, error: "Anda tidak memiliki izin untuk melakukan refund." };
        }
        try {
            // Get transaction data first to update optimistic state
            const { data: transactionData, error: fetchError } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', transactionId)
                .single();

            if (fetchError || !transactionData) {
                throw new Error("Transaksi tidak ditemukan");
            }

            if (transactionData.status === 'refunded') {
                throw new Error("Transaksi sudah di-refund sebelumnya");
            }

            // Call Supabase RPC
            const { data, error: rpcError } = await supabase.rpc('process_refund', {
                p_store_id: activeStoreId,
                p_transaction_id: transactionId,
                p_reason: reason,
                p_refund_by: user.name
            });

            if (rpcError) throw rpcError;
            if (data && data.success === false) throw new Error(data.error);

            // Optimistic Updates
            setTransactions(prev => prev.map(t =>
                t.id === transactionId ? { ...t, status: 'refunded', refund_reason: reason } : t
            ));

            setProducts(prev => prev.map(p => {
                const item = transactionData.items.find(i => i.id === p.id);
                if (item && p.type !== 'service') {
                    return { ...p, stock: (p.stock || 0) + item.qty };
                }
                return p;
            }));

            if (transactionData.customer_id) {
                setCustomers(prev => prev.map(c => {
                    if (c.id === transactionData.customer_id) {
                        const updates = {
                            total_spent: Math.max(0, (c.total_spent || 0) - transactionData.total)
                        };

                        if (transactionData.payment_method === 'debt') {
                            updates.debt = (c.debt || 0) - transactionData.total;
                        }

                        return { ...c, ...updates };
                    }
                    return c;
                }));
            }

            return { success: true };
        } catch (error) {
            console.error("Error processing refund:", error);
            return { success: false, error: error.message };
        }
    };

    // --- Customer Management ---

    const addCustomer = async (customerData) => {
        if (!activeStoreId) {
            return { success: false, error: "No active store selected" };
        }

        // Phone number is mandatory for ID
        const customerId = customerData.phone ? customerData.phone.replace(/[^0-9]/g, '') : '';

        if (!customerId) {
            return { success: false, error: "Nomor HP wajib diisi sebagai ID." };
        }

        try {
            const { data: existing } = await supabase
                .from('customers')
                .select('id')
                .eq('id', customerId)
                .maybeSingle();

            if (existing) {
                return { success: false, error: "Pelanggan dengan nomor HP ini sudah terdaftar." };
            }

            const newCustomer = {
                id: customerId,
                ...customerData,
                store_id: activeStoreId,
                total_spent: 0,
                debt: 0,
                loyalty_points: 0,
                total_lifetime_points: 0
            };

            const { data, error } = await supabase
                .from('customers')
                .insert(newCustomer)
                .select()
                .single();

            if (error) throw error;

            // Optimistic update with mapping
            const processedNewCustomer = {
                ...data,
                loyaltyPoints: data.loyalty_points || 0,
                totalSpent: data.total_spent || 0,
                totalLifetimePoints: data.total_lifetime_points || 0
            };

            setCustomers(prev => {
                if (prev.some(c => c.id === data.id)) {
                    return prev.map(c => c.id === data.id ? processedNewCustomer : c);
                }
                return [...prev, processedNewCustomer];
            });

            return { success: true };
        } catch (error) {
            console.error("Error adding customer:", error);
            return { success: false, error: error.message };
        }
    };

    const updateCustomer = async (id, data) => {
        try {
            const { error } = await supabase
                .from('customers')
                .update(data)
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setCustomers(prev => prev.map(cust => {
                if (cust.id === id) {
                    return {
                        ...cust,
                        ...data,
                        // Ensure critical fields are mapped if passed in update data
                        loyaltyPoints: data.loyalty_points !== undefined ? data.loyalty_points : (data.loyaltyPoints !== undefined ? data.loyaltyPoints : cust.loyaltyPoints)
                    };
                }
                return cust;
            }));

            return { success: true };
        } catch (error) {
            console.error("Error updating customer:", error);
            return { success: false, error };
        }
    };

    const deleteCustomer = async (id) => {
        try {
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setCustomers(prev => prev.filter(cust => cust.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting customer:", error);
            return { success: false, error };
        }
    };

    // --- Loyalty Points Management ---

    const adjustCustomerPoints = async (customerId, amount, reason, type = 'deduction') => {
        if (!activeStoreId || !user) {
            return { success: false, error: 'No active store or user' };
        }

        if (user.role !== 'admin' && user.role !== 'owner' && user.role !== 'super_admin') {
            return { success: false, error: 'Insufficient permissions' };
        }

        if (amount === 0) {
            return { success: false, error: 'Amount cannot be zero' };
        }

        if (!reason || reason.trim() === '') {
            return { success: false, error: 'Reason is required' };
        }

        try {
            // Get current customer data
            const { data: customerData, error: fetchError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();

            if (fetchError || !customerData) {
                return { success: false, error: 'Customer not found' };
            }

            const previousBalance = customerData.loyalty_points || 0;
            const newBalance = Math.max(0, previousBalance + amount);

            // Update customer points
            const { error: updateError } = await supabase
                .from('customers')
                .update({ loyalty_points: newBalance })
                .eq('id', customerId);

            if (updateError) throw updateError;

            // Create adjustment record
            await supabase.from('point_adjustments').insert({
                customer_id: customerId,
                customer_name: customerData.name,
                store_id: activeStoreId,
                type,
                amount,
                reason: reason.trim(),
                performed_by: user.id || null,
                performed_by_name: user.name || user.email || 'Unknown',
                date: new Date().toISOString(),
                previous_balance: previousBalance,
                new_balance: newBalance
            });

            // Optimistic update
            setCustomers(prev => prev.map(cust =>
                cust.id === customerId
                    ? { ...cust, loyaltyPoints: newBalance, loyalty_points: newBalance } // Update both for safety, but primary is camelCase
                    : cust
            ));

            return { success: true, newBalance };
        } catch (error) {
            console.error("Error adjusting customer points:", error);
            return { success: false, error };
        }
    };

    /**
     * Get point adjustment history for a customer
     * @param {string} customerId - Customer ID
     * @param {number} limitCount - Number of records to fetch (default 100)
     */
    const getPointAdjustmentHistory = async (customerId, limitCount = 100) => {
        if (!activeStoreId) {
            return { success: false, error: 'No active store', data: [] };
        }

        try {
            const { data: history, error } = await supabase
                .from('point_adjustments')
                .select('*')
                .eq('customer_id', customerId)
                .eq('store_id', activeStoreId)
                .order('date', { ascending: false })
                .limit(limitCount);

            if (error) throw error;

            return { success: true, data: history };
        } catch (error) {
            console.error("Error fetching point adjustment history:", error);
            return { success: false, error, data: [] };
        }
    };

    /**
     * Check and reset expired points if expiry date has passed
     */

    // --- Advanced Stock Management (FIFO) ---

    const addStockBatch = async (productId, qty, buyPrice, sellPrice, note = '') => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const { data, error } = await supabase.rpc('add_stock_batch', {
                p_store_id: activeStoreId,
                p_product_id: productId,
                p_qty: qty,
                p_buy_price: buyPrice,
                p_sell_price: sellPrice || 0,
                p_note: note
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            const batchId = data.batch_id;

            // Optimistic Updates
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return {
                        ...p,
                        stock: (p.stock || 0) + qty,
                        buy_price: buyPrice,
                        sell_price: sellPrice && sellPrice > 0 ? sellPrice : p.sell_price
                    };
                }
                return p;
            }));

            const newMovement = {
                id: 'temp-' + Date.now(),
                store_id: activeStoreId,
                product_id: productId,
                type: 'in',
                qty: qty,
                date: new Date().toISOString(),
                note: note || 'Stok Masuk (Batch)',
                ref_id: batchId
            };
            setStockMovements(prev => [newMovement, ...prev]);

            return { success: true };
        } catch (error) {
            console.error("Error adding stock batch:", error);
            return { success: false, error: error.message };
        }
    };

    const processSale = async (transactionData) => {
        if (!activeStoreId) {
            console.error("Process Sale Failed: No active store selected.");
            return { success: false, error: "No active store selected" };
        }
        try {
            // Prepare items for RPC (mapping fields if necessary)
            const rpcItems = transactionData.items.map(item => ({
                id: item.id,
                qty: item.qty,
                name: item.name,
                price: item.price,
                buy_price: item.buyPrice || item.buy_price || 0, // Map to snake_case for RPC
            }));

            // Call Supabase RPC
            const { data, error } = await supabase.rpc('process_sale', {
                p_store_id: activeStoreId,
                p_customer_id: transactionData.customerId || null,
                p_total: transactionData.total,
                p_discount: transactionData.discount || 0,
                p_subtotal: transactionData.subtotal || null,
                p_payment_method: transactionData.paymentMethod,
                p_items: rpcItems,
                p_amount_paid: transactionData.cashAmount || transactionData.amount_paid || 0,
                p_change: transactionData.change || 0,
                p_type: transactionData.type || 'sale',
                p_rental_session_id: transactionData.rental_session_id || null,
                p_points_earned: transactionData.pointsEarned || 0,
                p_date: transactionData.date || new Date().toISOString()
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            const numericId = data.transaction_id;

            // Optimistic Updates
            setProducts(prev => prev.map(p => {
                const soldItem = transactionData.items.find(item => item.id === p.id);
                if (soldItem) {
                    return { ...p, stock: (p.stock || 0) - soldItem.qty };
                }
                return p;
            }));

            const newTransaction = {
                id: numericId,
                ...transactionData,
                store_id: activeStoreId,
                date: transactionData.date || new Date().toISOString(),
                status: 'completed'
            };
            setTransactions(prev => [newTransaction, ...prev]);

            const newMovements = transactionData.items.map(item => ({
                id: 'temp-' + Date.now() + '-' + item.id,
                store_id: activeStoreId,
                product_id: item.id,
                type: 'sale',
                qty: -item.qty,
                date: new Date().toISOString(),
                note: 'Penjualan #' + numericId.slice(-6),
                ref_id: numericId
            }));
            setStockMovements(prev => [...newMovements, ...prev]);

            if (transactionData.customerId) {
                setCustomers(prev => prev.map(c => {
                    if (c.id === transactionData.customerId) {
                        const newDebt = transactionData.paymentMethod === 'debt'
                            ? (c.debt || 0) + transactionData.total
                            : (c.debt || 0);
                        return {
                            ...c,
                            total_spent: (c.total_spent || 0) + transactionData.total,
                            // Use mapped camelCase or fallback to snake_case if mixed
                            loyaltyPoints: (c.loyaltyPoints || c.loyalty_points || 0) + (transactionData.pointsEarned || 0),
                            // Also update snake_case for consistency if needed by other parts, or just use camelCase
                            loyalty_points: (c.loyaltyPoints || c.loyalty_points || 0) + (transactionData.pointsEarned || 0),
                            debt: newDebt
                        };
                    }
                    return c;
                }));
            }

            return { success: true, id: numericId, transactionId: numericId, transaction: newTransaction };
        } catch (error) {
            console.error("Error processing sale:", error);
            return { success: false, error: error.message || error };
        }
    };

    const voidTransaction = async (transactionId, reason) => {
        if (!activeStoreId) return;

        // Permission Check
        if (!checkPermission('transactions.void')) {
            return { success: false, error: "Anda tidak memiliki izin untuk membatalkan transaksi." };
        }
        try {
            // Get transaction data first to update optimistic state
            const { data: transactionData, error: fetchError } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', transactionId)
                .single();

            if (fetchError || !transactionData) {
                throw new Error("Transaksi tidak ditemukan");
            }

            if (transactionData.status === 'void') {
                throw new Error("Transaksi sudah dibatalkan sebelumnya");
            }

            // Call Supabase RPC
            const { data, error: rpcError } = await supabase.rpc('void_transaction', {
                p_store_id: activeStoreId,
                p_transaction_id: transactionId,
                p_reason: reason,
                p_void_by: user.name
            });

            if (rpcError) throw rpcError;
            if (data && data.success === false) throw new Error(data.error);

            // Optimistic Updates
            setTransactions(prev => prev.map(t =>
                t.id === transactionId ? { ...t, status: 'void', void_reason: reason } : t
            ));

            setProducts(prev => prev.map(p => {
                const item = transactionData.items.find(i => i.id === p.id);
                if (item && p.type !== 'service') {
                    return { ...p, stock: (p.stock || 0) + item.qty };
                }
                return p;
            }));

            if (transactionData.customer_id) {
                setCustomers(prev => prev.map(c => {
                    if (c.id === transactionData.customer_id) {
                        const updates = {
                            total_spent: Math.max(0, (c.total_spent || 0) - transactionData.total)
                        };

                        if (transactionData.points_earned > 0) {
                            const newPoints = Math.max(0, (c.loyalty_points || 0) - transactionData.points_earned);
                            updates.loyalty_points = newPoints;
                        }

                        if (transactionData.payment_method === 'debt') {
                            updates.debt = (c.debt || 0) - transactionData.total;
                        }

                        return { ...c, ...updates };
                    }
                    return c;
                }));
            }

            return { success: true };
        } catch (error) {
            console.error("Error voiding transaction:", error);
            return { success: false, error: error.message };
        }
    };

    const processDebtPayment = async (customerId, amount, paymentMethod) => {
        if (!activeStoreId) return;
        try {
            const { data, error } = await supabase.rpc('process_debt_payment', {
                p_store_id: activeStoreId,
                p_customer_id: customerId,
                p_amount: amount,
                p_payment_method: paymentMethod
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            const numericId = data.transaction_id;

            // Optimistic Updates
            setTransactions(prev => [{
                id: numericId,
                store_id: activeStoreId,
                customer_id: customerId,
                type: 'debt_payment',
                total: amount,
                payment_method: paymentMethod,
                date: new Date().toISOString(),
                status: 'completed',
                items: []
            }, ...prev]);

            setCustomers(prev => prev.map(c =>
                c.id === customerId ? { ...c, debt: (c.debt || 0) - amount } : c
            ));

            return { success: true };
        } catch (error) {
            console.error("Error processing debt payment:", error);
            return { success: false, error: error.message };
        }
    };

    // --- Supplier Management ---
    const addSupplier = async (supplierData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .insert({
                    ...supplierData,
                    store_id: activeStoreId
                })
                .select()
                .single();

            if (error) throw error;

            // Optimistic update
            setSuppliers(prev => [...prev, data]);
            return { success: true, id: data.id };
        } catch (error) {
            console.error("Error adding supplier:", error);
            return { success: false, error: error.message };
        }
    };

    const updateSupplier = async (id, data) => {
        try {
            const { error } = await supabase
                .from('suppliers')
                .update(data)
                .eq('id', id);

            if (error) throw error;

            setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
            return { success: true };
        } catch (error) {
            console.error("Error updating supplier:", error);
            return { success: false, error: error.message };
        }
    };

    const deleteSupplier = async (id) => {
        try {
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setSuppliers(prev => prev.filter(s => s.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting supplier:", error);
            return { success: false, error: error.message };
        }
    };

    // --- Purchase Order Management ---
    const addPurchaseOrder = async (poData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const { data, error } = await supabase
                .from('purchase_orders')
                .insert({
                    ...poData,
                    store_id: activeStoreId
                })
                .select()
                .single();

            if (error) throw error;

            setPurchaseOrders(prev => [data, ...prev]);
            return { success: true, id: data.id };
        } catch (error) {
            console.error("Error adding PO:", error);
            return { success: false, error: error.message };
        }
    };

    const updatePurchaseOrder = async (id, data) => {
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .update(data)
                .eq('id', id);

            if (error) throw error;

            setPurchaseOrders(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
            return { success: true };
        } catch (error) {
            console.error("Error updating PO:", error);
            return { success: false, error: error.message };
        }
    };

    const deletePurchaseOrder = async (id) => {
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setPurchaseOrders(prev => prev.map(p => p.id === id ? { ...p, isDeleted: true } : p));
            return { success: true };
        } catch (error) {
            console.error("Error deleting PO:", error);
            return { success: false, error: error.message };
        }
    };

    const receivePurchaseOrder = async (poId, items, poUpdates = {}) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const { data, error } = await supabase.rpc('receive_purchase_order', {
                p_store_id: activeStoreId,
                p_po_id: poId,
                p_items: items,
                p_po_updates: poUpdates
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            // Fetch updated data to reflect stock changes widely
            await fetchData();

            return { success: true };
        } catch (error) {
            console.error("Error receiving PO:", error);
            return { success: false, error: error.message };
        }
    };


    const bulkAddProducts = async (newProducts) => {
        if (!activeStoreId) return;
        try {
            const storePlan = currentStore?.plan || 'free';
            const limits = PLAN_LIMITS[storePlan] || PLAN_LIMITS.free;

            if (limits.maxProducts !== Infinity && (products.length + newProducts.length) > limits.maxProducts) {
                return {
                    success: false,
                    error: 'Cannot add ' + newProducts.length + ' products. Plan limit is ' + limits.maxProducts + '. Current: ' + products.length
                };
            }

            let addedCount = 0;
            let skippedCount = 0;
            let newCategoriesCount = 0;

            // Process each product
            for (const prod of newProducts) {
                // Skip if no name
                if (!prod.name) {
                    skippedCount++;
                    continue;
                }

                // Check duplicate barcode
                if (prod.barcode) {
                    const { data: existing } = await supabase
                        .from('products')
                        .select('id')
                        .eq('store_id', activeStoreId)
                        .eq('barcode', prod.barcode)
                        .eq('is_deleted', false)
                        .maybeSingle();

                    if (existing) {
                        skippedCount++;
                        continue;
                    }
                }

                // Handle category
                let categoryId = null;
                if (prod.category && prod.category !== 'Uncategorized') {
                    const { data: existingCat } = await supabase
                        .from('categories')
                        .select('id')
                        .eq('store_id', activeStoreId)
                        .ilike('name', prod.category)
                        .maybeSingle();

                    if (existingCat) {
                        categoryId = existingCat.id;
                    } else {
                        const { data: newCat } = await supabase
                            .from('categories')
                            .insert({ store_id: activeStoreId, name: prod.category })
                            .select('id')
                            .single();

                        if (newCat) {
                            categoryId = newCat.id;
                            newCategoriesCount++;
                        }
                    }
                }

                // Insert product with snake_case mapping
                const { error } = await supabase
                    .from('products')
                    .insert({
                        store_id: activeStoreId,
                        category_id: categoryId,
                        name: prod.name,
                        barcode: prod.barcode || null,
                        buy_price: prod.buyPrice || 0,
                        sell_price: prod.sellPrice || prod.price || 0,
                        stock: prod.stock || 0,
                        unit: prod.unit || 'pcs',
                        min_stock: prod.minStock || 0,
                        type: prod.type || 'product',
                        discount: prod.discount || 0,
                        discount_type: prod.discountType || 'percent',
                        is_deleted: false
                    });

                if (!error) {
                    addedCount++;
                } else {
                    console.error('Insert error for', prod.name, ':', error.message);
                    skippedCount++;
                }
            }

            if (addedCount > 0) {
                await fetchData();
            }

            return {
                success: true,
                count: addedCount,
                skipped: skippedCount,
                newCategories: newCategoriesCount
            };
        } catch (error) {
            console.error("Error bulk adding products:", error);
            return { success: false, error: error.message };
        }
    };

    /**
     * Bulk update stock for existing products based on barcode
     * @param {Array} stockUpdates - Array of objects { barcode, qty, buyPrice, sellPrice, note }
     */
    const bulkUpdateStock = async (stockUpdates) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };

        try {
            const { data, error } = await supabase.rpc('bulk_update_stock', {
                p_store_id: activeStoreId,
                p_updates: stockUpdates
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            if (data.success_count > 0) {
                await fetchData();
            }

            return {
                success: true,
                count: data.success_count,
                notFound: data.not_found_count
            };
        } catch (error) {
            console.error("Error bulk updating stock:", error);
            return { success: false, error: error.message };
        }
    };

    const adjustStock = async (productId, qtyChange, type, note) => {
        if (!activeStoreId) return;
        try {
            const { data, error } = await supabase.rpc('adjust_stock', {
                p_store_id: activeStoreId,
                p_product_id: productId,
                p_qty_change: qtyChange,
                p_type: type,
                p_note: note || 'Manual Adjustment'
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            // Optimistic update
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return { ...p, stock: (p.stock || 0) + qtyChange };
                }
                return p;
            }));

            const newMovement = {
                id: 'temp-' + Date.now(),
                store_id: activeStoreId,
                product_id: productId,
                type: type,
                qty: qtyChange,
                date: new Date().toISOString(),
                note: note || 'Manual Adjustment',
                ref_id: null
            };
            setStockMovements(prev => [newMovement, ...prev]);

            return { success: true };
        } catch (error) {
            console.error("Error adjusting stock:", error);
            return { success: false, error: error.message };
        }
    };

    const reduceStockFIFO = async (productId, qty, note) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const { data, error } = await supabase.rpc('reduce_stock_fifo', {
                p_store_id: activeStoreId,
                p_product_id: productId,
                p_qty: qty,
                p_note: note || 'Pengurangan Stok (FIFO)'
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            const totalCOGS = data.cogs;

            // Optimistic update
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return { ...p, stock: (p.stock || 0) - qty };
                }
                return p;
            }));

            const newMovement = {
                id: 'temp-' + Date.now(),
                store_id: activeStoreId,
                product_id: productId,
                type: 'out',
                qty: -qty,
                date: new Date().toISOString(),
                note: note || 'Pengurangan Stok (FIFO)',
                ref_id: null
            };
            setStockMovements(prev => [newMovement, ...prev]);

            return { success: true, cogs: totalCOGS };
        } catch (error) {
            console.error("Error reducing stock:", error);
            return { success: false, error: error.message };
        }
    };

    // --- Sales Targets Management ---

    const addSalesTarget = async (targetData) => {
        if (!activeStoreId) return;
        try {
            const { data, error } = await supabase
                .from('sales_targets')
                .insert({
                    ...targetData,
                    store_id: activeStoreId
                })
                .select()
                .single();

            if (error) throw error;

            // Optimistic update
            setSalesTargets(prev => [...prev, data]);
            return { success: true };
        } catch (error) {
            console.error("Error adding sales target:", error);
            return { success: false, error };
        }
    };

    const updateSalesTarget = async (id, data) => {
        try {
            const { error } = await supabase
                .from('sales_targets')
                .update(data)
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setSalesTargets(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
            return { success: true };
        } catch (error) {
            console.error("Error updating sales target:", error);
            return { success: false, error };
        }
    };

    const deleteSalesTarget = async (id) => {
        try {
            const { error } = await supabase
                .from('sales_targets')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setSalesTargets(prev => prev.filter(t => t.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting sales target:", error);
            return { success: false, error };
        }
    };

    const resetDatabase = async () => {
        if (!activeStoreId) return;
        try {
            const { data, error } = await supabase.rpc('reset_store_data', {
                p_store_id: activeStoreId
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            await fetchData();
            return { success: true };
        } catch (error) {
            console.error("Error resetting database:", error);
            return { success: false, error: error.message };
        }
    };

    // --- UTILS ---
    const recalculateProductStats = async () => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const { data, error } = await supabase.rpc('recalculate_product_stats', {
                p_store_id: activeStoreId
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            await fetchData(); // Refresh local state
            return { success: true };
        } catch (error) {
            console.error("Error recalculating product stats:", error);
            return { success: false, error: error.message };
        }
    };

    return (
        <DataContext.Provider value={{
            categories,
            products,
            transactions,
            stockMovements,
            fetchStockMovements,
            customers,
            stores,
            activeStoreId,
            currentStore,
            loading,
            promotions,
            refreshTransactions: () => fetchData(false),
            refreshProducts: () => fetchData(false),
            selectedStoreId,
            setSelectedStoreId,
            addStore,
            updateStore,
            deleteStore,
            updateStoreSettings,
            resetDatabase,
            suppliers, addSupplier, updateSupplier, deleteSupplier,
            purchaseOrders, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receivePurchaseOrder,
            voidTransaction,
            processRefund,
            processDebtPayment,
            addUser,
            fetchUsersByStore,
            plans,
            updatePlans,
            addCategory,
            updateCategory,
            deleteCategory,
            addProduct,
            updateProduct,
            deleteProduct,
            addTransaction,
            addCustomer,
            updateCustomer,
            deleteCustomer,
            adjustCustomerPoints,
            getPointAdjustmentHistory,
            checkAndResetExpiredPoints,
            addStockBatch,
            bulkUpdateStock,
            adjustStock,
            reduceStockFIFO,
            processSale,
            bulkAddProducts,
            refreshData: fetchData,
            checkPlanLimit,
            salesTargets,
            addSalesTarget,
            updateSalesTarget,
            deleteSalesTarget,
            lastFetchError,
            isOnline,
            storesLoading,
            recalculateProductStats,
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);
