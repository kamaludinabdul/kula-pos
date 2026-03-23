export const createServiceTransaction = ({
    items,
    total,
    paymentMethod,
    amountPaid,
    change,
    customer,
    store,
    user,
    shiftId,
    notes = ''
}) => {
    return {
        storeId: store?.id,
        cashierId: user?.id,
        cashier: user?.name,
        customerId: customer?.id || null,
        customerName: customer?.name || 'Umum',
        date: new Date().toISOString(),
        items: items,
        subtotal: total,
        discount: 0, // Bookings/Hotel typically don't apply POS discounts directly here yet
        tax: 0,
        serviceCharge: 0,
        total: total,
        paymentMethod: paymentMethod,
        amountPaid: amountPaid,
        change: change,
        status: 'completed',
        notes: notes,
        shiftId: shiftId,
        pointsRedeemed: 0,
        pointsRedemptionValue: 0,
        // Optional fields that might be needed by DB
        doctor_name: null,
        prescription_number: null,
        tuslah_fee: 0,
        storeName: store?.name || ''
    };
};

// Helper function to calculate a commission amount safely
export const calculateCommissionAmount = (price, qty, feeType, feeValue) => {
    if (!feeType || parseFloat(feeValue) === 0) return 0;
    const value = parseFloat(feeValue) || 0;
    
    if (feeType === 'percentage') {
        return (price * value) / 100 * qty;
    } else if (feeType === 'fixed') {
        return value * qty;
    }
    return 0;
};
