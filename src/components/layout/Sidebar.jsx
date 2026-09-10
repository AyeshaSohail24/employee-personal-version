import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus2,
  UserCheck,
  UserX,
  CheckSquare,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();

  // State to track expanded accordion sub-menus
  const [openSections, setOpenSections] = useState({
    onboarding: location.pathname.startsWith('/onboarding'),
    offboarding: location.pathname.startsWith('/offboarding'),
    activities: location.pathname.startsWith('/activities'),
  });

  React.useEffect(() => {
    if (location.pathname.startsWith('/onboarding')) {
      setOpenSections((prev) => ({ ...prev, onboarding: true }));
    }
    if (location.pathname.startsWith('/offboarding')) {
      setOpenSections((prev) => ({ ...prev, offboarding: true }));
    }
    if (location.pathname.startsWith('/activities')) {
      setOpenSections((prev) => ({ ...prev, activities: true }));
    }
  }, [location.pathname]);

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const closeMobile = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header">
        <NavLink to="/dashboard" className="brand-title-group" onClick={closeMobile}>
          <div className="brand-icon">R</div>
          <div className="brand-text">
            Rizurf <span className="brand-tag">HR</span>
          </div>
        </NavLink>
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav">
        {/* MAIN Section */}
        <div>
          <div className="nav-section-title">MAIN</div>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobile}
          >
            <LayoutDashboard className="nav-icon" size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/employees"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobile}
          >
            <Users className="nav-icon" size={18} />
            <span>Employees</span>
          </NavLink>
        </div>

        {/* PEOPLE Section */}
        <div style={{ marginTop: '1.25rem' }}>
          <div className="nav-section-title">PEOPLE</div>

          {/* Upcoming (shortlisted candidates / pre-hire offer workflow) */}
          <NavLink
            to="/upcoming"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobile}
          >
            <UserPlus2 className="nav-icon" size={18} />
            <span>Upcoming</span>
          </NavLink>

          {/* Onboarding */}
          <div>
            <button
              className="nav-group-header"
              onClick={() => toggleSection('onboarding')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <UserCheck size={18} />
                <span>Onboarding</span>
              </span>
              {openSections.onboarding ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {openSections.onboarding && (
              <div className="nav-sublist">
                <NavLink
                  to="/onboarding/dashboard"
                  className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/onboarding/employees"
                  className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  Employees
                </NavLink>
                <NavLink
                  to="/onboarding/plans"
                  className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  Plans
                </NavLink>
              </div>
            )}
          </div>

          {/* Offboarding */}
          <div>
            <button
              className="nav-group-header"
              onClick={() => toggleSection('offboarding')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <UserX size={18} />
                <span>Offboarding</span>
              </span>
              {openSections.offboarding ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {openSections.offboarding && (
              <div className="nav-sublist">
                <NavLink
                  to="/offboarding/dashboard"
                  className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/offboarding/departing"
                  className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  Departing Employees
                </NavLink>
                <NavLink
                  to="/offboarding/plans"
                  className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  Plans
                </NavLink>
              </div>
            )}
          </div>
        </div>

        {/* WORK Section */}
        <div style={{ marginTop: '1.25rem' }}>
          <div className="nav-section-title">WORK</div>
          
          {/* Activities */}
          <div>
            <button
              className="nav-group-header"
              onClick={() => toggleSection('activities')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckSquare size={18} />
                <span>Activities</span>
              </span>
              {openSections.activities ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {openSections.activities && (
              <div className="nav-sublist">
                <NavLink
                  to="/activities/my"
                  className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  My Activities
                </NavLink>
                <NavLink
                  to="/activities/all"
                  className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  All Activities
                </NavLink>
                <NavLink
                  to="/activities/overdue"
                  className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  Overdue
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </nav>
    </aside>
  );
}

