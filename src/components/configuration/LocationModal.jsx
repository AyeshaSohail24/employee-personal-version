import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import { validateLocation, SUPPORTED_LOCATION_TYPES } from '../../domain/configurationDomain';

export function LocationModal({ isOpen, onClose, onSave, location = null, allLocations = [] }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Office');
  const [address, setAddress] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (location) {
      setName(location.name || '');
      setType(location.type || 'Office');
      setAddress(location.address || '');
      setActive(location.active !== false);
    } else {
      setName('');
      setType('Office');
      setAddress('');
      setActive(true);
    }
    setErrors({});
  }, [location, isOpen]);

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
    const rawData = { name, type, address, active };
    const { isValid, errors: valErrors, cleanData } = validateLocation(rawData, allLocations, location?.id);

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
            {location ? 'Edit Work Location' : 'Create New Work Location'}
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
              Location Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rizurf HQ — Kuala Lumpur"
              className={`config-form-control ${errors.name ? 'error' : ''}`}
            />
            {errors.name && <div className="config-form-error">{errors.name}</div>}
          </div>

          <div className="config-form-group">
            <label className="config-form-label">
              Location Type <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={`config-form-control ${errors.type ? 'error' : ''}`}
            >
              {SUPPORTED_LOCATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.type && <div className="config-form-error">{errors.type}</div>}
          </div>

          <div className="config-form-group">
            <label className="config-form-label">
              Physical Address {type !== 'Remote' && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={type === 'Remote' ? 'Optional description (e.g. Distributed / WFH)' : 'Enter full street address...'}
              className={`config-form-control ${errors.address ? 'error' : ''}`}
            />
            {errors.address && <div className="config-form-error">{errors.address}</div>}
          </div>

          <label className="config-form-checkbox-group">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="config-form-checkbox"
            />
            <span style={{ fontSize: '0.8125rem', color: '#1e293b' }}>
              Active Status (Selectable for location assignment)
            </span>
          </label>

          <div className="config-modal-footer" style={{ borderTop: 'none', padding: '1rem 0 0 0', backgroundColor: 'transparent' }}>
            <button type="button" onClick={onClose} className="btn-secondary-cancel">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary-teal">
              {isSubmitting ? 'Saving...' : location ? 'Update Location' : 'Create Location'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
