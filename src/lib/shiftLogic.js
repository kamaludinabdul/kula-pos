/**
 * Calculates the expected cash and differences for a shift closure.
 * 
 * @param {Object} params
 * @param {number} params.initialCash - The starting cash in the drawer
 * @param {number} params.totalCashSales - Total sales paid in cash
 * @param {number} params.totalCashIn - Total manual cash additions (movements)
 * @param {number} params.totalCashOut - Total manual cash withdrawals (movements)
 * @param {number} params.finalCash - The actual physical cash counted
 * @param {number} params.totalNonCashSales - Total sales paid via non-cash methods
 * @param {number} params.finalNonCash - The actual non-cash amount confirmed
 * @returns {Object} Calculated totals and differences
 */
export const calculateShiftClosure = ({
    initialCash = 0,
    totalCashSales = 0,
    totalCashIn = 0,
    totalCashOut = 0,
    finalCash = 0,
    totalNonCashSales = 0,
    finalNonCash = 0
}) => {
    const expectedCash = Number(initialCash) + Number(totalCashSales) + Number(totalCashIn) - Number(totalCashOut);
    const cashDifference = Number(finalCash) - expectedCash;

    const expectedNonCash = Number(totalNonCashSales);
    const nonCashDifference = Number(finalNonCash) - expectedNonCash;

    return {
        expectedCash,
        cashDifference,
        expectedNonCash,
        nonCashDifference
    };
};
