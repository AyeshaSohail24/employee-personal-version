import { useEffect, useRef } from 'react';

// How often an open page quietly re-reads its live data (the Interns DB / Recruitment roster behind
// Personnel, Former, Dashboard, Onboarding, Offboarding and Upcoming). Same knob as the Rizurf
// Discussion directory refresh (RIZURF_AUTO_SYNC.md §1): there's no server timer — Vercel only runs
// on requests — so an open page asks again itself. Every read is live, so a refresh just re-asks.
export const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Calls `refresh` every `intervalMs` while the tab is visible, so a page left open shows people
 * added, removed or changed elsewhere without a reload. A background tab doesn't refresh (browsers
 * throttle its timers anyway); when it's shown again after the interval has passed, it refreshes
 * straight away. `refresh` should update the page quietly (no loading screen) and keep what's shown
 * if it fails — errors are swallowed here. Never runs two refreshes at once.
 *
 * @param {() => Promise<unknown>|unknown} refresh
 * @param {{ intervalMs?: number, enabled?: boolean }} [options]
 */
export function useAutoRefresh(refresh, { intervalMs = AUTO_REFRESH_INTERVAL_MS, enabled = true } = {}) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return undefined;
    let lastRun = Date.now(); // the page has just loaded its data itself
    let running = false;

    const run = async () => {
      if (running) return;
      running = true;
      lastRun = Date.now();
      try {
        await refreshRef.current();
      } catch (err) {
        console.error('Automatic refresh failed — keeping the data already shown:', err);
      } finally {
        running = false;
      }
    };

    const isVisible = () => document.visibilityState === 'visible';
    const timer = setInterval(() => {
      if (isVisible()) run();
    }, intervalMs);
    const onVisibility = () => {
      if (isVisible() && Date.now() - lastRun >= intervalMs) run();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}
