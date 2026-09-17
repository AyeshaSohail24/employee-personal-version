import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, Bell, ChevronRight, User } from 'lucide-react';
import { useRole } from '../../state/RoleContext';
import { useSession } from '../../state/SessionContext';
import { useNotifications } from '../../state/NotificationContext';
import NotificationPanel from './NotificationPanel';

function initialsFor(name, email) {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Header({ toggleMobileSidebar }) {
  const location = useLocation();
  const { currentRole } = useRole();
  const session = useSession();
  const { unreadCount } = useNotifications();
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

  // Helper to construct dynamic breadcrumbs from URL pathname
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const formatBreadcrumbText = (segment) => {
    return segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Display-label overrides, keyed by the FULL accumulated path (never by bare segment text) so
  // a route can read differently in the breadcrumb than its URL slug without ever affecting any
  // other route that happens to share the same last segment. The URLs themselves
  // (/employees, /onboarding/employees, /offboarding/departing, /offboarding/employees) are
  // intentionally left unchanged — only these display labels are remapped, so no route/link
  // elsewhere needs to change. '/employees' now reads "Personnel" in the breadcrumb (the
  // top-level workforce directory's user-facing rename), independent of the nested
  // onboarding/offboarding overrides below. '/offboarding/employees' covers the individual
  // detail page's intermediate breadcrumb segment (e.g. Home > Offboarding > Progress > <name>),
  // mirroring how '/onboarding/employees' already cascades into its own detail page.
  const BREADCRUMB_LABEL_OVERRIDES = {
    '/employees': 'Personnel',
    '/onboarding/employees': 'Progress',
    '/offboarding/departing': 'Progress',
    '/offboarding/employees': 'Progress',
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
            const label = BREADCRUMB_LABEL_OVERRIDES[url] || formatBreadcrumbText(segment);

            return (
              <React.Fragment key={url}>
                <ChevronRight size={14} style={{ color: 'var(--text-light)' }} />
                {isLast ? (
                  <span className="breadcrumb-current">
                    {label}
                  </span>
                ) : (
                  <Link to={url} className="breadcrumb-item">
                    {label}
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
            placeholder="Search personnel, notes..."
            aria-label="Global Search"
          />
        </div>

        {/* Notification Bell — the in-app notification center. Currently surfaces Note
            Reminder notifications only; the unread dot is only rendered while there is at
            least one unread notification, never a permanent/fake indicator. */}
        <div className="notification-bell-wrapper">
          <button
            type="button"
            className="icon-btn"
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={isNotificationPanelOpen}
            onClick={() => setIsNotificationPanelOpen((open) => !open)}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="notification-dot" />}
          </button>
          <NotificationPanel isOpen={isNotificationPanelOpen} onClose={() => setIsNotificationPanelOpen(false)} />
        </div>

        {/* Profile Avatar Menu — the real signed-in identity from the gateway
            session (SessionContext), not the app's own capability-role stub
            (RoleContext, still fixed to 'HR' — see its own comment). */}
        <div className="user-profile-badge">
          <div className="avatar">{initialsFor(session.name, session.email)}</div>
          <div className="user-info">
            <span className="user-name">{session.name || session.email}</span>
            <span className="user-role">{session.role ? session.role.toUpperCase() : currentRole}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

