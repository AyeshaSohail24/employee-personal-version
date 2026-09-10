import React, { useEffect, useState } from 'react';
import { RotateCcw, Save, CheckCircle2 } from 'lucide-react';
import { emailTemplateService } from '../../services/emailTemplateService.js';

const PLACEHOLDER_TOKENS = ['{{ApplicantName}}', '{{PositionName}}', '{{HiringEmployeeName}}'];

export default function EmailDraftsPanel() {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const all = await emailTemplateService.getAll();
      setTemplates(all);
      const stillSelected = all.find((t) => t.id === selectedId);
      const active = stillSelected || all[0];
      if (active) {
        setSelectedId(active.id);
        setSubject(active.subject);
        setBody(active.body);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleSelectTemplate = (tpl) => {
    setSelectedId(tpl.id);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setSavedMessage('');
  };

  const handleSave = async () => {
    await emailTemplateService.update(selectedId, { subject, body });
    setSavedMessage('Draft saved.');
    setTimeout(() => setSavedMessage(''), 2000);
  };

  const handleReset = async () => {
    const restored = await emailTemplateService.resetToDefault(selectedId);
    setSubject(restored.subject);
    setBody(restored.body);
    setSavedMessage('Reset to default.');
    setTimeout(() => setSavedMessage(''), 2000);
  };

  if (loading) {
    return <div className="directory-table-card skeleton-box" style={{ height: '320px' }} />;
  }

  return (
    <div className="email-drafts-layout">
      <div className="email-drafts-list-card">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className={`email-draft-list-item ${selectedId === tpl.id ? 'active' : ''}`}
            onClick={() => handleSelectTemplate(tpl)}
          >
            {tpl.name}
          </button>
        ))}
      </div>

      <div className="email-draft-editor-card">
        <div className="form-group">
          <label className="form-label">Subject</label>
          <input type="text" className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Body</label>
          <textarea className="form-textarea email-body-textarea" rows={16} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        <div className="email-draft-placeholder-legend">
          <span className="form-label" style={{ marginBottom: 0 }}>Available placeholders:</span>
          {PLACEHOLDER_TOKENS.map((token) => (
            <span key={token} className="placeholder-token-chip">{token}</span>
          ))}
        </div>

        <div className="email-draft-editor-footer">
          {savedMessage && (
            <span className="sync-status-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <CheckCircle2 size={14} /> {savedMessage}
            </span>
          )}
          <button type="button" className="btn-secondary" onClick={handleReset}>
            <RotateCcw size={14} />
            <span>Reset to Default</span>
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            <Save size={14} />
            <span>Save Draft</span>
          </button>
        </div>
      </div>
    </div>
  );
}
