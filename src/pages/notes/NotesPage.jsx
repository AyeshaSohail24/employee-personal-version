import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, NotebookPen } from 'lucide-react';
import { notesService } from '../../services/notesService.js';
import { NOTE_CATEGORIES, NOTE_SORT_OPTIONS } from '../../domain/noteDomain.js';
import NoteCard from '../../components/notes/NoteCard.jsx';
import NoteEditorModal from '../../components/notes/NoteEditorModal.jsx';
import DeleteNoteModal from '../../components/notes/DeleteNoteModal.jsx';
import Select from '../../components/common/Select.jsx';

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

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notesService.getAll({ scope: variant, search, category, sortBy });
      setNotes(data);
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
  }, [variant]);

  const handleOpenCreate = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
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
          options={NOTE_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />

        <Select
          variant="filter"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          options={SORT_OPTIONS}
        />
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading notes...
        </div>
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
        onSuccess={loadNotes}
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
