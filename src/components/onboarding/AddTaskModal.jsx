import React, { useState, useEffect } from 'react';
import { X, ListPlus, AlertTriangle } from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';

const buildInitialFormState = () => ({
  title: '',
  description: '',
  relativeOffsetDays: '0',
  required: true,
});

/**
 * Adds a single task to ONE employee's currently launched onboarding plan instance.
 * Employee-specific only — never touches the reusable PlanTemplate, so other employees
 * on the same (or any) template, and future plan launches, are unaffected.
 *
 * No assignee rule is collected here: a manually-added checklist item doesn't need
 * assignment logic, so onboardingService.addTaskToInstance() falls back to its existing
 * neutral "Unassigned" default when no rule is supplied — the reusable assignment system
 * (ASSIGNMENT_RULES, resolveAssigneeForRule) is untouched and still fully used by plan
 * templates and the Launch Onboarding Plan workflow.
 */
export default function AddTaskModal({ isOpen, onClose, onSuccess, planInstanceId, employeeName }) {
  const [formData, setFormData] = useState(buildInitialFormState());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitialFormState());
      setErrors({});
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.title.trim()) nextErrors.title = 'Task title is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onboardingService.addTaskToInstance(planInstanceId, {
        title: formData.title,
        description: formData.description,
        relativeOffsetDays: formData.relativeOffsetDays,
        required: formData.required,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const offsetPreview = (() => {
    const n = parseInt(formData.relativeOffsetDays || 0, 10);
    if (Number.isNaN(n)) return '';
    return `Day ${n >= 0 ? `+${n}` : n}`;
  })();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card xl-modal modal-scroll-shell" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <div className="modal-title-group">
              <div className="modal-icon-badge">
                <ListPlus size={20} />
              </div>
              <div>
                <h3 className="modal-title">Add Onboarding Task</h3>
                <p className="modal-subtitle">Add a task to {employeeName || 'this employee'}'s current onboarding plan.</p>
              </div>
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="modal-body modal-body-spacious">
            {error && (
              <div className="modal-error-alert" style={{ marginBottom: '1.25rem' }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Task Title <span className="required-star">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Set up VPN access"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
              {errors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.title}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Optional details for the assignee..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Relative Timing (Day Offset)</label>
              <input
                type="number"
                className="form-input"
                style={{ maxWidth: '220px' }}
                placeholder="e.g. -3, 0, 14"
                value={formData.relativeOffsetDays}
                onChange={(e) => handleChange('relativeOffsetDays', e.target.value)}
              />
              {offsetPreview && <span className="form-hint">{offsetPreview} from the employee's anchor start date</span>}

              <div className="relative-timing-help">
                <p>Set when the task should occur relative to the employee’s start date.</p>
                <ul>
                  <li><strong>0</strong> = On the employee’s start date</li>
                  <li><strong>+ value</strong> = After the start date (e.g., +3 = 3 days after)</li>
                  <li><strong>− value</strong> = Before the start date (e.g., −3 = 3 days before)</li>
                </ul>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-navy-header)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.required}
                  onChange={(e) => handleChange('required', e.target.checked)}
                />
                Required task (counts toward onboarding progress)
              </label>
            </div>
          </div>

          <div className="modal-footer modal-footer-spacious">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding Task...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
