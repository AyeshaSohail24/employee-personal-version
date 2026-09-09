import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, CheckSquare, PhoneCall, Calendar, FileText, ClipboardCheck, Clock } from 'lucide-react';
import {
  validateActivityType,
  SUPPORTED_ACTIVITY_CATEGORIES,
  SUPPORTED_ACTIVITY_ICONS,
} from '../../domain/configurationDomain';
import { Select } from '../common/Select.jsx';

const ICON_MAP = {
  CheckSquare,
  PhoneCall,
  Calendar,
  FileText,
  ClipboardCheck,
  Clock,
};

export function ActivityTypeModal({ isOpen, onClose, onSave, activityType = null, allTypes = [] }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [icon, setIcon] = useState('CheckSquare');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activityType) {
      setName(activityType.name || '');
      setCategory(activityType.category || 'General');
      setIcon(activityType.icon || 'CheckSquare');
      setActive(activityType.active !== false);
    } else {
      setName('');
      setCategory('General');
      setIcon('CheckSquare');
      setActive(true);
    }
    setErrors({});
  }, [activityType, isOpen]);

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
    const rawData = { name, category, icon, active };
    const { isValid, errors: valErrors, cleanData } = validateActivityType(rawData, allTypes, activityType?.id);

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
            {activityType ? 'Edit Activity Type' : 'Create New Activity Type'}
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
              Activity Type Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Compliance Audit"
              className={`config-form-control ${errors.name ? 'error' : ''}`}
            />
            {errors.name && <div className="config-form-error">{errors.name}</div>}
          </div>

          <div className="config-form-group">
            <label className="config-form-label">
              Category <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <Select
              variant="form"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={SUPPORTED_ACTIVITY_CATEGORIES}
            />
            {errors.category && <div className="config-form-error">{errors.category}</div>}
          </div>

          <div className="config-form-group">
            <label className="config-form-label">
              Select Icon <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
              {SUPPORTED_ACTIVITY_ICONS.map((iconName) => {
                const IconComp = ICON_MAP[iconName] || CheckSquare;
                const isSelected = icon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.6rem 0.25rem',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #129FA9' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#e6f7f8' : '#ffffff',
                      color: isSelected ? '#129FA9' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    <IconComp style={{ width: '18px', height: '18px', marginBottom: '0.25rem' }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{iconName}</span>
                  </button>
                );
              })}
            </div>
            {errors.icon && <div className="config-form-error">{errors.icon}</div>}
          </div>

          <label className="config-form-checkbox-group">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="config-form-checkbox"
            />
            <span style={{ fontSize: '0.8125rem', color: '#1e293b' }}>
              Active Status (Selectable for new activities & templates)
            </span>
          </label>

          <div className="config-modal-footer" style={{ borderTop: 'none', padding: '1rem 0 0 0', backgroundColor: 'transparent' }}>
            <button type="button" onClick={onClose} className="btn-secondary-cancel">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary-teal">
              {isSubmitting ? 'Saving...' : activityType ? 'Update Activity Type' : 'Create Activity Type'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
