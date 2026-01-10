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

export const calculateChange = (total, amountPaid) => {
    const paid = parseFloat(amountPaid) || 0;
    const due = parseFloat(total) || 0;
    return Math.max(0, paid - due);
};
