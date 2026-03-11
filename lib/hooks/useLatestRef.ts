import { useRef } from 'react';

/**
 * Returns a mutable ref that always holds the latest value.
 * Useful for accessing current props/state inside callbacks and intervals
 * without adding them to dependency arrays or causing re-subscriptions.
 *
 * @param value - The value to keep in sync with the ref.
 * @returns A MutableRefObject whose `.current` is always the latest value.
 */
export function useLatestRef<T>(value: T) {
    const ref = useRef<T>(value);
    ref.current = value;
    return ref;
}
