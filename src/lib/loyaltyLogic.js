/**
 * Calculate loyalty points based on store settings and transaction details.
 * 
 * @param {Object} params
 * @param {Object} params.loyaltySettings - Store loyalty settings (isActive, ruleType, minTransactionAmount, pointsReward, ratioAmount, ratioPoints).
 * @param {number} params.transactionTotal - Final transaction total amount.
 * @param {Object|null} params.selectedCustomer - The selected customer object, or null/undefined.
 * 
 * @returns {Object} Result object covering points earned and customer total.
 * @property {number} pointsEarned - The points earned from this specific transaction.
 * @property {number} customerTotalPoints - The customer's new total points (existing + earned).
 */
export const calculateLoyaltyPoints = ({ loyaltySettings, transactionTotal, selectedCustomer }) => {
    let pointsEarned = 0;

    // 1. Basic Validation: Loyalty must be active and customer must be selected
    if (loyaltySettings?.isActive && selectedCustomer) {
        const { ruleType, minTransactionAmount, pointsReward, ratioAmount, ratioPoints } = loyaltySettings;

        // 2. Minimum Transaction Rule
        if (ruleType === 'minimum') {
            if (transactionTotal >= (minTransactionAmount || 0)) {
                pointsEarned = parseInt(pointsReward) || 0;
            }
        }

        // 3. Multiple (Ratio) Rule
        else if (ruleType === 'multiple') {
            const step = parseFloat(ratioAmount) || 0;
            if (step > 0) {
                const multipliers = Math.floor(transactionTotal / step);
                pointsEarned = multipliers * (parseInt(ratioPoints) || 0);
            }
        }
    }

    // 4. Calculate Total Points for Customer (Snapshot)
    // If no customer is selected, total points is 0 (or we could return null, but 0 is safer for display)
    const currentPoints = selectedCustomer ? (parseInt(selectedCustomer.loyaltyPoints || selectedCustomer.points) || 0) : 0;
    const customerTotalPoints = currentPoints + pointsEarned;

    return {
        pointsEarned,
        customerTotalPoints
    };
};
