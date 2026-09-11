import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, NotebookPen, LayoutGrid, FileStack } from 'lucide-react';
import { notesService } from '../../services/notesService.js';
import { NOTE_CATEGORIES, NOTE_SORT_OPTIONS } from '../../domain/noteDomain.js';
import NoteCard from '../../components/notes/NoteCard.jsx';
import NotesDocumentView from '../../components/notes/NotesDocumentView.jsx';
import NoteEditorModal from '../../components/notes/NoteEditorModal.jsx';
import DeleteNoteModal from '../../components/notes/DeleteNoteModal.jsx';
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

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState(NOTE_SORT_OPTIONS.UPDATED);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
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
  }, [variant]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch (err) {
      // Non-fatal — the view just won't persist across reloads for this viewer.
    }
  }, [viewMode]);

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
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  // Card View's New Note / Edit flow only — Document View now saves inline via notesService
  // directly (see NotesDocumentView) rather than round-tripping through this modal.
  const handleEditorSuccess = (resultNote) => {
    loadNotes();
    if (resultNote && !editingNote) {
      setSelectedNoteId(resultNote.id);
    }
  };

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
            onClick={() => setViewMode('card')}
            title="Card View"
          >
            <LayoutGrid size={15} />
            <span>Card View</span>
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'document' ? 'active' : ''}`}
            onClick={() => setViewMode('document')}
            title="Document View"
          >
            <FileStack size={15} />
            <span>Document View</span>
          </button>
        </div>
      </div>

      {loading ? (
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
          onNotesChanged={loadNotes}
          onDirtyChange={setIsDocumentDirty}
          variant={variant}
        />
      ) : notes.length === 0 ? (
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
          onNotesChanged={loadNotes}
          onDirtyChange={setIsDocumentDirty}
          variant={variant}
        />
      ) : (
        <div className="notes-grid">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              variant={variant}
              onEdit={handleOpenEdit}
              onTogglePin={handleTogglePin}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onDeleteRequest={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <NoteEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        note={editingNote}
        onSuccess={handleEditorSuccess}
      />

      <DeleteNoteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        note={deleteTarget}
        onSuccess={loadNotes}
      />
    </div>
  );
}
