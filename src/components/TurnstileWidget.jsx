import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const TurnstileWidget = forwardRef(({ onVerify, onError, onExpire }, ref) => {
    const containerRef = useRef(null);
    const widgetIdRef = useRef(null);

    const reset = useCallback(() => {
        if (widgetIdRef.current !== null && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
        }
    }, []);

    useImperativeHandle(ref, () => ({
        reset
    }));

    useEffect(() => {
        if (!TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY === 'YOUR_TURNSTILE_SITE_KEY_HERE') {
            console.warn('Turnstile: No site key configured, skipping CAPTCHA');
            return;
        }

        const loadScript = () => {
            return new Promise((resolve) => {
                if (window.turnstile) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.id = 'cf-turnstile-script';
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                script.async = true;
                script.defer = true;
                script.onload = resolve;
                document.head.appendChild(script);
            });
        };

        let isMounted = true;

        loadScript().then(() => {
            if (!isMounted) return;
            
            if (containerRef.current && window.turnstile) {
                if (widgetIdRef.current !== null) {
                    try {
                        window.turnstile.remove(widgetIdRef.current);
                    } catch {
                        console.warn('Turnstile: Error removing widget');
                    }
                    widgetIdRef.current = null;
                }

                // Clear container just in case to prevent double rendering
                containerRef.current.innerHTML = '';
                
                try {
                    widgetIdRef.current = window.turnstile.render(containerRef.current, {
                        sitekey: TURNSTILE_SITE_KEY,
                        callback: (token) => onVerify?.(token),
                        'error-callback': (errorCode) => {
                            console.error('Turnstile Error:', errorCode);
                            onError?.(errorCode);
                        },
                        'expired-callback': () => onExpire?.(),
                        theme: 'light',
                        size: 'flexible',
                    });
                } catch (err) {
                    console.error('Turnstile: Render error:', err);
                    onError?.('render_error');
                }
            }
        });

        return () => {
            isMounted = false;
            if (widgetIdRef.current !== null && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // Ignore removal errors on unmount
                }
            }
        };
    }, [onVerify, onError, onExpire]);

    if (!TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY === 'YOUR_TURNSTILE_SITE_KEY_HERE') {
        return null;
    }

    return (
        <div className="flex flex-col items-center gap-2 w-full">
            <div ref={containerRef} className="flex justify-center min-h-[65px] min-w-[300px]" />
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span>Klik kotak di atas untuk verifikasi keamanan</span>
                <button 
                    type="button" 
                    onClick={reset}
                    className="ml-2 text-blue-600 hover:text-blue-800 font-bold underline flex items-center gap-1"
                    title="Refresh CAPTCHA"
                >
                    Muat Ulang
                </button>
            </div>
        </div>
    );
});

export default TurnstileWidget;
