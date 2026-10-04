import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, NotebookPen, LayoutGrid, FileStack } from 'lucide-react';
import { notesService } from '../../services/notesService.js';
import { NOTE_CATEGORIES, NOTE_SORT_OPTIONS } from '../../domain/noteDomain.js';
import NoteCard from '../../components/notes/NoteCard.jsx';
import NotesDocumentView from '../../components/notes/NotesDocumentView.jsx';
import NoteEditorModal from '../../components/notes/NoteEditorModal.jsx';
import NoteEditorForm from '../../components/notes/NoteEditorForm.jsx';
import DeleteNoteModal from '../../components/notes/DeleteNoteModal.jsx';
import ReminderModal from '../../components/notes/ReminderModal.jsx';
import Select from '../../components/common/Select.jsx';

const VIEW_MODE_STORAGE_KEY = 'rizurf_notes_view_mode';

function readStoredViewMode() {
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === 'document' ? 'document' : 'card';
  } catch (err) {
    return 'card';
  }
}

const VARIANT_META = {
  my: {
    heading: 'Notes',
    subtitle: 'Keep personal HR notes, reminders, and working information in one place.',
    emptyTitle: 'No notes yet.',
    emptyBody: 'Create your first note to keep important HR information in one place.',
  },
  pinned: {
    heading: 'Pinned Notes',
    subtitle: 'Quick access to notes you want to keep close.',
    emptyTitle: 'No pinned notes.',
    emptyBody: 'Pin important notes for quick access.',
  },
  archived: {
    heading: 'Archived Notes',
    subtitle: "Notes you've archived for later reference.",
    emptyTitle: 'No archived notes.',
    emptyBody: '',
  },
};

const SORT_OPTIONS = [
  { value: NOTE_SORT_OPTIONS.UPDATED, label: 'Last Updated' },
  { value: NOTE_SORT_OPTIONS.NEWEST, label: 'Newest' },
  { value: NOTE_SORT_OPTIONS.OLDEST, label: 'Oldest' },
  { value: NOTE_SORT_OPTIONS.TITLE, label: 'Title A–Z' },
];

export default function NotesPage({ variant = 'my' }) {
  const meta = VARIANT_META[variant];
  const location = useLocation();
  const navigate = useNavigate();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState(NOTE_SORT_OPTIONS.UPDATED);

  // New Note opens the popup (NoteEditorModal). Edit Note (Card View) opens the same form in place
  // on the page, instead of the card being edited (inlineEditNote) — one at a time.
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [inlineEditNote, setInlineEditNote] = useState(null);
  // Read at the moment of leaving (a ref, not state) so a click straight after typing still sees it.
  const inlineDirtyRef = useRef(false);
  const setInlineDirty = useCallback((dirty) => { inlineDirtyRef.current = dirty; }, []);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reminderTarget, setReminderTarget] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState(NOTE_CATEGORIES);

  // Presentation preference only — Card vs Document view never affects which notes exist or
  // their pinned/archived state; both views read the exact same `notes` array below.
  const [viewMode, setViewMode] = useState(readStoredViewMode);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  // Reported by NotesDocumentView whenever its inline editor has unsaved edits — used to pause
  // the auto-reselect safety net below so a search/filter change can never silently discard
  // in-progress edits (only the explicit Cancel/Discard actions inside the editor do that).
  const [isDocumentDirty, setIsDocumentDirty] = useState(false);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const [data, categories] = await Promise.all([
        notesService.getAll({ scope: variant, search, category, sortBy }),
        notesService.getCategoryOptions(),
      ]);
      setNotes(data);
      setCategoryOptions(categories);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, [variant, search, category, sortBy]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Reset toolbar state when switching between My Notes / Pinned / Archived
  useEffect(() => {
    setSearch('');
    setCategory('');
    setSortBy(NOTE_SORT_OPTIONS.UPDATED);
    setSelectedNoteId(null);
    setInlineEditNote(null);
  }, [variant]);

  // Leaving the in-page editor with unsaved changes asks first (the popup it replaced blocked
  // everything else until Cancel/Save, so this is the only way edits could otherwise be lost).
  const confirmLeaveInlineEdit = () => !inlineEditNote || !inlineDirtyRef.current
    || window.confirm(`Discard your unsaved changes to "${inlineEditNote.title}"?`);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch (err) {
      // Non-fatal — the view just won't persist across reloads for this viewer.
    }
  }, [viewMode]);

  // Arriving here from a clicked Note Reminder notification (see Header's NotificationPanel):
  // navigation carries the target note's id via router state. Clear any leftover search/
  // category filter that could hide it, switch to Document View (the reliable way to open one
  // specific note), and select it — then clear the state so this doesn't re-fire on a later
  // re-render or if the user navigates back to this exact history entry.
  useEffect(() => {
    const targetNoteId = location.state?.openNoteId;
    if (!targetNoteId) return;
    setSearch('');
    setCategory('');
    setViewMode('document');
    setSelectedNoteId(targetNoteId);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Document View selection safety net: if nothing is selected yet (first entry into Document
  // View), or the previously-selected note disappeared (deleted, archived while on My Notes,
  // restored while on Archived, or filtered out by search/category), fall back to the first
  // still-visible note. If none remain, selectedNoteId becomes null and the empty state shows.
  useEffect(() => {
    if (viewMode !== 'document' || loading || isDocumentDirty) return;
    const stillVisible = notes.some((n) => n.id === selectedNoteId);
    if (!stillVisible) {
      setSelectedNoteId(notes.length > 0 ? notes[0].id : null);
    }
  }, [viewMode, loading, notes, selectedNoteId, isDocumentDirty]);

  const handleOpenCreate = () => {
    if (!confirmLeaveInlineEdit()) return;
    setInlineEditNote(null);
    setIsEditorOpen(true);
  };

  // Card View: Edit (or clicking a card) opens the form in place of that card.
  const handleOpenEdit = (note) => {
    if (inlineEditNote?.id === note.id) return;
    if (!confirmLeaveInlineEdit()) return;
    setInlineEditNote(note);
  };

  const handleInlineSaved = () => {
    setInlineEditNote(null);
    loadNotes();
  };

  const handleChangeViewMode = (mode) => {
    if (mode === viewMode) return;
    if (!confirmLeaveInlineEdit()) return;
    setInlineEditNote(null);
    setViewMode(mode);
  };

  // New Note (popup) — Document View saves inline via notesService directly (see
  // NotesDocumentView) rather than round-tripping through this modal.
  const handleEditorSuccess = (resultNote) => {
    loadNotes();
    if (resultNote) {
      setSelectedNoteId(resultNote.id);
    }
  };

  const inlineEditor = inlineEditNote && (
    <div key={`edit-${inlineEditNote.id}`} className="notes-grid-editor">
      <NoteEditorForm
        key={inlineEditNote.id}
        note={inlineEditNote}
        layout="inline"
        onSaved={handleInlineSaved}
        onCancel={() => setInlineEditNote(null)}
        onDirtyChange={setInlineDirty}
      />
    </div>
  );
  // If the note being edited is no longer listed (e.g. a search now hides it), the editor stays
  // open at the top of the grid instead of disappearing with unsaved changes.
  const inlineNoteListed = Boolean(inlineEditNote) && notes.some((n) => n.id === inlineEditNote.id);

  const handleTogglePin = async (note) => {
    try {
      await notesService.togglePin(note.id);
      loadNotes();
    } catch (err) {
      alert(`Failed to update note: ${err.message}`);
    }
  };

  const handleArchive = async (note) => {
    try {
      await notesService.archive(note.id);
      loadNotes();
    } catch (err) {
      alert(`Failed to archive note: ${err.message}`);
    }
  };

  const handleRestore = async (note) => {
    try {
      await notesService.restore(note.id);
      loadNotes();
    } catch (err) {
      alert(`Failed to restore note: ${err.message}`);
    }
  };

  const isSearchActive = search.trim().length > 0 || category;

  return (
    <div className="page-layout-container">
      <div className="page-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="onboarding-plans-header">
          <h1 className="page-title">{meta.heading}</h1>
          <p className="page-subtitle">{meta.subtitle}</p>
          <p className="notes-sorting-helper">
            <span className="notes-sorting-helper-label">Sorting:</span> Newest/Oldest = creation date · Last Updated = latest edit · Title A–Z = alphabetical
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={handleOpenCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <Plus size={16} />
          <span>New Note</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="notes-toolbar">
        <div className="toolbar-search-box notes-toolbar-search">
          <Search size={16} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select
          variant="filter"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="All Categories"
          options={categoryOptions.map((c) => ({ value: c, label: c }))}
        />

        <Select
          variant="filter"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          options={SORT_OPTIONS}
        />

        <div className="view-switcher-group notes-view-switcher">
          <button
            type="button"
            className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => handleChangeViewMode('card')}
            title="Card View"
          >
            <LayoutGrid size={15} />
            <span>Card View</span>
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'document' ? 'active' : ''}`}
            onClick={() => handleChangeViewMode('document')}
            title="Document View"
          >
            <FileStack size={15} />
            <span>Document View</span>
          </button>
        </div>
      </div>

      {/* While a note is being edited in place, reloads (search, pin, reminder…) refresh the list in
          place instead of swapping it for the loading message — that would unmount the editor and
          lose what has been typed. */}
      {loading && !inlineEditNote ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading notes...
        </div>
      ) : viewMode === 'document' && !isSearchActive ? (
        // Document View handles its own "no notes yet" empty state inline (with an inline
        // Create Note flow instead of the modal), so it renders even when notes.length === 0 —
        // only Card View (and an active search yielding zero results) use the shared empty card.
        <NotesDocumentView
          notes={notes}
          selectedNoteId={selectedNoteId}
          onSelectNote={setSelectedNoteId}
          onTogglePin={handleTogglePin}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onDeleteRequest={setDeleteTarget}
          onReminderRequest={setReminderTarget}
          onNotesChanged={loadNotes}
          onDirtyChange={setIsDocumentDirty}
          variant={variant}
        />
      ) : notes.length === 0 && !inlineEditNote ? (
        <div className="table-container-card notes-empty-state">
          <NotebookPen size={32} style={{ color: 'var(--border-dark)', marginBottom: '0.75rem' }} />
          {isSearchActive ? (
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>No notes match your search.</h3>
          ) : (
            <>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{meta.emptyTitle}</h3>
              {meta.emptyBody && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.4rem 0 1.1rem 0' }}>
                  {meta.emptyBody}
                </p>
              )}
              {variant !== 'archived' && (
                <button type="button" className="btn-primary" onClick={handleOpenCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Plus size={14} />
                  <span>New Note</span>
                </button>
              )}
            </>
          )}
        </div>
      ) : viewMode === 'document' ? (
        <NotesDocumentView
          notes={notes}
          selectedNoteId={selectedNoteId}
          onSelectNote={setSelectedNoteId}
          onTogglePin={handleTogglePin}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onDeleteRequest={setDeleteTarget}
          onReminderRequest={setReminderTarget}
          onNotesChanged={loadNotes}
          onDirtyChange={setIsDocumentDirty}
          variant={variant}
        />
      ) : (
        <div className="notes-grid">
          {/* One keyed list (editor included), so the editor is moved, never re-created, when the
              list changes — re-creating it would lose what has been typed. */}
          {[...(inlineNoteListed ? [] : [inlineEditor]), ...notes.map((note) => (inlineEditNote?.id === note.id ? inlineEditor : (
            <NoteCard
              key={note.id}
              note={note}
              variant={variant}
              onEdit={handleOpenEdit}
              onTogglePin={handleTogglePin}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onDeleteRequest={setDeleteTarget}
              onReminderRequest={setReminderTarget}
            />
          )))].filter(Boolean)}
        </div>
      )}

      <NoteEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        note={null}
        onSuccess={handleEditorSuccess}
      />

      <DeleteNoteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        note={deleteTarget}
        onSuccess={loadNotes}
      />

      <ReminderModal
        isOpen={Boolean(reminderTarget)}
        note={reminderTarget}
        onClose={() => setReminderTarget(null)}
        onSaved={loadNotes}
      />
    </div>
  );
}
