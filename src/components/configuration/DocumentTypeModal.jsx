import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import { validateDocumentType, DOCUMENT_CATEGORIES } from '../../domain/documentTypeDomain';
import { Select } from '../common/Select.jsx';

export function DocumentTypeModal({ isOpen, onClose, onSave, documentType = null, allTypes = [] }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Employment');
  const [requiresExpiry, setRequiresExpiry] = useState(false);
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (documentType) {
      setName(documentType.name || '');
      setCode(documentType.code || '');
      setCategory(documentType.category || 'Employment');
      setRequiresExpiry(Boolean(documentType.requiresExpiry));
      setDescription(documentType.description || '');
      setActive(documentType.active !== false);
    } else {
      setName('');
      setCode('');
      setCategory('Employment');
      setRequiresExpiry(false);
      setDescription('');
      setActive(true);
    }
    setErrors({});
  }, [documentType, isOpen]);

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
    const rawData = { name, code, category, requiresExpiry, description, active };
    const { isValid, errors: valErrors, cleanData } = validateDocumentType(rawData, allTypes, documentType?.id);

    if (!isValid) {
      setErrors(valErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(cleanData, documentType?.id);
      onClose();
    } catch (err) {
      setErrors({ form: err.message || 'Failed to save document type.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="config-modal-backdrop" onClick={onClose}>
      <div
        className="config-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(640px, calc(100vw - 2rem))' }}
      >
        <div className="config-modal-header">
          <h3 className="config-modal-title">
            {documentType ? 'Edit Document Type' : 'Create Document Type'}
          </h3>
          <button type="button" className="config-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="config-modal-body">
            {errors.form && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#dc2626' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errors.form}</span>
              </div>
            )}

            {/* Document Type Name */}
            <div className="config-form-group">
              <label className="config-form-label">
                Document Type Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                className={`config-form-control ${errors.name ? 'error' : ''}`}
                placeholder="e.g. Identity Verification / Passport"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
              />
              {errors.name && <div className="config-form-error">{errors.name}</div>}
            </div>

            {/* Code & Category 2-Column Row */}
            <div className="config-form-row">
              <div className="config-form-group">
                <label className="config-form-label">
                  Code <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className={`config-form-control ${errors.code ? 'error' : ''}`}
                  placeholder="e.g. ID_PASSPORT"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
                  }}
                />
                {errors.code && <div className="config-form-error">{errors.code}</div>}
              </div>

              <div className="config-form-group">
                <label className="config-form-label">
                  Category <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <Select
                  variant="form"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
                  }}
                  options={DOCUMENT_CATEGORIES}
                />
                {errors.category && <div className="config-form-error">{errors.category}</div>}
              </div>
            </div>

            {/* Expiry Tracking Section */}
            <div className="config-form-group">
              <label className="config-form-checkbox-group">
                <input
                  type="checkbox"
                  checked={requiresExpiry}
                  onChange={(e) => setRequiresExpiry(e.target.checked)}
                  className="config-form-checkbox"
                />
                <div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                    Requires Expiration Date Tracking
                  </span>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', lineHeight: '1.4' }}>
                    Flag documents of this type (e.g. Passports, Work Permits) that require expiration monitoring.
                  </div>
                </div>
              </label>
            </div>

            {/* Description / Guidelines */}
            <div className="config-form-group">
              <label className="config-form-label">
                Description / Guidelines
              </label>
              <textarea
                className="config-form-control"
                rows={3}
                style={{ resize: 'vertical', minHeight: '80px' }}
                placeholder="Provide administrative guidance or document compliance notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Active Status Checkbox */}
            <div className="config-form-group">
              <label className="config-form-checkbox-group">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="config-form-checkbox"
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                  Active Status (Selectable for new compliance records)
                </span>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="config-modal-footer">
            <button
              type="button"
              className="btn-secondary-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-teal"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : documentType ? 'Save Changes' : 'Create Document Type'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
