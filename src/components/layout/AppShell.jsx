import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { prefetchAllPages } from '../../router/lazyPages';

// Sidebar layout, by screen width:
//  - phones (≤ 768px): a slide-in drawer, opened from the header's menu button;
//  - otherwise: a fixed sidebar that can be collapsed to an icon rail. Until someone chooses,
//    it follows the width (collapsed below 1200px, so tablets/small laptops get the room); once
//    they press collapse/expand, that choice is remembered in this browser.
const MOBILE_QUERY = '(max-width: 768px)';
const NARROW_QUERY = '(max-width: 1199px)';
const COLLAPSED_KEY = 'rizurf_sidebar_collapsed';

function readSavedCollapsed() {
  try {
    const value = localStorage.getItem(COLLAPSED_KEY);
    return value === null ? null : value === 'true';
  } catch {
    return null;
  }
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    onChange();
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isNarrow = useMediaQuery(NARROW_QUERY);
  const [savedCollapsed, setSavedCollapsed] = useState(readSavedCollapsed);
  const collapsed = savedCollapsed ?? isNarrow;
  const location = useLocation();

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    setSavedCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      // Not remembered this time (e.g. storage blocked) — still applies for this visit.
    }
  }, [collapsed]);

  // Phone drawer: closes on navigation, on Escape, and when the screen grows past phone size.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => { if (!isMobile) setMobileOpen(false); }, [isMobile]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // Pages are split into their own chunks (router/lazyPages.js) so first load doesn't parse the
  // whole app — then fetched quietly once the browser is idle, so switching tabs later never waits
  // on a chunk download.
  useEffect(() => {
    const schedule = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1500));
    schedule(() => prefetchAllPages());
  }, []);

  return (
    <div className={`app-container ${collapsed && !isMobile ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={collapsed}
        isMobile={isMobile}
        onToggleCollapsed={toggleCollapsed}
      />
      {isMobile && mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}
      <div className="main-wrapper">
        <Header toggleMobileSidebar={() => setMobileOpen(!mobileOpen)} />
        <main className="page-container">
          {/* Sidebar/header stay put while a page chunk loads; only the content area waits. */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
