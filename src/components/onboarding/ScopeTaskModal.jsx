import React, { useEffect, useState } from 'react';
import { X, Plus, Pencil, AlertCircle, Save, Info } from 'lucide-react';

// "-3" -> "3 days before the start date", "0" -> "On the start date", "7" -> "7 days after…".
export function describeRelativeOffset(days) {
  if (days === 0) return 'On the start date';
  const n = Math.abs(days);
  return `${n} day${n === 1 ? '' : 's'} ${days < 0 ? 'before' : 'after'} the start date`;
}

export function formatRelativeOffset(days) {
  const n = Number(days) || 0;
  return `Day ${n > 0 ? `+${n}` : n}`;
}

const OFFSET_PATTERN = /^[+-]?\d{1,3}$/;

/**
 * Add or edit one shared onboarding task (Onboarding → Plans): title, relative timing in days
 * (vs. each person's start date) and optional description. Saved into the shared Universal or
 * department task list — it only affects onboarding plans launched from now on.
 */
export default function ScopeTaskModal({ task = null, scopeLabel, onClose, onSave }) {
  const isNew = !task;
  const [title, setTitle] = useState(task?.title || '');
  const [offset, setOffset] = useState(String(task?.relativeOffsetDays ?? 0));
  const [description, setDescription] = useState(task?.description || '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape' && !isSaving) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, isSaving]);

  const offsetValid = OFFSET_PATTERN.test(offset.trim()) && Math.abs(parseInt(offset, 10)) <= 365;
  const offsetDays = offsetValid ? parseInt(offset, 10) : null;

  const handleSave = async () => {
    setError('');
    if (!title.trim()) {
      setError('Enter a task title.');
      return;
    }
    if (!offsetValid) {
      setError('Relative timing must be a whole number of days between -365 and 365 (e.g. -3, 0, 7).');
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ title: title.trim(), relativeOffsetDays: offsetDays, description: description.trim() });
    } catch (err) {
      setError(err?.message || 'Could not save this task.');
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isSaving && onClose()}>
      <div className="modal-card wide-modal modal-scroll-shell plan-task-modal" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">{isNew ? <Plus size={18} /> : <Pencil size={18} />}</div>
            <div>
              <h3 className="modal-title">{isNew ? 'Add Task' : 'Edit Task'}</h3>
              <p className="modal-subtitle">{scopeLabel}</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={isSaving}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Task title <span className="required-star">*</span></label>
            <input type="text" className="form-input" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Relative timing (days) <span className="required-star">*</span></label>
            <div className="scope-task-offset-row">
              <input
                type="text"
                inputMode="numeric"
                className="form-input scope-task-offset-input"
                value={offset}
                onChange={(e) => setOffset(e.target.value.replace(/[^\d+-]/g, ''))}
                placeholder="e.g. -3, 0, 7"
              />
              <span className={`scope-task-offset-preview ${offsetValid ? '' : 'is-invalid'}`}>
                {offsetValid ? `${formatRelativeOffset(offsetDays)} · ${describeRelativeOffset(offsetDays)}` : 'Enter a whole number, e.g. -3, 0 or 7'}
              </span>
            </div>
            <span className="form-hint">Negative = before the start date · 0 = on the start date · positive = after it.</span>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="scope-task-future-note">
            <Info size={14} />
            <span>Changes apply to onboarding plans launched from now on. People already onboarding keep their own tasks and dates.</span>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)', marginTop: 0 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="button" className="btn-primary dept-mapping-done" onClick={handleSave} disabled={isSaving}>
            <Save size={14} />
            <span>{isSaving ? 'Saving...' : isNew ? 'Add Task' : 'Save Task'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
