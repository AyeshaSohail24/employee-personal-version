import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';

export function DeleteConfirmModal({ isOpen, onClose, onConfirmDelete, onConfirmDeactivate, item = null, itemType = 'record' }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const canDelete = item.canDelete || item.totalReferences === 0;
  const itemName = item.name || item.title || 'Selected Item';

  const handleAction = async () => {
    setIsSubmitting(true);
    try {
      if (canDelete) {
        await onConfirmDelete(item.id);
      } else {
        await onConfirmDeactivate(item.id);
      }
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="config-modal-backdrop">
      <div className="config-modal-card" style={{ maxWidth: '460px' }}>
        <div className="config-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {canDelete ? (
              <AlertTriangle style={{ width: '20px', height: '20px', color: '#dc2626' }} />
            ) : (
              <ShieldAlert style={{ width: '20px', height: '20px', color: '#d97706' }} />
            )}
            <h3 className="config-modal-title">
              {canDelete ? `Delete ${itemType}` : `Deletion Blocked — Deactivate Instead`}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="config-modal-close">
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        <div className="config-modal-body">
          <div style={{ fontSize: '0.875rem', color: '#334155' }}>
            Target Record: <strong>"{itemName}"</strong>
          </div>

          {canDelete ? (
            <div style={{ padding: '0.85rem', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', fontSize: '0.75rem', color: '#991b1b', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <p style={{ fontWeight: 600 }}>This record is permanently deletable because it is not referenced by any historical or active HR data.</p>
              <p style={{ color: '#dc2626' }}>This action cannot be undone.</p>
            </div>
          ) : (
            <div style={{ padding: '0.85rem', borderRadius: '8px', backgroundColor: '#fffbe6', border: '1px solid #fde68a', fontSize: '0.75rem', color: '#854d0e', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <p style={{ fontWeight: 600 }}>
                This record is referenced by existing HR data ({item.referenceSummary || `${item.totalReferences} references`}) and cannot be deleted.
              </p>
              <p>
                Deactivating it will remove it from future creation dropdowns while preserving full historical accuracy for past records and reporting analytics.
              </p>
            </div>
          )}

          <div className="config-modal-footer" style={{ borderTop: 'none', padding: '1rem 0 0 0', backgroundColor: 'transparent' }}>
            <button type="button" onClick={onClose} className="btn-secondary-cancel">
              Cancel
            </button>

            {canDelete ? (
              <button
                type="button"
                onClick={handleAction}
                disabled={isSubmitting}
                className="btn-primary-teal"
                style={{ backgroundColor: '#dc2626' }}
              >
                {isSubmitting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAction}
                disabled={isSubmitting}
                className="btn-primary-teal"
                style={{ backgroundColor: '#d97706' }}
              >
                {isSubmitting ? 'Deactivating...' : 'Deactivate Record'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
