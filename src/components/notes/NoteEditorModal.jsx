import React, { useState, useEffect } from 'react';
import { X, NotebookPen, AlertTriangle } from 'lucide-react';
import { notesService } from '../../services/notesService.js';
import { NOTE_CATEGORIES, NOTE_ACCENTS, CUSTOM_CATEGORY_OPTION, resolveNoteCategory, resolveNoteContentHtml, deriveContentFromHtml } from '../../domain/noteDomain.js';
import Select from '../common/Select.jsx';
import NoteContentEditor from './NoteContentEditor.jsx';

const buildInitialFormState = (note) => ({
  title: note ? note.title : '',
  category: note ? note.category : NOTE_CATEGORIES[0],
  customCategory: '',
  contentHtml: note ? resolveNoteContentHtml(note) : '',
  tags: note ? (note.tags || []).join(', ') : '',
  colorAccent: note ? (note.colorAccent || 'default') : 'default',
});

const ACCENT_OPTIONS = Object.entries(NOTE_ACCENTS).map(([value, meta]) => ({
  value,
  label: meta.label,
  swatchColor: meta.swatchColor,
}));

/**
 * Create/Edit modal for a single personal note. Content uses the shared NoteContentEditor
 * (Bold/Italic/Underline only) — the same component Document View's inline editor uses, so
 * there is exactly one formatting implementation.
 */
export default function NoteEditorModal({ isOpen, onClose, onSuccess, note = null }) {
  const isEditing = Boolean(note);
  const [formData, setFormData] = useState(buildInitialFormState(note));
  const [categoryOptions, setCategoryOptions] = useState(NOTE_CATEGORIES);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitialFormState(note));
      setErrors({});
      setError(null);
      setSaving(false);
      notesService.getCategoryOptions().then(setCategoryOptions).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, note]);

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
    if (!formData.title.trim()) nextErrors.title = 'Title is required.';
    if (!deriveContentFromHtml(formData.contentHtml).trim()) nextErrors.content = 'Content is required.';
    if (formData.category === CUSTOM_CATEGORY_OPTION && !formData.customCategory.trim()) {
      nextErrors.customCategory = 'Enter a name for the custom category.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: formData.title,
        category: resolveNoteCategory(formData.category, formData.customCategory),
        contentHtml: formData.contentHtml,
        tags: formData.tags,
        colorAccent: formData.colorAccent,
      };

      const resultNote = isEditing
        ? await notesService.update(note.id, payload)
        : await notesService.create(payload);

      // Passes the created/updated note back to the caller — Document View uses this to
      // auto-select a newly-created note without a second lookup/guessing an ID.
      if (onSuccess) onSuccess(resultNote);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const categorySelectOptions = [
    ...categoryOptions.map((c) => ({ value: c, label: c })),
    { value: CUSTOM_CATEGORY_OPTION, label: 'Other / Custom...' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card xl-modal modal-scroll-shell" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <div className="modal-title-group">
              <div className="modal-icon-badge">
                <NotebookPen size={20} />
              </div>
              <div>
                <h3 className="modal-title">{isEditing ? 'Edit Note' : 'New Note'}</h3>
                <p className="modal-subtitle">Keep a quick personal working note for yourself.</p>
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
              <label className="form-label">Title <span className="required-star">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter note title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
              {errors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.title}</span>}
            </div>

            <div className="note-editor-field-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Category</label>
                <Select
                  variant="form"
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  options={categorySelectOptions}
                />
                {formData.category === CUSTOM_CATEGORY_OPTION && (
                  <div style={{ marginTop: '0.6rem' }}>
                    <label className="form-label">Custom Category</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter category name"
                      value={formData.customCategory}
                      onChange={(e) => handleChange('customCategory', e.target.value)}
                    />
                    {errors.customCategory && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.customCategory}</span>}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Color Accent</label>
                <Select
                  variant="form"
                  value={formData.colorAccent}
                  onChange={(e) => handleChange('colorAccent', e.target.value)}
                  options={ACCENT_OPTIONS}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Content <span className="required-star">*</span></label>
              <NoteContentEditor
                valueHtml={formData.contentHtml}
                onChangeHtml={(html) => handleChange('contentHtml', html)}
                placeholder="Write your note here..."
              />
              {errors.content && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.content}</span>}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tags</label>
              <input
                type="text"
                className="form-input"
                placeholder="candidate, follow-up, internship"
                value={formData.tags}
                onChange={(e) => handleChange('tags', e.target.value)}
              />
              <span className="form-hint">Separate tags with commas.</span>
            </div>
          </div>

          <div className="modal-footer modal-footer-spacious">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
