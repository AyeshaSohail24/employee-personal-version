import React from 'react';
import { Link } from 'react-router-dom';
import { Check, X, RotateCcw, Undo2 } from 'lucide-react';
import { formatDateDisplay } from '../../utils/dateUtils.js';

const OFFER_PILL_STYLES = {
  Paid: { bg: '#ECFDF5', color: '#059669' },
  Unpaid: { bg: '#FEF3C7', color: '#D97706' },
};

// The viewer's local calendar date for a timestamp (a UTC slice would show the previous day for
// anything before 8am in Malaysia).
function toIsoDate(isoTimestamp) {
  if (!isoTimestamp) return null;
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return String(isoTimestamp).slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function CandidateIdentity({ candidate, isUnreadReply }) {
  return (
    <>
      {isUnreadReply && <span className="gmail-unread-dot" title="New reply — awaiting response" />}
      <Link
        to={`/upcoming/${candidate.id}`}
        className="table-user-name gmail-name-link"
        onClick={(e) => e.stopPropagation()}
        title={`Open conversation with ${candidate.fullName}`}
      >
        {candidate.fullName}
      </Link>
      <span className="gmail-role-sep">·</span>
      <span className="table-text-secondary">{candidate.email}</span>
    </>
  );
}

function ActiveRowActions({ candidate, onAccept, onReject, onUndoAccept }) {
  const acceptButton = (
    <button
      type="button"
      className="candidate-action-btn accept"
      title={`Accept ${candidate.fullName} and add them as an intern`}
      aria-label={`Accept ${candidate.fullName}`}
      onClick={(e) => { e.stopPropagation(); onAccept(candidate); }}
    >
      <Check size={14} />
    </button>
  );
  // "Accepted" here is the old browser-only mark — they haven't been added as an intern yet, so
  // Accept is still offered to finish that, alongside Undo.
  if (candidate.responseStatus === 'Accepted') {
    return (
      <div className="candidate-row-actions gmail-row-actions">
        {acceptButton}
        <button
          type="button"
          className="candidate-action-btn undo"
          title={`Undo Accept for ${candidate.fullName}`}
          aria-label={`Undo Accept for ${candidate.fullName}`}
          onClick={(e) => { e.stopPropagation(); onUndoAccept(candidate); }}
        >
          <Undo2 size={14} />
        </button>
      </div>
    );
  }
  return (
    <div className="candidate-row-actions gmail-row-actions">
      {acceptButton}
      <button
        type="button"
        className="candidate-action-btn reject"
        title={`Reject ${candidate.fullName}`}
        aria-label={`Reject ${candidate.fullName}`}
        onClick={(e) => { e.stopPropagation(); onReject(candidate); }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function CandidateTable({
  candidates = [],
  mode = 'active', // 'active' | 'rejected'
  onAccept,
  onReject,
  onUndoAccept,
  onRestore,
}) {
  return (
    <>
      {/* Desktop table — dense, connected inbox-style list (Gmail pattern): flush rows with a
          hairline divider only, whole-row hover highlight, and the trailing date cell swaps to
          action icons on hover instead of showing a separate always-visible actions column. */}
      <div className="gmail-table-card candidate-table-desktop">
        <div className="widget-table-wrapper">
          <table className="widget-table gmail-table">
            <thead>
              <tr>
                <th style={{ width: '34%' }}>Candidate</th>
                <th style={{ width: '38%' }}>Role</th>
                <th style={{ width: '12%' }}>Offer</th>
                <th className="gmail-date-header" style={{ width: '16%' }}>{mode === 'active' ? 'Shortlisted' : 'Rejected'}</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const offerPill = OFFER_PILL_STYLES[candidate.offerType] || OFFER_PILL_STYLES.Paid;
                const isUnreadReply = mode === 'active' && candidate.emailStatus === 'Replied' && !candidate.notificationRead;

                return (
                  <tr
                    key={candidate.id}
                    className={`gmail-row ${isUnreadReply ? 'gmail-row-unread' : ''}`}
                  >
                    <td className="gmail-cell-truncate">
                      <CandidateIdentity candidate={candidate} isUnreadReply={isUnreadReply} />
                    </td>
                    <td className="gmail-cell-truncate">
                      <span className="table-text-main">{candidate.positionName}</span>
                      <span className="gmail-role-sep">—</span>
                      <span className="table-text-secondary">{candidate.department ? candidate.department.name : 'Unassigned'}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="status-pill" style={{ backgroundColor: offerPill.bg, color: offerPill.color }}>
                        {candidate.offerType}
                      </span>
                    </td>
                    <td className="gmail-date-cell">
                      <span className="gmail-date-text">
                        {formatDateDisplay(toIsoDate(mode === 'active' ? candidate.shortlistedAt : candidate.rejectedAt))}
                      </span>
                      {mode === 'active' ? (
                        <ActiveRowActions candidate={candidate} onAccept={onAccept} onReject={onReject} onUndoAccept={onUndoAccept} />
                      ) : (
                        // Always visible (not hover-only) so a rejected candidate can clearly be restored.
                        <button
                          type="button"
                          className="candidate-restore-btn"
                          title={`Restore ${candidate.fullName} to the active candidates`}
                          aria-label={`Restore ${candidate.fullName} to Candidates`}
                          onClick={(e) => { e.stopPropagation(); onRestore(candidate.id); }}
                        >
                          <RotateCcw size={13} />
                          <span>Restore</span>
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

          return (
            <div key={candidate.id} className="candidate-card">
              <div className="candidate-card-header">
                <div style={{ flex: 1 }}>
                  <Link
                    to={`/upcoming/${candidate.id}`}
                    className="table-user-name gmail-name-link"
                    title={`Open conversation with ${candidate.fullName}`}
                  >
                    {candidate.fullName}
                  </Link>
                  <div className="table-user-email" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{candidate.email}</div>
                </div>
              </div>

              <div className="candidate-card-body">
                <div className="detail-row"><span className="detail-text" style={{ fontWeight: 600 }}>{candidate.positionName}</span></div>
                <div className="detail-row"><span className="detail-text">{candidate.department ? candidate.department.name : 'Unassigned'}</span></div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.4rem 0' }}>
                  <span className="status-pill" style={{ backgroundColor: offerPill.bg, color: offerPill.color }}>{candidate.offerType}</span>
                  {mode !== 'active' && (
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
