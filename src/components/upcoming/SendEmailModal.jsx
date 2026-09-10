import React, { useEffect, useState } from 'react';
import { X, Send, AlertCircle, ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react';
import { candidateEmailService } from '../../services/candidateEmailService.js';
import { renderEmailTemplate, validateCcList } from '../../domain/candidateDomain.js';

/**
 * Single-candidate compose/preview OR multi-candidate bulk review modal for the Upcoming
 * offer email workflow. Bulk mode never merges recipients into one email — each candidate
 * is always rendered and sent individually via candidateEmailService.
 */
export default function SendEmailModal({ isOpen, onClose, candidates = [], onSent }) {
  const isBulk = candidates.length > 1;

  const [hiringEmployeeName, setHiringEmployeeName] = useState('');
  const [cc, setCc] = useState('');
  const [ccError, setCcError] = useState(null);

  // Single mode: the RAW rendered template (ApplicantName/PositionName resolved, but
  // {{HiringEmployeeName}} deliberately left as a literal token) is kept separately from the
  // displayed/editable subject/body, so the Hiring Employee Name can be re-interpolated fresh
  // on every keystroke via the centralized renderEmailTemplate() — never a one-time destructive
  // string replace, which would only ever resolve the very first character typed.
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [userEditedEmail, setUserEditedEmail] = useState(false);

  const [bulkPreviews, setBulkPreviews] = useState([]);
  const [error, setError] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setHiringEmployeeName('');
    setCc('');
    setCcError(null);
    setError(null);
    setIsSending(false);
    setBulkResults(null);
    setUserEditedEmail(false);

    if (!isBulk && candidates[0]) {
      candidateEmailService.renderPreview(candidates[0], { hiringEmployeeName: '', cc: '' })
        .then((preview) => {
          setSubjectTemplate(preview.subject);
          setBodyTemplate(preview.body);
          setSubject(preview.subject);
          setBody(preview.body);
        })
        .catch((err) => setError(err.message));
    } else {
      setBulkPreviews(candidates.map((c) => ({ candidateId: c.id, candidate: c, subject: '', body: '', unresolvedPlaceholders: [], expanded: false })));
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Single mode: re-render the DISPLAYED subject/body fresh from the raw template on every
  // Hiring Employee Name keystroke (A -> Ay -> Aye -> Ayesha all correctly reflected), via the
  // centralized renderEmailTemplate(). Once HR manually edits the Subject/Body directly, their
  // edit is respected and takes over — further name changes stop auto-overwriting free-form text.
  const handleHiringNameChange = (value) => {
    setHiringEmployeeName(value);
    if (!isBulk && !userEditedEmail) {
      setSubject(renderEmailTemplate(subjectTemplate, { HiringEmployeeName: value }).rendered);
      setBody(renderEmailTemplate(bodyTemplate, { HiringEmployeeName: value }).rendered);
    }
  };

  const handleSubjectChange = (value) => {
    setSubject(value);
    setUserEditedEmail(true);
  };

  const handleBodyChange = (value) => {
    setBody(value);
    setUserEditedEmail(true);
  };

  // Bulk mode: fully re-renders every candidate's preview (via the same centralized
  // renderEmailTemplate()/renderPreview()) whenever the Hiring Employee Name or CC changes —
  // previews are read-only, so there is no manual-edit state to preserve here.
  useEffect(() => {
    if (!isOpen || !isBulk) return;
    let cancelled = false;
    Promise.all(candidates.map(async (c) => {
      const preview = await candidateEmailService.renderPreview(c, { hiringEmployeeName, cc });
      return { candidateId: c.id, candidate: c, ...preview };
    })).then((results) => {
      if (cancelled) return;
      setBulkPreviews((prev) => results.map((r) => ({
        ...r,
        expanded: prev.find((p) => p.candidateId === r.candidateId)?.expanded || false,
      })));
    }).catch((err) => setError(err.message));
    return () => { cancelled = true; };
  }, [isOpen, isBulk, hiringEmployeeName, cc, candidates]);

  if (!isOpen || candidates.length === 0) return null;

  const toggleBulkExpand = (candidateId) => {
    setBulkPreviews((prev) => prev.map((p) => (p.candidateId === candidateId ? { ...p, expanded: !p.expanded } : p)));
  };

  const singleUnresolved = !isBulk
    ? Array.from(new Set([...renderEmailTemplate(subject, {}).unresolved, ...renderEmailTemplate(body, {}).unresolved]))
    : [];
  const bulkHasUnresolved = isBulk && bulkPreviews.some((p) => p.unresolvedPlaceholders.length > 0);

  const handleCcBlur = () => {
    if (!cc.trim()) { setCcError(null); return; }
    const { isValid, invalidEntries } = validateCcList(cc);
    setCcError(isValid ? null : `Invalid CC address: ${invalidEntries.join(', ')}`);
  };

  const canSend = hiringEmployeeName.trim() !== '' && !ccError && (isBulk ? !bulkHasUnresolved : singleUnresolved.length === 0);

  const handleSend = async () => {
    setError(null);
    if (cc.trim()) {
      const { isValid, invalidEntries } = validateCcList(cc);
      if (!isValid) {
        setCcError(`Invalid CC address: ${invalidEntries.join(', ')}`);
        return;
      }
    }

    setIsSending(true);
    try {
      if (!isBulk) {
        await candidateEmailService.sendEmail(candidates[0].id, { subject, body, cc });
        if (onSent) onSent();
        onClose();
      } else {
        const results = await candidateEmailService.sendBulkEmails(candidates.map((c) => c.id), { hiringEmployeeName, cc });
        setBulkResults(results);
        if (onSent) onSent();
      }
    } catch (err) {
      setError(err.message || 'Failed to send email.');
    } finally {
      setIsSending(false);
    }
  };

  const hiringNameCcFields = (
    <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Hiring Employee Name <span className="required-star">*</span></label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. Ayesha"
          value={hiringEmployeeName}
          onChange={(e) => handleHiringNameChange(e.target.value)}
        />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">CC <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
        <input
          type="text"
          className="form-input"
          placeholder="name@rizurf.example, name2@rizurf.example"
          value={cc}
          onChange={(e) => { setCc(e.target.value); setCcError(null); }}
          onBlur={handleCcBlur}
        />
        {ccError && <span className="form-hint" style={{ color: '#DC2626' }}>{ccError}</span>}
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide-modal modal-scroll-shell" style={{ maxWidth: '760px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Send size={20} />
            </div>
            <div>
              <h3 className="modal-title">
                {isBulk ? `Send ${candidates.length} Personalized Emails` : 'Email Preview'}
              </h3>
              <p className="modal-subtitle">
                {isBulk
                  ? 'Each candidate receives their own individually rendered offer email.'
                  : `To ${candidates[0].fullName} (${candidates[0].email})`}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {isBulk && !bulkResults ? (
          // Bulk mode: ONE primary scrollable content area for the candidate list. Hiring
          // Employee Name / CC stay fixed above it (never scroll away), and the candidate list
          // itself is the only scroller — no nested per-candidate email-body scrollbar.
          <div className="modal-body bulk-modal-body">
            {error && (
              <div className="modal-error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            <div className="bulk-fixed-fields">{hiringNameCcFields}</div>
            <div className="bulk-main-scroll-area">
              <div className="bulk-candidate-list">
                {bulkPreviews.map((p) => (
                  <div key={p.candidateId} className="bulk-candidate-row">
                    <button type="button" className="bulk-candidate-toggle" onClick={() => toggleBulkExpand(p.candidateId)}>
                      <CheckCircle2 size={15} style={{ color: '#059669' }} />
                      <span className="bulk-candidate-name">{p.candidate.fullName}</span>
                      <span className="status-pill" style={p.candidate.offerType === 'Paid' ? { backgroundColor: '#ECFDF5', color: '#059669' } : { backgroundColor: '#FEF3C7', color: '#D97706' }}>
                        {p.candidate.offerType}
                      </span>
                      {p.unresolvedPlaceholders.length > 0 && (
                        <span className="status-pill" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>Missing name</span>
                      )}
                      <span className="bulk-candidate-chevron">{p.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                    </button>
                    {p.expanded && (
                      <div className="bulk-candidate-preview">
                        <div className="bulk-preview-field"><strong>To:</strong> {p.to}</div>
                        <div className="bulk-preview-field"><strong>Subject:</strong> {p.subject}</div>
                        <pre className="bulk-preview-body">{p.body}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="modal-body">
            {error && (
              <div className="modal-error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {bulkResults ? (
              <div className="bulk-send-results">
                <p className="modal-subtitle" style={{ marginBottom: '0.75rem' }}>
                  Offer emails prepared and recorded in the PoC (no real email provider is connected yet).
                </p>
                {bulkResults.map((r) => {
                  const candidate = candidates.find((c) => c.id === r.candidateId);
                  return (
                    <div key={r.candidateId} className="bulk-result-row">
                      {r.success ? <CheckCircle2 size={16} style={{ color: '#059669' }} /> : <XCircle size={16} style={{ color: '#DC2626' }} />}
                      <span>{candidate ? candidate.fullName : r.candidateId}</span>
                      {!r.success && <span className="bulk-result-error">{r.error}</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {hiringNameCcFields}

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">To</label>
                  <input type="text" className="form-input" value={candidates[0].email} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Subject <span className="required-star">*</span></label>
                  <input type="text" className="form-input" value={subject} onChange={(e) => handleSubjectChange(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Email Body <span className="required-star">*</span></label>
                  <textarea className="form-textarea email-body-textarea app-scroll-area" rows={12} value={body} onChange={(e) => handleBodyChange(e.target.value)} />
                  {singleUnresolved.length > 0 && (
                    <span className="form-hint" style={{ color: '#DC2626' }}>
                      Unresolved placeholder(s): {singleUnresolved.map((t) => `{{${t}}}`).join(', ')}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)', marginTop: 0 }}>
          {bulkResults ? (
            <button type="button" className="btn-primary" onClick={onClose}>Done</button>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={isSending}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSend} disabled={!canSend || isSending}>
                {isSending ? 'Sending...' : isBulk ? `Confirm & Send ${candidates.length} Emails` : 'Send Email'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
