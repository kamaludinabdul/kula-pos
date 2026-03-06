/**
 * Calculates stock reduction across multiple batches using FIFO (First-In-First-Out).
 * 
 * @param {Array} batches - Array of batch objects {id, stock, buy_price, created_at}
 * @param {number} qtyToReduce - Positive number representing quantity to take out
 * @returns {Object} { updatedBatches, totalCOGS, remainingQty }
 */
export const calculateFIFOReduction = (batches, qtyToReduce) => {
    let remainingQty = Number(qtyToReduce);
    let totalCOGS = 0;

    // Clone and sort batches by date (oldest first)
    const sortedBatches = [...batches]
        .map(b => ({ ...b })) // Deepish clone
        .sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date));

    for (let batch of sortedBatches) {
        if (remainingQty <= 0) break;
        if (batch.stock <= 0) continue;

        const take = Math.min(batch.stock, remainingQty);
        batch.stock -= take;
        totalCOGS += (take * (Number(batch.buyPrice) || Number(batch.buy_price) || 0));
        remainingQty -= take;
    }

    return {
        updatedBatches: sortedBatches,
        totalCOGS,
        remainingQty
    };
};

/**
 * Calculates the difference between physical stock and system stock.
 * 
 * @param {number|string} physicalStock - The counted stock
 * @param {number} systemStock - The current stock in the system
 * @returns {number|null} The difference, or null if physicalStock is invalid
 */
export const calculateStockDifference = (physicalStock, systemStock) => {
    if (physicalStock === undefined || physicalStock === '' || physicalStock === null) return null;
    return Number(physicalStock) - (Number(systemStock) || 0);
};

/**
 * Calculates the monetary value of a stock difference.
 * 
 * @param {number|null} difference - The unit difference
 * @param {number} buyPrice - The cost price per unit
 * @returns {number|null} The difference value, or null if difference is null
 */
export const calculateStockDifferenceValue = (difference, buyPrice) => {
    if (difference === null) return null;
    return difference * (Number(buyPrice) || 0);
};

