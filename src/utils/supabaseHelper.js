import { supabase } from '../supabase';

/**
 * Robust fetch helper that retries on AbortError
 */
export const robustFetch = async (url, options, maxRetries = 3) => {
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (err) {
            const errStr = err.toString();
            const isAbort = err.name === 'AbortError' ||
                errStr.toLowerCase().includes('abort') ||
                errStr.toLowerCase().includes('signal');

            if (isAbort && i < maxRetries) {
                const delay = (i * 300) + 500;
                console.warn(`robustFetch: Abort detected, retrying in ${delay}ms... (${i + 1}/${maxRetries}). Error: ${errStr}`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            console.error(`robustFetch: Permanent failure after ${i} retries. Error: ${errStr}`);
            throw err;
        }
    }
};

/**
 * Helper to get token directly from storage to bypass SDK aborts
 */
export const getDirectAccessToken = () => {
    try {
        const raw = localStorage.getItem('kula-pos-auth');
        if (raw) {
            const parsed = JSON.parse(raw);
            return parsed?.access_token || null;
        }
    } catch (e) {
        console.error("supabaseHelper: Failed to read token from storage", e);
    }
    return null;
};

// Track SDK health - if we see repeated AbortErrors, prefer direct fetch
let sdkFailureCount = 0;
const SDK_FAILURE_THRESHOLD = 0; // Force direct fetch immediately

/**
 * A safe wrapper for Supabase table queries.
 * Handles timeouts and provides a REST API fallback if the SDK call is aborted.
 * Will automatically prefer direct fetch if SDK keeps failing.
 */
export const safeSupabaseQuery = async (options) => {
    const {
        tableName,
        queryBuilder,
        processFn,
        timeout = 15000,
        fallbackParams = '',
        accessToken: providedToken = null
    } = options || {};

    if (!tableName) {
        console.error("safeSupabaseQuery: tableName is required");
        return null;
    }

    // If SDK has been failing repeatedly, go directly to raw fetch
    if (sdkFailureCount >= SDK_FAILURE_THRESHOLD) {
        console.log(`safeSupabaseQuery: SDK has failed ${sdkFailureCount} times, using direct fetch for ${tableName}`);
        try {
            const result = await rawFetchFallback({ tableName, fallbackParams, processFn, accessToken: providedToken });
            // If direct fetch succeeds, reduce failure count (SDK might have recovered)
            if (sdkFailureCount > 0) sdkFailureCount--;
            return result;
        } catch (directErr) {
            console.error(`safeSupabaseQuery: Direct fetch failed for ${tableName}:`, directErr);
            throw directErr;
        }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        let query = supabase.from(tableName).select('*');
        if (queryBuilder && typeof queryBuilder === 'function') {
            query = queryBuilder(query);
        }

        const { data, error } = await query.abortSignal(controller.signal);
        clearTimeout(timeoutId);

        if (error) {
            const errorMsg = error.message || String(error);
            const isAbort = error.name === 'AbortError' ||
                errorMsg.includes('aborted') ||
                errorMsg.includes('timeout') ||
                errorMsg.includes('signal is aborted');

            if (isAbort) {
                sdkFailureCount++;
                console.warn(`safeSupabaseQuery: SDK query for ${tableName} aborted (failure #${sdkFailureCount}). Attempting Raw Fetch Fallback...`);
                return await rawFetchFallback({ tableName, fallbackParams, processFn, accessToken: providedToken });
            }
            throw error;
        }

        // SDK succeeded, reset failure count
        sdkFailureCount = 0;
        return processFn ? processFn(data) : data;
    } catch (err) {
        clearTimeout(timeoutId);
        const errMsg = err.message || String(err);
        if (err.name === 'AbortError' || errMsg.includes('aborted') || errMsg.includes('signal is aborted')) {
            sdkFailureCount++;
            console.warn(`safeSupabaseQuery: caught AbortError for ${tableName} (failure #${sdkFailureCount}). Attempting Raw Fetch Fallback...`);
            return await rawFetchFallback({ tableName, fallbackParams, processFn, accessToken: providedToken });
        }
        console.error(`safeSupabaseQuery: Error fetching ${tableName}:`, err);
        throw err;
    }
};

/**
 * A safe wrapper for Supabase RPC calls.
 */
export const safeSupabaseRpc = async (options) => {
    const {
        rpcName,
        params = {},
        timeout = 20000,
        accessToken: providedToken = null
    } = options || {};

    if (!rpcName) {
        console.error("safeSupabaseRpc: rpcName is required");
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const { data, error } = await supabase.rpc(rpcName, params).abortSignal(controller.signal);
        clearTimeout(timeoutId);

        if (error) {
            const isAbort = error.name === 'AbortError' ||
                error.message?.includes('aborted') ||
                error.message?.includes('timeout') ||
                error.message?.includes('signal is aborted');

            if (isAbort) {
                console.warn(`safeSupabaseRpc: SDK RPC ${rpcName} aborted. Attempting Raw RPC Fallback...`);
                return await rawRpcFallback({ rpcName, params, accessToken: providedToken });
            }
            throw error;
        }

        return data;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            console.warn(`safeSupabaseRpc: caught AbortError for ${rpcName}. Attempting Raw RPC Fallback...`);
            return await rawRpcFallback({ rpcName, params, accessToken: providedToken });
        }
        console.error(`safeSupabaseRpc: Error calling RPC ${rpcName}:`, err);
        throw err;
    }
};

/**
 * Private helper for Raw Fetch Fallback
 */
async function rawFetchFallback({ tableName, fallbackParams, processFn, accessToken }) {
    try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        let token = accessToken;
        if (!token) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                token = session?.access_token;
            } catch {
                console.warn("supabaseHelper: SDK session fetch aborted, using direct storage hint");
            }
        }
        if (!token) token = getDirectAccessToken();

        const authHeader = token ? `Bearer ${token}` : `Bearer ${supabaseKey}`;
        const url = `${supabaseUrl}/rest/v1/${tableName}${fallbackParams ? (fallbackParams.startsWith('?') ? fallbackParams : '?' + fallbackParams) : ''}`;

        const response = await robustFetch(url, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const json = await response.json();
            console.log(`supabaseHelper: Raw Fetch Fallback SUCCESS for ${tableName}`);
            return processFn ? processFn(json) : json;
        }

        // Log specific error for 401 to help with debugging
        if (response.status === 401) {
            console.error(`supabaseHelper: Raw fetch failed with 401 for ${tableName} - token may be expired or invalid`);
        }

        throw new Error(`Raw Fetch Fallback failed with status ${response.status}`);
    } catch (err) {
        console.error(`supabaseHelper: Raw Fetch Fallback failed for ${tableName}:`, err);
        throw err;
    }
}

/**
 * Private helper for Raw RPC Fallback
 */
async function rawRpcFallback({ rpcName, params, accessToken }) {
    try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        let token = accessToken;
        if (!token) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                token = session?.access_token;
            } catch {
                console.warn("supabaseHelper: SDK session fetch aborted, using direct storage hint");
            }
        }
        if (!token) token = getDirectAccessToken();

        const authHeader = token ? `Bearer ${token}` : `Bearer ${supabaseKey}`;
        const url = `${supabaseUrl}/rest/v1/rpc/${rpcName}`;

        const response = await robustFetch(url, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });

        if (response.ok) {
            const json = await response.json();
            console.log(`supabaseHelper: Raw RPC Fallback SUCCESS for ${rpcName}`);
            return json;
        }
        throw new Error(`Raw RPC Fallback failed with status ${response.status}`);
    } catch (err) {
        console.error(`supabaseHelper: Raw RPC Fallback failed for ${rpcName}:`, err);
        throw err;
    }
}
