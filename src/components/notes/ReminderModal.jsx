import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, X } from 'lucide-react';
import { notesService } from '../../services/notesService.js';
import { combineReminderDateTime, splitReminderDateTime, validateReminder, formatReminderLabel } from '../../domain/noteDomain.js';

/**
 * ONE shared Set/Edit Reminder dialog, used identically by Card View (NoteCard) and Document
 * View (NotesDocumentView) — there is exactly one reminder UI in the app, not a separate
 * implementation per view. A reminder is optional, per-note metadata, completely independent of
 * the note's content/Pin/Archive state: this modal only ever calls notesService.setReminder()/
 * removeReminder(), never anything that could touch title/content/category/tags/colorAccent.
 */
export default function ReminderModal({ isOpen, note, onClose, onSaved }) {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const hasExistingReminder = Boolean(note && note.reminderAt);

  useEffect(() => {
    if (isOpen && note) {
      const { dateStr: d, timeStr: t } = splitReminderDateTime(note.reminderAt);
      setDateStr(d);
      setTimeStr(t);
      setError(null);
      setSaving(false);
    }
  }, [isOpen, note]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !note) return null;

  const handleSetOrSave = async (e) => {
    e.preventDefault();
    const combined = combineReminderDateTime(dateStr, timeStr);
    const { isValid, error: validationError } = validateReminder(combined);
    if (!isValid) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await notesService.setReminder(note.id, combined);
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError(null);
    try {
      await notesService.removeReminder(note.id);
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card reminder-modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSetOrSave}>
          <div className="modal-header">
            <div className="modal-title-group">
              <div className="modal-icon-badge">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="modal-title">{hasExistingReminder ? 'Edit Reminder' : 'Set Reminder'}</h3>
                <p className="modal-subtitle">{note.title}</p>
              </div>
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="modal-body">
            {hasExistingReminder && (
              <p className="reminder-current-label">Current reminder: {formatReminderLabel(note.reminderAt)}</p>
            )}

            {error && (
              <div className="modal-error-alert" style={{ marginBottom: '1rem' }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="note-editor-field-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Time</label>
                <input
                  type="time"
                  className="form-input"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            {hasExistingReminder && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRemove}
                disabled={saving}
                style={{ marginRight: 'auto' }}
              >
                Remove Reminder
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : hasExistingReminder ? 'Save Changes' : 'Set Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
