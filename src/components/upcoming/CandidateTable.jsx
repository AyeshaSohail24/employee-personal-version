import React from 'react';
import { Check, X, RotateCcw, Undo2 } from 'lucide-react';
import { formatDateDisplay } from '../../utils/dateUtils.js';

const OFFER_PILL_STYLES = {
  Paid: { bg: '#ECFDF5', color: '#059669' },
  Unpaid: { bg: '#FEF3C7', color: '#D97706' },
};

const EMAIL_STATUS_PILL_STYLES = {
  Pending: { bg: '#F1F5F9', color: '#475569' },
  Sent: { bg: '#EFF6FF', color: '#2563EB' },
  Replied: { bg: '#E6F7F8', color: '#0E848D' },
};

const RESPONSE_PILL_STYLES = {
  'Awaiting Response': { bg: '#F1F5F9', color: '#475569' },
  Accepted: { bg: '#ECFDF5', color: '#059669' },
  Rejected: { bg: '#FEF2F2', color: '#DC2626' },
};

function toIsoDate(isoTimestamp) {
  return isoTimestamp ? isoTimestamp.slice(0, 10) : null;
}

function CandidateIdentity({ candidate }) {
  return (
    <div>
      <div className="table-user-name">{candidate.fullName}</div>
      <div className="table-user-email" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {candidate.email}
      </div>
    </div>
  );
}

function ActiveRowActions({ candidate, onAccept, onReject, onUndoAccept }) {
  if (candidate.responseStatus === 'Accepted') {
    return (
      <div className="candidate-row-actions">
        <span className="status-pill" style={RESPONSE_PILL_STYLES.Accepted}>Accepted</span>
        <button
          type="button"
          className="candidate-action-btn undo"
          title={`Undo Accept for ${candidate.fullName}`}
          aria-label={`Undo Accept for ${candidate.fullName}`}
          onClick={() => onUndoAccept(candidate)}
        >
          <Undo2 size={14} />
        </button>
      </div>
    );
  }
  return (
    <div className="candidate-row-actions">
      <button
        type="button"
        className="candidate-action-btn accept"
        title={`Accept ${candidate.fullName}`}
        aria-label={`Accept ${candidate.fullName}`}
        onClick={() => onAccept(candidate.id)}
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        className="candidate-action-btn reject"
        title={`Reject ${candidate.fullName}`}
        aria-label={`Reject ${candidate.fullName}`}
        onClick={() => onReject(candidate)}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function CandidateTable({
  candidates = [],
  mode = 'active', // 'active' | 'rejected'
  selectedIds = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  onAccept,
  onReject,
  onUndoAccept,
  onRestore,
}) {
  const allSelected = mode === 'active' && candidates.length > 0 && candidates.every((c) => selectedIds.has(c.id));

  return (
    <>
      {/* Desktop table */}
      <div className="directory-table-card candidate-table-desktop">
        <div className="widget-table-wrapper">
          <table className="widget-table">
            <thead>
              <tr>
                {mode === 'active' && (
                  <th style={{ width: '4%' }}>
                    <input
                      type="checkbox"
                      aria-label="Select all visible candidates"
                      checked={allSelected}
                      onChange={(e) => onToggleSelectAll(e.target.checked)}
                    />
                  </th>
                )}
                <th style={{ width: '20%' }}>CANDIDATE</th>
                <th style={{ width: '15%' }}>POSITION</th>
                <th style={{ width: '15%' }}>DEPARTMENT</th>
                <th style={{ width: '10%' }}>OFFER TYPE</th>
                <th style={{ width: '11%' }}>EMAIL STATUS</th>
                {mode === 'active' ? (
                  <>
                    <th style={{ width: '13%' }}>RESPONSE</th>
                    <th style={{ width: '10%' }}>SHORTLISTED</th>
                  </>
                ) : (
                  <th style={{ width: '13%' }}>REJECTED DATE</th>
                )}
                <th style={{ width: '10%' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const offerPill = OFFER_PILL_STYLES[candidate.offerType] || OFFER_PILL_STYLES.Paid;
                const emailPill = EMAIL_STATUS_PILL_STYLES[candidate.emailStatus] || EMAIL_STATUS_PILL_STYLES.Pending;
                const responsePill = RESPONSE_PILL_STYLES[candidate.responseStatus] || RESPONSE_PILL_STYLES['Awaiting Response'];

                return (
                  <tr key={candidate.id}>
                    {mode === 'active' && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${candidate.fullName}`}
                          checked={selectedIds.has(candidate.id)}
                          onChange={() => onToggleSelect(candidate.id)}
                        />
                      </td>
                    )}
                    <td><CandidateIdentity candidate={candidate} /></td>
                    <td><div className="table-text-main">{candidate.positionName}</div></td>
                    <td><div className="table-text-secondary">{candidate.department ? candidate.department.name : 'Unassigned'}</div></td>
                    <td>
                      <span className="status-pill" style={{ backgroundColor: offerPill.bg, color: offerPill.color }}>
                        {candidate.offerType}
                      </span>
                    </td>
                    <td>
                      <span className="status-pill" style={{ backgroundColor: emailPill.bg, color: emailPill.color }}>
                        {candidate.emailStatus}
                      </span>
                    </td>
                    {mode === 'active' ? (
                      <>
                        <td>
                          <span className="status-pill" style={{ backgroundColor: responsePill.bg, color: responsePill.color }}>
                            {candidate.responseStatus}
                          </span>
                        </td>
                        <td><div className="table-text-secondary">{formatDateDisplay(toIsoDate(candidate.shortlistedAt))}</div></td>
                      </>
                    ) : (
                      <td><div className="table-text-secondary">{formatDateDisplay(toIsoDate(candidate.rejectedAt))}</div></td>
                    )}
                    <td>
                      {mode === 'active' ? (
                        <ActiveRowActions candidate={candidate} onAccept={onAccept} onReject={onReject} onUndoAccept={onUndoAccept} />
                      ) : (
                        <button
                          type="button"
                          className="candidate-action-btn restore"
                          title={`Restore ${candidate.fullName}`}
                          aria-label={`Restore ${candidate.fullName} to Candidates`}
                          onClick={() => onRestore(candidate.id)}
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile candidate cards */}
      <div className="candidate-card-grid">
        {candidates.map((candidate) => {
          const offerPill = OFFER_PILL_STYLES[candidate.offerType] || OFFER_PILL_STYLES.Paid;
          const emailPill = EMAIL_STATUS_PILL_STYLES[candidate.emailStatus] || EMAIL_STATUS_PILL_STYLES.Pending;
          const responsePill = RESPONSE_PILL_STYLES[candidate.responseStatus] || RESPONSE_PILL_STYLES['Awaiting Response'];

          return (
            <div key={candidate.id} className="candidate-card">
              <div className="candidate-card-header">
                {mode === 'active' && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${candidate.fullName}`}
                    checked={selectedIds.has(candidate.id)}
                    onChange={() => onToggleSelect(candidate.id)}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div className="table-user-name">{candidate.fullName}</div>
                  <div className="table-user-email" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{candidate.email}</div>
                </div>
              </div>

              <div className="candidate-card-body">
                <div className="detail-row"><span className="detail-text" style={{ fontWeight: 600 }}>{candidate.positionName}</span></div>
                <div className="detail-row"><span className="detail-text">{candidate.department ? candidate.department.name : 'Unassigned'}</span></div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.4rem 0' }}>
                  <span className="status-pill" style={{ backgroundColor: offerPill.bg, color: offerPill.color }}>{candidate.offerType}</span>
                  <span className="status-pill" style={{ backgroundColor: emailPill.bg, color: emailPill.color }}>{candidate.emailStatus}</span>
                  {mode === 'active' ? (
                    <span className="status-pill" style={{ backgroundColor: responsePill.bg, color: responsePill.color }}>{candidate.responseStatus}</span>
                  ) : (
                    <span className="table-sub-badge">Rejected {formatDateDisplay(toIsoDate(candidate.rejectedAt))}</span>
                  )}
                </div>
                {mode === 'active' && (
                  <div className="detail-row" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Shortlisted {formatDateDisplay(toIsoDate(candidate.shortlistedAt))}
                  </div>
                )}
              </div>

              <div className="candidate-card-footer">
                {mode === 'active' ? (
                  <ActiveRowActions candidate={candidate} onAccept={onAccept} onReject={onReject} />
                ) : (
                  <button type="button" className="btn-secondary" onClick={() => onRestore(candidate.id)}>
                    <RotateCcw size={14} />
                    <span>Restore</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
