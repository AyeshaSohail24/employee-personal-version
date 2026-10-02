import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus2,
  UserMinus2,
  UserX2,
  NotebookPen,
  FileText,
  Pin,
  Archive,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import UserClockIcon from './icons/UserClockIcon.jsx';
// The official Rizurf Realty logo (building/R mark + "Rizurf Realty" wordmark) — already placed
// in the project's own `images/` folder (outside `src/`), never copied/moved into `src/assets`
// or `public/`. Vite resolves and bundles a relatively-imported image from anywhere reachable on
// disk, not only from inside `src/`, so a plain ES import referencing it in place is the correct,
// idiomatic way to wire it in — no new asset location was introduced. `logo-dark-mode.png` is the
// variant with a light/white wordmark, needed because the sidebar itself has a dark navy
// background — the standard-ink `logo-light-mode.png`/`Logo.png` would be unreadable here.
// When the sidebar is collapsed, the same image is cropped (CSS) to just its building mark.
import rizurfLogo from '../../../images/logo-dark-mode.png';

// The navigation, by section. A "group" has sub-pages: expanded, it opens in place (accordion);
// collapsed, it opens as a small flyout menu beside the icon.
const SECTIONS = [
  {
    title: 'MAIN',
    items: [
      { type: 'link', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { type: 'link', to: '/employees', label: 'Personnel', icon: Users },
    ],
  },
  {
    title: 'PEOPLE',
    items: [
      // Upcoming (shortlisted candidates / pre-hire offer workflow)
      { type: 'link', to: '/upcoming', label: 'Upcoming', icon: UserClockIcon },
      {
        type: 'group', key: 'onboarding', label: 'Onboarding', icon: UserPlus2, prefix: '/onboarding',
        items: [{ to: '/onboarding/employees', label: 'Progress' }, { to: '/onboarding/plans', label: 'Plans' }],
      },
      {
        type: 'group', key: 'offboarding', label: 'Offboarding', icon: UserMinus2, prefix: '/offboarding',
        items: [{ to: '/offboarding/departing', label: 'Progress' }, { to: '/offboarding/plans', label: 'Plans' }],
      },
      // Former — historical record view over the same Personnel identity (status: Former)
      { type: 'link', to: '/former', label: 'Former', icon: UserX2 },
    ],
  },
  {
    title: 'WORK',
    items: [
      // Notes — personal HR working notepad
      {
        type: 'group', key: 'notes', label: 'Notes', icon: NotebookPen, prefix: '/notes',
        items: [
          { to: '/notes', label: 'My Notes', icon: FileText, end: true },
          { to: '/notes/pinned', label: 'Pinned', icon: Pin },
          { to: '/notes/archived', label: 'Archived', icon: Archive },
        ],
      },
    ],
  },
];

const FLYOUT_CLOSE_DELAY_MS = 180;

/**
 * `collapsed`: icon-only rail (labels as hover/focus tooltips, groups as flyout menus).
 * On phones (CSS ≤ 768px) the sidebar is a slide-in drawer instead, always shown full width —
 * `isMobile` makes sure it renders labels there whatever the collapsed setting is.
 */
export default function Sidebar({ mobileOpen, setMobileOpen, collapsed = false, isMobile = false, onToggleCollapsed }) {
  const location = useLocation();
  const isCollapsed = collapsed && !isMobile;

  // Expanded accordion sub-menus — the one containing the current page opens automatically.
  const [openSections, setOpenSections] = useState(() => Object.fromEntries(
    SECTIONS.flatMap((s) => s.items).filter((i) => i.type === 'group').map((g) => [g.key, location.pathname.startsWith(g.prefix)]),
  ));
  useEffect(() => {
    const group = SECTIONS.flatMap((s) => s.items).find((i) => i.type === 'group' && location.pathname.startsWith(i.prefix));
    if (group) setOpenSections((prev) => ({ ...prev, [group.key]: true }));
  }, [location.pathname]);

  // Collapsed rail: one tooltip and one flyout at a time, positioned beside the hovered/focused
  // icon (fixed, so the nav's own scrolling never clips them).
  const [tooltip, setTooltip] = useState(null); // { label, top, left }
  const [flyout, setFlyout] = useState(null); // { key, top, left }
  const flyoutRef = useRef(null);
  const closeTimer = useRef(null);

  const cancelFlyoutClose = () => clearTimeout(closeTimer.current);
  const scheduleFlyoutClose = () => {
    cancelFlyoutClose();
    closeTimer.current = setTimeout(() => setFlyout(null), FLYOUT_CLOSE_DELAY_MS);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Leaving collapsed mode or changing page clears both.
  useEffect(() => { setTooltip(null); setFlyout(null); }, [isCollapsed, location.pathname]);

  // A flyout closes on Escape (focus back to its icon) or a click anywhere else.
  useEffect(() => {
    if (!flyout) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setFlyout(null);
        document.querySelector(`[data-group-trigger="${flyout.key}"]`)?.focus();
      }
    };
    const onDown = (e) => {
      if (flyoutRef.current?.contains(e.target) || e.target.closest?.(`[data-group-trigger="${flyout.key}"]`)) return;
      setFlyout(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [flyout]);

  const besideIcon = (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + r.height / 2, left: r.right + 12, rectTop: r.top };
  };
  const showTooltip = (e, label) => {
    if (!isCollapsed || flyout) return;
    const { top, left } = besideIcon(e.currentTarget);
    setTooltip({ label, top, left });
  };
  const hideTooltip = () => setTooltip(null);
  const openFlyout = (e, key) => {
    cancelFlyoutClose();
    const { rectTop, left } = besideIcon(e.currentTarget);
    setTooltip(null);
    setFlyout({ key, top: rectTop, left });
  };

  const closeMobile = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Tooltip props for an item in the collapsed rail (also on keyboard focus).
  const tipProps = (label) => (isCollapsed ? {
    onMouseEnter: (e) => showTooltip(e, label),
    onMouseLeave: hideTooltip,
    onFocus: (e) => showTooltip(e, label),
    onBlur: hideTooltip,
    'aria-label': label,
  } : {});

  const renderLink = (item) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        onClick={closeMobile}
        {...tipProps(item.label)}
      >
        <Icon className="nav-icon" size={18} />
        <span className="nav-label">{item.label}</span>
      </NavLink>
    );
  };

  const renderGroup = (group) => {
    const Icon = group.icon;
    const hasActive = location.pathname.startsWith(group.prefix);
    if (isCollapsed) {
      const isOpen = flyout?.key === group.key;
      return (
        <button
          key={group.key}
          type="button"
          data-group-trigger={group.key}
          className={`nav-group-header ${hasActive ? 'has-active' : ''} ${isOpen ? 'is-open' : ''}`}
          aria-label={group.label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onMouseEnter={(e) => openFlyout(e, group.key)}
          onMouseLeave={scheduleFlyoutClose}
          onClick={(e) => (isOpen ? setFlyout(null) : openFlyout(e, group.key))}
        >
          <Icon size={18} />
        </button>
      );
    }
    return (
      <div key={group.key}>
        <button
          type="button"
          className={`nav-group-header ${hasActive ? 'has-active' : ''}`}
          aria-expanded={Boolean(openSections[group.key])}
          onClick={() => toggleSection(group.key)}
        >
          <span className="nav-group-title">
            <Icon size={18} />
            <span className="nav-label">{group.label}</span>
          </span>
          {openSections[group.key] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {openSections[group.key] && (
          <div className="nav-sublist">
            {group.items.map((sub) => (
              <NavLink
                key={sub.to}
                to={sub.to}
                end={sub.end}
                className={({ isActive }) => `subnav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
              >
                {sub.icon && <sub.icon size={14} style={{ marginRight: '0.4rem', verticalAlign: '-2px' }} />}
                {sub.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  const flyoutGroup = flyout && SECTIONS.flatMap((s) => s.items).find((i) => i.key === flyout.key);
  const flyoutTop = flyout ? Math.max(8, Math.min(flyout.top - 8, window.innerHeight - (56 + (flyoutGroup?.items.length ?? 0) * 40))) : 0;

  return (
    <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}>
      {/* Brand Header — the official Rizurf Realty logo already contains both the company symbol
          and the "Rizurf Realty" wordmark, so it is the sole branding element here. Click-through
          to Dashboard as before. Expanded, the collapse button sits beside it. */}
      <div className="sidebar-header">
        <NavLink to="/dashboard" className="brand-title-group" onClick={closeMobile} aria-label="Rizurf Realty — Dashboard">
          <span className="brand-logo-wrap">
            <img src={rizurfLogo} alt="Rizurf Realty" className="brand-logo" />
          </span>
        </NavLink>
        {!isMobile && !isCollapsed && (
          <button type="button" className="sidebar-collapse-btn" onClick={onToggleCollapsed} aria-label="Collapse sidebar" aria-expanded="true" title="Collapse sidebar">
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {!isMobile && isCollapsed && (
        <div className="sidebar-expand-row">
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapsed}
            aria-label="Expand sidebar"
            aria-expanded="false"
            onMouseEnter={(e) => showTooltip(e, 'Expand sidebar')}
            onMouseLeave={hideTooltip}
            onFocus={(e) => showTooltip(e, 'Expand sidebar')}
            onBlur={hideTooltip}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Navigation List */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {SECTIONS.map((section) => (
          <div key={section.title} className="nav-section">
            <div className="nav-section-title">{section.title}</div>
            {section.items.map((item) => (item.type === 'group' ? renderGroup(item) : renderLink(item)))}
          </div>
        ))}
      </nav>

      {isCollapsed && tooltip && (
        <div className="sidebar-tooltip" role="tooltip" style={{ top: tooltip.top, left: tooltip.left }}>
          {tooltip.label}
        </div>
      )}

      {isCollapsed && flyoutGroup && (
        <div
          ref={flyoutRef}
          className="sidebar-flyout"
          role="menu"
          aria-label={flyoutGroup.label}
          style={{ top: flyoutTop, left: flyout.left }}
          onMouseEnter={cancelFlyoutClose}
          onMouseLeave={scheduleFlyoutClose}
        >
          <div className="sidebar-flyout-title">{flyoutGroup.label}</div>
          {flyoutGroup.items.map((sub) => (
            <NavLink
              key={sub.to}
              to={sub.to}
              end={sub.end}
              role="menuitem"
              className={({ isActive }) => `sidebar-flyout-item ${isActive ? 'active' : ''}`}
              onClick={() => setFlyout(null)}
            >
              {sub.icon && <sub.icon size={14} />}
              <span>{sub.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </aside>
  );
}
