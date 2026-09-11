import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Guards Document View's inline editor: shown only when the user tries to navigate away from a
 * note (or a new blank draft) that has unsaved edits — via the sidebar, Pin, Archive, or Delete.
 * The explicit "Cancel"/"Cancel Changes" buttons inside the editor bypass this by design (an
 * intentional discard needs no extra confirmation); this modal only covers the "might be
 * accidental" navigation cases.
 */
export default function UnsavedChangesModal({ isOpen, onDiscard, onKeepEditing }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onKeepEditing}>
      <div className="modal-card wide-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ backgroundColor: '#FFFBEB', color: '#B45309', width: '48px', height: '48px' }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem' }}>Unsaved Changes</h3>
              <p className="modal-subtitle">You have unsaved changes in this note.</p>
            </div>
          </div>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Save your changes before switching, or discard them to continue without saving.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onKeepEditing}>
            Keep Editing
          </button>
          <button type="button" className="btn-danger" onClick={onDiscard}>
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}
