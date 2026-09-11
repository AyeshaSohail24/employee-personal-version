import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { notesService } from '../../services/notesService.js';

/**
 * Confirmation modal for permanently deleting a note — reachable from note cards on any of
 * My Notes / Pinned / Archived, and from the Document View workspace. Permanent deletion never
 * happens without this explicit confirmation step; every Delete trigger only ever opens this
 * modal, never calls notesService.deletePermanently() directly.
 */
export default function DeleteNoteModal({ isOpen, onClose, onSuccess, note }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setDeleting(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !note) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await notesService.deletePermanently(note.id);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', width: '48px', height: '48px' }}>
              <Trash2 size={22} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem' }}>Delete Note?</h3>
              <p className="modal-subtitle">This note will be permanently deleted.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error-alert" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            "<strong style={{ color: 'var(--text-main)' }}>{note.title}</strong>" will be removed permanently. This action cannot be undone.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
