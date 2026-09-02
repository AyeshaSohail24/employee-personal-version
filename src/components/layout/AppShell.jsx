import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-container">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="main-wrapper">
        <Header toggleMobileSidebar={() => setMobileOpen(!mobileOpen)} />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
