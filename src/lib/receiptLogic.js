/**
 * Prepares and calculates totals for receipt display.
 * 
 * @param {Object} transaction - The transaction object from DB
 * @param {Object} store - Store settings
 * @returns {Object} Calculated totals and formatted items
 */
export const prepareReceiptData = (transaction) => {
    const items = (transaction.items || []).map(item => {
        const originalTotal = (Number(item.price) || 0) * (Number(item.qty) || 0);
        const itemDiscountValue = (Number(item.discount) || 0) * (Number(item.qty) || 0);
        const finalItemTotal = originalTotal - itemDiscountValue;

        return {
            ...item,
            originalTotal,
            itemDiscountValue,
            finalItemTotal
        };
    });

    const totalQty = items.reduce((acc, item) => acc + Number(item.qty), 0);
    const subtotal = Number(transaction.subtotal) || Number(transaction.total) || 0;
    const tax = Number(transaction.tax) || 0;
    const serviceCharge = Number(transaction.serviceCharge) || 0;
    const discount = Number(transaction.discount) || 0;
    const finalTotal = Number(transaction.total) || 0;
    const amountPaid = Number(transaction.amountPaid) || finalTotal;
    const change = Number(transaction.change) || 0;

    return {
        items,
        totalQty,
        subtotal,
        tax,
        serviceCharge,
        discount,
        finalTotal,
        amountPaid,
        change
    };
};
