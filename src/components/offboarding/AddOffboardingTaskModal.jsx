import React, { useState, useEffect } from 'react';
import { X, ListPlus, AlertTriangle } from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';
import { activityService } from '../../services/activityService.js';
import Select from '../common/Select.jsx';

const buildInitialFormState = (defaultActivityTypeId) => ({
  title: '',
  description: '',
  activityTypeId: defaultActivityTypeId || 'act-type-1',
  relativeOffsetDays: '0',
});

/**
 * Adds a single task to ONE departing person's currently launched offboarding plan instance.
 * Employee-specific only — never touches the reusable offboardingPlanTasks configuration under
 * Offboarding > Plans, so other people's launched instances and future launches are unaffected.
 * Mirrors Onboarding's AddTaskModal UX pattern, but collects Activity Type (offboarding's own
 * instance editor keeps this field) and never collects Required (no longer a configurable,
 * HR-facing concept in offboarding either) — fields stay Task Title / Activity Type / Relative
 * Offset (Days) / Task Description, matching the reusable Offboarding Plans task editor exactly.
 * Due dates are always calculated from the plan's Final Working Date anchor, never a start date.
 */
export default function AddOffboardingTaskModal({ isOpen, onClose, onSuccess, planInstanceId, employeeName }) {
  const [activityTypes, setActivityTypes] = useState([]);
  const [formData, setFormData] = useState(buildInitialFormState());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadActivityTypes();
      setErrors({});
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const loadActivityTypes = async () => {
    try {
      const types = await activityService.getActiveTypes();
      setActivityTypes(types);
      setFormData(buildInitialFormState(types.length > 0 ? types[0].id : 'act-type-1'));
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
      await offboardingService.addTaskToInstance(planInstanceId, {
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card xl-modal modal-scroll-shell" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <div className="modal-title-group">
              <div className="modal-icon-badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                <ListPlus size={20} />
              </div>
              <div>
                <h3 className="modal-title">Add Offboarding Task</h3>
                <p className="modal-subtitle">Add a task to {employeeName || 'this employee'}'s current offboarding plan.</p>
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
              <label className="form-label">Relative Timing (Day Offset)</label>
              <input
                type="number"
                className="form-input"
                style={{ maxWidth: '220px' }}
                placeholder="e.g. -5, 0, 2"
                value={formData.relativeOffsetDays}
                onChange={(e) => handleChange('relativeOffsetDays', e.target.value)}
              />

              <div className="relative-timing-help">
                <p>Set when the task should occur relative to the employee's Final Working Date.</p>
                <ul>
                  <li><strong>0</strong> = On the Final Working Date</li>
                  <li><strong>+ value</strong> = After the Final Working Date (e.g., +2 = 2 days after)</li>
                  <li><strong>− value</strong> = Before the Final Working Date (e.g., −5 = 5 days before)</li>
                </ul>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Task Description</label>
              <textarea
                className="form-textarea"
                placeholder="Optional details for this task..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
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
