import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import { validateEmployeeTag, SUPPORTED_TAG_CATEGORIES } from '../../domain/configurationDomain';

const COLOR_PRESETS = [
  '#129FA9', // Rizurf Teal
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#059669', // Green
  '#D97706', // Amber
  '#2563EB', // Indigo Blue
  '#0E848D', // Deep Teal
  '#6366F1', // Indigo
  '#DC2626', // Red
  '#64748B', // Slate
];

export function EmployeeTagModal({ isOpen, onClose, onSave, employeeTag = null, allTags = [] }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [color, setColor] = useState('#129FA9');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (employeeTag) {
      setName(employeeTag.name || '');
      setCategory(employeeTag.category || 'General');
      setColor(employeeTag.color || '#129FA9');
      setActive(employeeTag.active !== false);
    } else {
      setName('');
      setCategory('General');
      setColor('#129FA9');
      setActive(true);
    }
    setErrors({});
  }, [employeeTag, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rawData = { name, category, color, active };
    const { isValid, errors: valErrors, cleanData } = validateEmployeeTag(rawData, allTags, employeeTag?.id);

    if (!isValid) {
      setErrors(valErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(cleanData);
      onClose();
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="config-modal-backdrop">
      <div className="config-modal-card">
        <div className="config-modal-header">
          <h3 className="config-modal-title">
            {employeeTag ? 'Edit Employee Tag' : 'Create New Employee Tag'}
          </h3>
          <button type="button" onClick={onClose} className="config-modal-close">
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="config-modal-body">
          {errors.form && (
            <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#dc2626' }}>
              <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              <span>{errors.form}</span>
            </div>
          )}

          <div className="config-form-group">
            <label className="config-form-label">
              Tag Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Executive Committee"
              className={`config-form-control ${errors.name ? 'error' : ''}`}
            />
            {errors.name && <div className="config-form-error">{errors.name}</div>}
          </div>

          <div className="config-form-group">
            <label className="config-form-label">
              Category <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`config-form-control ${errors.category ? 'error' : ''}`}
            >
              {SUPPORTED_TAG_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && <div className="config-form-error">{errors.category}</div>}
          </div>

          <div className="config-form-group">
            <label className="config-form-label">Badge Color Dot</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: '2px solid #cbd5e1',
                  flexShrink: 0,
                }}
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#129FA9"
                className="config-form-control"
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {COLOR_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: hex,
                    border: color === hex ? '2px solid #0f172a' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                  title={hex}
                />
              ))}
            </div>
          </div>

          <label className="config-form-checkbox-group">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="config-form-checkbox"
            />
            <span style={{ fontSize: '0.8125rem', color: '#1e293b' }}>
              Active Status (Selectable for new assignments)
            </span>
          </label>

          <div className="config-modal-footer" style={{ borderTop: 'none', padding: '1rem 0 0 0', backgroundColor: 'transparent' }}>
            <button type="button" onClick={onClose} className="btn-secondary-cancel">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary-teal">
              {isSubmitting ? 'Saving...' : employeeTag ? 'Update Tag' : 'Create Tag'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
