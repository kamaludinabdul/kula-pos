export const PLAN_LEVELS = {
    free: 0,
    pro: 1,
    enterprise: 2
};

export const PLANS = {
    free: {
        label: 'Free',
        level: 0,
        price: 0,
        maxUsers: 2,
        maxProducts: 100
    },
    pro: {
        label: 'Pro',
        level: 1,
        price: 0,
        originalPrice: 150000,
        promoLabel: 'Promo',
        maxUsers: 5,
        maxProducts: -1 // Unlimited
    },
    enterprise: {
        label: 'Enterprise',
        level: 2,
        price: 350000,
        maxUsers: -1, // Unlimited
        maxProducts: -1 // Unlimited
    }
};

export const REQUIRED_PLANS = {
    // Reports
    'reports.profit_loss': 'pro',
    'reports.cash_flow': 'pro', // Assuming this feature flag exists or will be mapped
    'reports.inventory_value': 'pro',
    'reports.shifts': 'pro',
    'reports.sales_forecast': 'enterprise',

    // Stock
    'products.stock_opname': 'pro',
    'products.stock_history': 'pro',

    // Staff
    // 'staff.manage': 'pro', // Multi-user (Now Free, limited by quantity)
    'staff.login_history': 'pro',
    'staff.sales_target': 'pro',

    // Settings
    'settings.loyalty': 'pro',
    'settings.telegram': 'pro',

    // Advanced Features
    'features.shopping_recommendations': 'enterprise',
    'rental': 'pro'
};

export const checkPlanAccess = (currentPlan, requiredPlan) => {
    const currentLevel = PLAN_LEVELS[currentPlan || 'free'] || 0;
    const requiredLevel = PLAN_LEVELS[requiredPlan || 'free'] || 0;
    return currentLevel >= requiredLevel;
};

/**
 * Checks if a plan has access to a specific feature, 
 * prioritized by dynamic plan data if provided.
 */
export const hasFeatureAccess = (currentPlan, feature, dynamicPlans = null) => {
    // Feature Aliasing: Some features automatically grant others
    // e.g. Having 'settings.loyalty' also grants 'reports.loyalty'
    const ALIAS_MAP = {
        'reports.loyalty': 'settings.loyalty',
        'reports.performance': 'settings.sales_performance'
    };

    const checkSingle = (feat) => {
        if (dynamicPlans && dynamicPlans[currentPlan]) {
            const planData = dynamicPlans[currentPlan];
            if (planData.features && planData.features.includes(feat)) {
                return true;
            }
        }
        return false;
    };

    // 1. Check direct access (dynamic)
    if (checkSingle(feature)) return true;

    // 2. Check aliased access (dynamic)
    if (ALIAS_MAP[feature] && checkSingle(ALIAS_MAP[feature])) return true;

    // 3. Fallback to hardcoded level-based check
    const requiredPlan = getRequiredPlanForFeature(feature);
    const hasBaseAccess = checkPlanAccess(currentPlan, requiredPlan);

    // Also check base access for the alias
    if (ALIAS_MAP[feature]) {
        const requiredAliasPlan = getRequiredPlanForFeature(ALIAS_MAP[feature]);
        if (checkPlanAccess(currentPlan, requiredAliasPlan)) return true;
    }

    return hasBaseAccess;
};

export const getRequiredPlanForFeature = (feature) => {
    // Direct match
    if (REQUIRED_PLANS[feature]) return REQUIRED_PLANS[feature];

    // Check parent feature (e.g. 'reports.profit_loss' -> check 'reports')
    // This might be too broad, so we stick to specific mappings in REQUIRED_PLANS first.
    // If not found, default to 'free' (accessible)
    return 'free';
};
