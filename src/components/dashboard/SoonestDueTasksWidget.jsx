import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Bell } from 'lucide-react';
import { useNotifications } from '../../state/NotificationContext';
import { notesService } from '../../services/notesService.js';
import { formatReminderLabel } from '../../domain/noteDomain.js';

// The Dashboard only shows the 2 soonest-due tasks by default — "See more" reveals the rest in a
// bounded, internally scrollable list, per direct user request ("in dashboard it should only show
// latest 2 only").
const DEFAULT_VISIBLE_COUNT = 2;

/**
 * Dashboard widget showing exactly what the header Bell's NotificationPanel shows (the same
 * `unreadNotifications` from NotificationContext, currently only 'note_reminder' notifications —
 * see notificationService.js), sorted soonest-due-first rather than most-recently-created-first,
 * since "Soonest Due" is this widget's whole point. Clicking a row reuses the SAME
 * markAsRead + navigate-to-note behavior as the Bell dropdown — no second notification
 * implementation.
 */
export default function SoonestDueTasksWidget() {
  const { unreadNotifications, markAsRead } = useNotifications();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const sorted = [...unreadNotifications].sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''));
  const visible = expanded ? sorted : sorted.slice(0, DEFAULT_VISIBLE_COUNT);
  const hiddenCount = sorted.length - DEFAULT_VISIBLE_COUNT;

  const handleClick = async (notification) => {
    await markAsRead(notification.id);
    const note = await notesService.getById(notification.noteId).catch(() => null);
    if (!note) return;
    navigate(note.isArchived ? '/notes/archived' : '/notes', { state: { openNoteId: note.id } });
  };

  return (
    <div className="dashboard-widget">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="widget-icon-badge" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
            <ListChecks size={14} />
          </div>
          <div>
            <h3 className="widget-title">Soonest Due Tasks</h3>
            <p className="widget-subtitle">Everything the notification bell shows, soonest due first</p>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="empty-widget-text">Nothing due soon.</p>
      ) : (
        <>
          <div
            className={expanded ? 'dashboard-widget-scroll-list' : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.4rem' }}
          >
            {visible.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className="dashboard-task-row"
                onClick={() => handleClick(notification)}
                title={notification.title}
              >
                <span className="dashboard-task-row-icon">
                  <Bell size={12} />
                </span>
                <span className="dashboard-task-row-body">
                  <span className="dashboard-task-row-title">{notification.title}</span>
                  <span className="dashboard-task-row-message">{notification.message}</span>
                </span>
                <span className="dashboard-task-row-time">{formatReminderLabel(notification.dueAt)}</span>
              </button>
            ))}
          </div>

          {hiddenCount > 0 && (
            <button type="button" className="dashboard-widget-see-more" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? 'Show less' : `See more (${hiddenCount})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
