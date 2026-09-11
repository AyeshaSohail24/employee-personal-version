import React from 'react';
import { Pin, PinOff, Pencil, Archive, RotateCcw, Trash2 } from 'lucide-react';
import { formatNoteUpdatedLabel, resolveNoteContentHtml } from '../../domain/noteDomain.js';

/**
 * Shared read/action card used identically across My Notes, Pinned, and Archived — the same
 * visual language everywhere, only the available actions differ per page.
 */
export default function NoteCard({ note, variant = 'my', onEdit, onTogglePin, onArchive, onRestore, onDeleteRequest }) {
  const accent = note.colorAccent && note.colorAccent !== 'default' ? note.colorAccent : null;
  const cardClassName = ['note-card', accent ? `note-card--accent-${accent}` : ''].filter(Boolean).join(' ');

  const handleCardClick = () => {
    if (onEdit) onEdit(note);
  };

  const stop = (fn) => (e) => {
    e.stopPropagation();
    if (fn) fn(note);
  };

  return (
    <div className={cardClassName} onClick={handleCardClick} role="button" tabIndex={0}>
      <div className="note-card-header">
        <h3 className="note-card-title">{note.title}</h3>
        {note.isPinned && !note.isArchived && <Pin size={14} className="note-card-pin-indicator" />}
      </div>

      <span className="note-category-badge">{note.category}</span>

      {/* Formatting (Bold/Italic/Underline) rendered safely — resolveNoteContentHtml() always
          returns already-sanitized HTML (re-sanitized here defensively), so this is never fed
          raw/untrusted markup. Legacy notes with no contentHtml fall back to their escaped
          plain content with line breaks preserved. */}
      <p className="note-content-preview" dangerouslySetInnerHTML={{ __html: resolveNoteContentHtml(note) }} />

      {note.tags && note.tags.length > 0 && (
        <div className="note-tags">
          {note.tags.map((tag) => (
            <span key={tag} className="note-tag">#{tag}</span>
          ))}
        </div>
      )}

      <div className="note-card-footer">
        <span className="note-updated-label">{formatNoteUpdatedLabel(note.updatedAt)}</span>

        <div className="note-card-actions">
          {variant !== 'archived' && (
            <>
              <button
                type="button"
                className="icon-btn"
                title={note.isPinned ? 'Unpin' : 'Pin'}
                onClick={stop(onTogglePin)}
              >
                {note.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              <button type="button" className="icon-btn" title="Edit" onClick={stop(onEdit)}>
                <Pencil size={14} />
              </button>
              <button type="button" className="icon-btn" title="Archive" onClick={stop(onArchive)}>
                <Archive size={14} />
              </button>
              <button type="button" className="icon-btn icon-btn-danger" title="Delete" onClick={stop(onDeleteRequest)}>
                <Trash2 size={14} />
              </button>
            </>
          )}

          {variant === 'archived' && (
            <>
              <button type="button" className="icon-btn" title="Restore" onClick={stop(onRestore)}>
                <RotateCcw size={14} />
              </button>
              <button type="button" className="icon-btn icon-btn-danger" title="Delete Permanently" onClick={stop(onDeleteRequest)}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
