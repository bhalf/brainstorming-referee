'use client';

import { useState, useEffect } from 'react';

/**
 * Reactive hook that tracks a CSS media query.
 * Returns `true` when the viewport matches the given query string.
 *
 * Uses a lazy initializer for SSR safety (defaults to `false` on the server)
 * and subscribes to the browser `change` event for live updates.
 *
 * @param query - CSS media query string, e.g. `"(max-width: 640px)"`
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
