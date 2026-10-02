import React from 'react';
import { Link } from 'react-router-dom';
import { Check, X, RotateCcw, Undo2 } from 'lucide-react';
import { formatDateDisplay } from '../../utils/dateUtils.js';

const OFFER_PILL_STYLES = {
  Paid: { bg: '#ECFDF5', color: '#059669' },
  Unpaid: { bg: '#FEF3C7', color: '#D97706' },
};
// Real applicants created before the Recruitment API added its own allowance field carry no
// offerType at all — shown as its own state, never silently defaulted to Paid.
const OFFER_PILL_UNSET = { bg: '#FEF2F2', color: '#DC2626' };

// The viewer's local calendar date for a timestamp (a UTC slice would show the previous day for
// anything before 8am in Malaysia).
// The department they applied to, shown once. The job's position is added only when it says
// something different (e.g. "Data Analytics Intern" under "Data Analytics & Business
// Intelligence"), not when it just repeats the department ("Software Engineering").
function departmentAndPosition(candidate) {
  const normalize = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const department = candidate.department?.name || candidate.positionName || 'Unassigned';
  const position = candidate.positionName;
  const extraPosition = position && normalize(position) !== normalize(department) ? position : null;
  return { department, extraPosition };
}

function toIsoDate(isoTimestamp) {
  if (!isoTimestamp) return null;
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return String(isoTimestamp).slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The Shortlisted date comes only from the Recruitment system (when the candidate last entered
// Upcoming). Until Recruitment records it, say so — never show an estimated date in its place.
const SHORTLISTED_NOT_RECORDED_HINT = 'The Recruitment system hasn’t recorded when this candidate entered Upcoming yet.';

function ShortlistedDate({ candidate }) {
  if (!candidate.shortlistedAt) {
    return <span className="shortlisted-not-recorded" title={SHORTLISTED_NOT_RECORDED_HINT}>Not recorded</span>;
  }
  return formatDateDisplay(toIsoDate(candidate.shortlistedAt));
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
                <th style={{ width: '36%' }}>Candidate</th>
                <th style={{ width: '32%' }}>Department</th>
                <th style={{ width: '14%' }}>Offer</th>
                <th className="gmail-date-header" style={{ width: '18%' }}>{mode === 'active' ? 'Shortlisted' : 'Rejected'}</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const offerPill = OFFER_PILL_STYLES[candidate.offerType] || OFFER_PILL_UNSET;
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
                      {(() => {
                        const { department, extraPosition } = departmentAndPosition(candidate);
                        return (
                          <>
                            <span className="table-text-main">{department}</span>
                            {extraPosition && (
                              <>
                                <span className="gmail-role-sep">—</span>
                                <span className="table-text-secondary">{extraPosition}</span>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="status-pill" style={{ backgroundColor: offerPill.bg, color: offerPill.color }}>
                        {candidate.offerType || 'Not set'}
                      </span>
                    </td>
                    <td className="gmail-date-cell">
                      <span className="gmail-date-text">
                        {mode === 'active' ? <ShortlistedDate candidate={candidate} /> : formatDateDisplay(toIsoDate(candidate.rejectedAt))}
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
          const offerPill = OFFER_PILL_STYLES[candidate.offerType] || OFFER_PILL_UNSET;

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
                <div className="detail-row"><span className="detail-text" style={{ fontWeight: 600 }}>{departmentAndPosition(candidate).department}</span></div>
                {departmentAndPosition(candidate).extraPosition && (
                  <div className="detail-row"><span className="detail-text">{departmentAndPosition(candidate).extraPosition}</span></div>
                )}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.4rem 0' }}>
                  <span className="status-pill" style={{ backgroundColor: offerPill.bg, color: offerPill.color }}>{candidate.offerType || 'Not set'}</span>
                  {mode !== 'active' && (
                    <span className="table-sub-badge">Rejected {formatDateDisplay(toIsoDate(candidate.rejectedAt))}</span>
                  )}
                </div>
                {mode === 'active' && (
                  <div className="detail-row" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Shortlisted <ShortlistedDate candidate={candidate} />
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
