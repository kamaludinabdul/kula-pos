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
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                script.async = true;
                script.defer = true;
                script.onload = resolve;
                document.head.appendChild(script);
            });
        };

        loadScript().then(() => {
            if (containerRef.current && window.turnstile && widgetIdRef.current === null) {
                // Clear container just in case to prevent double rendering
                containerRef.current.innerHTML = '';
                
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: TURNSTILE_SITE_KEY,
                    callback: (token) => onVerify?.(token),
                    'error-callback': () => onError?.(),
                    'expired-callback': () => onExpire?.(),
                    theme: 'light',
                    size: 'flexible',
                });
            }
        });

        return () => {
            if (widgetIdRef.current !== null && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (!TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY === 'YOUR_TURNSTILE_SITE_KEY_HERE') {
        return null;
    }

    return <div ref={containerRef} className="flex justify-center" />;
});

export default TurnstileWidget;
