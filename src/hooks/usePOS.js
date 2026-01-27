import { useState, useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { calculateAssociations, getSmartRecommendations } from '../utils/smartCashier';
import { calculateCartTotals, calculateWholesaleUnitPrice } from '../lib/cartLogic';

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
                return prev.map((item) => {
                    if (item.id === product.id) {
                        const newQty = item.qty + 1;
                        // Recalculate price if tiered pricing exists
                        let newPrice = item.price;
                        if (item.pricingTiers && item.pricingTiers.length > 0) {
                            newPrice = calculateWholesaleUnitPrice(item, newQty);
                        }
                        return { ...item, qty: newQty, price: newPrice };
                    }
                    return item;
                });
            }
            // Calculate initial discount per unit
            const unitPrice = parseInt(product.sellPrice || product.price) || 0;
            const pDiscount = parseFloat(product.discount) || 0;
            const pDiscountType = product.discountType || 'percent';

            // Check initial wholesale price (usually base, but for robustness)
            // Note: quantity is 1 here
            // Check initial tiered price (usually base, but for robustness)
            // Note: quantity is 1 here
            let finalUnitPrice = unitPrice;
            if (product.pricingTiers && product.pricingTiers.length > 0) {
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
            finalTotal: result.finalTotal
        };

    }, [cart, currentStore, discountType, discountValue, appliedPromoId, activePromotions]);

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
