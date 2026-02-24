import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useShift } from '../context/ShiftContext';
import { sendTransactionToTelegram } from '../services/telegram';
import { printerService } from '../services/printer';
import { constructTransactionData } from '../lib/transactionLogic';
import { calculateLoyaltyPoints } from '../lib/loyaltyLogic';

import { usePOS } from '../hooks/usePOS';
import { printReceiptBrowser } from '../lib/receiptHelper';
import { cn } from '../lib/utils';

// Components
import POSHeader from '../components/pos/POSHeader';
import ProductFilter from '../components/pos/ProductFilter';
import ProductGrid from '../components/pos/ProductGrid';
import CartPanel from '../components/pos/CartPanel';
import CheckoutDialog from '../components/pos/CheckoutDialog';
import { StartShiftDialog, EndShiftDialog } from '../components/pos/ShiftDialogs';
import BarcodeScannerDialog from '../components/pos/BarcodeScannerDialog';
import CashManagementDialog from '../components/pos/CashManagementDialog';
import AlertDialog from '../components/AlertDialog';
import DiscountPinDialog from '../components/DiscountPinDialog';
import RentalDurationDialog from '../components/pos/RentalDurationDialog';
import CustomerFormDialog from '../components/CustomerFormDialog';

const POS = () => {
    // --- Contexts ---
    const { user, logout } = useAuth();
    // ... rest of context decl ...

    const {
        products, categories, processSale, currentStore, customers, updateCustomer,
        refreshTransactions: _, isOnline, fetchUsersByStore, fetchAllProducts, addCustomer
    } = useData();

    // Ensure we have products for the POS (since DataContext no longer fetches them globally by default)
    const lastFetchedStoreRef = useRef(null);
    useEffect(() => {
        if (!fetchAllProducts || !currentStore?.id) return;

        const hasProducts = products.length > 0;
        // Check if existing products belong to a different store (Stale Data)
        const isWrongStore = hasProducts && String(products[0].storeId) !== String(currentStore.id);

        // Prevent infinite loop if store has NO products
        if ((!hasProducts || isWrongStore) && lastFetchedStoreRef.current !== currentStore.id) {
            console.log("[POS] Fetching products for store:", currentStore.id);
            lastFetchedStoreRef.current = currentStore.id; // Mark as fetched
            fetchAllProducts(currentStore.id).catch(err => {
                console.error("[POS] Fetch failed:", err);
                lastFetchedStoreRef.current = null; // Allow retry on failure
            });
        }
    }, [currentStore?.id, fetchAllProducts, products]);



    const { currentShift, startShift, endShift, updateShiftStats, getShiftSummary } = useShift();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const bookingIdParam = searchParams.get('bookingId');
    const hasProcessedBooking = useRef(false);

    // --- usePOS Hook (Core Logic) ---
    const {
        cart, setCart,
        activeCategory, setActiveCategory,
        searchQuery, setSearchQuery,
        selectedCustomer, setSelectedCustomer,
        discountType, setDiscountType,
        discountValue, setDiscountValue,
        appliedPromoId, setAppliedPromoId, // Destructured for use
        salesPerson, setSalesPerson,
        filteredProducts, totals, recommendedItems,
        promotions, availablePromos, // Destructure new return values
        addToCart, updateQty, updateCartItem, clearCart
    } = usePOS();

    // --- Local UI State ---
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [lastTransaction, setLastTransaction] = useState(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);

    // Rental Specific
    const [isRentalDialogOpen, setIsRentalDialogOpen] = useState(false);
    const [selectedRentalProduct, setSelectedRentalProduct] = useState(null);

    // Wrapper to intercept rental products
    const handleProductClick = (product) => {
        if (product.pricingType === 'hourly' || product.pricingType === 'minutely') {
            setSelectedRentalProduct(product);
            setIsRentalDialogOpen(true);
        } else {
            addToCart(product);
        }
    };

    const handleRentalConfirm = (product, duration) => {
        // Add to cart with duration as Qty
        addToCart(product, duration);
    };
    const [isStartShiftOpen, setIsStartShiftOpen] = useState(false);
    const [isEndShiftOpen, setIsEndShiftOpen] = useState(false);
    const [recalculatedShift, setRecalculatedShift] = useState(null);
    const [isCashManagementOpen, setIsCashManagementOpen] = useState(false);
    const [initialCash, setInitialCash] = useState('');
    const [finalCash, setFinalCash] = useState('');
    const [finalNonCash, setFinalNonCash] = useState('');
    const [shiftNotes, setShiftNotes] = useState('');

    // Verification
    const [isDiscountPinOpen, setIsDiscountPinOpen] = useState(false);
    const [pendingCheckout, setPendingCheckout] = useState(false);

    // Alert
    const [alert, setAlert] = useState({ open: false, title: '', message: '' });
    const showAlert = useCallback((title, message) => {
        setAlert({ open: true, title, message });
    }, []);

    // Printer
    const [printerStatus, setPrinterStatus] = useState({ connected: false, name: null });

    // Printer Connection Management
    useEffect(() => {
        const checkConnection = () => {
            const isConnected = printerService.isConnected();
            const deviceName = printerService.getDeviceName();
            setPrinterStatus(prev => {
                if (prev.connected !== isConnected || prev.name !== deviceName) {
                    return { connected: isConnected, name: deviceName };
                }
                return prev;
            });
        };

        // Initial check and auto-connect
        const initPrinter = async () => {
            if (printerService.isConnected()) {
                checkConnection();
            } else {
                const res = await printerService.autoConnect();
                if (res.success) {
                    console.log('Printer auto-connected:', res.name);
                    checkConnection();
                }
            }
        };

        initPrinter();

        // Start polling
        const interval = setInterval(checkConnection, 3000);
        return () => clearInterval(interval);
    }, []);

    // Store Settings
    const storeSettings = currentStore?.settings || {};

    // --- Sales Users ---
    const [salesUsers, setSalesUsers] = useState([]);
    useEffect(() => {
        const fetchSales = async () => {
            if (!currentStore?.id) return;
            // Add safety check for fetchUsersByStore
            if (!fetchUsersByStore) return;

            try {
                const users = await fetchUsersByStore(currentStore.id);
                if (users && Array.isArray(users)) {
                    setSalesUsers(users.filter(u => u.role === 'sales'));
                } else {
                    setSalesUsers([]);
                }
            } catch (err) {
                console.error("Error loading sales users", err);
                setSalesUsers([]);
            }
        };
        fetchSales();
    }, [currentStore?.id, fetchUsersByStore]);

    // --- Connect Notification to usePOS ---
    useEffect(() => {
        console.log("[POS] Component Mounted");
        window.onPOSNotification = (title, message) => showAlert(title, message);
        return () => {
            console.log("[POS] Component Unmounted");
            window.onPOSNotification = null;
        };
    }, [showAlert]);

    // --- Global Barcode Scanner Listener ---
    // Hardware scanners (USB/Bluetooth) type characters very fast (<50ms) and end with Enter
    const barcodeBufferRef = useRef('');
    const barcodeTimeoutRef = useRef(null);

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Ignore if typing in an input field (except search)
            const activeElement = document.activeElement;
            const isSearchInput = activeElement?.id === 'product-search';

            // Clear buffer after 100ms of no input (human typing is slower)
            if (barcodeTimeoutRef.current) {
                clearTimeout(barcodeTimeoutRef.current);
            }


            // If Enter is pressed and we have a buffer, process as barcode
            if (e.key === 'Enter') {
                // If the buffer is long enough, treat as barcode
                if (barcodeBufferRef.current.length >= 2) { // 2 chars min
                    e.preventDefault(); // Prevent default Enter behavior (like submitting forms)
                    e.stopPropagation(); // Stop event from reaching focused inputs
                    const barcode = barcodeBufferRef.current;
                    barcodeBufferRef.current = '';

                    // Find and add product to cart
                    const product = products.find(p =>
                        (p.code && p.code.toLowerCase() === barcode.toLowerCase()) ||
                        (p.barcode && p.barcode.toLowerCase() === barcode.toLowerCase())
                    );

                    if (product) {
                        // Handle rental products
                        if (product.pricingType === 'hourly' || product.pricingType === 'minutely') {
                            setSelectedRentalProduct(product);
                            setIsRentalDialogOpen(true);
                        } else {
                            addToCart(product);
                        }
                        // Play beep sound
                        const audio = new Audio('/beep.mp3');
                        audio.play().catch(() => { });

                        // Clear search if user was in search field
                        if (isSearchInput) {
                            setSearchQuery('');
                            // Optional: Blur search to prevent further typing interfering?
                            // document.activeElement.blur(); 
                        }
                        return;
                    } else {
                        // If not found as product, but scanned -> show error
                        // Only show error if buffer was "scanner-like" (fast)
                        showAlert('Tidak Ditemukan', `Barcode tidak dikenali: ${barcode}`);
                        if (isSearchInput) setSearchQuery('');
                        return;
                    }
                }

                // If buffer empty/short, let normal Enter behavior happen (e.g. searching)
                // But if we are in search input, we handled "Manual Enter" via onEnter prop in ProductFilter
                return;
            }

            // Add character to buffer
            // We want to capture scanner input EVEN IF inside an input field (like search), 
            // BUT we must be careful not to break normal typing.
            // Scanners send keys very fast. Regular typing is slower.

            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                barcodeBufferRef.current += e.key;
            }

            // Reset buffer after 50ms (Scanner is FAST, human is SLOW)
            // 50ms is aggressive but good for scanners. 
            // If human types 'a', waits 100ms, types 'b', buffer is just 'b'.
            // If scanner types 'abc', it happens in ~10-20ms.
            if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
            barcodeTimeoutRef.current = setTimeout(() => {
                barcodeBufferRef.current = '';
            }, 60); // Increased slightly to 60ms for reliability
        };

        window.addEventListener('keydown', handleGlobalKeyDown, true);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown, true);
            if (barcodeTimeoutRef.current) {
                clearTimeout(barcodeTimeoutRef.current);
            }
        };
    }, [products, addToCart, showAlert, setSearchQuery, setSelectedRentalProduct, setIsRentalDialogOpen]);

    // --- Booking Integration ---
    useEffect(() => {
        const loadBooking = async () => {
            if (!bookingIdParam || hasProcessedBooking.current || !customers.length) return;
            try {
                const { data: booking, error } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('id', bookingIdParam)
                    .single();

                if (error) throw error;
                if (booking) {
                    if (booking.customer_id) {
                        const customer = customers.find(c => c.id === booking.customer_id);
                        if (customer) setSelectedCustomer(customer);
                    }

                    // Construct item
                    let productToAdd = null;
                    if (booking.service_type === 'hotel') {
                        productToAdd = {
                            id: `hotel-${booking.room_id || 'room'}`,
                            name: `Hotel: ${booking.room_name || 'Room'} (${booking.pet_name || 'Pet'})`,
                            price: booking.total_price || 0,
                            qty: 1,
                            type: 'service',
                            stock: 999
                        };
                    } else if (booking.service_id) {
                        productToAdd = products.find(p => p.id === booking.service_id);
                    }

                    if (productToAdd) {
                        setCart(prev => {
                            if (prev.some(item => item.bookingId === booking.id)) return prev;
                            return [...prev, { ...productToAdd, qty: 1, price: productToAdd.price, bookingId: booking.id }];
                        });
                        showAlert('Booking Loaded', 'Data dari reservasi berhasil dimuat.');
                    }
                    hasProcessedBooking.current = true;
                }
            } catch (err) {
                console.error("Error loading booking", err);
            }
        };
        loadBooking();
    }, [bookingIdParam, customers, products, setCart, showAlert, setSelectedCustomer]);

    // --- Handlers ---

    const handleBarcodeScan = (code) => {
        const product = products.find(p =>
            (p.code && p.code.toLowerCase() === code.toLowerCase()) ||
            (p.barcode && p.barcode.toLowerCase() === code.toLowerCase())
        );

        if (product) {
            addToCart(product);
            const audio = new Audio('/beep.mp3');
            audio.play().catch(() => { });
            setSearchQuery('');
        } else {
            showAlert('Tidak Ditemukan', `Barcode tidak dikenali: ${code}`);
        }
    };

    const handleCheckout = useCallback(() => {
        if (!currentShift) {
            showAlert('Shift Belum Dibuka', 'Silakan buka shift terlebih dahulu.');
            setIsStartShiftOpen(true);
            return;
        }

        if (discountValue > 0 && user?.role !== 'owner' && user?.role !== 'super_admin' && currentStore?.discountPin) {
            setPendingCheckout(true);
            setIsDiscountPinOpen(true);
            return;
        }

        setIsCheckoutOpen(true);
        setPaymentSuccess(false);
    }, [currentShift, discountValue, user, currentStore, showAlert]);

    const handlePrintReceipt = useCallback(async () => {
        if (!lastTransaction) return;

        const config = {
            ...currentStore,
            ...(currentStore?.settings || {})
        };

        if (printerService.isConnected()) {
            const res = await printerService.printReceipt(lastTransaction, config);
            if (res.success) return;
        }

        printReceiptBrowser(lastTransaction, config);
    }, [lastTransaction, currentStore]);

    const processPayment = async (paymentDetails) => {
        const { paymentMethod, cashAmount, change, transactionDate } = paymentDetails;

        // Use provided transaction date or default to now
        const txDate = transactionDate || new Date();

        // Debug: Log received transaction date
        console.log('[POS] Process Payment Debug:', {
            receivedTransactionDate: transactionDate?.toISOString(),
            txDateToUse: txDate.toISOString()
        });

        // Calculate Gross Subtotal and Total Item Discounts for accurate receipt display
        // 1. Construct Transaction Data using shared logic
        const transactionData = constructTransactionData({
            cart,
            totals,
            user,
            customer: selectedCustomer,
            activeStoreId: currentStore?.id,
            paymentMethod,
            amountPaid: cashAmount,
            change,
            notes: '',
            store: currentStore
        });

        // Add extra fields not covered by shared logic or specific to POS.jsx if any
        transactionData.discountType = discountType;
        transactionData.discountValue = discountValue;
        transactionData.promoId = appliedPromoId;
        transactionData.salesPersonId = salesPerson?.id || null;
        transactionData.salesPersonName = salesPerson?.name || null;
        transactionData.storeName = currentStore?.name;
        // Use custom transaction date if provided
        if (txDate) {
            transactionData.date = txDate.toISOString();
        }

        // Loyalty Logic (Refactored)
        const loyaltyResult = calculateLoyaltyPoints({
            loyaltySettings: currentStore?.loyaltySettings,
            transactionTotal: totals.finalTotal,
            selectedCustomer
        });

        transactionData.pointsEarned = loyaltyResult.pointsEarned;
        transactionData.customerTotalPoints = loyaltyResult.customerTotalPoints;

        console.log("DEBUG: Loyalty Logic Result", loyaltyResult);


        const result = await processSale(transactionData);

        if (result?.success) {
            try {
                await updateShiftStats(totals.finalTotal, paymentMethod, totals.discountAmount);
                if (selectedCustomer) {
                    await updateCustomer(selectedCustomer.id, {
                        totalSpent: (selectedCustomer.totalSpent || 0) + totals.finalTotal,
                        lastVisit: new Date().toISOString(),
                        loyaltyPoints: (parseInt(selectedCustomer.loyaltyPoints) || 0) + (transactionData.pointsEarned || 0)
                    });
                }
            } catch (err) {
                console.error("Non-critical error in post-transaction updates:", err);
            }

            // Telegram & Alerts
            if (currentStore?.telegramNotifyTransaction) {
                sendTransactionToTelegram({ ...transactionData, id: Date.now().toString() }, { token: currentStore.telegramBotToken, chatId: currentStore.telegramChatId }, currentStore);
            }

            setLastTransaction({ ...transactionData, id: result.id });
            setPaymentSuccess(true);
            // refreshTransactions(); // Removed to prevent UI freeze (Optimistic updates handle this)
        } else {
            showAlert('Gagal', `Transaksi gagal: ${result?.error || 'Unknown error'}`);
        }
    };

    // --- Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F2') { e.preventDefault(); document.getElementById('product-search')?.focus(); }
            if (e.key === 'F4' && cart.length > 0) { e.preventDefault(); handleCheckout(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart, handleCheckout]);


    // --- Permissions Helper ---
    const hasPermission = useCallback((permission) => {
        if (!user) return false;
        if (user.role === 'owner' || user.role === 'super_admin') return true;
        return user.permissions?.includes(permission);
    }, [user]);

    const [isCartCollapsed, setIsCartCollapsed] = useState(false);

    // Recalculate shift stats when End Shift dialog opens
    useEffect(() => {
        if (isEndShiftOpen && getShiftSummary) {
            getShiftSummary().then(summary => {
                if (summary) setRecalculatedShift(summary);
            });
        }
    }, [isEndShiftOpen, getShiftSummary]);

    // Prevent crash if currentStore is not yet loaded (though PrivateRoute should handle this)
    if (!currentStore && !products) {
        return <div className="h-screen flex items-center justify-center">Memuat Data Toko...</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
            {/* Top Navigation */}
            <POSHeader
                user={user}
                currentStore={currentStore}
                isOnline={isOnline}
                currentShift={currentShift}
                onStartShift={() => setIsStartShiftOpen(true)}
                onEndShift={() => setIsEndShiftOpen(true)}
                onManageCash={() => setIsCashManagementOpen(true)}
                printerStatus={printerStatus}
                onConnectPrinter={async () => {
                    if (!navigator.bluetooth) {
                        showAlert('Bluetooth Tidak Didukung', 'Browser ini tidak mendukung koneksi Bluetooth (Web Bluetooth API not found). Gunakan Chrome pada Android/Desktop atau aktifkan fitur Flag.');
                        return;
                    }
                    try {
                        const res = await printerService.connect();
                        setPrinterStatus({ connected: res.success, name: res.name });
                        if (!res.success) {
                            showAlert('Gagal Koneksi', res.error || 'Pastikan printer menyala dan belum terhubung ke perangkat lain.');
                        }
                    } catch (e) {
                        showAlert('Error', e.message);
                    }
                }}
                onNavigate={(path) => navigate(path)}
                onLogout={() => logout && logout()}
                hasPermission={hasPermission}
                onRefresh={async () => {
                    if (fetchAllProducts && currentStore?.id) {
                        try {
                            await fetchAllProducts(currentStore.id);
                            // showAlert('Sukses', 'Data produk berhasil diperbarui.'); // Silent refresh is often better for POS, or use toast
                        } catch (e) {
                            console.error("Manual refresh failed", e);
                        }
                    }
                }}
            />

            <div className="flex flex-1 overflow-hidden">
                {/* Left: Product Area */}
                <div className={cn(
                    "flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300",
                    !isCartCollapsed && "hidden sm:flex"
                )}>
                    <div className="p-4 pb-0">
                        <ProductFilter
                            activeCategory={activeCategory}
                            setActiveCategory={setActiveCategory}
                            categories={categories}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            onOpenScanner={() => setIsScannerOpen(true)}
                            onEnter={(query) => {
                                if (!query) return;
                                const product = products.find(p =>
                                    (p.code && p.code.toLowerCase() === query.trim().toLowerCase()) ||
                                    (p.barcode && p.barcode.toLowerCase() === query.trim().toLowerCase())
                                );
                                if (product) {
                                    handleProductClick(product);
                                    setSearchQuery('');
                                    const audio = new Audio('/beep.mp3');
                                    audio.play().catch(() => { });
                                }
                            }}
                        />
                    </div>
                    <div className="flex-1 p-4 overflow-hidden min-h-0">
                        <ProductGrid
                            products={filteredProducts}
                            onAddToCart={handleProductClick}
                            isCartCollapsed={isCartCollapsed}
                        />
                    </div>
                </div>

                {/* Right: Cart Panel */}
                <div
                    className={cn(
                        "shrink-0 h-full transition-all duration-300 ease-in-out",
                        isCartCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-full sm:w-[350px] lg:w-[400px] opacity-100"
                    )}
                >
                    <CartPanel
                        cart={cart}
                        totals={totals}

                        onUpdateQty={updateQty}
                        onUpdateItem={updateCartItem}
                        onClearCart={clearCart}

                        customers={customers}
                        selectedCustomer={selectedCustomer}
                        onSelectCustomer={setSelectedCustomer}

                        salesUsers={salesUsers}
                        salesPerson={salesPerson}
                        onSelectSalesPerson={setSalesPerson}
                        enableSalesPerformance={currentStore?.enableSalesPerformance}
                        loyaltySettings={currentStore?.loyaltySettings}

                        promotions={promotions}
                        availablePromos={availablePromos}
                        onApplyPromo={(promo) => {
                            // Handling applying promo
                            setAppliedPromoId(promo.id);
                            if (promo.type === 'bundle') {
                                // For bundle, we calculated potential discount.
                                // We set discountType='amount' and value = potentialDiscount
                                setDiscountType('amount');
                                setDiscountValue(promo.potentialDiscount);
                            } else if (promo.type === 'percentage') {
                                setDiscountType('percentage');
                                setDiscountValue(promo.value);
                            } else if (promo.type === 'fixed') {
                                setDiscountType('amount');
                                setDiscountValue(promo.value);
                            }
                        }}

                        discountType={discountType}
                        discountValue={discountValue}
                        onDiscountChange={(val, type) => { setDiscountValue(val); setDiscountType(type); }}

                        onCheckout={handleCheckout}

                        recommendations={recommendedItems}
                        onAddRecommendation={addToCart}

                        onAddCustomer={() => setIsCustomerFormOpen(true)}
                        onCollapse={() => setIsCartCollapsed(true)}
                    />
                </div>

                {/* Floating Cart Trigger if Collapsed */}
                {isCartCollapsed && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 z-50">
                        <button
                            onClick={() => setIsCartCollapsed(false)}
                            className="bg-indigo-600 text-white p-3 rounded-l-xl shadow-lg hover:bg-indigo-700 transition-colors flex items-center"
                        >
                            <ShoppingCart size={24} />
                            <span className="ml-2 font-bold">{cart.reduce((a, b) => a + b.qty, 0)}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Modals */}
            <CheckoutDialog
                isOpen={isCheckoutOpen}
                onClose={(val) => { setIsCheckoutOpen(val); if (!val) setPaymentSuccess(false); }}
                total={totals.finalTotal}
                onProcessPayment={processPayment}
                paymentSuccess={paymentSuccess}
                lastTransaction={lastTransaction}
                onPrintReceipt={handlePrintReceipt}
                onDownloadReceipt={() => { }}
                onCloseSuccess={() => { setIsCheckoutOpen(false); clearCart(); setPaymentSuccess(false); }}
                store={{ ...currentStore, ...storeSettings }}
                user={user}
                selectedCustomer={selectedCustomer}
                pointsEarned={(() => {
                    if (!currentStore?.loyaltySettings?.isActive || !selectedCustomer) return 0;
                    const rule = currentStore.loyaltySettings;
                    if (rule.ruleType === 'minimum' && totals.finalTotal >= rule.minTransactionAmount) {
                        return parseInt(rule.pointsReward) || 0;
                    } else if (rule.ruleType === 'multiple') {
                        const step = parseFloat(rule.ratioAmount) || 0;
                        if (step > 0) {
                            return Math.floor(totals.finalTotal / step) * (parseInt(rule.ratioPoints) || 0);
                        }
                    }
                    return 0;
                })()}
            />

            <BarcodeScannerDialog
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleBarcodeScan}
            />

            <StartShiftDialog
                isOpen={isStartShiftOpen}
                onClose={() => setIsStartShiftOpen(false)}
                onStart={async () => {
                    const res = await startShift(user?.name, parseFloat(initialCash) || 0);
                    if (res.success) { setIsStartShiftOpen(false); setInitialCash(''); }
                    else showAlert('Gagal', 'Gagal membuka shift');
                }}
                initialCash={initialCash}
                setInitialCash={setInitialCash}
            />

            <EndShiftDialog
                isOpen={isEndShiftOpen}
                onClose={() => { setIsEndShiftOpen(false); setRecalculatedShift(null); }}
                onEnd={async () => {
                    const res = await endShift(parseFloat(finalCash), parseFloat(finalNonCash), shiftNotes);
                    if (res.success) { setIsEndShiftOpen(false); setFinalCash(''); showAlert('Sukses', 'Shift ditutup'); }
                    else showAlert('Gagal', 'Gagal menutup shift');
                }}
                finalCash={finalCash} setFinalCash={setFinalCash}
                finalNonCash={finalNonCash} setFinalNonCash={setFinalNonCash}
                shiftNotes={shiftNotes} setShiftNotes={setShiftNotes}
                currentShift={recalculatedShift || currentShift}
                isLoading={!recalculatedShift} // Loading if no recalculated data yet
            />

            <CashManagementDialog
                isOpen={isCashManagementOpen}
                onClose={() => setIsCashManagementOpen(false)}
            />

            <AlertDialog
                isOpen={alert.open}
                onClose={() => setAlert({ ...alert, open: false })}
                title={alert.title}
                message={alert.message}
            />

            <DiscountPinDialog
                isOpen={isDiscountPinOpen}
                onClose={() => setIsDiscountPinOpen(false)}
                onSuccess={() => { setIsDiscountPinOpen(false); if (pendingCheckout) handleCheckout(); }}
            />

            <RentalDurationDialog
                key={isRentalDialogOpen ? 'open' : 'closed'}
                isOpen={isRentalDialogOpen}
                onClose={() => setIsRentalDialogOpen(false)}
                product={selectedRentalProduct}
                onConfirm={handleRentalConfirm}
            />

            <CustomerFormDialog
                isOpen={isCustomerFormOpen}
                onClose={() => setIsCustomerFormOpen(false)}
                onSave={async (data) => {
                    const result = await addCustomer(data);
                    if (result.success) {
                        // Optimistically select the new customer
                        // The addCustomer usually triggers a refresh of users, but we might need to find the new one.
                        // Since we deal with local state 'customers' in DataContext, it should update.
                        // However, to be safe and fast, we can set the selected customer manually if we had the ID.
                        // But addCustomer (in DataContext) usually re-fetches.
                        // Let's assume result.data contains the new customer or we wait for effect.
                        // Better: DataContext's addCustomer returns {success:true, data: newCustomer} ?
                        // Let's check DataContext if possible, but standard practice:
                        if (result.data) {
                            setSelectedCustomer(result.data);
                            showAlert('Sukses', 'Pelanggan berhasil ditambahkan');
                        } else {
                            // Fallback if data not returned immediately (though it should be)
                            showAlert('Sukses', 'Pelanggan ditambahkan. Silakan cari di daftar.');
                        }
                    } else {
                        showAlert('Gagal', result.error || 'Gagal menambah pelanggan');
                        throw new Error(result.error);
                    }
                }}
            />
        </div>
    );
};

export default POS;
