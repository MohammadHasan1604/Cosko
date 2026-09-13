'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * ScrollManager — Global scroll behavior controller for the AppLayout.
 *
 * Solves:
 * 1. New navigation (sidebar link click) → scroll main content to top
 * 2. Back/Forward (popstate) → restore the saved scroll position
 * 3. Prevents the browser's native scrollRestoration from fighting
 *    with our custom `<main>` scroll container
 * 4. Works across all routes, settings, dashboard, admin pages
 *
 * Architecture:
 * - The scrollable element is `<main id="main-scroll-area">` in AppLayout
 * - We save scroll positions keyed by `pathname + search` in a Map
 * - We distinguish "new navigation" vs "back/forward" using a popstate listener
 */

// Scroll position cache: keyed by full path (pathname + search)
const scrollPositions = new Map<string, number>();

export default function ScrollManager() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPopStateNav = useRef(false);
  const prevPath = useRef<string>('');

  // Build a stable key for the current route
  const getRouteKey = useCallback(() => {
    const search = searchParams?.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);

  // Get the main scroll container
  const getScrollContainer = useCallback((): HTMLElement | null => {
    return document.getElementById('main-scroll-area');
  }, []);

  // 1. Disable browser's native scroll restoration on mount
  //    (it fights with our <main> scroll container)
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // 2. Listen for popstate (back/forward) to flag navigation type
  useEffect(() => {
    const handlePopState = () => {
      isPopStateNav.current = true;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 3. On route change: save old position, then scroll to top or restore
  useEffect(() => {
    const routeKey = getRouteKey();
    const container = getScrollContainer();

    if (!container) return;

    // Save scroll position for the route we're LEAVING
    if (prevPath.current && prevPath.current !== routeKey) {
      scrollPositions.set(prevPath.current, container.scrollTop);
    }

    if (isPopStateNav.current) {
      // Back/Forward navigation → restore saved position
      const savedPosition = scrollPositions.get(routeKey);
      // Use rAF to ensure the DOM has rendered the new page content
      requestAnimationFrame(() => {
        // Double rAF to ensure layout is complete (handles dynamic imports)
        requestAnimationFrame(() => {
          container.scrollTo({
            top: savedPosition ?? 0,
            behavior: 'instant',
          });
        });
      });
      isPopStateNav.current = false;
    } else {
      // New navigation (link click) → scroll to top immediately
      // Use rAF to avoid the flash of old scroll position
      requestAnimationFrame(() => {
        container.scrollTo({
          top: 0,
          behavior: 'instant',
        });
      });
    }

    prevPath.current = routeKey;
  }, [pathname, searchParams, getRouteKey, getScrollContainer]);

  // 4. Save scroll position before page unload (for refresh scenarios)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const container = getScrollContainer();
      if (container) {
        const routeKey = getRouteKey();
        try {
          sessionStorage.setItem(
            `cosko-scroll-${routeKey}`,
            String(container.scrollTop)
          );
        } catch {
          // sessionStorage may be full or disabled — silently ignore
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [getRouteKey, getScrollContainer]);

  // 5. On initial mount, restore from sessionStorage (for page refresh)
  useEffect(() => {
    const routeKey = getRouteKey();
    const container = getScrollContainer();
    if (!container) return;

    try {
      const saved = sessionStorage.getItem(`cosko-scroll-${routeKey}`);
      if (saved !== null) {
        const position = parseInt(saved, 10);
        if (!isNaN(position) && position > 0) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              container.scrollTo({ top: position, behavior: 'instant' });
            });
          });
        }
        // Clean up after restoring
        sessionStorage.removeItem(`cosko-scroll-${routeKey}`);
      }
    } catch {
      // sessionStorage may be disabled — silently ignore
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This component renders nothing — it's purely behavioral
  return null;
}
