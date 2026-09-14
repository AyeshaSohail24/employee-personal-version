import React, { useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, CheckCheck } from 'lucide-react';

/**
 * Overdue Onboarding Tasks popup — reached from the Dashboard's "Overdue Tasks" button
 * instead of a permanently-visible side panel. Presentation-only: the parent page owns
 * fetching the overdue task list (via the existing activityService.getOverdueActivities()
 * path, filtered to source === 'Onboarding') and both the individual and bulk completion
 * handlers, so no new overdue-task data source or calculation is introduced here. "Mark All as
 * Complete" executes immediately on click (no confirmation step) — it calls
 * onMarkAllComplete() directly, the same bulk-complete flow the parent already owns;
 * isMarkingAllComplete (also owned by the parent) disables the button for the duration of that
 * call so a rapid double-click cannot fire it twice.
 */
export default function OverdueTasksModal({ isOpen, onClose, tasks = [], onMarkComplete, onMarkAllComplete, isMarkingAllComplete = false }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-scroll-shell" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="modal-title">Overdue Onboarding Tasks</h3>
              <p className="modal-subtitle">Tasks requiring HR attention</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Bulk-action row — right-aligned, sitting on its own between the header and the task
            list. Horizontal inset matches .modal-body's own 1.5rem padding (not the modal's
            outer edge) so the button's right edge lines up exactly with the task cards below.
            Vertical spacing: 1rem below the header gives it clear separation from the divider
            without crowding it, and 0 bottom padding lets .modal-body's own 1.5rem top padding
            (unchanged) be the single source of the gap before the first card — no doubled-up
            spacing. Entirely absent (not just empty) when there are zero overdue tasks, so no
            empty row/gap is ever left behind. */}
        {tasks.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1.5rem 0 1.5rem' }}>
            <button
              type="button"
              className="btn-success"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              onClick={onMarkAllComplete}
              disabled={isMarkingAllComplete}
            >
              <CheckCheck size={14} />
              <span>{isMarkingAllComplete ? 'Completing...' : 'Mark All as Complete'}</span>
            </button>
          </div>
        )}

        <div className="modal-body">
          {tasks.length === 0 ? (
            <div style={{ padding: '1.5rem 0', textAlign: 'center', color: '#059669', fontSize: '0.85rem' }}>
              <CheckCircle2 size={24} style={{ marginBottom: '0.35rem' }} />
              <div>All onboarding tasks are on schedule!</div>
            </div>
          ) : (
            <div className="notification-list app-scroll-area">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: '0.75rem',
                    background: '#FEF2F2',
                    borderRadius: '6px',
                    border: '1px solid #FECACA',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.815rem', color: '#991B1B' }}>
                      {task.title}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#DC2626', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      Due {task.dueDate}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.735rem', color: '#7F1D1D' }}>
                    For: <strong>{task.relatedEmployee?.fullName || 'Employee'}</strong>
                  </div>
                  <div style={{ textAlign: 'right', marginTop: '0.2rem' }}>
                    <button
                      type="button"
                      className="btn-compact-override"
                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', backgroundColor: '#FFF', color: '#059669', borderColor: '#A7F3D0' }}
                      onClick={() => onMarkComplete(task.id)}
                    >
                      Mark Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
