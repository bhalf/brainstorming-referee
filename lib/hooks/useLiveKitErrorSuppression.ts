'use client';

import { useEffect, useRef } from 'react';

/**
 * Suppresses known benign LiveKit errors that would otherwise pollute
 * console output and trigger the Next.js dev error overlay.
 *
 * IMPORTANT: This hook properly cleans up on unmount, restoring
 * the original error handlers. Should only be used inside a
 * LiveKit room context component.
 */

const KNOWN_LIVEKIT_ERRORS = [
    'not part of the array',
    'Unknown DataChannel error',
    'publication of local track timed out',
    'updatePages()',
];

function isKnownLiveKitError(msg: string): boolean {
    return KNOWN_LIVEKIT_ERRORS.some(pattern => msg.includes(pattern));
}

export function useLiveKitErrorSuppression() {
    const originalConsoleErrorRef = useRef<typeof console.error | null>(null);
    const originalOnErrorRef = useRef<OnErrorEventHandler>(null);

    useEffect(() => {
        // Save originals
        originalConsoleErrorRef.current = console.error;
        originalOnErrorRef.current = window.onerror;

        // Override console.error
        const origError = console.error;
        console.error = (...args: unknown[]) => {
            if (typeof args[0] === 'string' && isKnownLiveKitError(args[0])) return;
            origError.apply(console, args);
        };

        // Override window.onerror
        const origOnError = window.onerror;
        window.onerror = function (message, ...rest) {
            if (typeof message === 'string' && isKnownLiveKitError(message)) {
                return true;
            }
            return origOnError ? origOnError.call(this, message, ...rest) : false;
        };

        // Suppress unhandled rejections from LiveKit
        const rejectionHandler = (event: PromiseRejectionEvent) => {
            const msg = event?.reason?.message || String(event?.reason || '');
            if (isKnownLiveKitError(msg)) {
                event.preventDefault();
            }
        };
        window.addEventListener('unhandledrejection', rejectionHandler);

        // Cleanup: restore originals on unmount
        return () => {
            if (originalConsoleErrorRef.current) {
                console.error = originalConsoleErrorRef.current;
            }
            if (originalOnErrorRef.current !== undefined) {
                window.onerror = originalOnErrorRef.current;
            }
            window.removeEventListener('unhandledrejection', rejectionHandler);
        };
    }, []);
}
