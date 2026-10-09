import React, { Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { prefetchAllPages } from '../../router/lazyPages';

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Phone/tablet drawer (≤ 1000px — see the sidebar rail styles in index.css): Escape closes it too.
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
    <div className="app-container">
      <div className="top-accent" aria-hidden="true" />
      {/* Dark layer behind the phone/tablet drawer; tapping it closes the drawer. */}
      <div className={`sidebar-backdrop ${mobileOpen ? 'visible' : ''}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
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
