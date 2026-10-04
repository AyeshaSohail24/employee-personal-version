import React, { useState, useEffect, useRef } from 'react';
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
 * The Create/Edit form for a single personal note — one implementation used in two places:
 *  - layout "modal": inside NoteEditorModal (New Note);
 *  - layout "inline": directly on the Notes page in Card View (Edit Note), in place of the card.
 * Same fields, validation and save either way. Content uses the shared NoteContentEditor
 * (Bold/Italic/Underline only) — the same component Document View's inline editor uses.
 *
 * The form state is set once when it mounts (callers remount it per note via `key`), so a list
 * reload while editing never resets what's been typed. `onSaved(resultNote)` runs after a
 * successful save; `onCancel` on Cancel, the ×, or Escape. `onDirtyChange(bool)` reports unsaved
 * edits (inline only uses it).
 */
export default function NoteEditorForm({ note = null, layout = 'modal', onSaved, onCancel, onDirtyChange }) {
  const isEditing = Boolean(note);
  const inline = layout === 'inline';
  const [initial] = useState(() => buildInitialFormState(note));
  const [formData, setFormData] = useState(initial);
  const [categoryOptions, setCategoryOptions] = useState(NOTE_CATEGORIES);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    notesService.getCategoryOptions().then(setCategoryOptions).catch(() => {});
  }, []);

  // Inline: bring the form into view and put the cursor in Title.
  useEffect(() => {
    if (!inline) return;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    titleRef.current?.focus({ preventScroll: true });
  }, [inline]);

  const isDirty = JSON.stringify(formData) !== JSON.stringify(initial);
  useEffect(() => {
    if (onDirtyChange) onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => { if (onDirtyChange) onDirtyChange(false); }, [onDirtyChange]);

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
      if (onSaved) onSaved(resultNote);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const categorySelectOptions = [
    ...categoryOptions.map((c) => ({ value: c, label: c })),
    { value: CUSTOM_CATEGORY_OPTION, label: 'Other / Custom' },
  ];

  return (
    <form
      ref={rootRef}
      onSubmit={handleSubmit}
      className={inline ? 'note-inline-editor' : undefined}
      // Escape cancels — unless a popup (e.g. a note's Reminder) is open on top: that Escape is its.
      onKeyDown={inline ? (e) => {
        if (e.key !== 'Escape' || saving || document.querySelector('.modal-backdrop')) return;
        e.stopPropagation();
        onCancel();
      } : undefined}
      aria-label={inline ? `Edit note: ${note?.title ?? ''}` : undefined}
    >
      <div className={inline ? 'note-inline-editor-header' : 'modal-header'}>
        <div className="modal-title-group">
          <div className="modal-icon-badge">
            <NotebookPen size={20} />
          </div>
          <div>
            <h3 className="modal-title">{isEditing ? 'Edit Note' : 'New Note'}</h3>
            <p className="modal-subtitle">Keep a quick personal working note for yourself.</p>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={onCancel} disabled={saving} aria-label="Cancel editing">
          <X size={18} />
        </button>
      </div>

      <div className={inline ? 'note-inline-editor-body' : 'modal-body modal-body-spacious'}>
        {error && (
          <div className="modal-error-alert" style={{ marginBottom: '1.25rem' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Title <span className="required-star">*</span></label>
          <input
            ref={titleRef}
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

      <div className={inline ? 'note-inline-editor-footer' : 'modal-footer modal-footer-spacious'}>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Note'}
        </button>
      </div>
    </form>
  );
}
