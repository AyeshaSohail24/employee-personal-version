import React, { useEffect, useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { ApiError } from '../../services/apiClient.js';

/**
 * Confirms removing one task from one person's onboarding plan (same look as DeleteNoteModal).
 * Only this person's plan changes — the task stays in Onboarding > Plans for everyone else.
 */
export default function DeletePlanTaskModal({ task, personName, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape' && !deleting) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, deleting]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : 'Could not remove this task. Please try again.');
      setDeleting(false);
    }
  };

  const name = personName || 'this person';

  return (
    <div className="modal-backdrop" onClick={() => !deleting && onClose()}>
      <div className="modal-card wide-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', width: '48px', height: '48px' }}>
              <Trash2 size={22} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem' }}>Remove Task?</h3>
              <p className="modal-subtitle">From {name}’s onboarding plan only.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={deleting}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error-alert" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            "<strong style={{ color: 'var(--text-main)' }}>{task.title}</strong>" will be removed from {name}’s plan.
            It stays in Onboarding &gt; Plans for everyone else. This can’t be undone.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Removing...' : 'Remove Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
