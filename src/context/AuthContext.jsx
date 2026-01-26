/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { normalizePermissions, getPermissionsForRole } from '../utils/permissions';
import { safeSupabaseQuery } from '../utils/supabaseHelper';

const AuthContext = createContext(null);

const DEFAULT_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 Minutes

/**
 * Helper to check if a JWT token is expired
 * Returns true if expired or invalid, false if still valid
 */
const isTokenExpired = (token) => {
    if (!token) return true;
    try {
        // JWT format: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) return true;

        // Decode the payload (base64url)
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

        if (!payload.exp) return true;

        // exp is in seconds, Date.now() is in milliseconds
        // Add 60 second buffer to avoid edge cases
        const expiryTime = payload.exp * 1000;
        const now = Date.now();
        const isExpired = now >= (expiryTime - 60000);

        if (isExpired) {
            console.log(`Auth: Token expired at ${new Date(expiryTime).toISOString()}, current time: ${new Date(now).toISOString()}`);
        }

        return isExpired;
    } catch (e) {
        console.warn("Auth: Failed to parse JWT expiry:", e.message);
        return true; // Assume expired if we can't parse
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(() => {
        return sessionStorage.getItem('is_app_locked') === 'true';
    });

    const [storeSettings, setStoreSettings] = useState(null);
    const idleTimerRef = useRef(null);
    const lastResetTime = useRef(0);
    const fetchRequestId = useRef(0);
    const profilePromiseRef = useRef(null); // Stores the active promise for profile fetching
    const currentChannel = useRef(null);
    const profileChannelRef = useRef(null);
    const sessionStartTimeRef = useRef(new Date().toISOString());
    const userRef = useRef(user);
    const hasInitializedRef = useRef(false);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // --- Profile Fetching Helper ---
    const fetchUserProfile = useCallback(async (userId, accessToken, retryCount = 0) => {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 500;

        // REQUEST COALESCING: If a fetch is already in progress, return that promise.
        if (profilePromiseRef.current && retryCount === 0) {
            console.log("Auth: Profile fetch already in progress, sharing promise");
            return profilePromiseRef.current;
        }

        const fetchPromise = (async () => {
            console.log('Fetching profile for:', userId, retryCount > 0 ? `(retry ${retryCount})` : '');
            const startTime = performance.now();

            // Add a small delay to allow the environment/connection to settle from previous aborts
            await new Promise(resolve => setTimeout(resolve, 50));

            try {
                // Step 1: Fetch profile only (faster than join)
                console.log('Auth: Step 1: Fetching profile...');
                const profileStart = performance.now();

                const profile = await safeSupabaseQuery({
                    tableName: 'profiles',
                    queryBuilder: (q) => q.eq('id', userId).single(),
                    accessToken,
                    timeout: 15000,
                    fallbackParams: `?id=eq.${userId}&select=*`,
                    processFn: (data) => {
                        if (Array.isArray(data)) return data[0];
                        return data;
                    }
                });

                console.log(`Auth: Profile query took: ${((performance.now() - profileStart) / 1000).toFixed(1)}s`);

                if (!profile) {
                    console.warn("Auth: No profile found for user:", userId);
                    return null;
                }

                // Step 2: Fetch store if profile has store_id
                if (profile?.store_id) {
                    console.log('Auth: Step 2: Fetching store...');
                    const storeStart = performance.now();

                    try {
                        const store = await safeSupabaseQuery({
                            tableName: 'stores',
                            queryBuilder: (q) => q.eq('id', profile.store_id).single(),
                            accessToken,
                            timeout: 10000,
                            fallbackParams: `?id=eq.${profile.store_id}&select=*`,
                            processFn: (data) => {
                                if (Array.isArray(data)) return data[0];
                                return data;
                            }
                        });

                        if (store) {
                            profile.stores = store;
                        }
                    } catch (err) {
                        console.warn("Auth: Store fetch exception:", err.message);
                    }
                    console.log(`Auth: Store query took: ${((performance.now() - storeStart) / 1000).toFixed(1)}s`);
                }

                console.log(`Total profile fetch took: ${((performance.now() - startTime) / 1000).toFixed(1)}s`);

                // Hydrate permissions with FALLBACK for legacy users
                if (profile) {
                    let effectivePermissions = profile.permissions;
                    if (!effectivePermissions || effectivePermissions.length === 0) {
                        effectivePermissions = getPermissionsForRole(profile.role);
                    }

                    const normalized = normalizePermissions(effectivePermissions ? { [profile.role]: effectivePermissions } : null);
                    if (normalized[profile.role]) {
                        profile.permissions = normalized[profile.role];
                    } else {
                        profile.permissions = effectivePermissions || [];
                    }

                    profile.storeId = profile.store_id;
                }

                return profile;
            } catch (err) {
                // Downgrade "AbortError" logs to WARN if we are going to retry
                const isAbort = err.name === 'AbortError' || err.message?.includes('aborted') || err.message === 'Profile query timeout' || err.message === 'Store query timeout';

                if (isAbort && retryCount < MAX_RETRIES) {
                    console.warn(`Auth: Profile fetch aborted/timed-out after ${((performance.now() - startTime) / 1000).toFixed(1)}s:`, err.message);
                } else {
                    console.error(`Auth: Profile fetch failed after ${((performance.now() - startTime) / 1000).toFixed(1)}s:`, err.message);
                }

                // Retry on AbortError (Supabase internal abort)
                if ((err.name === 'AbortError' || err.message?.includes('aborted') ||
                    err.message === 'Profile query timeout' || err.message === 'Store query timeout') && retryCount < MAX_RETRIES) {
                    console.log(`Auth: ${err.message} detected, retrying in ${RETRY_DELAY}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    profilePromiseRef.current = null; // Clear promise to allow retry
                    return fetchUserProfile(userId, accessToken, retryCount + 1);
                }

                throw err;
            } finally {
                if (retryCount === 0) {
                    profilePromiseRef.current = null;
                }
            }
        })();

        if (retryCount === 0) {
            profilePromiseRef.current = fetchPromise;
        }
        return fetchPromise;
    }, []);

    const logout = useCallback(async () => {
        const currentUser = userRef.current;
        if (currentUser) {
            try {
                // record logs BEFORE signing out to ensure valid session
                await supabase.from('audit_logs').insert({ user_id: currentUser.id, action: 'logout' });
                // Set status to Offline
                await supabase.from('profiles').update({ status: 'offline' }).eq('id', currentUser.id);
            } catch (err) {
                console.error("Logout audit failed:", err);
            }
        }
        await supabase.auth.signOut();

        setUser(null);
    }, []);

    // --- Profile Loading Logic ---
    const loadUserSession = useCallback(async (userId, accessToken, requestId) => {
        // Settle delay to avoid "storm" collisions
        await new Promise(r => setTimeout(r, 50));
        console.log("Loading user session for:", userId);
        try {
            const profile = await fetchUserProfile(userId, accessToken);

            // Only update if this is still the latest request (or if it's a coalesced request that finished)
            // With request coalescing, multiple calls might await the same promise.
            // When it resolves, we want the LATEST one to update the state.
            if (requestId !== fetchRequestId.current) {
                console.log(`Auth: Request ID mismatch (Current: ${fetchRequestId.current}, This: ${requestId}). Checking if we should proceed...`);
                // If we already have a user, this stale request is definitely ignored
                if (userRef.current) {
                    console.warn("Auth: User already exists, ignoring stale profile load.");
                    return;
                }
                // If we DON'T have a user, we accept this one to unblock the app
                console.log("Auth: Current user is null, accepting valid profile from stale Request ID to unblock navigation.");
            }

            if (!profile) {
                console.warn("No profile found for user, logging out");
                await logout();
                return;
            }

            console.log("Profile loaded successfully:", profile.name);
            setUser(profile);
            if (profile.stores?.settings) {
                setStoreSettings(profile.stores.settings);
            }

            // Handle Store Channel (Realtime)
            if (profile.store_id) {
                // --- FORCE LOGOUT CHECK (Initial) ---
                if (profile.last_force_logout_at) {
                    const forceTime = new Date(profile.last_force_logout_at).getTime();
                    const sessionTime = new Date(sessionStartTimeRef.current).getTime();
                    if (forceTime > sessionTime) {
                        console.warn("Initial force logout check triggered.");
                        alert("Sesi Anda telah dihentikan oleh Admin.");
                        await logout();
                        return;
                    }
                }

                // Cleanup previous
                if (currentChannel.current) {
                    supabase.removeChannel(currentChannel.current);
                }

                const channel = supabase
                    .channel(`store-${profile.store_id}`)
                    .on('postgres_changes', {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'stores',
                        filter: `id=eq.${profile.store_id}`
                    }, payload => {
                        setStoreSettings(payload.new.settings);
                    })
                    .subscribe();

                currentChannel.current = channel;
            }

            // Handle Profile Changes (Force Logout Realtime)
            if (profileChannelRef.current) supabase.removeChannel(profileChannelRef.current);

            profileChannelRef.current = supabase
                .channel(`profile-${profile.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${profile.id}`
                }, async (payload) => {
                    // Check for force logout
                    if (payload.new.last_force_logout_at) {
                        const forceTime = new Date(payload.new.last_force_logout_at).getTime();
                        const sessionTime = new Date(sessionStartTimeRef.current).getTime();
                        if (forceTime > sessionTime) {
                            alert("Sesi Anda telah dihentikan oleh Admin.");
                            await logout();
                        }
                    }

                    // Update local state if needed (optional)
                    setUser(prev => ({ ...prev, ...payload.new }));
                })
                .subscribe();
        } catch (error) {
            // Ignore AbortError - don't logout user
            if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                console.warn("Profile fetch aborted, ignoring.");
                return;
            }
            console.error("Error loading profile:", error);

            // CRITICAL CHANGE: Do NOT re-throw. 
            // If we re-throw, checkingInitialSession might catch it and we might end up in a weird state.
            // If this fails, we should probably retry or keep loading true?
            // For now, if profile fails, we shouldn't just logout unless it's a 401?
            // But supabase-js handles 401. This is likely network or timeout.
            // Let's NOT logout, but we can't set user.
            // This leaves us in limbo. Ideally we have a "Retry" UI.
            // But to solve the "Redirect to Login" issue, we must NOT let loading=false happen 
            // while user is null IF simple network error.
            if (requestId === fetchRequestId.current) {
                // We could throw specific error to let caller decide
                throw error;
            }
        }
    }, [fetchUserProfile, logout]);

    // --- Listen to Auth State ---
    useEffect(() => {
        let isMounted = true;
        let loadingCompleted = false;

        // SAFETY: Force loading to false after 60 seconds max to prevent stuck state
        // Increased from 5s because Supabase can be slow (especially with cold starts)
        const _safetyTimeout = setTimeout(() => {
            if (isMounted && !loadingCompleted) {
                console.warn("Auth: Safety timeout triggered after 20s, completing loading");
                setLoading(false);
            }
        }, 20000); // Increased to 20s for SDK bypass reliability

        // Helper to mark loading as completed normally
        const completeLoading = () => {
            loadingCompleted = true;
            if (isMounted) setLoading(false);
        };

        const checkInitialSession = async (retryCount = 0) => {
            const MAX_RETRIES = 5;
            const RETRY_DELAY = 300;
            const requestId = ++fetchRequestId.current;

            // --- EMERGENCY RECOVERY (PHASE 8) ---
            // If the environment is killing the SDK, we probe localStorage directly
            if (retryCount === 0) {
                try {
                    const rawAuth = localStorage.getItem('kula-pos-auth');
                    if (rawAuth) {
                        const parsed = JSON.parse(rawAuth);
                        const token = parsed?.access_token;
                        const userId = parsed?.user?.id;

                        if (token && userId) {
                            // Check if token is expired before attempting Emergency Recovery
                            if (isTokenExpired(token)) {
                                console.log("Auth: Emergency Recovery skipped - token expired. Clearing stale session.");
                                localStorage.removeItem('kula-pos-auth');
                                // Don't set hasInitializedRef, let normal auth flow handle it
                            } else {
                                console.log("Auth: Emergency Session Recovery triggered (Found valid storage hint)");
                                // Pre-emptively lock initialization
                                hasInitializedRef.current = true;

                                try {
                                    // Try to load the session using the raw token immediately
                                    await loadUserSession(userId, token, requestId);
                                    console.log("Auth: Emergency Recovery SUCCESS!");
                                    if (isMounted) completeLoading();
                                    return; // EXIT EARLY - WE ARE SAVED!
                                } catch (emergencyError) {
                                    console.warn("Auth: Emergency Recovery attempt failed, falling back to normal loop:", emergencyError.message);
                                    // Don't return, let the normal loop try (maybe SDK recovers)
                                }
                            }
                        }
                    }
                } catch (storageError) {
                    console.warn("Auth: Emergency probe failed:", storageError.message);
                }
            }

            // Increased initial delay significantly for hard-refresh stabilization
            await new Promise(r => setTimeout(r, 500));

            if (hasInitializedRef.current && retryCount === 0) return;
            if (retryCount === 0) hasInitializedRef.current = true;

            try {
                console.log("Auth: Checking initial session...", retryCount > 0 ? `(retry ${retryCount})` : '');
                const startTime = performance.now();

                const { data: { session }, error } = await supabase.auth.getSession();
                const sessionTime = performance.now() - startTime;
                console.log(`Auth: Session check complete (${sessionTime.toFixed(0)}ms):`, session ? "Logged in" : "No session", error);
                if (error) throw error;

                if (session?.user) {
                    const profileStart = performance.now();
                    await loadUserSession(session.user.id, session.access_token, requestId);
                    console.log(`Auth: Initial profile loaded (${(performance.now() - profileStart).toFixed(0)}ms)`);
                    // CRITICAL: Complete loading after profile is loaded for logged-in users!
                    if (isMounted) completeLoading();
                } else {
                    // Complete loading after session check if not logged in
                    if (isMounted && requestId === fetchRequestId.current) {
                        completeLoading();
                    }
                }
            } catch (error) {
                // If aborted, retry before giving up
                if ((error.name === 'AbortError' || error.message?.includes('aborted')) && retryCount < MAX_RETRIES) {
                    const delay = (retryCount * 200) + 300;
                    console.log(`Auth: Session check aborted, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return checkInitialSession(retryCount + 1);
                }

                if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                    console.warn("Auth: Initial session check aborted after retries. Patiently waiting for onAuthStateChange to fire...");
                    // DO NOT completeLoading here! 
                    // Let onAuthStateChange or safetyTimeout handle it.
                    // This prevents premature redirect to /login.
                    return;
                }

                console.error("Auth: Error checking initial session:", error);

                // If we failed to load profile, but session existed?
                // The error catch block here catches BOTH session query error AND loadUserSession error.
                // If loadUserSession failed (e.g. Profile query timeout), we definitely do NOT want to set loading=false 
                // because that will redirect to login (since user is null).
                // Instead, we should probably RETRY?

                if (retryCount < MAX_RETRIES) {
                    console.log(`Auth: Error occurred, retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                    await new Promise(resolve => setTimeout(resolve, 600));
                    return checkInitialSession(retryCount + 1);
                }

                hasInitializedRef.current = true;
                // Only force complete if we really ran out of retries and it's NOT an abort.
                // (Already handled AbortError above)
                console.error("Auth: Final session check failure, completing loading.");
                if (isMounted) completeLoading();
            }
        };

        checkInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;
            console.log(`Auth: State Change Event: ${event}`);

            if (session?.user) {
                // If we already initialized with this exact user, skip redundant load
                // (Prevents ID mismatch race during Emergency Recovery)
                if (hasInitializedRef.current && userRef.current?.id === session.user.id && event !== 'TOKEN_REFRESHED') {
                    console.log(`Auth: Session already active for ${session.user.id}, skipping redundant ${event} load`);
                    return;
                }

                if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
                    // If we just signed in, the login() function might have already started the fetch
                    // But we're removing that manual call, so this listener becomes the primary source.
                    const requestId = ++fetchRequestId.current;
                    hasInitializedRef.current = true;
                    try {
                        await loadUserSession(session.user.id, session.access_token, requestId);
                    } catch (err) {
                        console.error("Auth: Failed to load user session in listener:", err);
                    }
                    if (isMounted) completeLoading();
                }
            } else {
                // Clear state on logout
                setUser(null);
                setStoreSettings(null);
                setIsLocked(false);
                sessionStorage.removeItem('is_app_locked');

                if (currentChannel.current) {
                    supabase.removeChannel(currentChannel.current);
                    currentChannel.current = null;
                }
                completeLoading();
            }
        });

        return () => {
            isMounted = false;
            clearTimeout(_safetyTimeout);
            subscription.unsubscribe();
            if (currentChannel.current) {
                supabase.removeChannel(currentChannel.current);
            }
            if (profileChannelRef.current) {
                supabase.removeChannel(profileChannelRef.current);
            }
        };
    }, [loadUserSession]);

    // --- Lock Screen Logic ---
    const lockScreen = useCallback(() => {
        if (user && !isLocked) {
            setIsLocked(true);
            sessionStorage.setItem('is_app_locked', 'true');
        }
    }, [user, isLocked]);

    const resetIdleTimer = useCallback(() => {
        if (!user || isLocked) return;

        const now = Date.now();
        if (now - lastResetTime.current < 1000) return;
        lastResetTime.current = now;

        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

        let timeoutDuration = DEFAULT_IDLE_TIMEOUT;
        let isEnabled = storeSettings?.autoLockEnabled === true;

        if (storeSettings?.autoLockDuration) {
            timeoutDuration = storeSettings.autoLockDuration * 60 * 1000;
        }

        if (!isEnabled) return;
        idleTimerRef.current = setTimeout(lockScreen, timeoutDuration);
    }, [user, isLocked, lockScreen, storeSettings]);

    useEffect(() => {
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        const handleActivity = () => resetIdleTimer();
        events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
        resetIdleTimer();
        return () => {
            events.forEach(e => window.removeEventListener(e, handleActivity));
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [resetIdleTimer]);

    const unlock = async (pin) => {
        if (!user) return { success: false, message: "User not found" };
        try {
            // Supabase approach: profiles table contains the PIN/PWD if not using Supabase Auth PWD
            // Or we check against metadata.
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('password, pin')
                .eq('id', user.id)
                .single();

            if (error || !profile) return { success: false, message: "User data not found" };

            const correctPin = profile.password || profile.pin;
            if (pin === correctPin) {
                setIsLocked(false);
                sessionStorage.removeItem('is_app_locked');
                resetIdleTimer();
                return { success: true };
            } else {
                return { success: false, message: "Password/PIN Salah" };
            }
        } catch {
            return { success: false, message: "Terjadi kesalahan saat verifikasi" };
        }
    };

    // --- Auth Actions ---
    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            console.error("Login Error:", error);
            let message = error.message;
            if (message === 'Invalid login credentials') message = 'Email atau password salah';
            if (message === 'Email not confirmed') message = 'Email belum dikonfirmasi. Silakan cek inbox Anda.';
            return { success: false, message };
        }

        // Record login history (custom table in Supabase) - Fire and forget
        (async () => {
            try {
                // Fetch profile to get user details for audit log
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name, role, store_id, stores(name)')
                    .eq('id', data.user.id)
                    .single();

                await supabase.from('audit_logs').insert({
                    user_id: data.user.id,
                    action: 'login_success',
                    status: 'success',
                    user_name: profile?.name || data.user.email,
                    user_role: profile?.role || 'unknown',
                    store_id: profile?.store_id,
                    store_name: profile?.stores?.name || null,
                    user_agent: navigator.userAgent,
                    metadata: { email: data.user.email }
                });

                // Set status to Online
                await supabase.from('profiles').update({ status: 'online' }).eq('id', data.user.id);
            } catch (err) {
                console.error("Audit log failed:", err);
            }
        })();

        // We no longer call loadUserSession manually here. 
        // supabase.auth.onAuthStateChange will catch the 'SIGNED_IN' event and handle it.
        // This prevents double-loading during the login flow.

        return { success: true };
    };

    const signup = async (email, password, name, storeName) => {
        // We now handle Store & Profile creation via Database Trigger (handle_new_user)
        // Check supabase_schema.sql for the logic.
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    store_name: storeName, // Trigger looks for this to create store
                    role: 'owner'
                }
            }
        });

        if (error) return { success: false, message: error.message };
        return { success: true };
    };


    const updateStaffPassword = async (staffId, newPassword) => {
        try {
            // In KulaPOS, we store PIN/Password in profiles table for local unlocking
            // This is especially used for staff members.
            const { error } = await supabase
                .from('profiles')
                .update({
                    password: newPassword,
                    pin: newPassword
                })
                .eq('id', staffId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error("Error updating staff password:", error);
            return { success: false, message: error.message };
        }
    };

    const resetPassword = async (email) => {
        try {
            // Determine the correct redirect URL based on the environment
            let redirectUrl = window.location.origin + '/reset-password';

            // Explicitly force the URL for production/staging to ensure no ambiguity
            if (import.meta.env.MODE === 'production') {
                redirectUrl = 'https://kula-pos.web.app/reset-password';
            } else if (import.meta.env.MODE === 'staging') {
                redirectUrl = 'https://kula-pos-staging.web.app/reset-password';
            }

            console.log("Requesting password reset with redirect to:", redirectUrl);

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl
            });
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error("Reset password error:", error);
            return { success: false, message: error.message };
        }
    };

    const checkPermission = useCallback((permission) => {
        if (!user) return false;
        if (user.role === 'super_admin' || user.role === 'owner') return true;

        // Admin usually has all access unless we want to granularly restrict them too. 
        // For now, let's say Admin is also super powerful unless we strictly enforce the schema defaults which we assigned.
        // But our ROLE_PRESETS giv Admin almost everything. So checking 'includes' is fine.

        const perms = user.permissions || [];
        // Check exact match OR if permission is a parent of held permission (e.g. asking for 'dashboard' but has 'dashboard.view')
        // Actually, usually it's: "Does user have permission X?"
        // If X is 'transactions.refund', we need exact match.
        // If X is 'dashboard', we accept 'dashboard.view'.
        return perms.includes(permission) || perms.some(p => p.startsWith(permission + '.'));
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, login, logout, signup, resetPassword, loading, isLocked, unlock, checkPermission, updateStaffPassword }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
