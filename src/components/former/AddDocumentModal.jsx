import React, { useState, useEffect } from 'react';
import { X, FilePlus, AlertCircle } from 'lucide-react';
import { formerService } from '../../services/formerService.js';
import { documentTypeService } from '../../services/documentTypeService.js';
import { Select } from '../common/Select.jsx';

const buildInitialFormState = () => ({
  title: '',
  documentType: '',
  documentDate: '',
  description: '',
});

/**
 * Records a document METADATA entry against a Former person's Personnel ID — see
 * formerService.addDocument()'s own doc comment for why this PoC genuinely does not (and does
 * not pretend to) persist the file's actual bytes: no backend file-storage layer exists anywhere
 * in this app. The Document Type dropdown reuses the app's EXISTING DocumentType master data
 * (documentTypeService) rather than inventing a second, parallel type list.
 */
export default function AddDocumentModal({ isOpen, onClose, employeeId, onSuccess }) {
  const [formData, setFormData] = useState(buildInitialFormState());
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentTypes, setDocumentTypes] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitialFormState());
      setFile(null);
      setErrors({});
      setIsSubmitting(false);
      documentTypeService.getActive().then(setDocumentTypes).catch((err) => {
        console.error('Failed to load document types:', err);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleFileChange = (e) => {
    const selected = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setFile(selected);
    if (errors.file) setErrors((prev) => ({ ...prev, file: null }));
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    const validationErrors = {};
    if (!formData.title.trim()) validationErrors.title = 'Document Title is required';
    if (!formData.documentType) validationErrors.documentType = 'Document Type is required';
    if (!file) validationErrors.file = 'Please select a file';
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await formerService.addDocument(employeeId, {
        title: formData.title,
        documentType: formData.documentType,
        fileName: file.name,
        fileSize: file.size,
        documentDate: formData.documentDate || null,
        description: formData.description,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setErrors({ form: err.message || 'Failed to add document.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <FilePlus size={20} />
            </div>
            <div>
              <h3 className="modal-title">Add Document</h3>
              <p className="modal-subtitle">Attach a document to this historical Personnel record</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmitForm}>
          <div className="modal-body">
            {errors.form && (
              <div className="modal-error-alert">
                <AlertCircle size={16} />
                <span>{errors.form}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Document Title <span className="required-star">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Fixed-Term Contract — Daniel Lee"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
              {errors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.title}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Document Type <span className="required-star">*</span></label>
              <Select
                variant="form"
                placeholder="Select Document Type..."
                value={formData.documentType}
                onChange={(e) => handleChange('documentType', e.target.value)}
                options={documentTypes.map((t) => ({ value: t.name, label: t.name }))}
              />
              {errors.documentType && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.documentType}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">File <span className="required-star">*</span></label>
              <input type="file" className="form-input" onChange={handleFileChange} />
              {file && (
                <span className="form-hint" style={{ color: 'var(--text-muted)' }}>
                  Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </span>
              )}
              {errors.file && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.file}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Document Date <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <input
                type="date"
                className="form-input"
                value={formData.documentDate}
                onChange={(e) => handleChange('documentDate', e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <textarea
                className="form-textarea"
                rows={3}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)', marginTop: 0 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
