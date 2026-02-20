/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';
import { normalizePermissions } from '../utils/permissions';
import { checkPlanLimit, PLAN_LIMITS } from '../utils/planLimits';
import { offlineService } from '../services/offlineService';
import { PLANS } from '../utils/plans';
import { safeSupabaseQuery, safeSupabaseRpc } from '../utils/supabaseHelper';

const DataContext = createContext(null);

const safeFetchSupabase = async (options) => {
    const { activeStoreId, tableName, setterFn, queryBuilder, processFn } = options || {};

    if (!tableName || !setterFn) {
        console.error("safeFetchSupabase: missing required options", { tableName, hasSetter: !!setterFn });
        return [];
    }

    try {
        const data = await safeSupabaseQuery({
            tableName,
            queryBuilder: (q) => {
                let baseQuery = q;
                // If customStoreFilter is provided, use it (e.g. for shared customers)
                // Otherwise use the default single activeStoreId filter
                if (options.customStoreFilter) {
                    baseQuery = options.customStoreFilter(baseQuery);
                } else if (activeStoreId) {
                    baseQuery = q.eq('store_id', activeStoreId);
                }

                if (queryBuilder && typeof queryBuilder === 'function') {
                    baseQuery = queryBuilder(baseQuery);
                }
                return baseQuery;
            },
            processFn,
            fallbackParams: options.customStoreFilter ? null : `?store_id=eq.${activeStoreId}&select=*`
        });

        if (setterFn && data) {
            setterFn(data);
        }
        return data || [];
    } catch (e) {
        console.error(`Failed to fetch ${tableName}:`, e);
        return [];
    }
};

export const DataProvider = ({ children }) => {
    // Debug log to verify if the latest code is running
    useEffect(() => {
        console.log("DataContext: v0.13.2 (" + new Date().toLocaleTimeString() + ")");
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
    const fetchingStoreIdRef = useRef(null);
    // latestActiveStoreId moved down


    const [suppliers, setSuppliers] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [plans, setPlans] = useState(PLANS);
    const [loading, setLoading] = useState(true);
    const [storesLoading, setStoresLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [summary, setSummary] = useState({ totalProducts: 0, totalStock: 0, totalValue: 0 });
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
    const activeStoreId = ((user?.role === 'super_admin' || user?.role === 'owner') && selectedStoreId)
        ? selectedStoreId
        : user?.store_id;
    const currentStore = stores.find(s => s.id === activeStoreId) || null;

    const latestActiveStoreId = useRef(activeStoreId);
    useEffect(() => {
        latestActiveStoreId.current = activeStoreId;
    }, [activeStoreId]);

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




    const fetchStores = useCallback(async (isSilent = false) => {
        if (!user) {
            setStores([]);
            setStoresLoading(false);
            return;
        }
        if (!isSilent) setStoresLoading(true);
        console.log("DataContext: fetchStores (v2)...");
        try {
            let query = supabase
                .from('stores')
                .select(`
                    *,
                    owner:profiles!stores_owner_id_fkey (
                        id, name, email, plan, plan_expiry_date
                    )
                `);

            if (user.role !== 'super_admin') {
                // Determine effective store IDs for the user
                // 1. Stores they own
                // 2. Stores they are staff in (found via profiles.store_id) - handled by AuthContext but here we fetch list

                // For 'owner', they see all stores where owner_id = user.id
                if (user.role === 'owner') {
                    query = query.eq('owner_id', user.id);
                } else {
                    // Staff usually only sees their assigned store data, handled by RLS mostly.
                    // But if we want to be explicit:
                    query = query.eq('id', user.store_id);
                }
            } else {
                // Super Admin sees ALL stores, ordered by created_at desc
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data) {
                setStores(data.map(s => {
                    // Handle join data that might be an array or null
                    const profileData = Array.isArray(s.owner)
                        ? (s.owner.find(p => p.id === s.owner_id) || s.owner[0])
                        : s.owner;

                    const hasProfile = !!profileData;

                    // Plan Logic: Prioritize highest plan found in either profile or store
                    const pPlan = profileData?.plan || 'free';
                    const sPlan = s.plan || 'free';
                    const effectivePlan = (pPlan === 'enterprise' || sPlan === 'enterprise')
                        ? 'enterprise'
                        : (pPlan === 'pro' || sPlan === 'pro')
                            ? 'pro'
                            : 'free';

                    return {
                        ...s,
                        // Map snake_case to camelCase for frontend compatibility
                        planExpiryDate: s.plan_expiry_date || profileData?.plan_expiry_date,
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

                        // Owner data mapping (robust)
                        ownerName: profileData?.name || s.owner_name || 'Owner',
                        ownerEmail: profileData?.email || s.email || '-',
                        ownerPlan: effectivePlan,
                        plan: effectivePlan, // Overwrite with effective plan for app-wide consistency
                        ownerId: s.owner_id,
                        hasProfile: hasProfile,

                        createdAt: s.created_at,

                        // Feature flags based on effective plan
                        isEnterprise: effectivePlan === 'enterprise',
                        isPro: effectivePlan === 'pro' || effectivePlan === 'enterprise',

                        // Extract settings for easier access
                        loyaltySettings: s.settings?.loyaltySettings,
                        printerPaperSize: s.settings?.printerPaperSize,
                        printerChunkSize: s.settings?.printerChunkSize,
                        printerChunkDelay: s.settings?.printerChunkDelay,
                        printLogo: s.settings?.printLogo !== undefined ? s.settings.printLogo : true, // Default to true

                        // --- Device Specific Settings (LocalStorage Override) ---
                        // These should be device-specific, not store-wide.
                        // Check local first, fallback to DB setting.
                        printerType: localStorage.getItem(`printerType_${s.id}`) || s.settings?.printerType || 'bluetooth',
                        printerWidth: localStorage.getItem(`printerWidth_${s.id}`) || s.settings?.printerWidth || '58mm',
                        receiptHeader: localStorage.getItem(`receiptHeader_${s.id}`) || s.settings?.receiptHeader || '',
                        receiptFooter: localStorage.getItem(`receiptFooter_${s.id}`) || s.settings?.receiptFooter || '',
                        autoPrintReceipt: localStorage.getItem(`autoPrint_${s.id}`) !== null
                            ? localStorage.getItem(`autoPrint_${s.id}`) === 'true'
                            : (s.settings?.autoPrintReceipt || false)
                    };
                }));

                if (data.length > 0 && !isSilent) {
                    console.log("DataContext: fetchStores SUCCESS. Sample:", {
                        id: data[0].id,
                        name: data[0].name,
                        ownerJoin: data[0].owner,
                        mappedOwnerPlan: (Array.isArray(data[0].owner) ? data[0].owner[0]?.plan : data[0].owner?.plan) || data[0].plan
                    });
                }
            }
        } catch (err) {
            console.error("Store fetch exception:", err);
        } finally {
            if (!isSilent) setStoresLoading(false);
        }
    }, [user]);

    const addStore = async (storeData) => {
        try {
            // Check store limits for non-super_admin (Per-Owner Limit)
            if (user?.role !== 'super_admin') {
                const ownerStores = stores.filter(s => s.owner_id === user?.id);

                const userPlan = user?.plan || 'free';
                // Use dynamic plan limits if available, otherwise fallback
                const maxStores = plans[userPlan]?.maxStores || PLANS[userPlan]?.maxStores || 1;

                if (ownerStores.length >= maxStores) {
                    return {
                        success: false,
                        error: `Limit toko tercapai (${ownerStores.length}/${maxStores}). Upgrade plan untuk menambah toko.`
                    };
                }
            }

            const { data, error } = await supabase
                .from('stores')
                .insert({
                    ...storeData,
                    owner_id: storeData.owner_id || user?.id // Allow override for Super Admin
                })
                .select()
                .single();

            if (error) throw error;
            fetchStores(true); // Re-fetch store list silently
            fetchData();
            return { success: true, id: data.id };
        } catch (error) {
            console.error("Error adding store:", error);
            return { success: false, error: error.message || error };
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

            // Logo - allow empty string to clear it
            if (typeof updates.logo !== 'undefined') dbUpdates.logo = updates.logo;

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

            // Geo location
            if (updates.latitude) dbUpdates.latitude = updates.latitude;
            if (updates.longitude) dbUpdates.longitude = updates.longitude;
            if (updates.email) dbUpdates.email = updates.email;

            // Handle nested JSON settings (like loyalty)
            // Note: This is a shallow merge for 'settings' column. 
            // In a real app, you might want deeper merging or dedicated JSONB patching.
            if (
                updates.loyaltySettings ||
                updates.shiftOpenTime ||
                updates.shiftCloseTime ||
                updates.lastShiftOpenReminderDate ||
                updates.lastShiftCloseReminderDate ||
                // Printer Settings
                updates.printerType ||
                updates.printerWidth ||
                updates.receiptHeader ||
                updates.receiptFooter ||
                typeof updates.autoPrintReceipt !== 'undefined' ||
                typeof updates.printerChunkSize !== 'undefined' ||
                typeof updates.printerChunkDelay !== 'undefined'
            ) {
                // Fetch current settings first to merge
                const { data: currentMeta } = await supabase.from('stores').select('settings').eq('id', id).single();
                const currentSettings = currentMeta?.settings || {};

                dbUpdates.settings = {
                    ...currentSettings,
                    ...(updates.loyaltySettings ? { loyaltySettings: updates.loyaltySettings } : {}),
                    ...(updates.printerType ? { printerType: updates.printerType } : {}),
                    ...(updates.printerWidth ? { printerWidth: updates.printerWidth } : {}),
                    ...(updates.receiptHeader ? { receiptHeader: updates.receiptHeader } : {}),
                    ...(updates.receiptFooter ? { receiptFooter: updates.receiptFooter } : {}),
                    ...(typeof updates.autoPrintReceipt !== 'undefined' ? { autoPrintReceipt: updates.autoPrintReceipt } : {}),
                    ...(typeof updates.printerChunkSize !== 'undefined' ? { printerChunkSize: updates.printerChunkSize } : {}),
                    ...(typeof updates.printerChunkDelay !== 'undefined' ? { printerChunkDelay: updates.printerChunkDelay } : {}),
                    ...(typeof updates.printLogo !== 'undefined' ? { printLogo: updates.printLogo } : {}),
                };
            }

            // Direct column updates take precedence
            const { error } = await supabase
                .from('stores')
                .update(dbUpdates)
                .eq('id', id);

            if (error) throw error;

            fetchStores(true); // Re-fetch store list silently

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
            console.error("Error updating store (DataContext):", error);
            // Log full error object for PWA debugging
            console.log("Full Update Error Details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
            setStoresLoading(false);
            return { success: false, error: error.message || 'Database update failed' };
        } finally {
            setStoresLoading(false);
            setStoresLoading(false);
        }
    }, [user, fetchStores]);

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
            fetchStores(true); // Re-fetch store list silently
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



    const fetchAllProducts = useCallback(async (storeId = activeStoreId) => {
        if (!storeId) return [];
        const phase2Start = performance.now();
        try {
            console.log("DataContext: Fetching ALL products for POS/Cache...");

            const processed = await safeSupabaseQuery({
                tableName: 'products',
                queryBuilder: (q) => q.select('*, categories(id, name)')
                    .eq('store_id', storeId)
                    .eq('is_deleted', false)
                    .limit(2000),
                timeout: 20000,
                fallbackParams: `?store_id=eq.${storeId}&is_deleted=eq.false&select=*,categories(id,name)`,
                processFn: (data) => (data || []).map(p => ({
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
                    isWholesale: p.is_wholesale,
                    price: p.sell_price,
                    category: p.categories?.name || null
                }))
            });

            // STALE CHECK: If the store changed while we were fetching products, discard this result
            if (storeId !== latestActiveStoreId.current) {
                console.log("DataContext: fetchAllProducts ignored stale result for store", storeId);
                return [];
            }

            setProducts(processed || []);
            console.log(`DataContext: fetchAllProducts took: ${((performance.now() - phase2Start) / 1000).toFixed(2)}s`);

            // Update cache
            offlineService.cacheData(storeId, processed || [], categories || [], []);

            return processed || [];
        } catch (e) {
            console.error('DataContext: Failed to fetch products:', e);
            return [];
        }
    }, [activeStoreId, categories]);

    // New RPC-based Pagination
    const fetchProductsPage = useCallback(async ({ page, pageSize, search = '', category = 'all', satuanPO = 'all', sortKey = 'name', sortDir = 'asc' }) => {
        if (!activeStoreId) return { data: [], total: 0 };

        try {
            const data = await safeSupabaseRpc({
                rpcName: 'get_products_page',
                params: {
                    p_store_id: activeStoreId,
                    p_page: page,
                    p_page_size: pageSize,
                    p_search: search,
                    p_category: category,
                    p_satuan_po: satuanPO,
                    p_sort_key: sortKey,
                    p_sort_dir: sortDir
                }
            });

            return data || { data: [], total: 0 };
        } catch (e) {
            console.error("DataContext: fetchProductsPage error:", e);
            throw e;
        }
    }, [activeStoreId]);

    const fetchData = useCallback(async (shouldSetLoading = false) => {
        if (!user) {
            setLoading(false);
            return;
        }

        if (isFetchingRef.current && fetchingStoreIdRef.current === activeStoreId) {
            console.log("DataContext: Fetch already in progress for this store, skipping redundant call");
            return;
        }

        // --- PHASE 10: Extended Settle Delay ---
        // We show a message and wait for the browser to stabilize
        if (shouldSetLoading) {
            setLoading(true);
            setLoadingMessage("Menyiapkan koneksi aman...");
        }

        // Lock needs to happen BEFORE the await to prevent double-entry
        // But we allow re-entry if storeId Changed.
        isFetchingRef.current = true;
        fetchingStoreIdRef.current = activeStoreId;

        await new Promise(r => setTimeout(r, 1000));

        // STALE CHECK 1: If store changed during wait, abort
        if (activeStoreId !== latestActiveStoreId.current) {
            console.log("DataContext: Aborting stale fetch (Pre-Settle)", activeStoreId, "vs", latestActiveStoreId.current);
            return;
        }

        if (shouldSetLoading) setLoadingMessage("Mengoptimalkan kecepatan data...");
        await new Promise(r => setTimeout(r, 2000));

        // STALE CHECK 2
        if (activeStoreId !== latestActiveStoreId.current) return;

        if (shouldSetLoading) setLoadingMessage("");

        // Removed the late setting of isFetchingRef here, moved up.

        if (shouldSetLoading) setLoading(true); // Only show loading for the very first critical part
        try {
            console.log("DataContext: Fetching data for user:", user?.email, "Role:", user?.role, "StoreId:", activeStoreId);

            if (activeStoreId) {
                setLastFetchError(null);

                // --- PHASE 1: INITIAL SNAPSHOT (CRITICAL - Awaited) ---
                const phase1Start = performance.now();
                try {
                    console.log("DataContext: Starting Phase 1 (Snapshot)...");

                    // STALE CHECK 3 (Pre-RPC)
                    if (activeStoreId !== latestActiveStoreId.current) return;

                    const snapshot = await safeSupabaseRpc({
                        rpcName: 'get_store_initial_snapshot',
                        params: { p_store_id: activeStoreId },
                        timeout: 15000
                    });

                    // STALE CHECK 4 (Post-RPC)
                    if (activeStoreId !== latestActiveStoreId.current) {
                        console.log("DataContext: Ignoring stale snapshot for", activeStoreId);
                        return;
                    }

                    if (snapshot) {
                        console.log("DataContext: Initial snapshot loaded successfully");
                        if (snapshot.categories && Array.isArray(snapshot.categories)) {
                            setCategories(snapshot.categories);
                        }
                        if (snapshot.summary) {
                            setSummary(snapshot.summary);
                        }
                    }
                } catch (e) {
                    console.warn("DataContext: Initial snapshot failed:", e);
                }
                console.log(`DataContext: Phase 1 (Snapshot) took: ${((performance.now() - phase1Start) / 1000).toFixed(2)}s`);

                // --- KEY CHANGE: Stop Loading Here ---
                // STALE CHECK: Only turn off loading if we are still on the same store
                if (shouldSetLoading && activeStoreId === latestActiveStoreId.current) setLoading(false);

                // --- PHASE 2: PRODUCTS (REMOVED FROM DEFAULT FETCH) ---
                // We no longer fetch all 2000 products by default.
                // Pages that need it (POS) must call fetchAllProducts().

                // --- PHASE 3: BACKGROUND DATA (Reports, History, Customers) ---
                console.log("DataContext: Starting Phase 3 (Background Data)...");
                const phase3Start = performance.now();
                Promise.all([
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
                    (currentStore?.settings?.enableSharedCustomers && user?.role === 'owner')
                        ? (async () => {
                            try {
                                const data = await safeSupabaseRpc({
                                    rpcName: 'get_shared_customers',
                                    params: { p_owner_id: user.id }
                                });
                                if (data) {
                                    const processed = data.map(c => ({
                                        ...c,
                                        loyaltyPoints: c.loyalty_points || 0,
                                        totalSpent: c.total_spent || 0,
                                        totalLifetimePoints: c.total_lifetime_points || 0
                                    }));
                                    setCustomers(processed);
                                    return processed;
                                }
                            } catch (e) {
                                console.error("Failed to fetch shared customers:", e);
                            }
                            return [];
                        })()
                        : safeFetchSupabase({
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
                ]).then(() => {
                    // Final verification that we finished for the correct store
                    if (activeStoreId === latestActiveStoreId.current) {
                        console.log("DataContext: Phase 3 finished for active store.");
                    }
                }).catch(err => console.error("DataContext: Phase 3 failed:", err));
                console.log(`DataContext: Phase 3 (Background) took: ${((performance.now() - phase3Start) / 1000).toFixed(2)}s`);


            } else {
                setCategories([]);
                setProducts([]);
                setTransactions([]);
                setCustomers([]);
                setStockMovements([]);
                setSalesTargets([]);
                // Also stop loading if no store
                if (shouldSetLoading) setLoading(false);
            }
        } catch (error) {
            console.error("DataContext: Failed to fetch data from Supabase:", error);
            setLastFetchError(error.message);

            // Fallback to Offline Cache (Products might need fetchAllProducts call now)
            // We can check local storage directly or just leave it empty until POS loads
            if (shouldSetLoading) setLoading(false);
        } finally {
            if (fetchingStoreIdRef.current === activeStoreId) {
                isFetchingRef.current = false;
                fetchingStoreIdRef.current = null;
            }
        }
    }, [user, activeStoreId, fetchStockMovements, currentStore?.settings?.enableSharedCustomers]);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const data = await safeSupabaseQuery({
                    tableName: 'subscription_plans',
                    queryBuilder: (q) => q.select('*'),
                    fallbackParams: ''
                });

                if (data) {
                    const plansMap = {};
                    data.forEach(p => {
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
            } catch (e) {
                console.error("DataContext: fetchPlans error:", e);
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

                            // Feature flags
                            isEnterprise: newRow.plan === 'enterprise',
                            isPro: newRow.plan === 'pro' || newRow.plan === 'enterprise',

                            // Owner data (Realtime payload doesn't have joins, use denormalized store columns)
                            ownerName: newRow.owner_name,
                            ownerId: newRow.owner_id,
                            ownerPlan: newRow.plan || 'free',
                            ownerEmail: newRow.email || '-',

                            createdAt: newRow.created_at,
                            loyaltySettings: newRow.settings?.loyaltySettings,
                            autoPrintReceipt: newRow.settings?.autoPrintReceipt,
                            printerType: newRow.settings?.printerType,
                            printerWidth: newRow.settings?.printerWidth,
                            receiptHeader: newRow.settings?.receiptHeader,
                            receiptFooter: newRow.settings?.receiptFooter,
                            permissions: normalizePermissions(newRow.settings?.permissions),
                            logo: newRow.logo || newRow.settings?.logo,
                            printerPaperSize: newRow.settings?.printerPaperSize
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
                        storeId: newRow.store_id,
                        isWholesale: newRow.is_wholesale
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
    // --- User Management ---
    const addUser = async (userData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            // 1. SECURITY CHECK: Prevent overriding staff from other stores
            // Using RPC to check profile status safely (Security Definer)
            const { data: checkData, error: checkError } = await supabase
                .rpc('check_staff_conflict', {
                    p_email: userData.email,
                    p_target_store_id: activeStoreId
                });

            if (checkError) {
                console.error("Staff conflict check failed:", checkError);
                // Proceed with caution or fail? Better to fail safe.
                return { success: false, error: "Gagal memverifikasi keamanan data staff." };
            }

            if (checkData && checkData.status === 'conflict') {
                return {
                    success: false,
                    error: `Username/Email ini sudah digunakan oleh toko lain (${checkData.current_store_name}). Gunakan username unik.`
                };
            }

            // 2. SAME STORE CHECK: Prevent accidental role downgrade or overwrite
            if (checkData && checkData.status === 'same_store') {
                // If attempting to ADD (no ID, meaning userData.id is undefined or null) but user exists -> Block to prevent overwrite
                if (!userData.id) {
                    return {
                        success: false,
                        error: `Staff ini sudah terdaftar di toko ini sebagai ${checkData.current_role}. Silakan EDIT data staff tersebut jika ingin mengubah role.`
                    };
                }
            }

            // 2. Upsert Profile (Safe to proceed)
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
            const storePlan = currentStore?.ownerPlan || 'free';
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
                is_wholesale: product.isWholesale || false,
                rack_location: product.shelf || product.rackLocation || null,
                weight: product.weight || 0,
                is_deleted: false
            };

            // Convert category name array to category_id
            if (!productData.category_id && product.category && Array.isArray(product.category) && product.category.length > 0) {
                const categoryName = product.category[0]; // Use first category
                const foundCategory = categories.find(c => c.name === categoryName);
                if (foundCategory) {
                    productData.category_id = foundCategory.id;
                }
            }

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
                is_wholesale: rawData.isWholesale ?? rawData.is_wholesale,
                category_id: rawData.categoryId ?? rawData.category_id
            };

            // Convert category name array to category_id
            if (!updateData.category_id && rawData.category && Array.isArray(rawData.category) && rawData.category.length > 0) {
                const categoryName = rawData.category[0]; // Use first category
                const foundCategory = categories.find(c => c.name === categoryName);
                if (foundCategory) {
                    updateData.category_id = foundCategory.id;
                }
            }

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
            // Include the resolved category info
            const optimisticData = { ...rawData };
            if (updateData.category_id) {
                optimisticData.categoryId = updateData.category_id;
                const foundCat = categories.find(c => c.id === updateData.category_id);
                if (foundCat) {
                    optimisticData.category = foundCat.name;
                }
            }
            setProducts(prev => prev.map(prod => prod.id === id ? { ...prod, ...optimisticData } : prod));

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

            // Map to snake_case for Supabase
            const newCustomer = {
                id: customerId,
                store_id: activeStoreId,
                name: customerData.name,
                phone: customerData.phone,
                email: customerData.email || null,
                address: customerData.address || null,
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

            // Optimistic update with camelCase mapping for consistency
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
            // Map to snake_case for Supabase
            const updateData = {};
            if (data.name !== undefined) updateData.name = data.name;
            if (data.phone !== undefined) updateData.phone = data.phone;
            if (data.email !== undefined) updateData.email = data.email === '' ? null : data.email;
            if (data.address !== undefined) updateData.address = data.address === '' ? null : data.address;

            // Handle loyalty points if passed (camelCase or snake_case)
            if (data.loyaltyPoints !== undefined) updateData.loyalty_points = data.loyaltyPoints;
            if (data.loyalty_points !== undefined) updateData.loyalty_points = data.loyalty_points;

            const { error } = await supabase
                .from('customers')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setCustomers(prev => prev.map(cust => {
                if (cust.id === id) {
                    return {
                        ...cust,
                        ...data,
                        // Ensure critical fields are mapped if passed in update data
                        loyaltyPoints: updateData.loyalty_points !== undefined ? updateData.loyalty_points : cust.loyaltyPoints,
                        loyalty_points: updateData.loyalty_points !== undefined ? updateData.loyalty_points : cust.loyalty_points
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
                discount: item.discount || 0 // Pass item-level discount
            }));

            // Prepare payment_details for snapshotting points and other meta
            const paymentDetailsSnapshot = {
                ...(transactionData.payment_details || {}),
                amount_paid: transactionData.cashAmount || transactionData.amount_paid || 0,
                change: transactionData.change || 0,
                points_earned: transactionData.pointsEarned || 0,
                customer_remaining_points: transactionData.customerTotalPoints || 0
            };

            // Call Supabase RPC
            const { data, error } = await supabase.rpc('process_sale', {
                p_store_id: activeStoreId,
                p_customer_id: transactionData.customerId || null,
                p_total: transactionData.total,
                p_discount: transactionData.discount || 0,
                p_subtotal: transactionData.subtotal || null,
                p_payment_method: transactionData.paymentMethod,
                p_items: rpcItems,
                p_amount_paid: paymentDetailsSnapshot.amount_paid,
                p_change: paymentDetailsSnapshot.change,
                p_type: transactionData.type || 'sale',
                p_rental_session_id: transactionData.rental_session_id || null,
                p_payment_details: paymentDetailsSnapshot, // Snapshot meta
                p_points_earned: transactionData.pointsEarned || 0,
                p_date: transactionData.date || new Date().toISOString(),
                p_shift_id: transactionData.shiftId || null,
                p_cashier_id: transactionData.cashierId || null,
                p_cashier_name: transactionData.cashier || null
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
                    if (c && c.id === transactionData.customerId) {
                        const newDebt = transactionData.paymentMethod === 'debt'
                            ? (c.debt || 0) + transactionData.total
                            : (c.debt || 0);
                        return {
                            ...c,
                            total_spent: (c.total_spent || 0) + transactionData.total,
                            // Use mapped camelCase or fallback to snake_case if mixed, with defensive checks
                            loyaltyPoints: (c.loyaltyPoints || c.loyalty_points || 0) + (transactionData.pointsEarned || 0),
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
            // Map camelCase to snake_case for Supabase
            const dbData = {
                store_id: activeStoreId,
                name: supplierData.name,
                contact_person: supplierData.contactPerson || supplierData.contact_person,
                phone: supplierData.phone,
                email: supplierData.email,
                address: supplierData.address,
                notes: supplierData.notes
            };

            const { data, error } = await supabase
                .from('suppliers')
                .insert(dbData)
                .select()
                .single();

            if (error) throw error;

            // Optimistic update (map back to camelCase for frontend state)
            const newSupplier = {
                ...data,
                contactPerson: data.contact_person,
                storeId: data.store_id
            };
            setSuppliers(prev => [newSupplier, ...prev]); // Prepend to show at top
            return { success: true, id: data.id };
        } catch (error) {
            console.error("Error adding supplier:", error);
            return { success: false, error: error.message };
        }
    };

    const updateSupplier = async (id, data) => {
        try {
            // Map camelCase to snake_case
            const dbUpdates = {};
            if (data.name) dbUpdates.name = data.name;
            if (data.contactPerson || data.contact_person) dbUpdates.contact_person = data.contactPerson || data.contact_person;
            if (data.phone) dbUpdates.phone = data.phone;
            if (data.email) dbUpdates.email = data.email;
            if (data.address) dbUpdates.address = data.address;
            if (data.notes) dbUpdates.notes = data.notes;

            const { error } = await supabase
                .from('suppliers')
                .update(dbUpdates)
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
            const storePlan = currentStore?.ownerPlan || 'free';
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

    const calculateItemPrice = useCallback((product, qty) => {
        if (!product || !product.pricingTiers || product.pricingTiers.length === 0) {
            return Number(product.sellPrice || 0);
        }

        const sortedTiers = [...product.pricingTiers].sort((a, b) => b.duration - a.duration);
        const basePrice = Number(product.sellPrice || 0);

        if (product.isWholesale) {
            // Strategy B: Wholesale (Threshold replacement)
            // If qty >= tier.duration, use that price for ALL units
            const activeTier = sortedTiers.find(t => qty >= t.duration);
            return activeTier ? Number(activeTier.price) : basePrice;
        } else {
            // Strategy A: Bundling (Greedy Sum / Step-wise)
            // Used for Rental packages or Retail Bundles
            let totalPrice = 0;
            let remaining = qty;

            for (const tier of sortedTiers) {
                while (remaining >= tier.duration) {
                    totalPrice += Number(tier.price);
                    remaining -= tier.duration;
                }
            }
            if (remaining > 0) {
                totalPrice += remaining * basePrice;
            }
            // Return average price PER UNIT for consistent cart handling
            return totalPrice / qty;
        }
    }, []);

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
            loadingMessage,
            promotions,
            refreshTransactions: () => fetchData(false),
            refreshProducts: () => fetchData(false),
            selectedStoreId,
            setSelectedStoreId,
            addStore,
            updateStore,
            deleteStore,
            fetchAllProducts,
            fetchProductsPage,
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
            summary,
            stats: summary,
            isOnline,
            storesLoading,
            recalculateProductStats,
            calculateItemPrice,
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);
