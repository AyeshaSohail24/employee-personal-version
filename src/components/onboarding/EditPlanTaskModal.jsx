import React, { useEffect, useState } from 'react';
import { X, Pencil, Plus, AlertCircle, Save } from 'lucide-react';
import { ApiError } from '../../services/apiClient.js';

/**
 * Edits one task in one person's onboarding plan (title, description, due date), or — with no
 * `task` — adds a new task to that plan (also asks whether it's required). Only this person's
 * plan changes; the shared tasks under Onboarding > Plans stay as they are.
 */
export default function EditPlanTaskModal({ task = null, personName, defaultDueDate = '', onClose, onSave }) {
  const isNew = !task;
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [dueDate, setDueDate] = useState(String(task?.due_date || task?.originally_calculated_due_date || defaultDueDate || '').slice(0, 10));
  const [required, setRequired] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape' && !isSaving) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, isSaving]);

  const handleSave = async () => {
    setError('');
    if (!title.trim()) {
      setError('Enter a task title.');
      return;
    }
    if (!dueDate) {
      setError('Choose a due date.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(isNew
        ? { title: title.trim(), description: description.trim(), dueDate, required }
        : { title: title.trim(), description: description.trim(), dueDate });
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : 'Could not save this task.');
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isSaving && onClose()}>
      <div className="modal-card wide-modal" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              {isNew ? <Plus size={18} /> : <Pencil size={18} />}
            </div>
            <div>
              <h3 className="modal-title">{isNew ? 'Add Task' : 'Edit Task'}</h3>
              <p className="modal-subtitle">
                {isNew ? 'Added to' : 'Changes apply to'} {personName ? `${personName}’s` : 'this'} plan only.
              </p>
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
            <input type="text" className="form-input" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Due date <span className="required-star">*</span></label>
            <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <span className="form-hint">The relative day (e.g. Day -3) is worked out from this date.</span>
          </div>
          {isNew && (
            <label className="plan-task-required-toggle">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              <span>
                <strong>Required</strong> — must be done before onboarding counts as complete.
              </span>
            </label>
          )}
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
