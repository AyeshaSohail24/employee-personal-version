import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';

/**
 * Confirmation modal for deleting ONE task from ONE employee's already-launched onboarding plan
 * instance. Deletion never happens without this explicit step, and always goes through
 * onboardingService.deleteTaskFromInstance() — never a direct storage write from this component
 * — which only ever touches this one instance's task instances/activities, never the reusable
 * Universal/Department Plans configuration under Onboarding > Plans.
 */
export default function DeleteOnboardingTaskModal({ isOpen, onClose, onSuccess, planInstanceId, task, employeeName }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setDeleting(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !task) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onboardingService.deleteTaskFromInstance(planInstanceId, task.id);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', width: '48px', height: '48px' }}>
              <Trash2 size={22} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem' }}>Delete Task?</h3>
              <p className="modal-subtitle">This only affects {employeeName || 'this employee'}'s launched plan.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
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
            "<strong style={{ color: 'var(--text-main)' }}>{task.currentTitle || task.title}</strong>" will be removed from {employeeName || 'this employee'}'s onboarding plan. This will not affect the reusable onboarding plan configuration under Onboarding &gt; Plans.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
