import React, { useEffect } from 'react';
import NoteEditorForm from './NoteEditorForm.jsx';

/**
 * Popup around the note form (NoteEditorForm) — used for New Note. Editing an existing note in
 * Card View happens in place on the Notes page instead (the same form, layout "inline"), and
 * Document View has its own inline editor. The form mounts fresh each time this opens, so it
 * always starts from the note's (or a blank) values.
 */
export default function NoteEditorModal({ isOpen, onClose, onSuccess, note = null }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card xl-modal modal-scroll-shell" onClick={(e) => e.stopPropagation()}>
        <NoteEditorForm
          key={note?.id ?? 'new'}
          note={note}
          layout="modal"
          onCancel={onClose}
          onSaved={(resultNote) => {
            if (onSuccess) onSuccess(resultNote);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
