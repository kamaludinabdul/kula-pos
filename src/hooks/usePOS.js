import { useState, useCallback, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { calculateAssociations, getSmartRecommendations } from '../utils/smartCashier';
import { calculateCartTotals, calculateWholesaleUnitPrice } from '../lib/cartLogic';
import { calculateActivePromotions } from '../lib/promoLogic';

export const usePOS = () => {
    const { products, transactions, currentStore } = useData();

    // Generate a unique key for the store's cart
    const cartStorageKey = useMemo(() => {
        return currentStore?.id ? `pos_cart_${currentStore.id}` : 'pos_cart_default';
    }, [currentStore?.id]);

    // --- State ---
    const [cart, setCart] = useState(() => {
        try {
            // Initial load using the specific key
            if (typeof window !== 'undefined' && window.localStorage) {
                const savedKey = currentStore?.id ? `pos_cart_${currentStore.id}` : 'pos_cart_default';
                const saved = localStorage.getItem(savedKey);
                return saved ? JSON.parse(saved) : [];
            }
        } catch {
            return [];
        }
        return [];
    });

    // Reload cart if store changes
    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const saved = localStorage.getItem(cartStorageKey);
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setCart(saved ? JSON.parse(saved) : []);
            }
        } catch {
            setCart([]);
        }
    }, [cartStorageKey]);

    // Save cart to local storage whenever it changes
    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                // Only save if cart has items or if there's already a saved state we need to clear
                if (cart.length > 0 || localStorage.getItem(cartStorageKey)) {
                    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
                }
            }
        } catch {
            console.error("Failed to save cart to local storage");
        }
    }, [cart, cartStorageKey]);

    const [activeCategory, setActiveCategory] = useState('Semua');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Discount & Payment State
    const [discountType, setDiscountType] = useState('percentage'); // 'percentage' | 'amount'
    const [discountValue, setDiscountValue] = useState(0);
    const [appliedPromoId, setAppliedPromoId] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashAmount, setCashAmount] = useState('');
    const [salesPerson, setSalesPerson] = useState(null);
    const [prescriptionData, setPrescriptionData] = useState({
        patientName: '',
        doctorName: '',
        prescriptionNumber: '',
        tuslahFee: 0
    });

    // --- Cart Actions ---

    // Add Item to Cart
    const addToCart = useCallback((product, scannedUnit = null) => {
        // Basic stock check (can be expanded for services vs goods)
        const currentStock = parseInt(product.stock) || 0;
        const minStock = parseInt(product.minStock) || 5;
        const isService = product.type === 'service';

        // Determine added unit multiplier
        const addedMultiplier = scannedUnit ? scannedUnit.multiplier : 1;

        setCart((prev) => {
            // If they scan a Box, we want to group it with the Box entry if it exists, or base if we just increment qty?
            // Usually, cart items are identified by ID. If we mix units, it's safer to have distinct cart items 
            // OR just update the selectedUnit of the existing item. Kasir Pro currently uses single product ID per row.
            // Let's stick to single row per product ID, and override the unit/price if a new unit is scanned.
            const existing = prev.find((item) => item.id === product.id);
            const currentQtyInCart = existing ? (existing.qty * (existing.multiplier || 1)) : 0;
            const nextQtyBase = currentQtyInCart + addedMultiplier;

            if (!isService && nextQtyBase > currentStock) {
                // Notify via callback if available
                if (window.onPOSNotification) window.onPOSNotification('Stok Habis', `Stok produk "${product.name}" tidak mencukupi.`);
                return prev;
            }

            // Low stock warning
            const remaining = currentStock - nextQtyBase;
            if (!isService && remaining <= minStock) {
                if (window.onPOSNotification) window.onPOSNotification('Stok Menipis', `Stok produk "${product.name}" tersisa ${remaining}.`, 'warning');
            }

            const targetUnitName = scannedUnit ? scannedUnit.name : (product.unit || 'Pcs');
            const targetMultiplier = scannedUnit ? scannedUnit.multiplier : 1;
            const targetPrice = (scannedUnit && scannedUnit.price) ? parseInt(scannedUnit.price) : ((parseInt(product.sellPrice || product.price) || 0) * targetMultiplier);

            if (existing) {
                return prev.map((item) => {
                    if (item.id === product.id) {
                        const newQty = item.qty + 1;
                        let newPrice = targetPrice;

                        // Recalculate price if tiered pricing exists (usually applies to base unit multiplier = 1)
                        if (item.pricingTiers && item.pricingTiers.length > 0 && targetMultiplier === 1) {
                            newPrice = calculateWholesaleUnitPrice(item, newQty);
                        }

                        return {
                            ...item,
                            qty: newQty,
                            price: newPrice,
                            selectedUnit: targetUnitName,
                            multiplier: targetMultiplier
                        };
                    }
                    return item;
                });
            }

            // --- New Item ---
            const pDiscount = parseFloat(product.discount) || 0;
            const pDiscountType = product.discountType || 'percent';
            let finalUnitPrice = targetPrice;

            // Check initial tiered price (usually base, but for robustness)
            if (product.pricingTiers && product.pricingTiers.length > 0 && targetMultiplier === 1) {
                finalUnitPrice = calculateWholesaleUnitPrice(product, 1);
            }

            let initialDiscountAmount = 0;
            if (pDiscount > 0) {
                if (pDiscountType === 'fixed') {
                    initialDiscountAmount = pDiscount;
                } else {
                    initialDiscountAmount = finalUnitPrice * (pDiscount / 100);
                }
            }

            return [...prev, {
                ...product,
                qty: 1,
                price: finalUnitPrice,
                discount: initialDiscountAmount,
                selectedUnit: targetUnitName,
                multiplier: targetMultiplier,
                baseUnit: product.unit || 'Pcs'
            }];
        });
    }, []);

    // Update Item Unit (Pharmacy / Multi-unit)
    const updateItemUnit = useCallback((id, unitData) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.id === id) {
                    // unitData is from product.units array: { name, multiplier, price, barcode }
                    // if it's the base unit, we might pass a special object or detect it
                    return {
                        ...item,
                        selectedUnit: unitData.name,
                        multiplier: unitData.multiplier,
                        price: unitData.price || item.sellPrice || item.price,
                        // Optionally reset discount or keep it? Usually keep if it's %
                        // but fixed discount might need adjustment. For now let's keep it simple.
                    };
                }
                return item;
            })
        );
    }, []);

    // Update Quantity
    const updateQty = useCallback((id, delta) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.id === id) {
                    const product = products.find(p => p.id === id);
                    const currentStock = product ? (parseInt(product.stock) || 0) : 0;
                    const isService = item.type === 'service';

                    const newQty = Math.max(0, item.qty + delta);
                    const newQtyBase = newQty * (item.multiplier || 1);

                    if (delta > 0 && !isService && newQtyBase > currentStock) {
                        return item; // Stock limit reached
                    }

                    // Recalculate Price if Tiered Pricing exists
                    let newPrice = item.price;
                    if (item.pricingTiers && item.pricingTiers.length > 0) {
                        newPrice = calculateWholesaleUnitPrice(item, newQty);
                    }

                    return { ...item, qty: newQty, price: newPrice };
                }
                return item;
            }).filter((item) => item.qty > 0)
        );
    }, [products]);

    // Update Item Details (Price, Discount, Note)
    const updateCartItem = useCallback((id, updates) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.id === id) {
                    return { ...item, ...updates };
                }
                return item;
            })
        );
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
        setDiscountValue(0);
        setAppliedPromoId(null);
        setSelectedCustomer(null);
        setCashAmount('');
        setPrescriptionData({
            patientName: '',
            doctorName: '',
            prescriptionNumber: '',
            tuslahFee: 0
        });
    }, []);

    // --- Search & Filter ---

    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            const pCats = Array.isArray(p.category) ? p.category : [p.category];
            const pCatNames = pCats.map(c => (typeof c === 'object' && c?.name) ? c.name.toLowerCase() : String(c).toLowerCase());

            const matchesCategory = activeCategory === 'Semua' || pCatNames.includes(activeCategory.toLowerCase());

            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = p.name.toLowerCase().includes(searchLower) ||
                (p.code && p.code.toString().toLowerCase().includes(searchLower)) ||
                (p.barcode && p.barcode.toString().toLowerCase().includes(searchLower)) ||
                (p.units && Array.isArray(p.units) && p.units.some(u => u.barcode && u.barcode.toString().toLowerCase().includes(searchLower)));

            return matchesCategory && matchesSearch;
        });
    }, [products, activeCategory, searchQuery]);


    // --- Promo Logic Integration ---
    const { promotions } = useData();

    // We need to move activePromotions calculation BEFORE totals so totals can use it
    // But activePromotions needs totals.rawTotal for minPurchase checks...
    // CIRCULAR DEPENDENCY FIX:
    // 1. Calculate Raw Total first.
    // 2. Calculate Active Promos based on Raw Total.
    // 3. Calculate Final Discount based on Applied Promo.
    // 4. Calculate Final Totals (Tax, Service).

    const rawTotal = useMemo(() => {
        return cart.reduce((sum, item) => {
            const itemPrice = item.price || 0;
            const itemDiscount = item.discount || 0;
            return sum + ((itemPrice - itemDiscount) * item.qty);
        }, 0);
    }, [cart]);

    // Helper to check if a promo is applicable to current cart
    const activePromotions = useMemo(() => {
        return calculateActivePromotions(promotions, cart, rawTotal, products);
    }, [cart, promotions, rawTotal, products]);

    // Recalculate totals including dynamic promo discount
    const totals = useMemo(() => {
        const storeTaxRate = parseFloat(currentStore?.taxRate) || 0;
        const storeServiceChargeRate = parseFloat(currentStore?.serviceCharge) || 0;
        const storeTaxType = currentStore?.taxType || 'exclusive';

        let discountAmount = 0;
        let effectiveDiscountType = discountType;

        // If a promo is actively applied, use its DYNAMIC potential discount
        if (appliedPromoId) {
            const activePromo = activePromotions.find(p => p.id === appliedPromoId);
            if (activePromo && activePromo.isApplicable) {
                // Determine discount type based on promo for consistent math
                // If promo is fixed amount (bundle or fixed), handle as amount
                // If promo is percentage, we could pass it as percentage but potentialDiscount is already calculated as AMOUNT.
                // Safest to treat ALL promo discounts as 'amount' override.
                effectiveDiscountType = 'amount';
                discountAmount = activePromo.potentialDiscount;
            } else {
                // Fallback handled by cartLogic if we assume 0 or manual?
                // Logic: If promo applied but invalid, current UI ignores manual discount.
            }
        }
        // Fallback to manual discount if NO promo is applied
        else {
            if (discountType === 'percentage') {
                effectiveDiscountType = 'percentage';
                discountAmount = discountValue; // Pass raw percentage value (e.g. 10)
            } else {
                effectiveDiscountType = 'amount';
                discountAmount = discountValue;
            }
        }

        // Delegate pure calculation
        const result = calculateCartTotals(
            cart,
            effectiveDiscountType,
            discountAmount,
            storeTaxRate,
            storeServiceChargeRate,
            storeTaxType
        );

        return {
            rawTotal: result.subtotal, // cartLogic returns 'subtotal' as the sum of items
            subtotal: result.taxBase, // This aligns with "after discount"
            tax: result.taxAmount,
            serviceCharge: result.serviceCharge,
            discountAmount: result.discountAmount,
            tuslahFee: prescriptionData.tuslahFee,
            finalTotal: result.finalTotal + (parseFloat(prescriptionData.tuslahFee) || 0)
        };

    }, [cart, currentStore, discountType, discountValue, appliedPromoId, activePromotions, prescriptionData]);

    // --- Smart Recommendations ---
    const associations = useMemo(() => {
        const completedTransactions = transactions
            ?.filter(t => t.status === 'completed')
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 200) || [];

        if (completedTransactions.length > 0) {
            return calculateAssociations(completedTransactions);
        }
        return {};
    }, [transactions]);

    const recommendedItems = useMemo(() => {
        return getSmartRecommendations(cart, products, associations);
    }, [cart, products, associations]);

    const availablePromos = activePromotions.filter(p => p.isApplicable);

    // --- Auto-Apply Promotion Logic ---
    useEffect(() => {
        // If the user has explicitly set a manual discount (non-zero value when NOT a promo), 
        // or if they are typing a discount, we might want to respect that.
        // However, the rule here is: If there's an applicable promo and NO manual discount, AUTO-APPLY.

        if (availablePromos.length > 0) {
            // Find the promo with the highest potential discount
            const bestPromo = [...availablePromos].sort((a, b) => b.potentialDiscount - a.potentialDiscount)[0];

            // Auto-apply if:
            // 1. No promo is currently applied
            // 2. OR the currently applied promo is no longer the "best" or no longer applicable
            // 3. AND discountValue is 0 (no manual discount) or the current discountValue MATCHES a previous promo

            if (appliedPromoId !== bestPromo.id) {
                // Only auto-apply if the user hasn't manually overridden with a DIFFERENT discount
                // Checking discountValue === 0 is the safest trigger for "fresh" carts
                if (discountValue === 0) {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setAppliedPromoId(bestPromo.id);
                }
            }
        } else if (appliedPromoId) {
            // If no promos are available but one is still marked as applied, clear it
            setAppliedPromoId(null);
            // Also clear discountValue if it was set by the promo (best effort)
            // To be safe, we only clear it if we are sure it was a promo
        }
    }, [availablePromos, appliedPromoId, discountValue]);



    return {
        // State
        cart,
        activeCategory,
        searchQuery,
        selectedCustomer,
        discountType,
        discountValue,
        paymentMethod,
        cashAmount,
        salesPerson,
        prescriptionData,

        // Calculations
        filteredProducts,
        totals,
        recommendedItems,

        // Promo
        promotions,
        activePromotions,
        availablePromos,

        // Setters
        setCart,
        setActiveCategory,
        setSearchQuery,
        setSelectedCustomer,
        setDiscountType,
        setDiscountValue,
        appliedPromoId, setAppliedPromoId,
        setPaymentMethod,
        setCashAmount,
        setSalesPerson,
        setPrescriptionData,

        // Actions
        addToCart,
        updateQty,
        updateCartItem,
        updateItemUnit,
        clearCart
    };
};
