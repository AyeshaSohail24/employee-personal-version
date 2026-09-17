import React, { useState, useEffect } from 'react';
import { X, NotebookPen, AlertCircle } from 'lucide-react';
import { formerService } from '../../services/formerService.js';
import { notesService } from '../../services/notesService.js';
import { Select } from '../common/Select.jsx';

const buildInitialFormState = () => ({
  title: '',
  content: '',
  category: 'General',
});

/**
 * Creates a note via the EXISTING Notes module (notesService.create, through
 * formerService.addNoteForPersonnel), linked to this person via the additive relatedEmployeeId
 * field — never a second note-writing path. The Category dropdown reuses the exact same category
 * options the main Notes module itself offers (notesService.getCategoryOptions()). No separate
 * "Date" field: Notes has no generic per-note date field anywhere else in the app (only
 * createdAt, set automatically, and an unrelated optional Reminder), so this form does not invent
 * one just for Former.
 */
export default function AddNoteModal({ isOpen, onClose, employeeId, onSuccess }) {
  const [formData, setFormData] = useState(buildInitialFormState());
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState(['General']);

  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitialFormState());
      setErrors({});
      setIsSubmitting(false);
      notesService.getCategoryOptions().then(setCategoryOptions).catch((err) => {
        console.error('Failed to load note categories:', err);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    const validationErrors = {};
    if (!formData.title.trim()) validationErrors.title = 'Title is required';
    if (!formData.content.trim()) validationErrors.content = 'Note content is required';
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await formerService.addNoteForPersonnel(employeeId, formData);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setErrors({ form: err.message || 'Failed to add note.' });
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
              <NotebookPen size={20} />
            </div>
            <div>
              <h3 className="modal-title">Add Note</h3>
              <p className="modal-subtitle">Adds an HR note linked to this person — also visible in the main Notes module</p>
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
              <label className="form-label">Title <span className="required-star">*</span></label>
              <input
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
              {errors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.title}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <Select
                variant="form"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                options={categoryOptions.map((c) => ({ value: c, label: c }))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Note <span className="required-star">*</span></label>
              <textarea
                className="form-textarea"
                rows={5}
                value={formData.content}
                onChange={(e) => handleChange('content', e.target.value)}
              />
              {errors.content && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.content}</span>}
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)', marginTop: 0 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
