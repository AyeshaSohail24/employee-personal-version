import React, { useState, useEffect } from 'react';
import { X, XCircle, AlertTriangle } from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';

/**
 * Confirmation modal for dropping (cancelling) ONE employee's active onboarding plan instance.
 * Always goes through onboardingService.dropPlanInstance() — never a direct storage write from
 * this component — which marks the instance Dropped (a permanent, non-active terminal state)
 * without erasing any task/activity history, and never touches the employee's own lifecycle
 * status. Only ever rendered for a plan whose derivedStatus is currently active (In Progress /
 * Needs Attention) — the parent page is responsible for that gating.
 */
export default function DropPlanModal({ isOpen, onClose, onSuccess, planInstance, employeeName }) {
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setDropping(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !planInstance) return null;

  const handleDrop = async () => {
    setDropping(true);
    setError(null);
    try {
      await onboardingService.dropPlanInstance(planInstance.id);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setDropping(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', width: '48px', height: '48px' }}>
              <XCircle size={22} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem' }}>Drop Onboarding Plan?</h3>
              <p className="modal-subtitle">{planInstance.template ? planInstance.template.name : 'Onboarding Plan'}</p>
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
            This will stop the onboarding plan for <strong style={{ color: 'var(--text-main)' }}>{employeeName || 'this employee'}</strong>. The plan will no longer be active, but its completed task history will be retained.
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>Progress: <strong style={{ color: 'var(--text-main)' }}>{planInstance.progress ? planInstance.progress.progressPercentage : 0}%</strong></span>
            <span>Tasks: <strong style={{ color: 'var(--text-main)' }}>{planInstance.progress ? `${planInstance.progress.completedTasksCount} of ${planInstance.progress.totalTasks}` : 'N/A'}</strong></span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={dropping}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={handleDrop} disabled={dropping}>
            {dropping ? 'Dropping...' : 'Drop Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
