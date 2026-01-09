
// Simple implementation of Association Rules (Market Basket Analysis)
// Uses a simplified FP-Growth or Apriori-like approach

/**
 * Calculates item associations from a list of transactions.
 * @param {Array} transactions - List of transaction objects with 'items' array.
 * @returns {Object} Map of ItemID -> Array of { id, score }
 */
export const calculateAssociations = (transactions) => {
    const pairCounts = {};
    const itemCounts = {};

    transactions.forEach(t => {
        const uniqueItems = [...new Set(t.items.map(i => i.id))];

        // Count individual occurrences
        uniqueItems.forEach(id => {
            itemCounts[id] = (itemCounts[id] || 0) + 1;
        });

        // Count pairs
        for (let i = 0; i < uniqueItems.length; i++) {
            for (let j = i + 1; j < uniqueItems.length; j++) {
                const itemA = uniqueItems[i];
                const itemB = uniqueItems[j];

                // Create a sorted key to ensure A-B is same as B-A
                const key = [itemA, itemB].sort().join('_');
                pairCounts[key] = (pairCounts[key] || 0) + 1;
            }
        }
    });

    // Convert to easy lookup map
    const associations = {};

    Object.keys(pairCounts).forEach(key => {
        const [itemA, itemB] = key.split('_');
        const count = pairCounts[key];

        // Calculate confidence/lift if needed, for now just raw count is fine for simple sorting
        // Confidence(A -> B) = Count(A,B) / Count(A)

        const scoreA = count / (itemCounts[itemA] || 1);
        const scoreB = count / (itemCounts[itemB] || 1);

        if (!associations[itemA]) associations[itemA] = [];
        if (!associations[itemB]) associations[itemB] = [];

        associations[itemA].push({ id: itemB, score: scoreA, count });
        associations[itemB].push({ id: itemA, score: scoreB, count });
    });

    // Sort by score desc
    Object.keys(associations).forEach(key => {
        associations[key].sort((a, b) => b.score - a.score);
    });

    return associations;
};

/**
 * Generates persuasive scripts based on product relationships
 * @param {string} triggerProduct - Name of the product being bought
 * @param {string} suggestedProduct - Name of the product being suggested
 * @returns {string} One-liner script
 */
export const generateAIScript = (triggerProduct, suggestedProduct) => {
    const templates = [
        `"Cocok banget diminum bareng ${suggestedProduct} kak!"`,
        `"Lagi promo bundling sama ${suggestedProduct} lho."`,
        `"Banyak yang beli ${triggerProduct} sama ${suggestedProduct} juga."`,
        `"Gak sekalian ${suggestedProduct}-nya? Pas buat temen ${triggerProduct}."`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
};

/**
 * Get recommendations for current cart
 * @param {Array} cart - Current cart items
 * @param {Array} allProducts - List of all products
 * @param {Object} associations - Pre-calculated associations
 * @returns {Array} List of recommended products with scripts
 */
export const getSmartRecommendations = (cart, allProducts, associations) => {
    if (cart.length === 0) return [];

    const cartIds = new Set(cart.map(i => i.id));
    const scores = {};
    const triggers = {}; // Keep track of which item triggered the recommendation

    cart.forEach(item => {
        const related = associations[item.id] || [];
        related.forEach(rel => {
            if (!cartIds.has(rel.id)) {
                // Accumulate score if multiple items suggest the same thing
                scores[rel.id] = (scores[rel.id] || 0) + rel.score;

                // Store the trigger if it's the highest scoring one so far
                if (!triggers[rel.id] || rel.score > triggers[rel.id].score) {
                    triggers[rel.id] = { trigger: item.name, score: rel.score };
                }
            }
        });
    });

    // Sort candidates
    const sortedCandidates = Object.keys(scores)
        .sort((a, b) => scores[b] - scores[a])
        .slice(0, 3);

    return sortedCandidates.map(id => {
        const product = allProducts.find(p => p.id === id);
        if (!product) return null;

        const triggerName = triggers[id]?.trigger || 'Pesanan Anda';

        return {
            ...product,
            aiScript: generateAIScript(triggerName, product.name),
            reason: `Sering dibeli dengan ${triggerName}`
        };
    }).filter(Boolean);
};
