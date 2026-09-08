import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCheck,
  UserX,
  CheckSquare,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Shield,
  Briefcase,
  MapPin,
  Network,
  FileText,
  Clock,
  UserPlus
} from 'lucide-react';

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();

  // State to track expanded accordion sub-menus
  const [openSections, setOpenSections] = useState({
    employees: true,
    organization: true,
    onboarding: false,
    offboarding: false,
    activities: location.pathname.startsWith('/activities'),
    reporting: false,
    configuration: false,
  });

  React.useEffect(() => {
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
        {/* Main Section */}
        <div>
          <div className="nav-section-title">Main</div>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobile}
          >
            <LayoutDashboard className="nav-icon" size={18} />
            <span>Dashboard</span>
          </NavLink>
        </div>

        {/* Employees Section */}
        <div>
          <button
            className="nav-group-header"
            onClick={() => toggleSection('employees')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Users size={18} />
              <span>Employees</span>
            </span>
            {openSections.employees ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {openSections.employees && (
            <div className="nav-sublist">
              <NavLink
                to="/employees"
                end
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                All Employees
              </NavLink>
              <NavLink
                to="/employees/active"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Active
              </NavLink>
              <NavLink
                to="/employees/new-joiners"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                New Joiners
              </NavLink>
              <NavLink
                to="/employees/departing"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Departing
              </NavLink>
              <NavLink
                to="/employees/former"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Former Employees
              </NavLink>
              <NavLink
                to="/presence"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Work Status / Presence
              </NavLink>
            </div>
          )}
        </div>

        {/* Organization Section */}
        <div>
          <button
            className="nav-group-header"
            onClick={() => toggleSection('organization')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Building2 size={18} />
              <span>Organization</span>
            </span>
            {openSections.organization ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {openSections.organization && (
            <div className="nav-sublist">
              <NavLink
                to="/organization/departments"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Departments
              </NavLink>
              <NavLink
                to="/organization/org-chart"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Organization Chart
              </NavLink>
              <NavLink
                to="/organization/job-positions"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Job Positions
              </NavLink>
              <NavLink
                to="/organization/work-locations"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Work Locations
              </NavLink>
            </div>
          )}
        </div>

        {/* Onboarding Section */}
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

        {/* Offboarding Section */}
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

        {/* Activities Section */}
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

        {/* Reporting Section */}
        <div>
          <button
            className="nav-group-header"
            onClick={() => toggleSection('reporting')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <BarChart3 size={18} />
              <span>Reporting</span>
            </span>
            {openSections.reporting ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {openSections.reporting && (
            <div className="nav-sublist">
              <NavLink
                to="/reporting/overview"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Workforce Overview
              </NavLink>
              <NavLink
                to="/reporting/headcount"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Headcount
              </NavLink>
              <NavLink
                to="/reporting/hires"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Hires
              </NavLink>
              <NavLink
                to="/reporting/departures"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Departures
              </NavLink>
              <NavLink
                to="/reporting/retention"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Retention
              </NavLink>
            </div>
          )}
        </div>

        {/* Configuration Section */}
        <div>
          <button
            className="nav-group-header"
            onClick={() => toggleSection('configuration')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Settings size={18} />
              <span>Configuration</span>
            </span>
            {openSections.configuration ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {openSections.configuration && (
            <div className="nav-sublist">
              <NavLink
                to="/configuration/organization"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Organization
              </NavLink>
              <NavLink
                to="/configuration/employees"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Employees
              </NavLink>
              <NavLink
                to="/configuration/activities"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Activities
              </NavLink>
              <NavLink
                to="/configuration/presence"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Presence
              </NavLink>
              <NavLink
                to="/configuration/documents"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Documents
              </NavLink>
              <NavLink
                to="/configuration/permissions"
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                Permissions
              </NavLink>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
