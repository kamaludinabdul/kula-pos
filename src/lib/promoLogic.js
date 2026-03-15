/**
 * Calculates which promotions are applicable based on current cart and products.
 * 
 * @param {Array} promotions - List of all available promotions
 * @param {Array} cart - Current items in cart
 * @param {number} rawTotal - Subtotal before global discounts (but after item discounts)
 * @param {Array} products - Master product list (for price lookups)
 * @returns {Array} List of promotions with isApplicable and potentialDiscount populated
 */
export const calculateActivePromotions = (promotions, cart, rawTotal, products = []) => {
    if (!promotions || promotions.length === 0 || cart.length === 0) return [];

    return promotions.map(promo => {
        let isApplicable = false;
        let potentialDiscount = 0;
        let missingItems = [];

        if (!promo.isActive) return { ...promo, isApplicable: false, potentialDiscount: 0 };

        // 1. Bundle Logic
        if (promo.type === 'bundle') {
            const targetIds = promo.targetIds || [];

            if (targetIds.length === 0) {
                return { ...promo, isApplicable: false, potentialDiscount: 0, missingItems: [] };
            }

            let minSets = Infinity;

            for (const id of targetIds) {
                const item = cart.find(c => c.id === id);
                const qty = item ? item.qty : 0;
                if (qty < minSets) minSets = qty;
            }

            if (minSets >= 1 && minSets !== Infinity) {
                isApplicable = true;
                const oneSetNormalPrice = targetIds.reduce((sum, id) => {
                    const product = products.find(p => p.id === id);
                    const price = Number(product?.sellPrice || product?.price) || 0;
                    return sum + price;
                }, 0);
                const bundlePrice = Number(promo.value !== undefined ? promo.value : promo.discountValue) || 0;
                const oneSetDiscount = Math.max(0, oneSetNormalPrice - bundlePrice);
                const multiplier = (promo.allowMultiples === false) ? 1 : minSets;
                potentialDiscount = oneSetDiscount * multiplier;
            } else {
                missingItems = targetIds.filter(id => {
                    const item = cart.find(c => c.id === id);
                    return !item || item.qty < 1;
                });
            }
        }
        // 2. Percentage on Total Transaction
        else if (promo.type === 'percentage' && (!promo.targetType || promo.targetType === 'transaction')) {
            if (rawTotal >= (Number(promo.minPurchase) || 0)) {
                isApplicable = true;
                const pValue = Number(promo.value !== undefined ? promo.value : promo.discountValue) || 0;
                potentialDiscount = rawTotal * (pValue / 100);
            }
        }
        // 3. Fixed Amount on Total
        else if (promo.type === 'fixed' && (!promo.targetType || promo.targetType === 'transaction')) {
            const minPurchase = Number(promo.minPurchase) || 0;
            const promoValue = Number(promo.value !== undefined ? promo.value : promo.discountValue) || 0;
            if (rawTotal >= minPurchase) {
                isApplicable = true;
                if (promo.allowMultiples && minPurchase > 0) {
                    const multiplier = Math.floor(rawTotal / minPurchase);
                    potentialDiscount = promoValue * multiplier;
                } else {
                    potentialDiscount = promoValue;
                }
            }
        }

        if (potentialDiscount <= 0) isApplicable = false;

        return { ...promo, isApplicable, potentialDiscount, missingItems };
    });
};
