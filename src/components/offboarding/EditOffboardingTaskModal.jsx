import React, { useState, useEffect } from 'react';
import { X, Pencil, AlertTriangle } from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';
import { activityService } from '../../services/activityService.js';
import Select from '../common/Select.jsx';

const buildFormStateFromTask = (task) => ({
  title: task ? (task.currentTitle || task.title || '') : '',
  description: task ? (task.description || '') : '',
  activityTypeId: task ? (task.activityTypeId || 'act-type-1') : 'act-type-1',
  relativeOffsetDays: task ? String(task.relativeOffsetDays) : '0',
});

/**
 * Edits ONE task already on ONE departing person's currently launched offboarding plan instance.
 * Employee-specific only — mirrors AddOffboardingTaskModal's boundary: this only ever touches
 * THIS task instance/its linked activity via offboardingService.updateTaskInInstance(), never the
 * reusable Offboarding Plans configuration, never another person's plan.
 *
 * There is deliberately no editable Due Date field — HR edits Relative Offset (Days) only, and
 * the Due Date shown here is always recalculated live from this launched instance's own already-
 * snapshotted Final Working Date anchor (never a freshly resolved employee canonical date),
 * matching exactly how offboardingService.updateTaskInInstance() will calculate it on save.
 *
 * Completion state is entirely untouched by this modal — editing task details never marks a task
 * Done or Reopens it; that remains the exclusive responsibility of the Done/Reopen action.
 */
export default function EditOffboardingTaskModal({ isOpen, onClose, onSuccess, planInstanceId, task, employeeName, anchorDate }) {
  const [activityTypes, setActivityTypes] = useState([]);
  const [formData, setFormData] = useState(buildFormStateFromTask(task));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(buildFormStateFromTask(task));
      setErrors({});
      setError(null);
      setSubmitting(false);
      loadActivityTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task]);

  const loadActivityTypes = async () => {
    try {
      const types = await activityService.getActiveTypes();
      setActivityTypes(types);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.title.trim()) nextErrors.title = 'Task title is required.';
    if (formData.relativeOffsetDays === '' || Number.isNaN(parseInt(formData.relativeOffsetDays, 10))) {
      nextErrors.relativeOffsetDays = 'Relative Offset (Days) must be a valid number.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      await offboardingService.updateTaskInInstance(planInstanceId, task.id, {
        title: formData.title,
        description: formData.description,
        activityTypeId: formData.activityTypeId,
        relativeOffsetDays: formData.relativeOffsetDays,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const parsedOffset = parseInt(formData.relativeOffsetDays, 10);
  const previewDueDate = anchorDate && !Number.isNaN(parsedOffset)
    ? (() => {
        const d = new Date(anchorDate.slice(0, 10));
        d.setDate(d.getDate() + parsedOffset);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })()
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card xl-modal modal-scroll-shell" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <div className="modal-title-group">
              <div className="modal-icon-badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                <Pencil size={20} />
              </div>
              <div>
                <h3 className="modal-title">Edit Task</h3>
                <p className="modal-subtitle">Update this task for {employeeName || 'this employee'}'s launched plan.</p>
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
                placeholder="e.g. Confirm equipment return"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
              {errors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.title}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Activity Type</label>
              <Select
                variant="form"
                value={formData.activityTypeId}
                onChange={(e) => handleChange('activityTypeId', e.target.value)}
                options={activityTypes.map((at) => ({ value: at.id, label: at.name }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Task Description</label>
              <textarea
                className="form-textarea"
                placeholder="Optional details for this task..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Relative Offset (Days)</label>
              <input
                type="number"
                className="form-input"
                style={{ maxWidth: '220px' }}
                placeholder="e.g. -5, 0, 2"
                value={formData.relativeOffsetDays}
                onChange={(e) => handleChange('relativeOffsetDays', e.target.value)}
              />
              {errors.relativeOffsetDays && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.relativeOffsetDays}</span>}

              <div className="relative-timing-help">
                <p>Set when the task should occur relative to the employee's Final Working Date anchor.</p>
                <ul>
                  <li><strong>0</strong> = On the Final Working Date anchor</li>
                  <li><strong>+ value</strong> = After the Final Working Date anchor (e.g., +2 = 2 days after)</li>
                  <li><strong>− value</strong> = Before the Final Working Date anchor (e.g., −5 = 5 days before)</li>
                </ul>
              </div>

              {previewDueDate && (
                <div style={{ marginTop: '0.6rem', fontSize: '0.815rem', color: 'var(--text-muted)' }}>
                  Recalculated Due Date: <strong style={{ color: 'var(--text-main)' }}>{previewDueDate}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer modal-footer-spacious">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
