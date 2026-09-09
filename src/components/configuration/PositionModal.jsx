import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import { validatePosition } from '../../domain/configurationDomain';
import { Select } from '../common/Select.jsx';

export function PositionModal({ isOpen, onClose, onSave, position = null, activeDepartments = [], activeLocations = [] }) {
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [defaultLocationId, setDefaultLocationId] = useState('loc-1');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (position) {
      setName(position.name || '');
      setDepartmentId(position.departmentId || '');
      setDefaultLocationId(position.defaultLocationId || 'loc-1');
      setActive(position.active !== false);
    } else {
      setName('');
      setDepartmentId(activeDepartments.length > 0 ? activeDepartments[0].id : '');
      setDefaultLocationId(activeLocations.length > 0 ? activeLocations[0].id : 'loc-1');
      setActive(true);
    }
    setErrors({});
  }, [position, isOpen, activeDepartments, activeLocations]);

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
    const rawData = { name, departmentId, defaultLocationId, active };
    const { isValid, errors: valErrors, cleanData } = validatePosition(rawData, [], position?.id);

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
            {position ? 'Edit Job Position' : 'Create New Job Position'}
          </h3>
          <button type="button" onClick={onClose} className="config-modal-close">
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="config-modal-body">
          {errors.form && (
            <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', items: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#dc2626' }}>
              <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              <span>{errors.form}</span>
            </div>
          )}

          <div className="config-form-group">
            <label className="config-form-label">
              Position Title <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chief Executive Officer"
              className={`config-form-control ${errors.name ? 'error' : ''}`}
            />
            {errors.name && <div className="config-form-error">{errors.name}</div>}
          </div>

          <div className="config-form-group">
            <label className="config-form-label">
              Department Assignment <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <Select
              variant="form"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="Select Department"
              options={activeDepartments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
            />
            {errors.departmentId && <div className="config-form-error">{errors.departmentId}</div>}
          </div>

          <div className="config-form-group">
            <label className="config-form-label">
              Default Work Location
            </label>
            <Select
              variant="form"
              value={defaultLocationId}
              onChange={(e) => setDefaultLocationId(e.target.value)}
              options={activeLocations.map((l) => ({ value: l.id, label: `${l.name} (${l.type})` }))}
            />
          </div>

          <label className="config-form-checkbox-group">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="config-form-checkbox"
            />
            <span style={{ fontSize: '0.8125rem', color: '#1e293b' }}>
              Active (Available for new hires & transfers)
            </span>
          </label>

          <div className="config-modal-footer" style={{ borderTop: 'none', padding: '1rem 0 0 0', backgroundColor: 'transparent' }}>
            <button type="button" onClick={onClose} className="btn-secondary-cancel">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary-teal">
              {isSubmitting ? 'Saving...' : position ? 'Update Job Position' : 'Create Job Position'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
