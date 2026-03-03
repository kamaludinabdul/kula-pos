/**
 * Calculate loyalty points based on store settings, transaction details, and cart items.
 * 
 * @param {Object} params
 * @param {Object} params.loyaltySettings - Store loyalty settings (isActive, ruleType, minTransactionAmount, pointsReward, ratioAmount, ratioPoints).
 * @param {number} params.transactionTotal - Final transaction total amount.
 * @param {Array} params.cartItems - Array of items in the cart.
 * @param {Array} params.loyaltyProductRules - Array of product rules from the DB.
 * @param {Object|null} params.selectedCustomer - The selected customer object, or null/undefined.
 * 
 * @returns {Object} Result object covering points earned from transaction.
 */
export const calculateLoyaltyPoints = ({ loyaltySettings, transactionTotal, cartItems = [], loyaltyProductRules = [], selectedCustomer }) => {
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
        // 4. Per Product Rule
        else if (ruleType === 'per_product') {
            const productRules = loyaltyProductRules.filter(r => r.rule_type === 'per_product' && r.is_active);

            cartItems.forEach(item => {
                // Find if this item has an active per_product rule
                const rule = productRules.find(r => r.product_ids.includes(item.id));
                if (rule && rule.points_per_item) {
                    pointsEarned += (rule.points_per_item * item.qty);
                }
            });
        }
    }

    const currentPoints = selectedCustomer ? (parseInt(selectedCustomer.loyaltyPoints || selectedCustomer.points) || 0) : 0;
    const customerTotalPoints = currentPoints + pointsEarned;

    return {
        pointsEarned,
        customerTotalPoints
    };
};

/**
 * Calculate stamp increments and rewards based on cart items.
 * 
 * @param {Object} params
 * @param {Array} params.cartItems - Items placed in order.
 * @param {Array} params.loyaltyProductRules - Rules from DB including stamp_card types.
 * @param {Array} params.customerStamps - Customer's existing stamp cards from DB.
 * 
 * @returns {Array} Array of updates for the DB `customer_stamps` table and total bonus points.
 */
export const calculateStampUpdates = ({ cartItems = [], loyaltyProductRules = [], customerStamps = [] }) => {
    const updates = [];
    let bonusPoints = 0;

    const stampRules = loyaltyProductRules.filter(r => r.rule_type === 'stamp_card' && r.is_active);

    stampRules.forEach(rule => {
        // Check if the cart contains any product eligible for this stamp card
        const hasEligibleProduct = cartItems.some(item => rule.product_ids.includes(item.id));

        if (hasEligibleProduct) {
            // Find customer's current progress for this rule
            const currentRecord = customerStamps.find(s => s.rule_id === rule.id);
            let currentStamps = currentRecord ? currentRecord.current_stamps : 0;
            let completedCount = currentRecord ? currentRecord.completed_count : 0;

            // Increment logic (1 stamp per transaction containing the product)
            currentStamps += 1;

            // Check if target reached
            if (currentStamps >= rule.stamp_target) {
                completedCount += 1;
                currentStamps = 0; // Reset
                bonusPoints += (rule.stamp_reward_points || 0); // Add bonus points
            }

            updates.push({
                rule_id: rule.id,
                rule_name: rule.name,
                target_stamps: rule.stamp_target,
                current_stamps: currentStamps,
                completed_count: completedCount,
                reward_reached: currentStamps === 0 && completedCount > (currentRecord ? currentRecord.completed_count : 0)
            });
        }
    });

    return { updates, bonusPoints };
};
