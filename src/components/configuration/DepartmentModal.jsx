import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import { validateDepartment } from '../../domain/configurationDomain';
import { Select } from '../common/Select.jsx';

export function DepartmentModal({ isOpen, onClose, onSave, department = null, allDepartments = [], activeEmployees = [] }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [managerEmployeeId, setManagerEmployeeId] = useState('');
  const [color, setColor] = useState('#129FA9');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (department) {
      setName(department.name || '');
      setCode(department.code || '');
      setManagerEmployeeId(department.managerEmployeeId || '');
      setColor(department.color || '#129FA9');
      setActive(department.active !== false);
    } else {
      setName('');
      setCode('');
      setManagerEmployeeId('');
      setColor('#129FA9');
      setActive(true);
    }
    setErrors({});
  }, [department, isOpen]);

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
    const rawData = { name, code, managerEmployeeId: managerEmployeeId || null, color, active };
    const { isValid, errors: valErrors, cleanData } = validateDepartment(rawData, allDepartments, department?.id);

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
            {department ? 'Edit Department' : 'Create New Department'}
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
              Department Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering"
              className={`config-form-control ${errors.name ? 'error' : ''}`}
            />
            {errors.name && <div className="config-form-error">{errors.name}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="config-form-group">
              <label className="config-form-label">
                Department Code <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. ENG"
                className={`config-form-control ${errors.code ? 'error' : ''}`}
                style={{ textTransform: 'uppercase' }}
              />
              {errors.code && <div className="config-form-error">{errors.code}</div>}
            </div>

            <div className="config-form-group">
              <label className="config-form-label">
                Accent Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ width: '2.5rem', height: '2.5rem', padding: '0.2rem', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: '#ffffff', flexShrink: 0 }}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="config-form-control"
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                />
              </div>
            </div>
          </div>

          <div className="config-form-group">
            <label className="config-form-label">
              Head of Department
            </label>
            <Select
              variant="form"
              value={managerEmployeeId}
              onChange={(e) => setManagerEmployeeId(e.target.value)}
              placeholder="Unassigned"
              options={activeEmployees.map((emp) => ({ value: emp.id, label: `${emp.fullName} (${emp.employeeId})` }))}
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
              Active Status (Selectable for new assignments)
            </span>
          </label>

          <div className="config-modal-footer" style={{ borderTop: 'none', padding: '1rem 0 0 0', backgroundColor: 'transparent' }}>
            <button type="button" onClick={onClose} className="btn-secondary-cancel">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary-teal">
              {isSubmitting ? 'Saving...' : department ? 'Update Department' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
