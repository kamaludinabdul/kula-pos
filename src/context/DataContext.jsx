/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';
import { normalizePermissions } from '../utils/permissions';
import { checkPlanLimit, PLAN_LIMITS } from '../utils/planLimits';
import { offlineService } from '../services/offlineService';
import { PLANS } from '../utils/plans';

const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
    const { user, checkPermission } = useAuth();
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [stores, setStores] = useState([]);
    const [stockMovements, setStockMovements] = useState([]);
    const [salesTargets, setSalesTargets] = useState([]);
    const [promotions, setPromotions] = useState([]);

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

    // Debug active store logic
    useEffect(() => {
        if (user?.role === 'super_admin') {
            console.log("Super Admin Store Logic:", {
                userStoreId: user.store_id,
                selectedStoreId,
                activeStoreId,
                currentStoreName: currentStore?.name
            });
        }
    }, [user, selectedStoreId, activeStoreId, currentStore]);



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

    const updateStore = async (id, data) => {
        try {
            const { error } = await supabase
                .from('stores')
                .update(data)
                .eq('id', id);

            if (error) throw error;
            fetchData();
            return { success: true };
        } catch (error) {
            console.error("Error updating store:", error);
            return { success: false, error };
        }
    };

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
            const { error } = await supabase
                .from('stores')
                .update({ settings })
                .eq('id', activeStoreId);

            if (error) throw error;
            fetchData();
            return { success: true };
        } catch (error) {
            console.error("Error updating store settings:", error);
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
            setStockMovements(data);
            return data;
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

        if (shouldSetLoading) setLoading(true);
        try {
            console.log("Fetching data for user:", user?.email, "Role:", user?.role, "StoreId:", user?.storeId);
            // 1. Stores are now handled by onSnapshot useEffect below
            // This prevents stale data and ensures real-time updates for settings like 'enableDiscount'

            // 2. Fetch Operational Data
            // Only fetch operational data if we have an active store context

            if (activeStoreId) {
                setLastFetchError(null);

                // --- PHASE 1: INITIAL SNAPSHOT (Consolidated RPC) ---
                try {
                    const { data: snapshot, error: snapshotError } = await supabase.rpc('get_store_initial_snapshot', {
                        p_store_id: activeStoreId
                    });

                    if (!snapshotError && snapshot) {
                        if (snapshot.categories) setCategories(snapshot.categories);
                        // Optional: update current store if needed
                        // if (snapshot.store) setCurrentStore(snapshot.store);
                    }
                } catch (e) {
                    console.warn("Initial snapshot RPC failed, falling back to standard fetch:", e);
                }

                // Helper to safely fetch and log errors
                const safeFetchSupabase = async (tableName, setterFn, queryBuilder = (q) => q, processFn = (d) => d) => {
                    try {
                        let query = supabase.from(tableName).select('*').eq('store_id', activeStoreId);
                        query = queryBuilder(query);
                        const { data, error } = await query;
                        if (error) throw error;
                        const processed = processFn(data);
                        setterFn(processed);
                        return processed;
                    } catch (e) {
                        console.error(`Failed to fetch ${tableName}:`, e);
                        return [];
                    }
                };

                // --- PHASE 2: CRITICAL DATA (Unblocks UI) ---
                // Fetch Products (Categories potentially arrived in snapshot)
                const fetchedProducts = await (async () => {
                    try {
                        const { data, error } = await supabase
                            .from('products')
                            .select('*, categories(id, name)')
                            .eq('store_id', activeStoreId)
                            .eq('is_deleted', false)
                            .limit(2000);

                        if (error) throw error;

                        const processed = data.map(p => ({
                            ...p,
                            // Map snake_case to camelCase
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
                            price: p.sell_price,
                            category: p.categories?.name || null
                        }));
                        setProducts(processed);
                        return processed;
                    } catch (e) {
                        console.error('Failed to fetch products:', e);
                        return [];
                    }
                })();

                // UNBLOCK UI: Turn off loading indicator immediately after critical data
                if (shouldSetLoading) setLoading(false);

                // Update Offline Cache for critical data
                if (fetchedProducts?.length > 0) {
                    offlineService.cacheData(activeStoreId, fetchedProducts || [], categories || [], []);
                }

                // --- PHASE 2: BACKGROUND DATA (Silent Load) ---
                // Fetch secondary data like history, customers, reports
                Promise.all([
                    safeFetchSupabase('transactions', setTransactions, (q) => q.order('date', { ascending: false }).limit(50)),
                    safeFetchSupabase('customers', setCustomers, (q) => q.limit(2000)),
                    safeFetchSupabase('sales_targets', setSalesTargets),
                    safeFetchSupabase('suppliers', setSuppliers),
                    safeFetchSupabase('promotions', setPromotions, (q) => q.eq('is_active', true)),
                    safeFetchSupabase('purchase_orders', setPurchaseOrders, (q) => q.order('date', { ascending: false }).limit(100)),
                    fetchStockMovements()
                ]).catch(err => console.error("Background fetch error:", err));


                // Offline Cache is updated in Phase 1 and after background fetches if needed
                // (Customers, Transactions etc are usually too large for simple full-cache on every fetch)

            } else {
                // Reset data if no store selected (e.g. Super Admin dashboard view)
                setCategories([]);
                setProducts([]);
                setTransactions([]);
                setCustomers([]);
                setStockMovements([]);
                setSalesTargets([]);
            }
        } catch (error) {
            console.error("Failed to fetch data from Supabase:", error);
            setLastFetchError(error.message);

            // Fallback to Offline Cache
            if (activeStoreId) {
                console.log("Attempting to load from offline cache...");
                const cached = await offlineService.loadFromCache(activeStoreId);
                if (cached.products.length > 0) {
                    setProducts(cached.products);
                    setCategories(cached.categories);
                    setCustomers(cached.customers);
                    console.log("Loaded from offline cache:", cached.products.length, "products");
                }
            }
        } finally {
            setLoading(false);
        }
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

    // Real-time Store Subscription
    useEffect(() => {
        if (!user) {
            setStores([]);
            setStoresLoading(false);
            return;
        }

        const fetchStores = async () => {
            setStoresLoading(true);
            try {
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
                        petCareEnabled: s.pet_care_enabled,
                        telegramBotToken: s.telegram_bot_token,
                        telegramChatId: s.telegram_chat_id,
                        ownerName: s.owner_name,
                        ownerId: s.owner_id,
                        createdAt: s.created_at,
                        permissions: normalizePermissions(s.settings?.permissions)
                    })));
                }
            } catch (err) {
                console.error("Store fetch error:", err);
            } finally {
                setStoresLoading(false);
            }
        };

        fetchStores();

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
                            petCareEnabled: newRow.pet_care_enabled,
                            telegramBotToken: newRow.telegram_bot_token,
                            telegramChatId: newRow.telegram_chat_id,
                            ownerName: newRow.owner_name,
                            ownerId: newRow.owner_id,
                            createdAt: newRow.created_at,
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

    }, [user, activeStoreId]);

    // Real-time Products Subscription
    useEffect(() => {
        if (!user || !activeStoreId) return;

        const channel = supabase.channel('products-realtime')
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
            supabase.removeChannel(channel);
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
                });

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
                image: product.image,
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
            return { success: false, error };
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
                rack_location: rawData.rackLocation ?? rawData.rack_location,
                image: rawData.image,
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
            return { success: false, error };
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

            // Optimistic update
            setCustomers(prev => {
                if (prev.some(c => c.id === data.id)) {
                    return prev.map(c => c.id === data.id ? data : c);
                }
                return [...prev, data];
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
            setCustomers(prev => prev.map(cust => cust.id === id ? { ...cust, ...data } : cust));

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
                    ? { ...cust, loyalty_points: newBalance }
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
    const checkAndResetExpiredPoints = async () => {
        if (!activeStoreId || !currentStore) {
            return { success: false, error: 'No active store' };
        }

        const loyaltySettings = currentStore.loyalty_settings || currentStore.loyaltySettings || {};

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
            setCustomers(prev => prev.map(c =>
                c.store_id === activeStoreId ? { ...c, loyalty_points: 0 } : c
            ));

            // Update store settings with last reset date
            await supabase.from('stores').update({
                settings: {
                    ...currentStore.settings,
                    loyaltySettings: {
                        ...loyaltySettings,
                        lastResetDate: new Date().toISOString()
                    }
                }
            }).eq('id', activeStoreId);

            // Refresh data
            await fetchData();

            return {
                success: true,
                message: `Reset ${customersWithPoints.length} customers' points`,
                adjustments: results
            };
        } catch (error) {
            console.error("Error resetting expired points:", error);
            return { success: false, error };
        }
    };

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
                buyPrice: item.buyPrice || item.buy_price || 0
            }));

            // Call Supabase RPC
            const { data, error } = await supabase.rpc('process_sale', {
                p_store_id: activeStoreId,
                p_customer_id: transactionData.customerId || null,
                p_total: transactionData.total,
                p_discount: transactionData.discount || 0,
                p_payment_method: transactionData.paymentMethod,
                p_items: rpcItems,
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
                            loyalty_points: (c.loyalty_points || 0) + (transactionData.pointsEarned || 0),
                            debt: newDebt
                        };
                    }
                    return c;
                }));
            }

            return { success: true, id: numericId, transactionId: numericId };
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
