import React, { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../../state/NotificationContext';
import { iconFor, labelFor, toneFor, useOpenNotification } from './notificationDisplay.js';

// Banners stay 6 s, then slide out (RIZURF_NOTIFICATION_STANDARD.md §1).
const SHOW_MS = 6000;
const LEAVE_MS = 250;

/**
 * New-notification banners, top right over the header — the same banner every Rizurf app shows.
 * Three lines: what it's about (bold, with "now"), the kind of reminder (bold), and the detail.
 * Clicking one opens it exactly like clicking it in the bell (marked read, then its page); ×
 * only dismisses it, and it stays unread in the bell. Which notifications get a banner is decided
 * in NotificationContext.
 */
export default function NotificationBanners() {
  const { banners, dismissBanner } = useNotifications();
  return (
    <div className="notify-stack" role="status" aria-live="polite">
      {banners.map((b) => (
        <NotificationBanner key={b.bannerId} banner={b} onGone={dismissBanner} />
      ))}
    </div>
  );
}

function NotificationBanner({ banner, onGone }) {
  const { notification, bannerId } = banner;
  const openNotification = useOpenNotification();
  const [leaving, setLeaving] = useState(false);
  const goneTimer = useRef(null);

  const dismiss = () => {
    if (goneTimer.current) return;
    setLeaving(true);
    goneTimer.current = setTimeout(() => onGone(bannerId), LEAVE_MS);
  };

  useEffect(() => {
    const timer = setTimeout(dismiss, SHOW_MS);
    return () => { clearTimeout(timer); clearTimeout(goneTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = () => {
    dismiss();
    openNotification(notification);
  };

  const Icon = iconFor(notification);
  const label = labelFor(notification);
  return (
    <div
      className={`notify-banner tone-${toneFor(notification)}${leaving ? ' leaving' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${notification.title}. ${notification.message ?? ''} Opens it and marks it read.`}
      onClick={(e) => (e.target.closest('.notify-banner-close') ? dismiss() : open())}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open(); }}
    >
      <span className="notify-banner-icon" aria-hidden="true"><Icon size={18} /></span>
      <span className="notify-banner-text">
        <span className="notify-banner-head">
          <span className="notify-banner-title">{notification.title}</span>
          <span className="notify-banner-time">now</span>
        </span>
        <span className="notify-banner-sub">{label}</span>
        {notification.message && <span className="notify-banner-body">{notification.message}</span>}
      </span>
      <button type="button" className="notify-banner-close" aria-label="Dismiss">×</button>
    </div>
  );
}
