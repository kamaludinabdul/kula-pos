export const PLAN_LIMITS = {
    free: {
        maxUsers: 2, // 1 Admin + 1 Cashier
        allowedRoles: ['admin', 'owner', 'cashier', 'staff'],
        maxProducts: 100,
        features: ['pos', 'reports.basic']
    },
    pro: {
        maxUsers: 5,
        allowedRoles: ['admin', 'owner', 'cashier', 'staff', 'sales'],
        maxProducts: Infinity,
        features: ['pos', 'reports.advanced', 'stock']
    },
    enterprise: {
        maxUsers: Infinity,
        allowedRoles: ['admin', 'owner', 'cashier', 'staff', 'sales', 'super_admin'],
        maxProducts: Infinity,
        features: ['all']
    }
};

export const checkPlanLimit = (plan, type, value, dynamicPlans = null) => {
    const normalizedPlan = (plan || 'free').toLowerCase().trim();

    // 1. Try to get limits from dynamic plans first
    let limits = null;
    if (dynamicPlans && dynamicPlans[normalizedPlan]) {
        limits = dynamicPlans[normalizedPlan];
    }

    // 2. Fallback to hardcoded limits if not found in dynamic plans
    if (!limits) {
        limits = PLAN_LIMITS[normalizedPlan] || PLAN_LIMITS[Object.keys(PLAN_LIMITS).find(k => k === normalizedPlan)] || PLAN_LIMITS.free;
    }

    if (type === 'users') {
        const maxUsers = limits.maxUsers !== undefined ? limits.maxUsers : (PLAN_LIMITS[normalizedPlan]?.maxUsers ?? 2);

        if (maxUsers === -1 || maxUsers === Infinity) return { allowed: true };
        return {
            allowed: value < maxUsers,
            limit: maxUsers,
            current: value
        };
    }

    if (type === 'roles') {
        // value here is the role string being checked
        // Dynamic plans might not have allowedRoles yet, so we fallback to hardcoded for safety or assume all if strictly dynamic
        // For now, let's mix: if dynamic has it, use it.

        const allowedRoles = limits.allowedRoles || PLAN_LIMITS[normalizedPlan]?.allowedRoles;

        if (!allowedRoles) return { allowed: true }; // Default allow if not specified anywhere
        return {
            allowed: allowedRoles.includes(value),
            allowedRoles: allowedRoles
        };
    }

    if (type === 'products') {
        const maxProducts = limits.maxProducts !== undefined ? limits.maxProducts : (PLAN_LIMITS[normalizedPlan]?.maxProducts ?? 100);

        if (maxProducts === -1 || maxProducts === Infinity) return { allowed: true };
        return {
            allowed: value < maxProducts,
            limit: maxProducts,
            current: value
        };
    }

    return { allowed: true };
};
