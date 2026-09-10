import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, Bell, ChevronRight, User } from 'lucide-react';
import { useRole } from '../../state/RoleContext';

export default function Header({ toggleMobileSidebar }) {
  const location = useLocation();
  const { currentRole } = useRole();

  // Helper to construct dynamic breadcrumbs from URL pathname
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const formatBreadcrumbText = (segment) => {
    return segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className="mobile-toggle"
          onClick={toggleMobileSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} />
        </button>

        {/* Dynamic Breadcrumbs */}
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/dashboard" className="breadcrumb-item">
            Home
          </Link>
          {pathSegments.map((segment, index) => {
            const url = `/${pathSegments.slice(0, index + 1).join('/')}`;
            const isLast = index === pathSegments.length - 1;

            return (
              <React.Fragment key={url}>
                <ChevronRight size={14} style={{ color: 'var(--text-light)' }} />
                {isLast ? (
                  <span className="breadcrumb-current">
                    {formatBreadcrumbText(segment)}
                  </span>
                ) : (
                  <Link to={url} className="breadcrumb-item">
                    {formatBreadcrumbText(segment)}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      <div className="header-right">
        {/* Global Search */}
        <div className="global-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search employees, notes..."
            aria-label="Global Search"
          />
        </div>

        {/* Notification Indicator */}
        <button className="icon-btn" aria-label="Notifications">
          <Bell size={20} />
          <span className="notification-dot" />
        </button>

        {/* Profile Avatar Menu */}
        <div className="user-profile-badge">
          <div className="avatar">AZ</div>
          <div className="user-info">
            <span className="user-name">Ayesha Z.</span>
            <span className="user-role">{currentRole}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

