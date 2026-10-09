import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Bell } from 'lucide-react';
import { useNotifications } from '../../state/NotificationContext';
import { notesService } from '../../services/notesService.js';
import { formatReminderLabel } from '../../domain/noteDomain.js';
import { reminderLabel } from '../../services/reminderService.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';

// The Dashboard only shows the 2 soonest-due tasks by default — "See more" reveals the rest in a
// bounded, internally scrollable list, per direct user request ("in dashboard it should only show
// latest 2 only").
const DEFAULT_VISIBLE_COUNT = 2;

/**
 * Dashboard widget: everything that's DUE, soonest first — open Onboarding/Offboarding plan tasks
 * that are overdue, due today or due within 7 days (the ERP reminders feed — the same one behind
 * the header bell, via NotificationContext) plus unread Note reminders (the bell's own). Clicking
 * a task opens that person's plan; a note reminder is marked read and opens the note, exactly as
 * from the bell. No second reminder implementation.
 */
export default function SoonestDueTasksWidget() {
  const { reminders, feedError, unreadNotifications, notifications, markAsRead } = useNotifications();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const tasks = (reminders?.items ?? [])
    .filter((item) => item.kind === 'task')
    .map((item) => ({ ...item, rowKey: item.key, sortDate: item.date }));
  const noteReminders = unreadNotifications
    .filter((n) => n.type !== 'erp_reminder')
    .map((n) => ({ ...n, rowKey: n.id, sortDate: n.dueAt || '' }));
  const sorted = [...tasks, ...noteReminders].sort((a, b) => String(a.sortDate).localeCompare(String(b.sortDate)));
  const visible = expanded ? sorted : sorted.slice(0, DEFAULT_VISIBLE_COUNT);
  const hiddenCount = sorted.length - DEFAULT_VISIBLE_COUNT;

  const handleClick = async (row) => {
    if (row.kind === 'task') {
      // Seeing it here counts as seeing the bell's notification for it, if there is one.
      const bellCopy = notifications.find((n) => n.type === 'erp_reminder' && n.key === row.key && !n.isRead);
      if (bellCopy) await markAsRead(bellCopy.id);
      navigate(row.link);
      return;
    }
    await markAsRead(row.id);
    const note = await notesService.getById(row.noteId).catch(() => null);
    if (!note) return;
    navigate(note.isArchived ? '/notes/archived' : '/notes', { state: { openNoteId: note.id } });
  };

  const timeLabel = (row) => {
    if (row.kind !== 'task') return formatReminderLabel(row.dueAt);
    if (row.state === 'overdue') return `Overdue · ${formatDateDisplay(row.date)}`;
    if (row.state === 'today') return 'Today';
    return formatDateDisplay(row.date);
  };

  return (
    <div className="dashboard-widget">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="widget-icon-badge" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--primary)' }}>
            <ListChecks size={14} />
          </div>
          <div>
            <h3 className="widget-title">Soonest Due Tasks</h3>
            <p className="widget-subtitle">Onboarding/Offboarding tasks due within 7 days or overdue, and note reminders</p>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="empty-widget-text">
          {feedError && !reminders ? 'Couldn’t load tasks right now — they’ll appear on the next refresh.' : 'Nothing due soon.'}
        </p>
      ) : (
        <>
          <div
            className={expanded ? 'dashboard-widget-scroll-list' : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.45rem' }}
          >
            {visible.map((row) => (
              <button
                key={row.rowKey}
                type="button"
                className={`dashboard-task-row ${row.state === 'overdue' ? 'is-overdue' : row.state === 'today' ? 'is-due-today' : ''}`}
                onClick={() => handleClick(row)}
                title={row.kind === 'task' ? `${row.title} — ${row.message}` : row.title}
              >
                <span className="dashboard-task-row-icon">
                  {row.kind === 'task' ? <ListChecks size={12} /> : <Bell size={12} />}
                </span>
                <span className="dashboard-task-row-body">
                  <span className="dashboard-task-row-title">{row.title}</span>
                  <span className="dashboard-task-row-message">
                    {row.kind === 'task' ? `${reminderLabel({ kind: 'task', module: row.module })} · ${row.personName}` : row.message}
                  </span>
                </span>
                <span className="dashboard-task-row-time">{timeLabel(row)}</span>
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
