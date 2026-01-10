/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { normalizePermissions } from '../utils/permissions';

const AuthContext = createContext(null);

const DEFAULT_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 Minutes

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
    const currentChannel = useRef(null);

    // --- Profile Fetching Helper ---
    const fetchUserProfile = useCallback(async (userId) => {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select(`
                *,
                stores (*)
            `)
            .eq('id', userId)
            .single();

        if (error) {
            console.error("Error fetching user profile:", error);
            return null;
        }

        // Hydrate permissions
        const normalized = normalizePermissions(profile.permissions ? { [profile.role]: profile.permissions } : null);
        if (normalized[profile.role]) {
            profile.permissions = normalized[profile.role];
        }

        if (profile) {
            profile.storeId = profile.store_id;
        }

        return profile;
    }, []);

    // --- Listen to Auth State ---
    useEffect(() => {
        let isMounted = true;

        const handleProfileLoad = async (userId) => {
            const requestId = ++fetchRequestId.current;
            try {
                const profile = await fetchUserProfile(userId);

                // Only update if this is still the latest request and component is mounted
                if (!isMounted || requestId !== fetchRequestId.current) return;

                if (profile) {
                    setUser(profile);
                    if (profile.stores?.settings) {
                        setStoreSettings(profile.stores.settings);
                    }

                    // Handle Store Channel (Realtime)
                    if (profile.store_id) {
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
                                if (isMounted) setStoreSettings(payload.new.settings);
                            })
                            .subscribe();

                        currentChannel.current = channel;
                    }
                }
            } catch (error) {
                // Ignore AbortError - don't logout user
                if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                    console.warn("Profile fetch aborted, ignoring.");
                    return;
                }
                console.error("Error loading profile:", error);
            } finally {
                if (isMounted && requestId === fetchRequestId.current) {
                    setLoading(false);
                }
            }
        };

        // Immediately check session on mount
        const checkInitialSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;

                if (session?.user) {
                    await handleProfileLoad(session.user.id);
                } else {
                    if (isMounted) setLoading(false);
                }
            } catch (error) {
                if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                    return; // Ignore
                }
                console.error("Error checking initial session:", error);
                if (isMounted) setLoading(false);
            }
        };

        checkInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            if (session?.user) {
                // Load or refresh profile
                handleProfileLoad(session.user.id);
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
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            if (currentChannel.current) {
                supabase.removeChannel(currentChannel.current);
            }
        };
    }, [fetchUserProfile]);

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
        if (error) return { success: false, message: error.message };

        // Record login history (custom table in Supabase) - Fire and forget
        (async () => {
            try {
                await supabase.from('audit_logs').insert({
                    user_id: data.user.id,
                    action: 'login_success',
                    metadata: { user_agent: navigator.userAgent }
                });
            } catch (err) {
                console.error("Audit log failed:", err);
            }
        })();


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

    const logout = async () => {
        if (user) {
            (async () => {
                try {
                    await supabase.from('audit_logs').insert({ user_id: user.id, action: 'logout' });
                } catch (err) {
                    console.error("Logout audit failed:", err);
                }
            })();
        }
        await supabase.auth.signOut();

        setUser(null);
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

    const checkPermission = useCallback((permission) => {
        if (!user) return false;
        if (user.role === 'super_admin' || user.role === 'owner') return true;
        return (user.permissions || []).includes(permission);
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, login, logout, signup, loading, isLocked, unlock, checkPermission, updateStaffPassword }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
