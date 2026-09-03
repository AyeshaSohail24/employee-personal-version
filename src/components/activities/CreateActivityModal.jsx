import React, { useState, useEffect } from 'react';
import { X, CheckSquare, AlertCircle } from 'lucide-react';
import { getTodayLocalDateString } from '../../utils/dateUtils';
import { validateActivity } from '../../domain/activityDomain';

export default function CreateActivityModal({
  isOpen,
  onClose,
  onSubmit,
  activityTypes = [],
  employees = [],
  currentUserId = 'emp-001',
}) {
  const [formData, setFormData] = useState({
    title: '',
    typeId: '',
    employeeId: '',
    assigneeId: currentUserId,
    dueDate: getTodayLocalDateString(),
    description: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const activeTypes = activityTypes.filter((t) => t.active !== false);
      const defaultTypeId = activeTypes.length > 0 ? activeTypes[0].id : '';
      const defaultEmpId = employees.length > 0 ? employees[0].id : '';

      setFormData({
        title: '',
        typeId: defaultTypeId,
        employeeId: defaultEmpId,
        assigneeId: currentUserId || defaultEmpId,
        dueDate: getTodayLocalDateString(),
        description: '',
      });
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, activityTypes, employees, currentUserId]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    const validation = validateActivity(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        source: 'Manual',
      });
      onClose();
    } catch (err) {
      setErrors({ form: err.message || 'Failed to create activity.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTypes = activityTypes.filter((t) => t.active !== false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <CheckSquare size={20} />
            </div>
            <div>
              <h3 className="modal-title">Create Manual Activity</h3>
              <p className="modal-subtitle">Add a new operational HR task or follow-up activity</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmitForm}>
          <div className="modal-body">
            {errors.form && (
              <div className="modal-error-alert">
                <AlertCircle size={16} />
                <span>{errors.form}</span>
              </div>
            )}

            {/* Title */}
            <div className="form-group">
              <label className="form-label">
                Activity Title <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className="form-select"
                placeholder="e.g. Conduct 30-Day Check-in Review"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
              {errors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.title}</span>}
            </div>

            {/* Type & Due Date Row */}
            <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Activity Type <span className="required-star">*</span>
                </label>
                <select
                  className="form-select"
                  value={formData.typeId}
                  onChange={(e) => handleChange('typeId', e.target.value)}
                >
                  {activeTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
                {errors.typeId && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.typeId}</span>}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Due Date <span className="required-star">*</span>
                </label>
                <input
                  type="date"
                  className="form-select"
                  value={formData.dueDate}
                  onChange={(e) => handleChange('dueDate', e.target.value)}
                />
                {errors.dueDate && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.dueDate}</span>}
              </div>
            </div>

            {/* Related Employee & Assignee Row */}
            <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Related Employee <span className="required-star">*</span>
                </label>
                <select
                  className="form-select"
                  value={formData.employeeId}
                  onChange={(e) => handleChange('employeeId', e.target.value)}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.status})
                    </option>
                  ))}
                </select>
                {errors.employeeId && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.employeeId}</span>}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Assignee <span className="required-star">*</span>
                </label>
                <select
                  className="form-select"
                  value={formData.assigneeId}
                  onChange={(e) => handleChange('assigneeId', e.target.value)}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeId})
                    </option>
                  ))}
                </select>
                {errors.assigneeId && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.assigneeId}</span>}
              </div>
            </div>

            {/* Source Display (Fixed to Manual) */}
            <div className="form-group">
              <label className="form-label">Activity Source</label>
              <input
                type="text"
                className="form-select"
                value="Manual (User Created)"
                disabled
                style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              />
            </div>

            {/* Notes / Description */}
            <div className="form-group">
              <label className="form-label">Description & Notes (Optional)</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Add additional context or instructions for the assignee..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
