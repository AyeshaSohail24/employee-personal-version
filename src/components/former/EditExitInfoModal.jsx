import React, { useState, useEffect } from 'react';
import { X, PencilLine, AlertCircle } from 'lucide-react';
import { formerService } from '../../services/formerService.js';
import { EXIT_TYPES, DEFAULT_EXIT_TYPE } from '../../domain/formerDomain.js';
import { Select } from '../common/Select.jsx';

/**
 * The one small, explicitly-scoped edit action Former allows on a historical record: Exit Type
 * (Contract Ended / Resignation / Termination) and Exit Remarks only. Deliberately does NOT expose
 * employment dates, department/position, status, or anything else historical — those remain
 * read-only here, changed only through the existing Personnel/Offboarding mechanisms that
 * originally produced them. A record saved earlier with an Exit Type that's no longer offered
 * ("Internship Completed" / "Other") opens with the default (Contract Ended) selected — it only
 * changes if HR saves.
 */
export default function EditExitInfoModal({ isOpen, onClose, employeeId, currentExitInfo, onSuccess }) {
  const [exitType, setExitType] = useState(DEFAULT_EXIT_TYPE);
  const [exitRemarks, setExitRemarks] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = currentExitInfo?.exitType;
      setExitType(EXIT_TYPES.includes(current) ? current : DEFAULT_EXIT_TYPE);
      setExitRemarks(currentExitInfo?.exitRemarks || '');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, currentExitInfo]);

  if (!isOpen) return null;

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await formerService.setExitInfo(employeeId, { exitType, exitRemarks });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update Exit Information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <PencilLine size={20} />
            </div>
            <div>
              <h3 className="modal-title">Edit Exit Information</h3>
              <p className="modal-subtitle">Exit Type and Exit Remarks only</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmitForm}>
          <div className="modal-body">
            {error && (
              <div className="modal-error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Exit Type</label>
              <Select
                variant="form"
                value={exitType}
                onChange={(e) => setExitType(e.target.value)}
                options={EXIT_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Exit Remarks <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <textarea
                className="form-textarea"
                rows={4}
                value={exitRemarks}
                onChange={(e) => setExitRemarks(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)', marginTop: 0 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
