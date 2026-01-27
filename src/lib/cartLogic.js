export const calculateCartTotals = (cart, discountType, discountValue, taxRate = 0, serviceRate = 0, taxType = 'exclusive') => {
    // 1. Subtotal = Sum of (Price * Qty)
    const subtotal = cart.reduce((sum, item) => {
        return sum + (item.price * item.qty);
    }, 0);

    // 2. Discount Amount
    let discountAmount = 0;
    if (discountType === 'percentage') {
        // Ensure discount doesn't exceed 100%
        const rate = Math.min(Math.max(parseFloat(discountValue) || 0, 0), 100);
        discountAmount = (subtotal * rate) / 100;
    } else {
        // Fixed amount
        discountAmount = parseFloat(discountValue) || 0;
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    // 3. Tax Base (Subtotal - Discount)
    const taxBasePre = Math.max(0, subtotal - discountAmount);

    // 4. Tax & Service Charge
    let taxAmount = 0;
    let serviceCharge = 0;
    let taxBase = taxBasePre;
    let finalTotal = 0;

    if (taxType === 'inclusive') {
        // Tax is included in the price
        // Formula: Price = TaxBase + Tax
        // Tax = Price - (Price / (1 + Rate))
        taxAmount = taxBasePre - (taxBasePre / (1 + (taxRate / 100)));
        taxBase = taxBasePre - taxAmount;

        // Service charge is typically calculated on the tax base?
        // In usePOS.js: serviceCharge = totalAfterDiscount * (storeServiceChargeRate / 100);
        // Wait, in usePOS.js line 257: serviceCharge = totalAfterDiscount * (storeServiceChargeRate / 100).
        // It seems service charge is on the GROSS amount after discount, not net. 
        // Let's stick to usePOS logic:
        serviceCharge = taxBasePre * (serviceRate / 100);

        // Final total is just taxBasePre + serviceCharge (since tax is inside taxBasePre)
        finalTotal = taxBasePre + serviceCharge;
    } else {
        // Exclusive
        taxBase = taxBasePre;
        taxAmount = taxBase * (taxRate / 100);
        serviceCharge = taxBase * (serviceRate / 100);
        finalTotal = taxBase + taxAmount + serviceCharge;
    }

    return {
        subtotal,
        discountAmount,
        taxBase,
        taxAmount,
        serviceCharge,
        finalTotal
    };
};

// Helper: Hitung Harga Satuan berdasarkan Grosir (Wholesale) atau Bundling (Paket)
export const calculateWholesaleUnitPrice = (product, qty) => {
    const basePrice = parseInt(product.sellPrice || product.price) || 0;

    // Safety check
    if (!product.pricingTiers || product.pricingTiers.length === 0) {
        return basePrice;
    }

    // 1. Sort Tiers: Largest Qty (Duration) first
    const sortedTiers = [...product.pricingTiers]
        .map(t => ({ minQty: parseFloat(t.duration), price: parseFloat(t.price) }))
        .sort((a, b) => b.minQty - a.minQty);

    if (product.isWholesale) {
        // Strategy B: Wholesale (Threshold replacement)
        // Jika Qty >= threshold, gunakan harga tier tersebut untuk SELURUH unit.
        const matchedTier = sortedTiers.find(t => qty >= t.minQty);
        return matchedTier ? matchedTier.price : basePrice;
    } else {
        // Strategy A: Bundling (Greedy Sum / Step-wise)
        // Digunakan untuk Paket Rental atau Paket Food.
        // Formula: Mencari rata-rata harga per unit.
        let totalPrice = 0;
        let remaining = qty;

        for (const tier of sortedTiers) {
            while (remaining >= tier.minQty) {
                totalPrice += tier.price;
                remaining -= tier.minQty;
            }
        }
        if (remaining > 0) {
            totalPrice += remaining * basePrice;
        }
        // Kembalikan harga RATA-RATA per unit agar Cart (qty * price) tetap benar.
        return totalPrice / qty;
    }
};

export const calculateChange = (total, amountPaid) => {
    const paid = parseFloat(amountPaid) || 0;
    const due = parseFloat(total) || 0;
    return Math.max(0, paid - due);
};
