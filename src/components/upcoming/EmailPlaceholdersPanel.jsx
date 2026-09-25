import React, { useMemo, useState } from 'react';
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Braces, Pencil, Plus, Trash2, X, Lock } from 'lucide-react';
import { emailPlaceholderService } from '../../services/emailPlaceholderService.js';
import { ApiError } from '../../services/apiClient.js';
import { Select } from '../common/Select.jsx';
import {
  BUILT_IN_PLACEHOLDERS,
  PLACEHOLDER_SOURCES,
  FIXED_TEXT_SOURCE,
  PLACEHOLDER_TOKEN_PATTERN,
  getPlaceholderSource,
  suggestTokenFromLabel,
  extractPlaceholderTokens,
} from '../../domain/emailPlaceholders.js';

const SOURCE_OPTIONS = PLACEHOLDER_SOURCES.map((s) => ({ value: s.key, label: s.label }));

const EMPTY_FORM = { label: '', token: '', source: '', fixedValue: '', description: '' };

function errorText(err, fallback) {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

function describeSource(placeholder) {
  const source = getPlaceholderSource(placeholder.source);
  if (!source) return 'Unknown source';
  if (source.key === FIXED_TEXT_SOURCE) return `Fixed text: “${placeholder.fixedValue}”`;
  return source.label;
}

/**
 * Placeholder management for Email Drafts — a card list of the built-in and user-created
 * {{Tokens}}, and a focused editor (same layout as the draft editor) for creating or editing
 * one. Every user-created placeholder picks where its value comes from
 * (src/domain/emailPlaceholders.js), so it always resolves to something real for a candidate.
 * Placeholders are shared by every HR/Admin user (MySQL, via emailPlaceholderService).
 */
export default function EmailPlaceholdersPanel({ placeholders, templates, onBack, onChanged }) {
  const [editing, setEditing] = useState(null); // null = list; {} = new; {id,...} = existing
  const [form, setForm] = useState(EMPTY_FORM);
  const [tokenTouched, setTokenTouched] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Which drafts use each token — shown on the cards, and used to explain why a placeholder in
  // use can't be renamed or deleted (the server enforces the same rule).
  const draftsByToken = useMemo(() => {
    const map = new Map();
    for (const tpl of templates) {
      for (const token of extractPlaceholderTokens(tpl.subject, tpl.body)) {
        if (!map.has(token)) map.set(token, []);
        map.get(token).push(tpl.name);
      }
    }
    return map;
  }, [templates]);

  const usedIn = (token) => draftsByToken.get(token) || [];

  const openEditor = (placeholder) => {
    setErrorMessage('');
    setSavedMessage('');
    if (placeholder) {
      setEditing(placeholder);
      setForm({
        label: placeholder.label,
        token: placeholder.token,
        source: placeholder.source,
        fixedValue: placeholder.fixedValue || '',
        description: placeholder.description || '',
      });
      setTokenTouched(true);
    } else {
      setEditing({});
      setForm(EMPTY_FORM);
      setTokenTouched(false);
    }
  };

  const closeEditor = () => {
    setEditing(null);
    setErrorMessage('');
  };

  const isNew = editing && !editing.id;
  const editingUsage = editing?.id ? usedIn(editing.token) : [];
  const tokenLocked = editingUsage.length > 0;
  const source = getPlaceholderSource(form.source);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // The token follows the name ("Start Date" -> StartDate) until HR edits it themselves.
  const handleLabelChange = (value) => {
    setForm((prev) => ({ ...prev, label: value, token: tokenTouched ? prev.token : suggestTokenFromLabel(value) }));
  };

  const handleTokenChange = (value) => {
    setTokenTouched(true);
    setField('token', value.replace(/[{}\s]/g, ''));
  };

  const isDirty = editing && (isNew
    ? Object.values(form).some((v) => String(v).trim() !== '')
    : form.label !== editing.label
      || form.token !== editing.token
      || form.source !== editing.source
      || form.fixedValue !== (editing.fixedValue || '')
      || form.description !== (editing.description || ''));

  const handleCancel = () => {
    if (isDirty && !window.confirm('Discard your unsaved changes to this placeholder?')) return;
    closeEditor();
  };

  // Checked here for an immediate, specific message; the server validates the same rules.
  const validate = () => {
    const token = form.token.trim();
    if (!form.label.trim()) return 'Enter a name for the placeholder.';
    if (!PLACEHOLDER_TOKEN_PATTERN.test(token)) {
      return 'The placeholder must start with a letter and use only letters and numbers (no spaces), up to 40 characters — e.g. StartDate.';
    }
    if (BUILT_IN_PLACEHOLDERS.some((b) => b.token.toLowerCase() === token.toLowerCase())) {
      return `{{${token}}} is a built-in placeholder and already exists.`;
    }
    if (placeholders.some((p) => p.id !== editing.id && p.token.toLowerCase() === token.toLowerCase())) {
      return `A placeholder called {{${token}}} already exists.`;
    }
    if (!form.source) return 'Choose where the value comes from.';
    if (form.source === FIXED_TEXT_SOURCE && !form.fixedValue.trim()) return 'Enter the text this placeholder should insert.';
    return null;
  };

  const handleSave = async () => {
    setErrorMessage('');
    const problem = validate();
    if (problem) {
      setErrorMessage(problem);
      return;
    }
    const payload = {
      label: form.label.trim(),
      token: form.token.trim(),
      source: form.source,
      fixedValue: form.source === FIXED_TEXT_SOURCE ? form.fixedValue.trim() : '',
      description: form.description.trim(),
    };
    setIsSaving(true);
    try {
      if (isNew) await emailPlaceholderService.create(payload);
      else await emailPlaceholderService.update(editing.id, payload);
      await onChanged();
      closeEditor();
      setSavedMessage(`{{${payload.token}}} saved — it's now available in the draft editor.`);
      setTimeout(() => setSavedMessage(''), 3500);
    } catch (err) {
      setErrorMessage(errorText(err, 'Could not save this placeholder.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setErrorMessage('');
    if (editingUsage.length > 0) {
      const list = editingUsage.map((n) => `"${n}"`).join(', ');
      setErrorMessage(`{{${editing.token}}} is used in ${list}, so it can't be deleted. Remove it from ${editingUsage.length === 1 ? 'that draft' : 'those drafts'} first.`);
      return;
    }
    if (!window.confirm(`Delete {{${editing.token}}} permanently? This cannot be undone.`)) return;
    try {
      await emailPlaceholderService.remove(editing.id);
      await onChanged();
      closeEditor();
      setSavedMessage(`{{${editing.token}}} deleted.`);
      setTimeout(() => setSavedMessage(''), 3500);
    } catch (err) {
      setErrorMessage(errorText(err, 'Could not delete this placeholder.'));
    }
  };

  const errorBanner = errorMessage && (
    <div className="email-draft-error" role="alert">
      <AlertCircle size={15} />
      <span>{errorMessage}</span>
    </div>
  );

  if (editing) {
    const previewToken = form.token.trim() || 'Placeholder';
    return (
      <div>
        <button type="button" className="email-draft-back-link" onClick={handleCancel}>
          <ArrowLeft size={14} /> Back to Placeholders
        </button>

        <div className="email-draft-editor-card">
          <h3 className="placeholder-editor-title">{isNew ? 'Create Placeholder' : 'Edit Placeholder'}</h3>

          <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Start Date"
                value={form.label}
                maxLength={100}
                onChange={(e) => handleLabelChange(e.target.value)}
              />
              <span className="form-hint">A friendly name HR will see, e.g. “Start Date”.</span>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Placeholder</label>
              <div className="placeholder-token-input">
                <span aria-hidden="true">{'{{'}</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="StartDate"
                  value={form.token}
                  maxLength={40}
                  disabled={tokenLocked}
                  onChange={(e) => handleTokenChange(e.target.value)}
                />
                <span aria-hidden="true">{'}}'}</span>
              </div>
              <span className="form-hint">
                {tokenLocked
                  ? 'Can’t be renamed while drafts use it.'
                  : <>Appears in drafts as <code className="placeholder-token-code">{`{{${previewToken}}}`}</code>. Letters and numbers only.</>}
              </span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">Where does the value come from?</label>
            <Select
              variant="filter"
              value={form.source}
              onChange={(e) => setField('source', e.target.value)}
              placeholder="Choose a value source..."
              options={SOURCE_OPTIONS}
            />
            {source && (
              <div className="placeholder-source-help">
                <p>{source.description}</p>
                {source.key !== FIXED_TEXT_SOURCE && (
                  <p>Example in an email: <strong>{source.example}</strong></p>
                )}
                {source.mayBeMissing && (
                  <p className="placeholder-source-warning">
                    Not every candidate has this. If a candidate has none, their email shows the placeholder as missing and can’t be sent until it’s removed or filled in.
                  </p>
                )}
              </div>
            )}
          </div>

          {form.source === FIXED_TEXT_SOURCE && (
            <div className="form-group">
              <label className="form-label">Text to insert</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. RM600"
                value={form.fixedValue}
                maxLength={500}
                onChange={(e) => setField('fixedValue', e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              What it represents <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. The date the internship is expected to start"
              value={form.description}
              maxLength={255}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>

          {!isNew && (
            <p className="form-hint" style={{ marginTop: 0 }}>
              {editingUsage.length > 0
                ? `Used in: ${editingUsage.join(', ')}.`
                : 'Not used in any draft yet.'}
            </p>
          )}

          {errorBanner}

          <div className="email-draft-editor-footer">
            {!isNew && (
              <button type="button" className="btn-danger-outline email-draft-delete-btn" onClick={handleDelete}>
                <Trash2 size={14} />
                <span>Delete Placeholder</span>
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              <X size={14} />
              <span>Cancel</span>
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={isSaving}>
              <Save size={14} />
              <span>{isSaving ? 'Saving...' : 'Save Placeholder'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="email-draft-back-link" onClick={onBack}>
        <ArrowLeft size={14} /> Back to Drafts
      </button>

      <div className="placeholder-list-header">
        <p className="page-description" style={{ margin: 0 }}>
          Placeholders are filled in with each candidate’s details when an email is prepared. They’re shared with everyone who uses Email Drafts.
        </p>
        <button type="button" className="btn-primary email-drafts-toolbar-btn" style={{ flexShrink: 0 }} onClick={() => openEditor(null)}>
          <Plus size={15} />
          <span>Create Placeholder</span>
        </button>
      </div>

      {savedMessage && (
        <div className="sync-status-text" role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.75rem' }}>
          <CheckCircle2 size={14} /> {savedMessage}
        </div>
      )}
      {errorBanner}

      <h4 className="placeholder-section-title">Your placeholders</h4>
      {placeholders.length === 0 ? (
        <div className="directory-empty-card">
          <p className="empty-description">No custom placeholders yet — click Create Placeholder to add one.</p>
        </div>
      ) : (
        <div className="email-draft-card-grid">
          {placeholders.map((p) => {
            const drafts = usedIn(p.token);
            return (
              <div key={p.id} className="email-draft-card" onClick={() => openEditor(p)}>
                <div className="email-draft-card-header">
                  <span className="email-draft-card-name">{p.label}</span>
                  <code className="placeholder-token-code">{`{{${p.token}}}`}</code>
                </div>
                <div className="email-draft-card-subject">Value: {describeSource(p)}</div>
                <div className="email-draft-card-snippet">
                  {p.description || getPlaceholderSource(p.source)?.description}
                </div>
                <div className="placeholder-card-usage">
                  {drafts.length > 0 ? `Used in ${drafts.length} draft${drafts.length === 1 ? '' : 's'}` : 'Not used in any draft'}
                </div>
                <div className="email-draft-card-footer">
                  <Pencil size={13} />
                  <span>Edit Placeholder</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h4 className="placeholder-section-title">Built-in</h4>
      <div className="email-draft-card-grid">
        {BUILT_IN_PLACEHOLDERS.map((b) => (
          <div key={b.token} className="email-draft-card placeholder-card-builtin">
            <div className="email-draft-card-header">
              <span className="email-draft-card-name">{b.label}</span>
              <code className="placeholder-token-code">{`{{${b.token}}}`}</code>
            </div>
            <div className="email-draft-card-snippet">{b.description}</div>
            <div className="placeholder-card-usage">
              {usedIn(b.token).length > 0 ? `Used in ${usedIn(b.token).length} draft${usedIn(b.token).length === 1 ? '' : 's'}` : 'Not used in any draft'}
            </div>
            <div className="email-draft-card-footer placeholder-card-builtin-footer">
              <Lock size={12} />
              <span>Built-in — always available</span>
            </div>
          </div>
        ))}
      </div>

      <p className="form-hint" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <Braces size={13} /> In the draft editor, click a placeholder to insert it into the Subject or Body.
      </p>
    </div>
  );
}
