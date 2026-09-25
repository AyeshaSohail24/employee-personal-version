import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Mail, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { emailTemplateService } from '../../services/emailTemplateService.js';
import { ApiError } from '../../services/apiClient.js';
import { Select } from '../common/Select.jsx';

const PLACEHOLDER_TOKENS = ['{{ApplicantName}}', '{{PositionName}}', '{{HiringEmployeeName}}'];

const OFFER_PILL_STYLES = {
  Paid: { bg: '#ECFDF5', color: '#059669' },
  Unpaid: { bg: '#FEF3C7', color: '#D97706' },
};

// Every candidate's offer email is rendered from a draft of their offer type, so each of these
// must always keep at least one draft (mirrors REQUIRED_OFFER_TYPES in server/db/candidateMessaging.js).
const REQUIRED_OFFER_TYPES = ['Paid', 'Unpaid'];

function errorText(err, fallback) {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

const OFFER_TYPE_OPTIONS = [
  { value: 'Paid', label: 'Paid' },
  { value: 'Unpaid', label: 'Unpaid' },
];

/**
 * Card-grid overview of every offer email draft, so HR can see what exists at a glance before
 * committing to edit one. Clicking a card opens a focused, full-width editor for just that
 * draft (name/offer type/subject/body + placeholder legend + Delete/Cancel/Save) — replaces the old
 * cramped sidebar-list-plus-editor split view. The "New Draft" button above the grid creates a
 * blank draft and opens it straight into the editor.
 */
export default function EmailDraftsPanel() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [offerType, setOfferType] = useState('Paid');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeField, setActiveField] = useState('body');
  const [search, setSearch] = useState('');
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);

  // Inserts a placeholder token at the cursor position in whichever field (Subject or Body) the
  // user last focused — replacing any current selection, like a normal text edit — then restores
  // focus and cursor position so multiple placeholders can be dropped in back-to-back.
  const insertPlaceholder = (token) => {
    const isSubject = activeField === 'subject';
    const ref = isSubject ? subjectRef : bodyRef;
    const value = isSubject ? subject : body;
    const setValue = isSubject ? setSubject : setBody;
    const el = ref.current;
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const newValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
    setValue(newValue);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  // Drafts live in MySQL (via emailTemplateService). Only the first load shows the skeleton —
  // later refreshes (after save/create/delete) update in place so the open editor isn't unmounted.
  const loadTemplates = async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    try {
      setTemplates(await emailTemplateService.getAll());
    } catch (err) {
      setErrorMessage(errorText(err, 'Could not load email drafts.'));
    } finally {
      if (initial) setLoading(false);
    }
  };

  useEffect(() => { loadTemplates({ initial: true }); }, []);

  const editingTemplate = templates.find((t) => t.id === editingId) || null;

  // Searches by draft name, subject, AND body content — not just the name — so a draft can be
  // found by what it actually says, not only what it was called.
  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((tpl) => (
      (tpl.name || '').toLowerCase().includes(q)
      || (tpl.subject || '').toLowerCase().includes(q)
      || (tpl.body || '').toLowerCase().includes(q)
    ));
  }, [templates, search]);

  const openEditor = (tpl) => {
    setEditingId(tpl.id);
    setName(tpl.name);
    setOfferType(tpl.offerType);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setSavedMessage('');
    setErrorMessage('');
  };

  const handleAddDraft = async () => {
    setErrorMessage('');
    try {
      const created = await emailTemplateService.create({ name: 'New Draft', offerType: 'Paid', subject: '', body: '' });
      await loadTemplates();
      openEditor(created);
    } catch (err) {
      setErrorMessage(errorText(err, 'Could not create a new draft.'));
    }
  };

  const handleBack = () => {
    setEditingId(null);
    setSavedMessage('');
    setErrorMessage('');
  };

  // Discards any unsaved edits and returns to the drafts grid — nothing is written. Asks first
  // only when something has actually changed since the draft was opened/last saved.
  const handleCancel = () => {
    const isDirty = editingTemplate && (
      name !== editingTemplate.name
      || offerType !== editingTemplate.offerType
      || subject !== editingTemplate.subject
      || body !== editingTemplate.body
    );
    if (isDirty && !window.confirm('Discard your unsaved changes to this draft?')) return;
    handleBack();
  };

  const handleSave = async () => {
    setErrorMessage('');
    try {
      await emailTemplateService.update(editingId, { name, offerType, subject, body });
      await loadTemplates();
      // Back to the drafts list once saved; a failed save (catch below) keeps the editor open.
      handleBack();
      setSavedMessage('Draft saved.');
      setTimeout(() => setSavedMessage(''), 2500);
    } catch (err) {
      setErrorMessage(errorText(err, 'Could not save this draft.'));
    }
  };

  // Offer emails are rendered from the candidate's Paid/Unpaid draft, so the last saved draft of
  // either type can't be deleted — explained up front here, and enforced again by the server
  // (DELETE /email-templates/{id} answers 422) in case the list here is out of date.
  const isLastOfRequiredType = editingTemplate
    && REQUIRED_OFFER_TYPES.includes(editingTemplate.offerType)
    && templates.filter((t) => t.offerType === editingTemplate.offerType).length <= 1;

  // Permanently removes the draft (after confirmation) and returns to the drafts grid.
  const handleDelete = async () => {
    setErrorMessage('');
    if (isLastOfRequiredType) {
      const type = editingTemplate.offerType;
      setErrorMessage(`This is the only ${type} email draft. ${type} offer emails are sent using it, so it can't be deleted. Create another ${type} draft first.`);
      return;
    }
    const label = name.trim() || editingTemplate?.name || 'this draft';
    if (!window.confirm(`Delete "${label}" permanently? This cannot be undone.`)) return;
    try {
      await emailTemplateService.remove(editingId);
      handleBack();
      await loadTemplates();
    } catch (err) {
      setErrorMessage(errorText(err, 'Could not delete this draft.'));
    }
  };

  if (loading) {
    return <div className="directory-table-card skeleton-box" style={{ height: '220px' }} />;
  }

  if (editingTemplate) {
    return (
      <div>
        <button type="button" className="email-draft-back-link" onClick={handleBack}>
          <ArrowLeft size={14} /> Back to Drafts
        </button>

        <div className="email-draft-editor-card">
          <div className="dept-card-grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Draft Name</label>
              <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Offer Type</label>
              <Select
                variant="filter"
                value={offerType}
                onChange={(e) => setOfferType(e.target.value)}
                options={OFFER_TYPE_OPTIONS}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">Subject</label>
            <input
              ref={subjectRef}
              type="text"
              className="form-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setActiveField('subject')}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Body</label>
            <textarea
              ref={bodyRef}
              className="form-textarea email-body-textarea"
              rows={16}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => setActiveField('body')}
            />
          </div>

          <div className="email-draft-placeholder-legend">
            <span className="form-label" style={{ marginBottom: 0 }}>
              Click to insert into {activeField === 'subject' ? 'Subject' : 'Body'}:
            </span>
            {PLACEHOLDER_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                className="placeholder-token-chip placeholder-token-chip-clickable"
                onClick={() => insertPlaceholder(token)}
                title={`Insert ${token} into ${activeField === 'subject' ? 'Subject' : 'Body'}`}
              >
                {token}
              </button>
            ))}
          </div>

          {errorMessage && (
            <div className="email-draft-error" role="alert">
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="email-draft-editor-footer">
            <button type="button" className="btn-danger-outline email-draft-delete-btn" onClick={handleDelete}>
              <Trash2 size={14} />
              <span>Delete Draft</span>
            </button>
            {savedMessage && (
              <span className="sync-status-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={14} /> {savedMessage}
              </span>
            )}
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              <X size={14} />
              <span>Cancel</span>
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
              <Save size={14} />
              <span>Save Draft</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {errorMessage && (
        <div className="email-draft-error" role="alert" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}
      {savedMessage && (
        <div className="sync-status-text" role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.75rem' }}>
          <CheckCircle2 size={14} /> {savedMessage}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="toolbar-search-box">
          <Search size={18} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search drafts by name, subject, or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={search ? { paddingRight: '2.25rem' } : undefined}
          />
          {search && (
            <button type="button" className="toolbar-search-clear-btn" onClick={() => setSearch('')} title="Clear search">
              <X size={15} />
            </button>
          )}
        </div>
        <button type="button" className="btn-primary" style={{ flexShrink: 0 }} onClick={handleAddDraft}>
          <Plus size={15} />
          <span>New Draft</span>
        </button>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="directory-empty-card">
          <p className="empty-description">
            {search.trim() ? <>No drafts match &ldquo;{search}&rdquo;.</> : 'No email drafts yet.'}
          </p>
        </div>
      ) : (
        <div className="email-draft-card-grid">
          {filteredTemplates.map((tpl) => {
            const offerPill = OFFER_PILL_STYLES[tpl.offerType] || OFFER_PILL_STYLES.Paid;
            return (
              <div key={tpl.id} className="email-draft-card" onClick={() => openEditor(tpl)}>
                <div className="email-draft-card-header">
                  <span className="email-draft-card-name">{tpl.name}</span>
                  <span className="status-pill" style={{ backgroundColor: offerPill.bg, color: offerPill.color }}>
                    {tpl.offerType}
                  </span>
                </div>
                <div className="email-draft-card-subject">
                  <Mail size={12} style={{ marginRight: '0.3rem', verticalAlign: '-1px' }} />
                  {tpl.subject || 'No subject yet'}
                </div>
                <div className="email-draft-card-snippet">{tpl.body || 'No content yet — click to write this draft.'}</div>
                <div className="email-draft-card-footer">
                  <Pencil size={13} />
                  <span>Edit Draft</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
