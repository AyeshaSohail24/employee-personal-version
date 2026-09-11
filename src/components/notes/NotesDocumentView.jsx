import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pin, PinOff, Archive, RotateCcw, Trash2, ArrowLeft, NotebookPen, Save, X, Pencil } from 'lucide-react';
import { notesService } from '../../services/notesService.js';
import {
  NOTE_CATEGORIES,
  NOTE_ACCENTS,
  CUSTOM_CATEGORY_OPTION,
  formatNoteUpdatedLabel,
  resolveNoteCategory,
  resolveNoteContentHtml,
  deriveContentFromHtml,
} from '../../domain/noteDomain.js';
import Select from '../common/Select.jsx';
import NoteContentEditor from './NoteContentEditor.jsx';
import UnsavedChangesModal from './UnsavedChangesModal.jsx';

const ACCENT_OPTIONS = Object.entries(NOTE_ACCENTS).map(([value, meta]) => ({
  value,
  label: meta.label,
  swatchColor: meta.swatchColor,
}));

function buildDraftFromNote(note) {
  return {
    title: note.title,
    category: note.category,
    customCategory: '',
    tags: (note.tags || []).join(', '),
    colorAccent: note.colorAccent || 'default',
    contentHtml: resolveNoteContentHtml(note),
  };
}

function buildBlankDraft() {
  return {
    title: '',
    category: NOTE_CATEGORIES[0],
    customCategory: '',
    tags: '',
    colorAccent: 'default',
    contentHtml: '',
  };
}

/**
 * Google-Docs-tabs-inspired notepad workspace: a compact note list on the left, the selected
 * note as a directly-editable document on the right — no NoteEditorModal round-trip. Reads/
 * writes through notesService directly (same as Card View's modal), so both save paths call
 * the exact same create()/update(), and NotesPage's `notes` list stays the single source of
 * truth (this component owns only its own in-progress editing draft, never a parallel store).
 */
export default function NotesDocumentView({
  notes,
  selectedNoteId,
  onSelectNote,
  onTogglePin,
  onArchive,
  onRestore,
  onDeleteRequest,
  onNotesChanged,
  onDirtyChange,
  variant = 'my',
}) {
  const [mobileShowingDocument, setMobileShowingDocument] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState(NOTE_CATEGORIES);

  const [creatingNew, setCreatingNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(buildBlankDraft());
  const [baseline, setBaseline] = useState(buildBlankDraft());
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  // Rebuild the draft whenever a DIFFERENT persisted note becomes selected (not on every
  // `notes` refresh — Pin/Archive don't touch any field this editor tracks, so an in-progress
  // edit is never silently clobbered by an unrelated background list refresh).
  useEffect(() => {
    if (creatingNew) return;
    const note = notes.find((n) => n.id === selectedNoteId);
    if (note) {
      const fresh = buildDraftFromNote(note);
      setDraft(fresh);
      setBaseline(fresh);
      setFormErrors({});
      setSaveError(null);
      // A newly-selected note always opens in READ state, never mid-edit.
      setIsEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId]);

  useEffect(() => {
    notesService.getCategoryOptions().then(setCategoryOptions).catch(() => {});
  }, [notes]);

  useEffect(() => {
    if (!selectedNote) setMobileShowingDocument(false);
  }, [selectedNote]);

  // Reports dirty state up to NotesPage so its auto-reselect safety net (search/filter/archive
  // changing which notes are visible) never silently discards an in-progress edit.
  useEffect(() => {
    if (onDirtyChange) onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  // Guards navigation-changing actions (switching notes, Pin, Archive, Delete) against silently
  // discarding unsaved edits. The explicit Cancel/Cancel Changes buttons bypass this entirely —
  // see handleCancelChanges/handleCancelNewNote below — since an explicit discard needs no
  // extra confirmation.
  const requestAction = (actionFn) => {
    if (isDirty) {
      setPendingAction(() => actionFn);
    } else {
      actionFn();
    }
  };

  const handleDiscardPending = () => {
    if (creatingNew) {
      setCreatingNew(false);
    } else {
      setDraft(baseline);
    }
    const fn = pendingAction;
    setPendingAction(null);
    if (fn) fn();
  };

  const handleKeepEditing = () => setPendingAction(null);

  const handleSelectSidebarItem = (id) => {
    requestAction(() => {
      onSelectNote(id);
      setMobileShowingDocument(true);
    });
  };

  const handleCreateNewClick = () => {
    requestAction(() => {
      setCreatingNew(true);
      setIsEditing(false);
      setDraft(buildBlankDraft());
      setBaseline(buildBlankDraft());
      setFormErrors({});
      setSaveError(null);
      setMobileShowingDocument(true);
    });
  };

  // Switches the currently-selected (already-saved) note from read state into edit state — a
  // local UI toggle only, never guarded (the draft is already clean/synced to baseline at this
  // point, so there is nothing to lose by entering edit mode).
  const handleStartEdit = () => {
    setFormErrors({});
    setSaveError(null);
    setIsEditing(true);
  };

  // Explicit discard actions — bypass the unsaved-changes guard by design (Part 7/8). Both
  // return the document to READ state regardless of whether anything had actually changed, so
  // the user always has a reliable way out of edit mode.
  const handleCancelChanges = () => {
    setDraft(baseline);
    setFormErrors({});
    setSaveError(null);
    setIsEditing(false);
  };
  const handleCancelNewNote = () => {
    setCreatingNew(false);
    setFormErrors({});
    setSaveError(null);
  };

  const handleDraftChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateDraft = () => {
    const nextErrors = {};
    if (!draft.title.trim()) nextErrors.title = 'Title is required.';
    if (!deriveContentFromHtml(draft.contentHtml).trim()) nextErrors.content = 'Content is required.';
    if (draft.category === CUSTOM_CATEGORY_OPTION && !draft.customCategory.trim()) {
      nextErrors.customCategory = 'Enter a name for the custom category.';
    }
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildPayload = () => ({
    title: draft.title,
    category: resolveNoteCategory(draft.category, draft.customCategory),
    contentHtml: draft.contentHtml,
    tags: draft.tags,
    colorAccent: draft.colorAccent,
  });

  const handleSaveChanges = async () => {
    if (!validateDraft()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await notesService.update(selectedNoteId, buildPayload());
      await onNotesChanged();
      const fresh = buildDraftFromNote(updated);
      setDraft(fresh);
      setBaseline(fresh);
      // Draft now exactly matches the freshly-saved baseline (isDirty becomes false), and
      // exiting edit mode returns the document to its read/view state — the user's clear
      // visual confirmation that the save actually finished.
      setIsEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNewNote = async () => {
    if (!validateDraft()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await notesService.create(buildPayload());
      setCreatingNew(false);
      await onNotesChanged();
      onSelectNote(created.id);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const categorySelectOptions = useMemo(
    () => [...categoryOptions.map((c) => ({ value: c, label: c })), { value: CUSTOM_CATEGORY_OPTION, label: 'Other / Custom' }],
    [categoryOptions]
  );

  if (notes.length === 0 && !creatingNew) {
    return (
      <div className="table-container-card notes-empty-state">
        <NotebookPen size={32} style={{ color: 'var(--border-dark)', marginBottom: '0.75rem' }} />
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>No notes yet.</h3>
        {variant !== 'archived' && (
          <button type="button" className="btn-primary" onClick={handleCreateNewClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '1rem' }}>
            <Plus size={14} />
            <span>Create Note</span>
          </button>
        )}
      </div>
    );
  }

  const isArchivedReadOnly = variant === 'archived';

  return (
    <div className={`notes-document-view ${mobileShowingDocument ? 'mobile-showing-document' : 'mobile-showing-list'}`}>
      {/* Notes sidebar (internal to the Notes page, distinct from the main Rizurf sidebar) */}
      <div className="notes-document-sidebar">
        <div className="notes-document-sidebar-header">
          <span>Notes</span>
          {variant !== 'archived' && (
            <button type="button" className="icon-btn" title="New Note" onClick={handleCreateNewClick}>
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="notes-document-sidebar-list app-scroll-area">
          {creatingNew && (
            <div className="notes-document-sidebar-item active notes-document-sidebar-item--draft">
              <span className="notes-document-sidebar-item-title">{draft.title || 'Untitled Note'}</span>
              <span className="notes-document-draft-badge">Draft</span>
            </div>
          )}
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              className={`notes-document-sidebar-item ${!creatingNew && note.id === selectedNoteId ? 'active' : ''}`}
              onClick={() => handleSelectSidebarItem(note.id)}
            >
              {note.isPinned && !note.isArchived && <Pin size={11} className="notes-document-sidebar-item-pin" />}
              <span className="notes-document-sidebar-item-title">{note.title}</span>
              <span className="notes-document-sidebar-item-category">{note.category}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Document workspace */}
      <div className="notes-document-workspace">
        {creatingNew ? (
          <div className="notes-document-surface">
            <button type="button" className="notes-document-back-btn" onClick={() => setMobileShowingDocument(false)}>
              <ArrowLeft size={14} />
              <span>Back to Notes</span>
            </button>

            {saveError && <div className="modal-error-alert" style={{ marginBottom: '1rem' }}>{saveError}</div>}

            <input
              type="text"
              className="notes-document-title-input"
              placeholder="Enter note title"
              value={draft.title}
              onChange={(e) => handleDraftChange('title', e.target.value)}
            />
            {formErrors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{formErrors.title}</span>}

            <DocumentMetaFields
              draft={draft}
              onChange={handleDraftChange}
              categorySelectOptions={categorySelectOptions}
              formErrors={formErrors}
            />

            <NoteContentEditor
              valueHtml={draft.contentHtml}
              onChangeHtml={(html) => handleDraftChange('contentHtml', html)}
              className="notes-document-content-editor"
            />
            {formErrors.content && <span className="form-hint" style={{ color: '#DC2626' }}>{formErrors.content}</span>}

            <div className="notes-document-save-row">
              <button type="button" className="btn-secondary" onClick={handleCancelNewNote} disabled={saving}>
                <X size={14} />
                <span>Cancel</span>
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveNewNote} disabled={saving}>
                <Save size={14} />
                <span>{saving ? 'Saving...' : 'Save Note'}</span>
              </button>
            </div>
          </div>
        ) : !selectedNote ? (
          <div className="notes-document-empty">
            <p>Select a note to view it.</p>
          </div>
        ) : (
          <div className="notes-document-surface">
            <button type="button" className="notes-document-back-btn" onClick={() => setMobileShowingDocument(false)}>
              <ArrowLeft size={14} />
              <span>Back to Notes</span>
            </button>

            <div className="notes-document-actions">
              <button
                type="button"
                className="icon-btn"
                title={selectedNote.isPinned ? 'Unpin' : 'Pin'}
                onClick={() => requestAction(() => onTogglePin(selectedNote))}
              >
                {selectedNote.isPinned ? <PinOff size={15} /> : <Pin size={15} />}
              </button>
              {!isArchivedReadOnly ? (
                <button type="button" className="icon-btn" title="Archive" onClick={() => requestAction(() => onArchive(selectedNote))}>
                  <Archive size={15} />
                </button>
              ) : (
                <button type="button" className="icon-btn" title="Restore" onClick={() => requestAction(() => onRestore(selectedNote))}>
                  <RotateCcw size={15} />
                </button>
              )}
              <button type="button" className="icon-btn icon-btn-danger" title="Delete" onClick={() => requestAction(() => onDeleteRequest(selectedNote))}>
                <Trash2 size={15} />
              </button>
              {!isArchivedReadOnly && !isEditing && (
                <button type="button" className="icon-btn" title="Edit" onClick={handleStartEdit}>
                  <Pencil size={15} />
                </button>
              )}
            </div>

            {saveError && <div className="modal-error-alert" style={{ marginBottom: '1rem' }}>{saveError}</div>}

            {isArchivedReadOnly || !isEditing ? (
              // READ / VIEW state — a document, not a form: title, category/color/tags as
              // static metadata, formatted content. Archived notes are always read-only (no
              // Edit action is ever shown for them); non-archived notes reach this branch
              // whenever isEditing is false (the default for every newly-selected note, and
              // again immediately after Save Changes/Cancel Changes).
              <>
                <h2 className="notes-document-title">{selectedNote.title}</h2>
                <div className="notes-document-meta">
                  <span className="note-category-badge">{selectedNote.category}</span>
                  {selectedNote.colorAccent && selectedNote.colorAccent !== 'default' && NOTE_ACCENTS[selectedNote.colorAccent] && (
                    <span
                      className="notes-document-color-indicator"
                      title={NOTE_ACCENTS[selectedNote.colorAccent].label}
                      style={{ backgroundColor: NOTE_ACCENTS[selectedNote.colorAccent].swatchColor }}
                    />
                  )}
                  {selectedNote.tags && selectedNote.tags.length > 0 && (
                    <div className="note-tags">
                      {selectedNote.tags.map((tag) => <span key={tag} className="note-tag">#{tag}</span>)}
                    </div>
                  )}
                </div>
                <div className="notes-document-content" dangerouslySetInnerHTML={{ __html: resolveNoteContentHtml(selectedNote) }} />
              </>
            ) : (
              // EDIT state — real editable controls, only reachable via the Edit button above.
              <>
                <input
                  type="text"
                  className="notes-document-title-input"
                  placeholder="Enter note title"
                  value={draft.title}
                  onChange={(e) => handleDraftChange('title', e.target.value)}
                />
                {formErrors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{formErrors.title}</span>}

                <DocumentMetaFields
                  draft={draft}
                  onChange={handleDraftChange}
                  categorySelectOptions={categorySelectOptions}
                  formErrors={formErrors}
                />

                <NoteContentEditor
                  valueHtml={draft.contentHtml}
                  onChangeHtml={(html) => handleDraftChange('contentHtml', html)}
                  className="notes-document-content-editor"
                />
                {formErrors.content && <span className="form-hint" style={{ color: '#DC2626' }}>{formErrors.content}</span>}
              </>
            )}

            <div className="notes-document-updated">{formatNoteUpdatedLabel(selectedNote.updatedAt)}</div>

            {!isArchivedReadOnly && isEditing && (
              <div className="notes-document-save-row">
                <button type="button" className="btn-secondary" onClick={handleCancelChanges} disabled={saving}>
                  <X size={14} />
                  <span>Cancel Changes</span>
                </button>
                <button type="button" className="btn-primary" onClick={handleSaveChanges} disabled={saving || !isDirty}>
                  <Save size={14} />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <UnsavedChangesModal isOpen={Boolean(pendingAction)} onDiscard={handleDiscardPending} onKeepEditing={handleKeepEditing} />
    </div>
  );
}

/** Category / Color Accent / Tags row shared between the new-blank-sheet and existing-note editing layouts. */
function DocumentMetaFields({ draft, onChange, categorySelectOptions, formErrors }) {
  return (
    <div className="notes-document-meta-fields">
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Category</label>
        <Select variant="form" value={draft.category} onChange={(e) => onChange('category', e.target.value)} options={categorySelectOptions} />
        {draft.category === CUSTOM_CATEGORY_OPTION && (
          <div style={{ marginTop: '0.5rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Enter category name"
              value={draft.customCategory}
              onChange={(e) => onChange('customCategory', e.target.value)}
            />
            {formErrors.customCategory && <span className="form-hint" style={{ color: '#DC2626' }}>{formErrors.customCategory}</span>}
          </div>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Color</label>
        <Select variant="form" value={draft.colorAccent} onChange={(e) => onChange('colorAccent', e.target.value)} options={ACCENT_OPTIONS} />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Tags</label>
        <input
          type="text"
          className="form-input"
          placeholder="candidate, follow-up"
          value={draft.tags}
          onChange={(e) => onChange('tags', e.target.value)}
        />
      </div>
    </div>
  );
}
