import { useState, useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { calculateAssociations, getSmartRecommendations } from '../utils/smartCashier';

export const usePOS = () => {
    const { products, transactions, currentStore } = useData();

    // --- State ---
    const [cart, setCart] = useState([]);
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

    // --- Cart Actions ---

    // Add Item to Cart
    const addToCart = useCallback((product) => {
        // Basic stock check (can be expanded for services vs goods)
        const currentStock = parseInt(product.stock) || 0;
        const minStock = parseInt(product.minStock) || 5;
        const isService = product.type === 'service';

        setCart((prev) => {
            const existing = prev.find((item) => item.id === product.id);
            const currentQtyInCart = existing ? existing.qty : 0;
            const nextQty = currentQtyInCart + 1;

            if (!isService && nextQty > currentStock) {
                // Notify via callback if available
                if (window.onPOSNotification) window.onPOSNotification('Stok Habis', `Stok produk "${product.name}" tidak mencukupi.`);
                return prev;
            }

            // Low stock warning
            const remaining = currentStock - nextQty;
            if (!isService && remaining <= minStock) {
                if (window.onPOSNotification) window.onPOSNotification('Stok Menipis', `Stok produk "${product.name}" tersisa ${remaining}.`, 'warning');
            }

            if (existing) {
                return prev.map((item) =>
                    item.id === product.id ? { ...item, qty: nextQty } : item
                );
            }
            // Calculate initial discount per unit
            const unitPrice = parseInt(product.sellPrice || product.price) || 0;
            const pDiscount = parseFloat(product.discount) || 0;
            const pDiscountType = product.discountType || 'percent';

            let initialDiscountAmount = 0;
            if (pDiscount > 0) {
                if (pDiscountType === 'fixed') {
                    initialDiscountAmount = pDiscount;
                } else {
                    initialDiscountAmount = unitPrice * (pDiscount / 100);
                }
            }

            return [...prev, {
                ...product,
                qty: 1,
                price: unitPrice,
                discount: initialDiscountAmount
            }];
        });
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

                    if (delta > 0 && !isService && newQty > currentStock) {
                        return item; // Stock limit reached
                    }

                    return { ...item, qty: newQty };
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
    }, []);

    // --- Search & Filter ---

    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            const pCats = Array.isArray(p.category) ? p.category : [p.category];
            const pCatNames = pCats.map(c => (typeof c === 'object' && c?.name) ? c.name.toLowerCase() : String(c).toLowerCase());

            const matchesCategory = activeCategory === 'Semua' || pCatNames.includes(activeCategory.toLowerCase());

            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.code && p.code.toString().toLowerCase().includes(searchQuery.toLowerCase())) ||
                (p.barcode && p.barcode.toString().toLowerCase().includes(searchQuery.toLowerCase()));

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
        if (!promotions || promotions.length === 0 || cart.length === 0) return [];

        return promotions.map(promo => {
            let isApplicable = false;
            let potentialDiscount = 0;
            let missingItems = [];

            // 1. Bundle Logic
            if (promo.type === 'bundle') {
                const targetIds = promo.targetIds || [];
                let minSets = Infinity;

                for (const id of targetIds) {
                    const item = cart.find(c => c.id === id);
                    const qty = item ? item.qty : 0;
                    if (qty < minSets) minSets = qty;
                }

                if (minSets >= 1) {
                    isApplicable = true;
                    const oneSetNormalPrice = targetIds.reduce((sum, id) => {
                        const product = products.find(p => p.id === id);
                        return sum + (product ? (product.sellPrice || product.price) : 0);
                    }, 0);
                    const oneSetDiscount = oneSetNormalPrice - promo.value;
                    const multiplier = (promo.allowMultiples === false) ? 1 : minSets;
                    potentialDiscount = oneSetDiscount * multiplier;
                    if (potentialDiscount < 0) potentialDiscount = 0;
                } else {
                    missingItems = targetIds.filter(id => {
                        const item = cart.find(c => c.id === id);
                        return !item || item.qty < 1;
                    });
                }
            }
            // 2. Percentage on Total Transaction
            else if (promo.type === 'percentage' && (!promo.targetType || promo.targetType === 'transaction')) {
                if (rawTotal >= (promo.minPurchase || 0)) {
                    isApplicable = true;
                    potentialDiscount = rawTotal * (promo.value / 100);
                }
            }
            // 3. Fixed Amount on Total
            else if (promo.type === 'fixed' && (!promo.targetType || promo.targetType === 'transaction')) {
                const minPurchase = promo.minPurchase || 0;
                if (rawTotal >= minPurchase) {
                    isApplicable = true;
                    if (promo.allowMultiples && minPurchase > 0) {
                        const multiplier = Math.floor(rawTotal / minPurchase);
                        potentialDiscount = promo.value * multiplier;
                    } else {
                        potentialDiscount = promo.value;
                    }
                }
            }

            return { ...promo, isApplicable, potentialDiscount, missingItems };
        }).filter(p => p.isActive);
    }, [cart, promotions, rawTotal, products]);

    // Recalculate totals including dynamic promo discount
    const totals = useMemo(() => {
        const storeTaxRate = parseFloat(currentStore?.taxRate) || 0;
        const storeServiceChargeRate = parseFloat(currentStore?.serviceCharge) || 0;
        const storeTaxType = currentStore?.taxType || 'exclusive';

        let discountAmount = 0;

        // If a promo is actively applied, use its DYNAMIC potential discount
        if (appliedPromoId) {
            const activePromo = activePromotions.find(p => p.id === appliedPromoId);
            if (activePromo && activePromo.isApplicable) {
                discountAmount = activePromo.potentialDiscount;
            } else {
                // If promo is no longer applicable (e.g. removed items), fallback to 0 or manual?
                // For now, 0, but maybe we should keep manual discount if promo fails? 
                // Let's assume manual discount (discountValue) is OVERRIDDEN by promo if active.
                // If promo becomes invalid, we default to 0.
            }
        }
        // Fallback to manual discount if NO promo is applied
        else {
            if (discountType === 'percentage') {
                discountAmount = rawTotal * (discountValue / 100);
            } else {
                discountAmount = discountValue;
            }
        }

        if (discountAmount > rawTotal) discountAmount = rawTotal;

        const totalAfterDiscount = rawTotal - discountAmount;
        let tax = 0;
        let subtotal = 0;
        let serviceCharge = 0;
        let finalTotal = 0;

        if (storeTaxType === 'inclusive') {
            tax = totalAfterDiscount - (totalAfterDiscount / (1 + (storeTaxRate / 100)));
            subtotal = totalAfterDiscount - tax;
            serviceCharge = totalAfterDiscount * (storeServiceChargeRate / 100);
            finalTotal = totalAfterDiscount + serviceCharge;
        } else {
            subtotal = totalAfterDiscount;
            tax = subtotal * (storeTaxRate / 100);
            serviceCharge = subtotal * (storeServiceChargeRate / 100);
            finalTotal = subtotal + tax + serviceCharge;
        }

        return {
            rawTotal,
            subtotal,
            tax,
            serviceCharge,
            discountAmount,
            finalTotal
        };

    }, [rawTotal, currentStore, discountType, discountValue, appliedPromoId, activePromotions]);

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

        // Actions
        addToCart,
        updateQty,
        updateCartItem,
        clearCart
    };
};
