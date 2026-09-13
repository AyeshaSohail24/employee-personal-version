import React from 'react';
import { Pin, PinOff, Pencil, Archive, RotateCcw, Trash2, Bell } from 'lucide-react';
import { formatNoteUpdatedLabel, formatReminderLabel, getReminderAttentionState, resolveNoteContentHtml } from '../../domain/noteDomain.js';
import { useNotifications } from '../../state/NotificationContext';

/**
 * Shared read/action card used identically across My Notes, Pinned, and Archived — the same
 * visual language everywhere, only the available actions differ per page.
 */
export default function NoteCard({ note, variant = 'my', onEdit, onTogglePin, onArchive, onRestore, onDeleteRequest, onReminderRequest }) {
  const accent = note.colorAccent && note.colorAccent !== 'default' ? note.colorAccent : null;
  const cardClassName = ['note-card', accent ? `note-card--accent-${accent}` : ''].filter(Boolean).join(' ');

  // The active teal Bell state means "this reminder still needs attention" (future, or due and
  // unread) — NOT merely "a reminder exists". A due-and-already-read reminder goes back to
  // neutral even though reminderAt (and the metadata line below) remain untouched. One shared
  // rule (noteDomain.getReminderAttentionState) is used identically here and in
  // NotesDocumentView so both views can never disagree.
  const { notifications } = useNotifications();
  const isReminderActive = getReminderAttentionState(note, notifications);

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

      {/* Formatting (Bold/Italic/Underline/Highlight/Lists) rendered safely —
          resolveNoteContentHtml() always returns already-sanitized HTML (re-sanitized here
          defensively), so this is never fed raw/untrusted markup. Legacy notes with no
          contentHtml fall back to their escaped plain content with line breaks preserved. A
          <div> (not <p>) is required here since sanitized content can now legitimately include
          block-level <ul>/<ol> lists. */}
      <div className="note-content-preview" dangerouslySetInnerHTML={{ __html: resolveNoteContentHtml(note) }} />

      {note.tags && note.tags.length > 0 && (
        <div className="note-tags">
          {note.tags.map((tag) => (
            <span key={tag} className="note-tag">#{tag}</span>
          ))}
        </div>
      )}

      {/* Reminder metadata — shown only while the reminder is "active" (future, or due and
          still unread), using the exact same getReminderAttentionState() result as the Bell so
          the two can never disagree. Once a due reminder's notification has been read, this
          line hides — reminderAt itself is untouched, so it reappears automatically if the
          reminder is rescheduled to a new future time. A note with no reminder at all shows no
          reminder line either (never "Reminder: None"). */}
      {isReminderActive && (
        <span className="note-reminder-badge">
          <Bell size={12} />
          <span>Reminder: {formatReminderLabel(note.reminderAt)}</span>
        </span>
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
              <button
                type="button"
                className={`icon-btn ${isReminderActive ? 'icon-btn-reminder-active' : ''}`}
                title={note.reminderAt ? 'Edit reminder' : 'Set reminder'}
                onClick={stop(onReminderRequest)}
              >
                <Bell size={14} />
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
              <button
                type="button"
                className={`icon-btn ${isReminderActive ? 'icon-btn-reminder-active' : ''}`}
                title={note.reminderAt ? 'Edit reminder' : 'Set reminder'}
                onClick={stop(onReminderRequest)}
              >
                <Bell size={14} />
              </button>
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
