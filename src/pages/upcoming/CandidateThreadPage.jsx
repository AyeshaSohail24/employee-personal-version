import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, FileEdit, Braces } from 'lucide-react';
import { upcomingCandidateService } from '../../services/upcomingCandidateService.js';
import { candidateEmailService } from '../../services/candidateEmailService.js';
import { emailTemplateService } from '../../services/emailTemplateService.js';
import { Select } from '../../components/common/Select.jsx';
import { useSession } from '../../state/SessionContext';

function formatThreadTimestamp(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

const OFFER_PILL_STYLES = {
  Paid: { bg: '#ECFDF5', color: '#059669' },
  Unpaid: { bg: '#FEF3C7', color: '#D97706' },
};

/**
 * Full-page conversation view for one candidate's offer-email correspondence — reads via
 * candidateEmailService.getThread() (same source EmailThreadModal used to use) and can send a
 * new reply through candidateEmailService.sendEmail(), which appends to candidateEmailLog and
 * is picked up on the next getThread() call. Opening this page clears the candidate's unseen
 * reply flag, same as opening a message in an inbox.
 */
export default function CandidateThreadPage() {
  const { candidateId } = useParams();
  const session = useSession();
  const hiringEmployeeName = session.name || session.email || 'HR Team';
  const [candidate, setCandidate] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [draftPickerValue, setDraftPickerValue] = useState('');
  const [placeholderPickerValue, setPlaceholderPickerValue] = useState('');
  const [activeReplyField, setActiveReplyField] = useState('body');
  const replyTextareaRef = useRef(null);
  const replySubjectRef = useRef(null);

  useEffect(() => {
    emailTemplateService.getAll().then(setDrafts).catch(() => {});
  }, []);

  // Auto-grow the reply box as its content overflows — matches the height to what's actually
  // typed (or pasted/inserted from a draft) instead of clipping to the fixed 3-row default;
  // .form-textarea's own max-height still caps it, past which it scrolls normally.
  useEffect(() => {
    const el = replyTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [replyText]);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await upcomingCandidateService.getById(candidateId);
      if (!c) {
        setError('Candidate not found.');
        return;
      }
      setCandidate(c);

      if (c.emailStatus === 'Replied' && !c.notificationRead) {
        await upcomingCandidateService.markNotificationRead(candidateId);
      }

      const thread = await candidateEmailService.getThread(candidateId);
      setMessages(thread);
    } catch (err) {
      setError(err.message || 'Failed to load conversation.');
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Anchored to the thread's earliest message subject (never the mutable candidate.lastEmailSubject,
  // which sendEmail() overwrites on every send — anchoring to that would double up "Re: Re: ..."
  // once a reply had already been sent once).
  const anchorSubject = messages[0]?.subject || candidate?.lastEmailSubject || 'Your application';
  const fallbackReplySubject = anchorSubject.startsWith('Re:') ? anchorSubject : `Re: ${anchorSubject}`;

  const handleSendReply = async () => {
    if (!replyText.trim() || !candidate) return;
    setIsSending(true);
    try {
      const subject = replySubject.trim() || fallbackReplySubject;
      await candidateEmailService.sendEmail(candidate.id, { subject, body: replyText.trim(), cc: '' });
      setReplySubject('');
      setReplyText('');
      await loadThread();
    } catch (err) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  // Pulls a saved draft in as a starting point for the reply, personalized for this candidate
  // (ApplicantName/PositionName resolved; {{HiringEmployeeName}} filled with the current user).
  // Confirms before overwriting anything already typed, same as other destructive-ish actions
  // in this app (Undo Accept, Reject).
  const handleInsertDraft = async (templateId) => {
    setDraftPickerValue('');
    if (!templateId || !candidate) return;
    if ((replySubject.trim() || replyText.trim()) && !window.confirm('Replace what you\'ve typed with this draft?')) {
      return;
    }
    try {
      const rendered = await candidateEmailService.renderTemplateForCandidate(templateId, candidate, hiringEmployeeName);
      setReplySubject(rendered.subject);
      setReplyText(rendered.body);
    } catch (err) {
      setError(err.message || 'Failed to load draft.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendReply();
    }
  };

  // Personalized values for this specific candidate — unlike EmailDraftsPanel's raw {{tokens}}
  // (which are only ever resolved later, at send time, for a reusable template), this is a live
  // reply already addressed to one person, so there's nothing left to resolve: inserting drops
  // the actual value straight in.
  const placeholderFields = candidate ? [
    { key: 'applicantName', label: 'Applicant Name', value: candidate.fullName },
    { key: 'positionName', label: 'Position', value: candidate.positionName },
    { key: 'hiringEmployeeName', label: 'Hiring Employee Name', value: hiringEmployeeName },
  ] : [];

  // Inserts the selected value at the cursor in whichever reply field (Subject or Body) was
  // last focused — same pattern as EmailDraftsPanel's placeholder chips.
  const handleInsertPlaceholder = (fieldKey) => {
    setPlaceholderPickerValue('');
    const field = placeholderFields.find((f) => f.key === fieldKey);
    if (!field) return;

    const isSubject = activeReplyField === 'subject';
    const ref = isSubject ? replySubjectRef : replyTextareaRef;
    const value = isSubject ? replySubject : replyText;
    const setValue = isSubject ? setReplySubject : setReplyText;
    const el = ref.current;
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const newValue = `${value.slice(0, start)}${field.value}${value.slice(end)}`;
    setValue(newValue);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const cursor = start + field.value.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  if (loading && !candidate) {
    return (
      <div className="page-layout-container">
        <div className="directory-table-card skeleton-box" style={{ height: '320px' }} />
      </div>
    );
  }

  if (error && !candidate) {
    return (
      <div className="page-layout-container">
        <Link to="/upcoming" className="thread-back-link">
          <ArrowLeft size={14} /> Back to Upcoming
        </Link>
        <div className="modal-error-alert" style={{ marginTop: '1rem' }}>{error}</div>
      </div>
    );
  }

  const offerPill = OFFER_PILL_STYLES[candidate.offerType] || OFFER_PILL_STYLES.Paid;

  return (
    <div className="page-layout-container thread-page-container">
      <Link to="/upcoming" className="thread-back-link">
        <ArrowLeft size={14} /> Back to Upcoming
      </Link>

      <div className="thread-page-card">
        <div className="thread-page-header">
          <div>
            <h2 className="thread-page-name">{candidate.fullName}</h2>
            <p className="thread-page-email">{candidate.email}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="thread-reply-toolbar" style={{ margin: 0 }}>
              <FileEdit size={14} className="thread-reply-toolbar-icon" />
              <Select
                variant="filter"
                value={draftPickerValue}
                onChange={(e) => handleInsertDraft(e.target.value)}
                placeholder={drafts.length ? 'Use a Draft...' : 'No drafts available'}
                disabled={drafts.length === 0}
                options={drafts.map((d) => ({ value: d.id, label: `${d.name} (${d.offerType})` }))}
              />
            </div>
            <div className="thread-reply-toolbar" style={{ margin: 0 }}>
              <Braces size={14} className="thread-reply-toolbar-icon" />
              <Select
                variant="filter"
                value={placeholderPickerValue}
                onChange={(e) => handleInsertPlaceholder(e.target.value)}
                placeholder={`Insert into ${activeReplyField === 'subject' ? 'Subject' : 'Body'}...`}
                options={placeholderFields.map((f) => ({ value: f.key, label: f.label }))}
              />
            </div>
            <span className="status-pill" style={{ backgroundColor: offerPill.bg, color: offerPill.color }}>{candidate.offerType}</span>
            <span className="status-pill" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{candidate.positionName}</span>
          </div>
        </div>

        <div className="email-thread-body thread-page-scroll app-scroll-area">
          {loading ? (
            <div className="email-thread-loading">
              <Loader2 size={18} className="icon-spin" />
              <span>Loading conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <p className="empty-widget-text">No emails have been sent to this candidate yet.</p>
          ) : (
            <div className="email-thread-list">
              {messages.map((msg) => (
                <div key={msg.id} className={`email-thread-message ${msg.direction}`}>
                  <div className="email-thread-message-meta">
                    <span className="email-thread-sender">
                      {msg.direction === 'sent' ? 'You' : candidate.firstName || candidate.fullName}
                    </span>
                    <span className="email-thread-timestamp">{formatThreadTimestamp(msg.at)}</span>
                  </div>
                  <div className="email-thread-bubble">
                    <div className="email-thread-subject">{msg.subject}</div>
                    <div className="email-thread-text">{msg.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div className="modal-error-alert" style={{ margin: '0 1.25rem' }}>{error}</div>}

        <div className="thread-reply-box">
          <div className="thread-reply-compose">
            <input
              ref={replySubjectRef}
              type="text"
              className="form-input thread-reply-subject"
              placeholder={fallbackReplySubject}
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
              onFocus={() => setActiveReplyField('subject')}
            />
            <textarea
              ref={replyTextareaRef}
              className="form-textarea thread-reply-textarea"
              placeholder={`Reply to ${candidate.firstName || candidate.fullName}...`}
              rows={1}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setActiveReplyField('body')}
            />
          </div>
          <div className="thread-reply-actions">
            <span className="thread-reply-hint">Cmd/Ctrl + Enter to send</span>
            <button
              type="button"
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={handleSendReply}
              disabled={!replyText.trim() || isSending}
            >
              <Send size={14} />
              <span>{isSending ? 'Sending...' : 'Send'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
