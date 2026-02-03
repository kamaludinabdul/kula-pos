export const constructTransactionData = ({
    cart,
    totals,
    user,
    customer,
    activeStoreId,
    paymentMethod,
    amountPaid,
    change,
    notes,
    pointsToRedeem = 0,
    pointsRedemptionValue = 0
}) => {
    // 1. Calculate Gross Subtotal (Sum of Price * Qty)
    const grossTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // 2. Calculate Total Item Discounts (Sum of (Discount * Qty))
    const totalItemDiscounts = cart.reduce((sum, item) => sum + ((item.discount || 0) * item.qty), 0);

    // 3. Total Global Discount (Difference between raw total discounts and item discounts, or just use totals.discountAmount)
    // Wait, totals.discountAmount includes EVERYTHING if configured that way? 
    // Let's rely on the inputs: 
    // totals.discountAmount from usePOS usually includes global % or fixed discounts.
    // BUT we need to be careful not to double count if usePOS logic changes.
    // In the previous fix, we did: discount: totals.discountAmount + totalItemDiscounts
    // indicating totals.discountAmount was ONLY the global discount part.

    const totalDiscountValue = (totals.discountAmount || 0) + totalItemDiscounts;

    // 4. Construct Items Array
    const items = cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        unit: item.unit,
        discount: item.discount || 0,
        buy_price: item.buy_price, // Important for profit calc
        note: item.note
    }));

    return {
        store_id: activeStoreId,
        cashier_id: user?.id,
        cashier_name: user?.name,
        customer_id: customer?.id || null,
        customer_name: customer?.name || 'Umum',
        date: new Date().toISOString(),
        items: items,
        subtotal: grossTotal, // Fix: Use Gross Total
        discount: totalDiscountValue, // Fix: Include Item Discounts
        tax: totals.tax || 0,
        service_charge: totals.serviceCharge || 0,
        total: totals.finalTotal,
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        change: change,
        status: 'completed',
        notes: notes || '',
        points_redeemed: pointsToRedeem,
        points_redemption_value: pointsRedemptionValue
    };
};
