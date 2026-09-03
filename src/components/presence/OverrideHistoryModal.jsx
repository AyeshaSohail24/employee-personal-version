import React, { useState, useEffect } from 'react';
import { X, History, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { presenceService } from '../../services/presenceService';

export default function OverrideHistoryModal({ employee, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      if (!employee) return;
      setLoading(true);
      try {
        const records = await presenceService.getPresenceOverrideHistory(employee.id);
        setHistory(records);
      } catch (err) {
        console.error('Failed to load override history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [employee]);

  if (!employee) return null;

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
              <History size={20} />
            </div>
            <div>
              <h2 className="modal-title">Presence Override Audit Trail</h2>
              <p className="modal-subtitle">
                Historical overrides for {employee.fullName} ({employee.employeeId})
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p className="modal-empty-text">Loading audit trail...</p>
          ) : history.length === 0 ? (
            <div className="modal-empty-state">
              <Shield size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
              <p className="modal-empty-text">No manual presence overrides recorded for this employee.</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((rec) => (
                <div key={rec.id} className={`history-item-card ${rec.active ? 'active-override' : 'ended-override'}`}>
                  <div className="history-item-header">
                    <div className="history-status-group">
                      {rec.active ? (
                        <span className="history-active-badge">
                          <CheckCircle2 size={13} /> Active Override
                        </span>
                      ) : (
                        <span className="history-ended-badge">
                          <XCircle size={13} /> Ended / Cleared
                        </span>
                      )}
                      <span className="history-state-tag">{rec.overrideState}</span>
                    </div>
                    <span className="history-time">{formatDate(rec.createdAt)}</span>
                  </div>

                  <div className="history-item-body">
                    <div className="history-meta-row">
                      <span className="history-meta-label">Reason:</span>
                      <span className="history-meta-val">{rec.reason}</span>
                    </div>

                    <div className="history-meta-row">
                      <span className="history-meta-label">Created By:</span>
                      <span className="history-meta-val">{rec.createdBy}</span>
                    </div>

                    {!rec.active && (
                      <div className="history-ended-row">
                        <span>Cleared/Ended by {rec.endedBy || 'System'} at {formatDate(rec.endedAt)}</span>
                        {rec.reasonEnded && <span> ({rec.reasonEnded})</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
