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
    const [pets, setPets] = useState([]);
    const [petRooms, setPetRooms] = useState([]);
    const [petBookings, setPetBookings] = useState([]);
    const [petServices, setPetServices] = useState([]);
    const [medicalRecords, setMedicalRecords] = useState([]);
    const [petDailyLogs, setPetDailyLogs] = useState([]);
    const [staff, setStaff] = useState([]);
    const isFetchingRef = useRef(false);
    const fetchingStoreIdRef = useRef(null);
    const lastFetchedProductsStoreIdRef = useRef(null);
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
    // SECURITY: Validate that selectedStoreId belongs to the current user
    // to prevent cross-store data leaks from stale localStorage values.
    const validatedSelectedStoreId = React.useMemo(() => {
        if (!selectedStoreId || !user) return null;
        // Super admin can access any store
        if (user.role === 'super_admin') return selectedStoreId;
        // For owners, verify the selected store is one they own
        if (user.role === 'owner' && stores.length > 0) {
            const ownsStore = stores.some(s => s.id === selectedStoreId);
            if (!ownsStore) {
                console.warn('DataContext: Clearing stale selectedStoreId - not owned by current user');
                localStorage.removeItem('superAdminSelectedStoreId');
                return null;
            }
        }
        return selectedStoreId;
    }, [selectedStoreId, user, stores]);

    const activeStoreId = ((user?.role === 'super_admin' || user?.role === 'owner') && validatedSelectedStoreId)
        ? validatedSelectedStoreId
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
                    const effectivePlan = (pPlan.includes('enterprise') || sPlan.includes('enterprise'))
                        ? 'enterprise'
                        : (pPlan.includes('pro') || sPlan.includes('pro'))
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
                        telegramNotifyShift: s.settings?.telegramNotifyShift,
                        telegramNotifyTransaction: s.settings?.telegramNotifyTransaction,
                        telegramNotifyLowStock: s.settings?.telegramNotifyLowStock,
                        telegramNotifyShiftReminder: s.settings?.telegramNotifyShiftReminder,
                        shiftOpenTime: s.settings?.shiftOpenTime || '08:00',
                        shiftCloseTime: s.settings?.shiftCloseTime || '22:00',
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

            // Map camelCase fields to snake_case for DB
            const dbStoreData = {
                name: storeData.name,
                address: storeData.address,
                phone: storeData.phone,
                email: storeData.email,
                plan: storeData.plan,
                plan_expiry_date: storeData.plan_expiry_date || storeData.planExpiryDate,
                telegram_bot_token: storeData.telegram_bot_token || storeData.telegramBotToken,
                telegram_chat_id: storeData.telegram_chat_id || storeData.telegramChatId,
                enable_sales_performance: storeData.enable_sales_performance || storeData.enableSalesPerformance || false,
                pet_care_enabled: storeData.pet_care_enabled || storeData.petCareEnabled || false,
                owner_id: storeData.owner_id || user?.id
            };

            const { data, error } = await supabase
                .from('stores')
                .insert(dbStoreData)
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
            if (typeof updates.petCareEnabled !== 'undefined') dbUpdates.pet_care_enabled = updates.petCareEnabled;
            if (typeof updates.pet_care_enabled !== 'undefined') dbUpdates.pet_care_enabled = updates.pet_care_enabled;

            // Values
            if (updates.discountPin) dbUpdates.discount_pin = updates.discountPin;
            if (updates.taxRate) dbUpdates.tax_rate = updates.taxRate;
            if (updates.serviceCharge) dbUpdates.service_charge = updates.serviceCharge;
            if (updates.taxType) dbUpdates.tax_type = updates.taxType;
            if (updates.telegramBotToken) dbUpdates.telegram_bot_token = updates.telegramBotToken;
            if (updates.telegramChatId) dbUpdates.telegram_chat_id = updates.telegramChatId;

            // Plans & Business
            if (updates.plan) dbUpdates.plan = updates.plan;
            if (updates.plan_expiry_date !== undefined) dbUpdates.plan_expiry_date = updates.plan_expiry_date;
            if (updates.business_type !== undefined) dbUpdates.business_type = updates.business_type;

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
                typeof updates.telegramNotifyShift !== 'undefined' ||
                typeof updates.telegramNotifyTransaction !== 'undefined' ||
                typeof updates.telegramNotifyLowStock !== 'undefined' ||
                typeof updates.telegramNotifyShiftReminder !== 'undefined' ||
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
                    ...(typeof updates.telegramNotifyShift !== 'undefined' ? { telegramNotifyShift: updates.telegramNotifyShift } : {}),
                    ...(typeof updates.telegramNotifyTransaction !== 'undefined' ? { telegramNotifyTransaction: updates.telegramNotifyTransaction } : {}),
                    ...(typeof updates.telegramNotifyLowStock !== 'undefined' ? { telegramNotifyLowStock: updates.telegramNotifyLowStock } : {}),
                    ...(typeof updates.telegramNotifyShiftReminder !== 'undefined' ? { telegramNotifyShiftReminder: updates.telegramNotifyShiftReminder } : {}),
                    ...(updates.shiftOpenTime ? { shiftOpenTime: updates.shiftOpenTime } : {}),
                    ...(updates.shiftCloseTime ? { shiftCloseTime: updates.shiftCloseTime } : {}),
                };
            }

            // Direct column updates take precedence
            const { error } = await supabase
                .from('stores')
                .update(dbUpdates)
                .eq('id', id);

            if (error) throw error;

            // Sync plan to owner's profile (belt-and-suspenders with DB trigger)
            if (dbUpdates.plan || dbUpdates.plan_expiry_date) {
                try {
                    const { data: storeData } = await supabase.from('stores').select('owner_id').eq('id', id).single();
                    if (storeData?.owner_id) {
                        const profileUpdate = {};
                        if (dbUpdates.plan) profileUpdate.plan = dbUpdates.plan;
                        if (dbUpdates.plan_expiry_date !== undefined) profileUpdate.plan_expiry_date = dbUpdates.plan_expiry_date;
                        await supabase.from('profiles').update(profileUpdate).eq('id', storeData.owner_id);
                        console.log('DataContext: Synced plan to owner profile', storeData.owner_id, profileUpdate);
                    }
                } catch (syncErr) {
                    console.warn('DataContext: Plan sync to profile failed (non-fatal):', syncErr.message);
                }
            }

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
        if (!activeStoreId) return [];
        try {
            const data = await safeSupabaseRpc({
                rpcName: 'get_stock_history',
                params: {
                    p_store_id: activeStoreId,
                    p_product_id: null,
                    p_limit: 500
                }
            });

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
    
    // --- Pet Care Management ---
    const fetchPets = useCallback(async () => {
        if (!activeStoreId) return [];
        try {
            const data = await safeFetchSupabase({
                supabase, activeStoreId,
                tableName: 'pets',
                setterFn: setPets,
                queryBuilder: (q) => q.order('name', { ascending: true }),
                processFn: (data) => data.map(p => ({
                    ...p,
                    customerId: p.customer_id,
                    rmNumber: p.rm_number,
                    petType: p.pet_type,
                    petAge: p.pet_age,
                    isNeutered: p.is_neutered,
                    isVaccinated: p.is_vaccinated,
                    lastCheckup: p.last_checkup,
                    specialNeeds: p.special_needs,
                    medicalHistory: p.medical_history,
                    imageUrl: p.image_url
                }))
            });
            return data;
        } catch (error) {
            console.error("Failed to fetch pets:", error);
            return [];
        }
    }, [activeStoreId]);

    const addPet = async (petData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const dbData = {
                store_id: activeStoreId,
                name: petData.name,
                customer_id: petData.customerId || null,
                pet_type: petData.petType,
                breed: petData.breed,
                gender: petData.gender,
                pet_age: petData.petAge,
                weight: (petData.weight === "" || petData.weight === null) ? null : parseFloat(petData.weight),
                color: petData.color,
                rm_number: petData.rmNumber,
                is_neutered: petData.isNeutered || false,
                is_vaccinated: petData.isVaccinated || false,
                special_needs: petData.specialNeeds,
                medical_history: petData.medicalHistory,
                image_url: petData.imageUrl || null
            };

            const { data, error } = await supabase
                .from('pets')
                .insert(dbData)
                .select()
                .single();

            if (error) throw error;
            
            setPets(prev => [...prev, {
                ...data,
                customerId: data.customer_id,
                rmNumber: data.rm_number,
                petType: data.pet_type,
                petAge: data.pet_age,
                isNeutered: data.is_neutered,
                isVaccinated: data.is_vaccinated,
                specialNeeds: data.special_needs,
                medicalHistory: data.medical_history,
                imageUrl: data.image_url
            }]);
            return { success: true, data };
        } catch (error) {
            console.error("Error adding pet:", error);
            return { success: false, error: error.message };
        }
    };

    const updatePet = async (id, petData) => {
        try {
            const dbData = {
                name: petData.name,
                customer_id: petData.customerId || null,
                pet_type: petData.petType,
                breed: petData.breed,
                gender: petData.gender,
                pet_age: petData.petAge,
                weight: (petData.weight === "" || petData.weight === null) ? null : parseFloat(petData.weight),
                color: petData.color,
                is_neutered: petData.isNeutered || false,
                is_vaccinated: petData.isVaccinated || false,
                special_needs: petData.specialNeeds,
                medical_history: petData.medicalHistory,
                image_url: petData.imageUrl || null
            };

            const { error } = await supabase
                .from('pets')
                .update(dbData)
                .eq('id', id);

            if (error) throw error;

            setPets(prev => prev.map(p => p.id === id ? { ...p, ...petData } : p));
            return { success: true };
        } catch (error) {
            console.error("Error updating pet:", error);
            return { success: false, error: error.message };
        }
    };

    const deletePet = async (id) => {
        try {
            const { error } = await supabase
                .from('pets')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setPets(prev => prev.filter(p => p.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting pet:", error);
            return { success: false, error: error.message };
        }
    };

    const fetchPetRooms = useCallback(async () => {
        if (!activeStoreId) return [];
        try {
            const data = await safeFetchSupabase({
                supabase, activeStoreId,
                tableName: 'pet_rooms',
                setterFn: setPetRooms,
                queryBuilder: (q) => q.order('name', { ascending: true }),
                processFn: (data) => data.map(r => ({
                    ...r,
                    currentBookingId: r.current_booking_id,
                    linkedServiceId: r.linked_service_id
                }))
            });
            return data;
        } catch (error) {
            console.error("Failed to fetch pet rooms:", error);
            return [];
        }
    }, [activeStoreId]);

    const addPetRoom = async (roomData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const { data, error } = await supabase
                .from('pet_rooms')
                .insert({ ...roomData, store_id: activeStoreId })
                .select()
                .single();

            if (error) throw error;
            setPetRooms(prev => [...prev, data]);
            return { success: true, data };
        } catch (error) {
            console.error("Error adding pet room:", error);
            return { success: false, error: error.message };
        }
    };

    const updatePetRoom = async (id, roomData) => {
        try {
            const { error } = await supabase
                .from('pet_rooms')
                .update(roomData)
                .eq('id', id);

            if (error) throw error;
            setPetRooms(prev => prev.map(r => r.id === id ? { ...r, ...roomData } : r));
            return { success: true };
        } catch (error) {
            console.error("Error updating pet room:", error);
            return { success: false, error: error.message };
        }
    };

    const deletePetRoom = async (id) => {
        try {
            const { error } = await supabase
                .from('pet_rooms')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setPetRooms(prev => prev.filter(r => r.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting pet room:", error);
            return { success: false, error: error.message };
        }
    };

    const mapPetBookingData = useCallback((b) => ({
        ...b,
        customerId: b.customer_id,
        petId: b.pet_id,
        serviceType: b.service_type,
        serviceId: b.service_id,
        roomId: b.room_id,
        startDate: b.start_date,
        startTime: b.start_time,
        endDate: b.end_date,
        unitPrice: b.unit_price,
        totalPrice: b.total_price,
        paymentStatus: b.payment_status,
        groomerId: b.groomer_id,
        extraItems: b.extra_items || [],
        status: b.status || (b.service_type ? 'pending' : '') // Explicitly keep status
    }), []);

    const fetchPetBookings = useCallback(async () => {
        if (!activeStoreId) return [];
        try {
            const data = await safeFetchSupabase({
                supabase, activeStoreId,
                tableName: 'pet_bookings',
                setterFn: setPetBookings,
                queryBuilder: (q) => q.order('start_date', { ascending: false }),
                processFn: (data) => data.map(mapPetBookingData)
            });
            return data;
        } catch (error) {
            console.error("Failed to fetch pet bookings:", error);
            return [];
        }
    }, [activeStoreId, mapPetBookingData]);

    const addPetBooking = async (bookingData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const dbData = {
                store_id: activeStoreId,
                customer_id: bookingData.customerId || null,
                pet_id: bookingData.petId || null,
                service_type: bookingData.serviceType,
                service_id: bookingData.serviceId || null,
                room_id: bookingData.roomId || null,
                start_date: bookingData.startDate || null,
                start_time: bookingData.startTime || null,
                end_date: bookingData.endDate || null,
                unit_price: Number(bookingData.unitPrice) || 0,
                total_price: Number(bookingData.totalPrice) || 0,
                payment_status: bookingData.paymentStatus || 'unpaid',
                groomer_id: bookingData.groomerId || null,
                status: bookingData.status || 'pending',
                notes: bookingData.notes || null,
                extra_items: bookingData.extraItems || []
            };

            const { data, error } = await supabase
                .from('pet_bookings')
                .insert(dbData)
                .select()
                .single();

            if (error) throw error;
            
            // If it's a room booking and room_id is provided, update room status
            if (dbData.room_id && dbData.status === 'confirmed') {
                await supabase.from('pet_rooms').update({ status: 'occupied', current_booking_id: data.id }).eq('id', dbData.room_id);
                fetchPetRooms();
            }

            const processed = mapPetBookingData(data);
            setPetBookings(prev => [processed, ...prev]);
            return { success: true, data: processed };
        } catch (error) {
            console.error("Error adding pet booking:", error);
            return { success: false, error: error.message };
        }
    };

    const updatePetBooking = async (id, bookingData) => {
        try {
            const dbData = {
                customer_id: bookingData.customerId || null,
                pet_id: bookingData.petId || null,
                service_type: bookingData.serviceType,
                service_id: bookingData.serviceId || null,
                room_id: bookingData.roomId || null,
                start_date: bookingData.startDate || null,
                start_time: bookingData.startTime || null,
                end_date: bookingData.endDate || null,
                unit_price: Number(bookingData.unitPrice) || 0,
                total_price: Number(bookingData.totalPrice) || 0,
                payment_status: bookingData.paymentStatus || 'unpaid',
                groomer_id: bookingData.groomerId || null,
                status: bookingData.status,
                notes: bookingData.notes || null,
                ...(bookingData.extraItems !== undefined && { extra_items: bookingData.extraItems })
            };

            const { data: updatedRow, error } = await supabase
                .from('pet_bookings')
                .update(dbData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Handle room status updates if status changes
            if (dbData.room_id) {
                if (dbData.status === 'completed' || dbData.status === 'cancelled') {
                    await supabase.from('pet_rooms').update({ status: 'available', current_booking_id: null }).eq('id', dbData.room_id);
                } else if (dbData.status === 'confirmed') {
                    await supabase.from('pet_rooms').update({ status: 'occupied', current_booking_id: id }).eq('id', dbData.room_id);
                }
                fetchPetRooms();
            }

            // Use actual DB response to update local state (ensures all fields are correct)
            const processed = mapPetBookingData(updatedRow || dbData);
            setPetBookings(prev => prev.map(b => b.id === id ? { ...b, ...processed, id } : b));
            return { success: true };
        } catch (error) {
            console.error("Error updating pet booking:", error);
            return { success: false, error: error.message };
        }
    };

    const deletePetBooking = async (id) => {
        try {
            const { error } = await supabase
                .from('pet_bookings')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setPetBookings(prev => prev.filter(b => b.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting pet booking:", error);
            return { success: false, error: error.message };
        }
    };

    const mapPetServiceData = useCallback((s) => ({
        ...s,
        capitalPrice: s.capital_price,
        paramedicCommission: s.paramedic_commission,
        isActive: s.is_active,
        doctorFeeType: s.doctor_fee_type,
        doctorFeeValue: s.doctor_fee_value,
        commissions: s.commission || {} // DB stores as 'commission' (singular), frontend uses 'commissions' (plural)
    }), []);

    const fetchPetServices = useCallback(async () => {
        if (!activeStoreId) return [];
        try {
            const data = await safeFetchSupabase({
                supabase, activeStoreId,
                tableName: 'pet_services',
                setterFn: setPetServices,
                queryBuilder: (q) => q.order('name', { ascending: true }),
                processFn: (data) => data.map(mapPetServiceData)
            });
            return data;
        } catch (error) {
            console.error("Failed to fetch pet services:", error);
            return [];
        }
    }, [activeStoreId, mapPetServiceData]);

    const addPetService = async (serviceData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const dbData = {
                ...serviceData,
                store_id: activeStoreId,
                capital_price: serviceData.capitalPrice,
                commission: serviceData.commissions, // Store the new multi-role object
                is_active: serviceData.isActive ?? true,
                doctor_fee_type: serviceData.doctorFeeType || 'fixed',
                doctor_fee_value: serviceData.doctorFeeValue || 0
            };
            
            // Clean up UI-only fields
            delete dbData.capitalPrice;
            delete dbData.isActive;
            delete dbData.doctorFeeType;
            delete dbData.doctorFeeValue;
            delete dbData.commissions;

            const { data, error } = await supabase
                .from('pet_services')
                .insert(dbData)
                .select()
                .single();

            if (error) throw error;
            const processed = mapPetServiceData(data);
            setPetServices(prev => [...prev, processed]);
            return { success: true, data: processed };
        } catch (error) {
            console.error("Error adding pet service:", error);
            return { success: false, error: error.message };
        }
    };

    const updatePetService = async (id, serviceData) => {
        try {
            const dbData = {
                ...serviceData,
                capital_price: serviceData.capitalPrice,
                commission: serviceData.commissions,
                is_active: serviceData.isActive,
                doctor_fee_type: serviceData.doctorFeeType || 'fixed',
                doctor_fee_value: serviceData.doctorFeeValue || 0
            };

            // Clean up UI-only fields
            delete dbData.capitalPrice;
            delete dbData.isActive;
            delete dbData.doctorFeeType;
            delete dbData.doctorFeeValue;
            delete dbData.commissions;

            const { data, error } = await supabase
                .from('pet_services')
                .update(dbData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            const processed = mapPetServiceData(data);
            setPetServices(prev => prev.map(s => s.id === id ? processed : s));
            return { success: true, data: processed };
        } catch (error) {
            console.error("Error updating pet service:", error);
            return { success: false, error: error.message };
        }
    };

    const deletePetService = async (id) => {
        try {
            const { error } = await supabase
                .from('pet_services')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setPetServices(prev => prev.filter(s => s.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting pet service:", error);
            return { success: false, error: error.message };
        }
    };



    const fetchMedicalRecords = useCallback(async () => {
        if (!activeStoreId) return [];
        try {
            const data = await safeFetchSupabase({
                supabase, activeStoreId,
                tableName: 'medical_records',
                setterFn: setMedicalRecords,
                queryBuilder: (q) => q.order('date', { ascending: false }),
                processFn: (data) => data.map(m => ({
                    ...m,
                    petId: m.pet_id,
                    customerId: m.customer_id,
                    bookingId: m.booking_id,
                    doctorId: m.doctor_id,
                    doctorName: m.doctor_name,
                    paramedicId: m.paramedic_id,
                    nextVisit: m.next_visit,
                    paymentStatus: m.payment_status,
                    isPaidPos: m.is_paid_pos
                }))
            });
            return data;
        } catch (error) {
            console.error("Failed to fetch medical records:", error);
            return [];
        }
    }, [activeStoreId]);

    const addMedicalRecord = async (recordData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const dbData = {
                store_id: activeStoreId,
                pet_id: recordData.petId || null,
                customer_id: recordData.customerId || null,
                booking_id: recordData.bookingId || null,
                date: recordData.date || new Date().toISOString(),
                doctor_id: recordData.doctorId || null,
                doctor_name: recordData.doctorName || null,
                paramedic_id: recordData.paramedicId || null,
                symptoms: recordData.symptoms || null,
                diagnosis: recordData.diagnosis || null,
                treatment: recordData.treatment || null,
                services: recordData.services || [],
                prescriptions: recordData.prescriptions || [],
                next_visit: recordData.nextVisit || null,
                notes: recordData.notes || null,
                payment_status: recordData.paymentStatus || 'unpaid'
            };

            const { data, error } = await supabase
                .from('medical_records')
                .insert(dbData)
                .select()
                .single();

            if (error) throw error;
            setMedicalRecords(prev => [data, ...prev]);
            return { success: true, data };
        } catch (error) {
            console.error("Error adding medical record:", error);
            return { success: false, error: error.message };
        }
    };

    const updateMedicalRecord = async (id, recordData) => {
        try {
            const dbData = {
                pet_id: recordData.petId || null,
                customer_id: recordData.customerId || null,
                booking_id: recordData.bookingId || null,
                date: recordData.date || new Date().toISOString(),
                doctor_id: recordData.doctorId || null,
                doctor_name: recordData.doctorName || null,
                paramedic_id: recordData.paramedicId || null,
                symptoms: recordData.symptoms || null,
                diagnosis: recordData.diagnosis || null,
                treatment: recordData.treatment || null,
                services: recordData.services || [],
                prescriptions: recordData.prescriptions || [],
                next_visit: recordData.nextVisit || null,
                notes: recordData.notes || null,
                payment_status: recordData.paymentStatus
            };

            const { error } = await supabase
                .from('medical_records')
                .update(dbData)
                .eq('id', id);

            if (error) throw error;
            setMedicalRecords(prev => prev.map(m => m.id === id ? { ...m, ...recordData } : m));
            return { success: true };
        } catch (error) {
            console.error("Error updating medical record:", error);
            return { success: false, error: error.message };
        }
    };

    const fetchMedicalRecordsByRM = useCallback(async (rmNumber) => {
        if (!activeStoreId || !rmNumber) return [];
        try {
            // 1. First find the pet with this RM number
            const { data: petData, error: petError } = await supabase
                .from('pets')
                .select('id, name')
                .eq('store_id', activeStoreId)
                .eq('rm_number', rmNumber)
                .maybeSingle();

            if (petError) throw petError;
            if (!petData) return [];

            // 2. Then find unpaid medical records for this pet
            const { data, error } = await supabase
                .from('medical_records')
                .select('*')
                .eq('pet_id', petData.id)
                .eq('is_paid_pos', false)
                .order('date', { ascending: false });

            if (error) throw error;
            return (data || []).map(m => ({
                ...m,
                petId: m.pet_id,
                petName: petData.name,
                customerId: m.customer_id,
                bookingId: m.booking_id,
                doctorId: m.doctor_id,
                doctorName: m.doctor_name,
                paramedicId: m.paramedic_id,
                isPaidPos: m.is_paid_pos
            }));
        } catch (error) {
            console.error("Error fetching medical records by RM:", error);
            return [];
        }
    }, [activeStoreId]);

    const deleteMedicalRecord = async (id) => {
        try {
            const { error } = await supabase
                .from('medical_records')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setMedicalRecords(prev => prev.filter(m => m.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting medical record:", error);
            return { success: false, error: error.message };
        }
    };

    const fetchPetDailyLogs = useCallback(async () => {
        if (!activeStoreId) return [];
        try {
            const data = await safeFetchSupabase({
                supabase, activeStoreId,
                tableName: 'pet_daily_logs',
                setterFn: setPetDailyLogs,
                queryBuilder: (q) => q.order('date', { ascending: false }),
                processFn: (data) => data.map(l => ({
                    ...l,
                    petId: l.pet_id,
                    bookingId: l.booking_id,
                    staffId: l.staff_id,
                    staffName: l.staff_name,
                    logType: l.log_type,
                    imageUrl: l.image_url
                }))
            });
            return data;
        } catch (error) {
            console.error("Failed to fetch pet daily logs:", error);
            return [];
        }
    }, [activeStoreId]);

    const addPetDailyLog = async (logData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const dbData = {
                store_id: activeStoreId,
                booking_id: logData.bookingId || null,
                pet_id: logData.petId || null,
                eating: logData.eating || null,
                mood: logData.mood || null,
                bathroom: logData.bathroom || null,
                notes: logData.notes || null,
                staff_id: logData.staffId || null,
                staff_name: logData.staffName || null
            };

            const { data, error } = await supabase
                .from('pet_daily_logs')
                .insert(dbData)
                .select()
                .single();

            if (error) throw error;
            setPetDailyLogs(prev => [data, ...prev]);
            return { success: true, data };
        } catch (error) {
            console.error("Error adding pet daily log:", error);
            return { success: false, error: error.message };
        }
    };

    const updatePetDailyLog = async (id, logData) => {
        try {
            const dbData = {
                booking_id: logData.bookingId || null,
                pet_id: logData.petId || null,
                eating: logData.eating || null,
                mood: logData.mood || null,
                bathroom: logData.bathroom || null,
                notes: logData.notes || null,
                staff_id: logData.staffId || null,
                staff_name: logData.staffName || null
            };

            const { error } = await supabase
                .from('pet_daily_logs')
                .update(dbData)
                .eq('id', id);

            if (error) throw error;
            setPetDailyLogs(prev => prev.map(l => l.id === id ? { ...l, ...logData } : l));
            return { success: true };
        } catch (error) {
            console.error("Error updating pet daily log:", error);
            return { success: false, error: error.message };
        }
    };

    const deletePetDailyLog = async (id) => {
        try {
            const { error } = await supabase
                .from('pet_daily_logs')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setPetDailyLogs(prev => prev.filter(l => l.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting pet daily log:", error);
            return { success: false, error: error.message };
        }
    };

    // Helper to map snake_case products (from DB) to camelCase frontend objects
    const mapProductData = useCallback((p) => {
        if (!p) return null;
        return {
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
            units: p.units || [], // Explicitly map units
            isBundlingEnabled: p.is_bundling_enabled,
            isWholesale: p.is_wholesale,
            stockType: p.stock_type,
            overtime_hourly_penalty: p.overtime_hourly_penalty,
            overtime_trigger_hours: p.overtime_trigger_hours,
            price: p.sell_price,
            category: p.categories?.name || p.category || null,
            doctorFeeType: p.doctor_fee_type,
            doctorFeeValue: p.doctor_fee_value
        };
    }, []);

    const fetchAllProducts = useCallback(async (storeId = activeStoreId, force = false) => {
        if (!storeId) return [];
        
        // Guard: Prevent redundant fetches if products already loaded for this store
        // Skip guard if 'force' is true (manual refresh)
        if (!force && products.length > 0 && lastFetchedProductsStoreIdRef.current === storeId) {
            console.log("DataContext: Products already fetched for store", storeId, "skipping redundant fetch.");
            return products;
        }

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
                processFn: (data) => (data || []).map(p => mapProductData(p))
            });

            // STALE CHECK: If the store changed while we were fetching products, discard this result
            if (storeId !== latestActiveStoreId.current) {
                console.log("DataContext: fetchAllProducts ignored stale result for store", storeId);
                return [];
            }

            setProducts(processed || []);
            lastFetchedProductsStoreIdRef.current = storeId; // Mark as fetched
            console.log(`DataContext: fetchAllProducts took: ${((performance.now() - phase2Start) / 1000).toFixed(2)}s`);

            // Update cache
            offlineService.cacheData(storeId, processed || [], categories || [], []);

            return processed || [];
        } catch (e) {
            console.error('DataContext: Failed to fetch products:', e);
            return [];
        }
    }, [activeStoreId, categories, mapProductData, products]);

    // New RPC-based Pagination
    const fetchProductsPage = useCallback(async ({ page, pageSize, search = '', category = 'all', satuanPO = 'all', stockType = 'all', sortKey = 'name', sortDir = 'asc' }) => {
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
                    p_stock_type: stockType,
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
    const fetchStaff = useCallback(async (storeId = activeStoreId) => {
        if (!storeId) return [];
        try {
            const data = await safeSupabaseQuery({
                tableName: 'profiles',
                queryBuilder: (q) => q.eq('store_id', storeId),
                fallbackParams: `?store_id=eq.${storeId}`,
                processFn: (data) => data.map(u => ({ 
                    ...u, 
                    storeId: u.store_id, 
                    petCareAccess: u.pet_care_access 
                }))
            });
            if (storeId === activeStoreId) {
                setStaff(data || []);
            }
            return data || [];
        } catch (e) {
            console.error('DataContext: Failed to fetch staff:', e);
            return [];
        }
    }, [activeStoreId]);

    const fetchData = useCallback(async (shouldSetLoading = false) => {
        if (!user) {
            setLoading(false);
            return;
        }

        // --- RACE CONDITION FIX ---
        // Do not fetch store-specific data until we know the store settings (Shared vs Single)
        // If stores are still loading, wait for the next callback trigger when storesLoading becomes false.
        if (storesLoading) {
            console.log("DataContext: Stores still loading, deferring fetchData...");
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
                            pointsEarned: t.points_earned !== undefined ? Number(t.points_earned || 0) : Number(t.payment_details?.points_earned || 0),
                            customerTotalPoints: Number(t.payment_details?.customer_remaining_points || 0),
                            voidedAt: t.voided_at,
                            shiftId: t.shift_id,
                            amountPaid: Number(t.payment_details?.amount_paid || t.amount_paid || t.total || 0),
                            change: Number(t.payment_details?.change || t.change || 0)
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
                                    console.log(`DataContext: Shared customers RPC returned ${data.length} records.`);
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
                    fetchPets(),
                    fetchPetRooms(),
                    fetchPetBookings(),
                    fetchPetServices(),
                    fetchMedicalRecords(),
                    fetchPetDailyLogs(),
                    fetchStaff(),
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
    }, [user, activeStoreId, fetchStockMovements, fetchPets, fetchPetRooms, fetchPetBookings, fetchPetServices, fetchMedicalRecords, fetchPetDailyLogs, fetchStaff, currentStore?.settings?.enableSharedCustomers, storesLoading]);

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
        if (!stores || stores.length === 0 || user?.role === 'staff') return;

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
                    // Prevent infinite loop: Only update if the local state isn't already 'free'
                    // actually the filter already does this (store.plan !== 'free')
                    // but we should avoid running this too often.
                    const { error } = await supabase
                        .from('stores')
                        .update({ plan: 'free', plan_expiry_date: null })
                        .in('id', expiredStores.map(s => s.id));
                    if (error) throw error;
                    console.log("Auto-downgraded expired plans:", expiredStores.length);
                    // Don't re-fetch here, let Realtime handle it
                } catch (error) {
                    console.error("Failed to auto-downgrade plans:", error);
                }
            }
        };

        // De-bounce or only run once every hour/day? 
        // For now, let's at least ensure it doesn't loop by checking if stores actually changed in length
        // or just run it once when stores are first loaded.
        const timer = setTimeout(checkExpiry, 10000); // Wait 10s after stores load to check expiry
        return () => clearTimeout(timer);
    }, [stores, user?.role]); // Added stores to satisfy lint, logic remains safe via checkExpiry guards

    // --- User Management ---
    // --- User Management ---
    const addUser = async (userData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            // If we already have an authId (from Edge Function create-user), the
            // handle_new_user trigger already created the profile automatically.
            // We skip the conflict check and just upsert to fill in details.
            if (!userData.id) {
                // Conflict check only needed when there's NO known auth user
                const { data: checkData, error: checkError } = await supabase
                    .rpc('check_staff_conflict', {
                        p_email: userData.email,
                        p_target_store_id: activeStoreId
                    });

                if (checkError) {
                    console.error("Staff conflict check failed:", checkError);
                    return { success: false, error: "Gagal memverifikasi keamanan data staff." };
                }

                if (checkData && checkData.status === 'conflict') {
                    console.warn("Staff registration conflict detected:", {
                        email: userData.email,
                        targetStore: activeStoreId,
                        conflictData: checkData
                    });
                    return {
                        success: false,
                        error: `Username/Email ini sudah digunakan oleh toko lain (${checkData.current_store_name || 'Unknown Store'}). Gunakan username unik.`
                    };
                }

                if (checkData && checkData.status === 'same_store') {
                    return {
                        success: false,
                        error: `Staff ini sudah terdaftar di toko ini sebagai ${checkData.current_role}. Silakan EDIT data staff tersebut jika ingin mengubah role.`
                    };
                }
            }

            // Upsert Profile (handles both new create and updating auto-created trigger profile)
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    ...userData,
                    store_id: activeStoreId,
                    created_at: new Date().toISOString()
                }, { onConflict: 'id', ignoreDuplicates: false });

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
                pricing_type: product.pricingType || 'fixed',
                pricing_tiers: product.pricingTiers || [],
                units: product.units || [], // Explicitly insert units array
                is_bundling_enabled: product.isBundlingEnabled || false,
                is_wholesale: product.isWholesale || false,
                stock_type: product.stockType || 'Barang',
                purchase_unit: product.purchaseUnit || null,
                conversion_to_unit: product.conversionToUnit ? Number(product.conversionToUnit) : null,
                overtime_hourly_penalty: Number(product.overtime_hourly_penalty) || 0,
                overtime_trigger_hours: Number(product.overtime_trigger_hours) || 0,
                rack_location: product.shelf || product.rackLocation || null,
                weight: product.weight || 0,
                doctor_fee_type: product.doctorFeeType || 'fixed',
                doctor_fee_value: product.doctorFeeValue || 0,
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

            // Optimistic update with mapped data
            const mappedNewProduct = mapProductData(newProductData);
            setProducts(prev => [...prev, mappedNewProduct]);

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
                pricing_type: (() => {
                    const pt = rawData.pricingType || rawData.pricing_type || 'fixed';
                    return pt === 'standard' ? 'fixed' : pt;
                })(),
                pricing_tiers: rawData.pricingTiers || rawData.pricing_tiers,
                units: rawData.units, // Explicitly update units array
                is_bundling_enabled: rawData.isBundlingEnabled || rawData.is_bundling_enabled,
                is_wholesale: rawData.isWholesale ?? rawData.is_wholesale,
                stock_type: rawData.stockType || rawData.stock_type || 'Barang',
                overtime_hourly_penalty: Number(rawData.overtime_hourly_penalty) || 0,
                overtime_trigger_hours: Number(rawData.overtime_trigger_hours) || 0,
                category_id: rawData.categoryId ?? rawData.category_id,
                doctor_fee_type: rawData.doctorFeeType || rawData.doctor_fee_type,
                doctor_fee_value: rawData.doctorFeeValue ?? rawData.doctor_fee_value
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

            // Perform a full re-fetch of the product to ensure state is absolutely correct
            const { data: updatedProduct, error: fetchError } = await supabase
                .from('products')
                .select('*, categories(id, name)')
                .eq('id', id)
                .single();

            if (!fetchError && updatedProduct) {
                const mappedUpdatedProduct = mapProductData(updatedProduct);
                setProducts(prev => prev.map(p => p.id === id ? mappedUpdatedProduct : p));
            } else {
                // Fallback to simple merge if re-fetch fails
                const optimisticData = { ...rawData };
                if (updateData.category_id) {
                    optimisticData.categoryId = updateData.category_id;
                    const foundCat = categories.find(c => c.id === updateData.category_id);
                    if (foundCat) {
                        optimisticData.category = foundCat.name;
                    }
                }
                setProducts(prev => prev.map(prod => prod.id === id ? { ...prod, ...optimisticData } : prod));
            }

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

        // Generate a unique UUID for the customer ID
        // Support for older browsers / environments where crypto.randomUUID might be missing
        const customerId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        try {
            // Check if phone number already exists WITHIN THE SAME STORE
            const cleanPhone = customerData.phone ? customerData.phone.replace(/[^0-9]/g, '') : '';
            if (!cleanPhone) {
                return { success: false, error: "Nomor HP wajib diisi." };
            }

            const { data: existing } = await supabase
                .from('customers')
                .select('id')
                .eq('phone', customerData.phone)
                .eq('store_id', activeStoreId)
                .maybeSingle();

            if (existing) {
                return { success: false, error: "Pelanggan dengan nomor HP ini sudah terdaftar di outlet ini." };
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

    // --- Loyalty Rules & Stamp Cards Management ---
    const fetchLoyaltyRules = useCallback(async (storeId) => {
        if (!storeId) return [];
        try {
            const { data, error } = await supabase
                .from('loyalty_product_rules')
                .select('*')
                .eq('store_id', storeId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching loyalty rules:", error);
            return [];
        }
    }, []);

    const saveLoyaltyRule = async (ruleData) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            let result;
            if (ruleData.id) {
                // Update
                result = await supabase
                    .from('loyalty_product_rules')
                    .update(ruleData)
                    .eq('id', ruleData.id)
                    .select();
            } else {
                // Insert
                const insertData = { ...ruleData };
                delete insertData.id;
                result = await supabase
                    .from('loyalty_product_rules')
                    .insert([{ ...insertData, store_id: activeStoreId }])
                    .select();
            }

            if (result.error) throw result.error;
            return { success: true, data: result.data[0] };
        } catch (error) {
            console.error("Error saving loyalty rule:", error);
            return { success: false, error: error.message };
        }
    };

    const deleteLoyaltyRule = async (id) => {
        try {
            const { error } = await supabase
                .from('loyalty_product_rules')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error("Error deleting loyalty rule:", error);
            return { success: false, error: error.message };
        }
    };

    const fetchCustomerStamps = useCallback(async (customerId) => {
        if (!customerId) return [];
        try {
            const { data, error } = await supabase
                .from('customer_stamps')
                .select(`
                    *,
                    loyalty_product_rules:rule_id (name, rule_type, stamp_target)
                `)
                .eq('customer_id', customerId);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching customer stamps:", error);
            return [];
        }
    }, []);

    const updateCustomerStamps = async (customerId, ruleId, currentStamps, completedCount) => {
        try {
            // Upsert the stamp record
            const { error } = await supabase
                .from('customer_stamps')
                .upsert(
                    {
                        customer_id: customerId,
                        rule_id: ruleId,
                        current_stamps: currentStamps,
                        completed_count: completedCount,
                        last_stamped_at: new Date().toISOString()
                    },
                    { onConflict: 'customer_id,rule_id' }
                );

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error("Error updating customer stamps:", error);
            return { success: false, error: error.message };
        }
    };

    const adjustCustomerStamps = async (customerId, stampId, amount, reason, type = 'addition') => {
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
            // Get current stamp data
            const { data: stampData, error: fetchError } = await supabase
                .from('customer_stamps')
                .select('*')
                .eq('id', stampId)
                .single();

            if (fetchError || !stampData) {
                return { success: false, error: 'Stamp record not found' };
            }

            const previousBalance = stampData.current_stamps || 0;
            const newBalance = Math.max(0, previousBalance + amount);

            // Update customer stamps
            const { error: updateError } = await supabase
                .from('customer_stamps')
                .update({ current_stamps: newBalance })
                .eq('id', stampId);

            if (updateError) throw updateError;

            // Optional: Create adjustment record in point_adjustments to keep history
            const { data: custData } = await supabase.from('customers').select('name').eq('id', customerId).single();
            await supabase.from('point_adjustments').insert({
                customer_id: customerId,
                customer_name: custData?.name || 'Customer',
                store_id: activeStoreId,
                type: type === 'addition' ? 'addition' : 'deduction',
                amount: Math.abs(amount),
                reason: `[Penyesuaian Stamp] ${reason.trim()}`,
                performed_by: user.id || null,
                performed_by_name: user.name || user.email || 'Unknown',
                date: new Date().toISOString(),
                previous_balance: previousBalance,
                new_balance: newBalance
            });

            return { success: true, newBalance };
        } catch (error) {
            console.error("Error adjusting customer stamps:", error);
            return { success: false, error: error.message };
        }
    };

    const redeemStampCard = async (stampId, customerId, targetStamps, rewardPoints) => {
        try {
            const { data, error } = await supabase.rpc('redeem_stamp_card', {
                p_stamp_id: stampId,
                p_customer_id: customerId,
                p_target_stamps: targetStamps,
                p_reward_points: rewardPoints
            });

            if (error) throw error;

            // Optimistic stat update
            const customerIndex = customers.findIndex(c => c.id === customerId);
            if (customerIndex !== -1) {
                const updatedCustomers = [...customers];
                updatedCustomers[customerIndex] = {
                    ...updatedCustomers[customerIndex],
                    loyalty_points: (updatedCustomers[customerIndex].loyalty_points || 0) + rewardPoints
                };
                setCustomers(updatedCustomers);
            }

            return { success: true, data };
        } catch (error) {
            console.error("Error redeeming stamp card:", error);
            return { success: false, error: error.message };
        }
    };

    // --- Advanced Stock Management (FIFO) ---

    const addStockBatch = async (productId, qty, buyPrice, sellPrice, note = '', expiredDate = null) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const { data, error } = await supabase.rpc('add_stock_batch', {
                p_store_id: activeStoreId,
                p_product_id: productId,
                p_qty: qty,
                p_buy_price: buyPrice,
                p_sell_price: sellPrice || 0,
                p_note: note,
                p_expired_date: expiredDate
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
                storeId: activeStoreId,
                product_id: productId,
                productId: productId,
                type: 'in',
                qty: qty,
                date: new Date().toISOString(),
                note: note || 'Stok Masuk (Batch)',
                ref_id: batchId,
                refId: batchId
            };
            setStockMovements(prev => [newMovement, ...prev]);

            return { success: true };
        } catch (error) {
            console.error("Error adding stock batch:", error);
            alert("DB Error in add_stock_batch: " + (error.message || JSON.stringify(error)));
            return { success: false, error: error.message };
        }
    };

    const createInitialBatch = async (productId, qty, buyPrice, expiredDate) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const { data, error } = await supabase.rpc('create_initial_batch', {
                p_store_id: activeStoreId,
                p_product_id: productId,
                p_qty: qty,
                p_buy_price: buyPrice,
                p_expired_date: expiredDate
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            return { success: true, batch_id: data.batch_id };
        } catch (error) {
            console.error("Error creating initial batch:", error);
            return { success: false, error: error.message };
        }
    };

    const fetchActiveBatches = async (productId) => {
        if (!activeStoreId) return [];
        try {
            const { data, error } = await supabase
                .from('batches')
                .select('*')
                .eq('store_id', activeStoreId)
                .eq('product_id', productId)
                .gt('current_qty', 0)
                .order('date', { ascending: true });

            if (error) {
                console.error("Error fetching active batches:", error);
                return [];
            }
            return data || [];
        } catch (error) {
            console.error("Error fetching active batches:", error);
            return [];
        }
    };

    const processSale = async (transactionData) => {
        if (!activeStoreId) {
            console.error("Process Sale Failed: No active store selected.");
            return { success: false, error: "No active store selected" };
        }

        // VALIDATION: Prevent Checkout without Items (except for deposit/debt_payment types if they ever exist)
        if (!transactionData.items || transactionData.items.length === 0) {
            console.error("Process Sale Failed: Cart items are empty.");
            return { success: false, error: "Keranjang masih kosong. Tidak ada detail barang yang bisa disimpan." };
        }

        try {
            // Prepare items for RPC (mapping fields if necessary)
            const rpcItems = transactionData.items.map(item => ({
                id: item.id,
                qty: item.qty,
                name: item.name,
                price: item.price,
                multiplier: item.multiplier || 1,
                unit: item.unit,
                buy_price: item.buyPrice || item.buy_price || 0, // Map to snake_case for RPC
                discount: item.discount || 0, // Pass item-level discount
                aturan_pakai: item.aturanPakai || null, // Save pharmacy usage instructions
                doctor_id: item.doctorId || null,
                doctor_commission_type: item.doctorFeeType || null,
                doctor_commission_value: item.doctorFeeValue || 0,
                doctor_commission_amount: item.doctorCommissionAmount || 0,
                groomer_id: item.groomerId || null,
                groomer_commission_amount: item.groomerCommissionAmount || 0,
                paramedic_id: item.paramedicId || null,
                paramedic_commission_amount: item.paramedicCommissionAmount || 0,
                cashier_id: item.cashierId || null,
                cashier_commission_amount: item.cashierCommissionAmount || 0
            }));

            // Prepare payment_details for snapshotting points and other meta
            const paymentDetailsSnapshot = {
                ...(transactionData.payment_details || {}),
                amount_paid: transactionData.cashAmount || transactionData.amount_paid || 0,
                change: transactionData.change || 0,
                points_earned: transactionData.pointsEarned || 0,
                customer_remaining_points: transactionData.customerTotalPoints || 0,
                stamp_updates: transactionData.stampUpdates || []
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
                p_cashier_name: transactionData.cashier || null,
                p_patient_name: transactionData.patient_name || null,
                p_doctor_name: transactionData.doctor_name || null,
                p_prescription_number: transactionData.prescription_number || null,
                p_tuslah_fee: transactionData.tuslah_fee || 0,
                p_medical_record_id: transactionData.medicalRecordId || null
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            const numericId = data.transaction_id;

            // Optimistic Updates
            setProducts(prev => prev.map(p => {
                const soldItem = transactionData.items.find(item => item.id === p.id);
                if (soldItem) {
                    const baseQty = soldItem.qty * (soldItem.multiplier || 1);
                    return { ...p, stock: (p.stock || 0) - baseQty };
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
                qty: -(item.qty * (item.multiplier || 1)),
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
            // Also refresh products specifically since fetchData() skips them for performance
            // This ensures stock quantities update immediately in the UI
            await fetchAllProducts(activeStoreId);

            return { success: true };
        } catch (error) {
            console.error("Error receiving PO:", error);
            return { success: false, error: error.message };
        }
    };


    const bulkAddProducts = async (newProducts) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const storePlan = currentStore?.ownerPlan || 'free';
            const limits = PLAN_LIMITS[storePlan] || PLAN_LIMITS.free;

            if (limits.maxProducts !== Infinity && (products.length + newProducts.length) > limits.maxProducts) {
                return {
                    success: false,
                    error: 'Cannot add ' + newProducts.length + ' products. Plan limit is ' + limits.maxProducts + '. Current: ' + products.length
                };
            }

            // 1. Pre-process input: filter missing names and normalize categories
            const validProducts = newProducts.filter(p => p.name);
            let skippedCount = newProducts.length - validProducts.length;
            const categoryNames = [...new Set(validProducts.map(p => p.category).filter(c => c && c !== 'Uncategorized'))];
            const barcodes = validProducts.map(p => p.barcode).filter(b => b);

            // 2. Batch check existing barcodes to skip duplicates
            let existingBarcodes = new Set();
            if (barcodes.length > 0) {
                // Supabase filter has limits, but for 276 it's fine. 
                // If it's huge, we might need smaller chunks.
                const { data: existingProds } = await supabase
                    .from('products')
                    .select('barcode')
                    .eq('store_id', activeStoreId)
                    .eq('is_deleted', false)
                    .in('barcode', barcodes);
                
                if (existingProds) {
                    existingProds.forEach(p => existingBarcodes.add(p.barcode));
                }
            }

            // 3. Batch handle categories
            let categoryMap = {}; // name -> id
            let newCategoriesCount = 0;
            
            // 3.1 Fetch existing categories
            const { data: existingCats } = await supabase
                .from('categories')
                .select('id, name')
                .eq('store_id', activeStoreId);
            
            if (existingCats) {
                existingCats.forEach(c => {
                    categoryMap[c.name.toLowerCase()] = c.id;
                });
            }

            // 3.2 Create missing categories
            const missingCats = categoryNames.filter(name => !categoryMap[name.toLowerCase()]);
            if (missingCats.length > 0) {
                const { data: newlyCreatedCats, error: catError } = await supabase
                    .from('categories')
                    .insert(missingCats.map(name => ({ store_id: activeStoreId, name })))
                    .select('id, name');
                
                if (catError) throw catError;
                if (newlyCreatedCats) {
                    newlyCreatedCats.forEach(c => {
                        categoryMap[c.name.toLowerCase()] = c.id;
                    });
                    newCategoriesCount = newlyCreatedCats.length;
                }
            }

            // 4. Prepare products for bulk insert
            const toInsert = [];
            for (const prod of validProducts) {
                // Skip duplicates
                if (prod.barcode && existingBarcodes.has(prod.barcode)) {
                    skippedCount++;
                    continue;
                }

                const catId = (prod.category && prod.category !== 'Uncategorized') 
                    ? categoryMap[prod.category.toLowerCase()] 
                    : null;

                toInsert.push({
                    store_id: activeStoreId,
                    category_id: catId,
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
                    units: prod.units || [],
                    is_deleted: false
                });
            }

            // 5. Bulk insert products
            let addedCount = 0;
            if (toInsert.length > 0) {
                const { data: insertedData, error: insertError } = await supabase
                    .from('products')
                    .insert(toInsert)
                    .select('id');
                
                if (insertError) throw insertError;
                addedCount = insertedData ? insertedData.length : toInsert.length;
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
            alert("DB Error in bulkUpdateStock: " + (error.message || JSON.stringify(error)));
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
                storeId: activeStoreId,
                product_id: productId,
                productId: productId,
                type: type,
                qty: qtyChange,
                date: new Date().toISOString(),
                note: note || 'Manual Adjustment',
                ref_id: null,
                refId: null
            };
            setStockMovements(prev => [newMovement, ...prev]);

            return { success: true };
        } catch (error) {
            console.error("Error adjusting stock:", error);
            alert("DB Error in adjust_stock: " + (error.message || JSON.stringify(error)));
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
                storeId: activeStoreId,
                product_id: productId,
                productId: productId,
                type: 'out',
                qty: -qty,
                date: new Date().toISOString(),
                note: note || 'Pengurangan Stok (FIFO)',
                ref_id: null,
                refId: null
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
            staff,
            fetchStaff,
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
            pets, addPet, updatePet, deletePet,
            petRooms, addPetRoom, updatePetRoom, deletePetRoom, fetchPetRooms,
            petBookings, addPetBooking, updatePetBooking, deletePetBooking, fetchPetBookings,
            petServices, addPetService, updatePetService, deletePetService, fetchPetServices,
            medicalRecords, addMedicalRecord, updateMedicalRecord, deleteMedicalRecord, fetchMedicalRecords, fetchMedicalRecordsByRM,
            petDailyLogs, addPetDailyLog, updatePetDailyLog, deletePetDailyLog, fetchPetDailyLogs,
            adjustCustomerPoints,
            getPointAdjustmentHistory,
            checkAndResetExpiredPoints,
            fetchLoyaltyRules,
            saveLoyaltyRule,
            deleteLoyaltyRule,
            fetchCustomerStamps,
            updateCustomerStamps,
            adjustCustomerStamps,
            redeemStampCard,
            fetchActiveBatches,
            addStockBatch,
            createInitialBatch,
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
