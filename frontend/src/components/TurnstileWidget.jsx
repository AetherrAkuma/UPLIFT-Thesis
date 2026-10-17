import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

/**
 * Cloudflare Turnstile Native Widget
 * Compatible with React 19.
 *
 * Props:
 * - onVerify: (token: string) => void
 * - onExpire: () => void
 * - onError: (err: any) => void
 * - theme: 'auto' | 'light' | 'dark'
 * - size: 'normal' | 'compact' | 'flexible'
 */
const TurnstileWidget = forwardRef(({
    onVerify,
    onExpire,
    onError,
    action,
    theme = 'auto',
    size = 'normal',
    className = ''
}, ref) => {
    const containerRef = useRef(null);
    const widgetIdRef = useRef(null);

    const siteKey = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

    useImperativeHandle(ref, () => ({
        reset: () => {
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.reset(widgetIdRef.current);
                } catch (e) {
                    console.warn('Turnstile reset error:', e);
                }
            }
        }
    }));

    const callbacksRef = useRef({ onVerify, onExpire, onError });
    useEffect(() => {
        callbacksRef.current = { onVerify, onExpire, onError };
    });

    useEffect(() => {
        let isMounted = true;

        const renderWidget = () => {
            if (!containerRef.current || !window.turnstile || typeof window.turnstile.render !== 'function') return;

            // If already rendered in this container, do not re-render
            if (widgetIdRef.current) return;

            try {
                const options = {
                    sitekey: siteKey,
                    theme: theme,
                    size: size,
                    callback: (token) => {
                        if (isMounted && callbacksRef.current.onVerify) {
                            callbacksRef.current.onVerify(token);
                        }
                    },
                    'expired-callback': () => {
                        if (isMounted && callbacksRef.current.onExpire) {
                            callbacksRef.current.onExpire();
                        }
                    },
                    'error-callback': (err) => {
                        console.warn('[TurnstileWidget] Challenge error:', err);
                        if (isMounted && callbacksRef.current.onError) {
                            callbacksRef.current.onError(err);
                        }
                    }
                };
                if (action) {
                    options.action = action;
                }
                widgetIdRef.current = window.turnstile.render(containerRef.current, options);
            } catch (renderErr) {
                console.error('[TurnstileWidget] Render error:', renderErr);
                if (isMounted && callbacksRef.current.onError) {
                    callbacksRef.current.onError(renderErr);
                }
            }
        };

        // If Turnstile is already loaded, render immediately
        if (window.turnstile && typeof window.turnstile.render === 'function') {
            renderWidget();
        } else {
            // Find existing script or dynamically inject without async/defer
            const SCRIPT_ID = 'cf-turnstile-script';
            let script = document.getElementById(SCRIPT_ID);

            if (!script) {
                script = document.createElement('script');
                script.id = SCRIPT_ID;
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                script.onload = () => {
                    if (isMounted) renderWidget();
                };
                script.onerror = (e) => {
                    console.error('Failed to load Cloudflare Turnstile script:', e);
                    if (isMounted && callbacksRef.current.onError) {
                        callbacksRef.current.onError(e);
                    }
                };
                document.head.appendChild(script);
            } else {
                script.addEventListener('load', () => {
                    if (isMounted) renderWidget();
                });
                script.addEventListener('error', (e) => {
                    if (isMounted && callbacksRef.current.onError) {
                        callbacksRef.current.onError(e);
                    }
                });
            }
        }

        return () => {
            isMounted = false;
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // Ignore removal error on unmount
                }
                widgetIdRef.current = null;
            }
        };
    }, [siteKey, theme, size, action]);

    return (
        <div className={`flex justify-center items-center my-3 min-h-[65px] ${className}`}>
            <div ref={containerRef} />
        </div>
    );
});

TurnstileWidget.displayName = 'TurnstileWidget';

export default TurnstileWidget;
