import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { describeRelativeOffset } from './ScopeTaskCard.jsx';
import { getTodayLocalDateString } from '../../utils/dateUtils.js';

// "YYYY-MM-DD" -> whole days from anchorDate (negative = before). null if either date is missing.
function daysFromAnchor(dueDate, anchorDate) {
  const toUtc = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const due = toUtc(dueDate);
  const anchor = toUtc(anchorDate);
  return due === null || anchor === null ? null : Math.round((due - anchor) / 86400000);
}
// The hint's "Day +0 / Day -3" matches the Relative Timing badge on the person pages.

/**
 * Edits one task in one person's Onboarding/Offboarding plan in place (no popup): title, due date
 * — with its relative day from the plan's anchor shown live — and description. With no `task` it
 * adds a new one instead: the due date starts on the anchor date and a Required checkbox is shown.
 * A due date can't be before today; an existing task that's already overdue keeps its date as long
 * as it isn't changed. Enter saves, Escape cancels. The page supplies onSubmit ({ title, description, dueDate } — plus
 * `required` when adding), so Onboarding and Offboarding each keep their own service calls.
 * Rendered as a full-width table row.
 */
export default function InlinePlanTaskEditor({ task = null, anchorDate, anchorLabel = 'start date', planLabel = 'onboarding', colSpan = 5, onSubmit, onCancel }) {
  const isNew = !task;
  const today = getTodayLocalDateString();
  const originalDueDate = isNew ? '' : String(task.due_date || task.originally_calculated_due_date || '').slice(0, 10);
  // A new task starts on the anchor date, or today if that has already passed.
  const defaultNewDueDate = [String(anchorDate || '').slice(0, 10), today].sort().pop();
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [dueDate, setDueDate] = useState(isNew ? defaultNewDueDate : originalDueDate);
  const [required, setRequired] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const offset = daysFromAnchor(dueDate, anchorDate);

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Enter a task title.'); return; }
    if (!dueDate) { setError('Choose a due date.'); return; }
    if (dueDate < today && dueDate !== originalDueDate) { setError("The due date can't be before today."); return; }
    setSaving(true);
    try {
      const details = { title: title.trim(), description: description.trim(), dueDate };
      await onSubmit(isNew ? { ...details, required } : details);
    } catch (err) {
      setError(err?.message || 'Could not save this task.');
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    // Enter on a button already clicks it (Cancel/Save), so only save from the fields.
    if (e.key === 'Enter' && !['TEXTAREA', 'BUTTON'].includes(e.target.tagName)) { e.preventDefault(); submit(); }
    if (e.key === 'Escape' && !saving) { e.preventDefault(); onCancel(); }
  };

  return (
    <tr className={`plan-task-inline-row${isNew ? ' is-new' : ''}`}>
      <td colSpan={colSpan}>
        <div className="scope-task-inline-editor" onKeyDown={onKeyDown}>
          <div className="scope-task-inline-row">
            <input
              type="text"
              className="form-input scope-task-inline-title"
              placeholder={isNew ? 'New task title' : 'Task title'}
              value={title}
              maxLength={255}
              autoFocus
              disabled={saving}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Task title"
            />
            <div className="scope-task-inline-timing">
              <span className="scope-task-inline-day">Due</span>
              <input
                type="date"
                className="form-input plan-task-inline-date"
                value={dueDate}
                min={today}
                disabled={saving}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Due date"
              />
            </div>
          </div>
          <div className="scope-task-inline-hint">
            {offset === null
              ? 'Choose a due date'
              : `Day ${offset >= 0 ? `+${offset}` : offset} · ${describeRelativeOffset(offset, anchorLabel)}`}
          </div>
          <input
            type="text"
            className="form-input scope-task-inline-description"
            placeholder="Description (optional)"
            value={description}
            disabled={saving}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Description"
          />
          {isNew && (
            <label className="plan-task-inline-required">
              <input type="checkbox" checked={required} disabled={saving} onChange={(e) => setRequired(e.target.checked)} />
              <span>
                <strong>Required</strong> — must be done before {planLabel} counts as complete.
              </span>
            </label>
          )}
          {error && <div className="scope-task-inline-error">{error}</div>}
          <div className="scope-task-inline-actions">
            <button type="button" className="btn-secondary email-drafts-toolbar-btn" disabled={saving} onClick={onCancel}>
              <X size={13} />
              <span>Cancel</span>
            </button>
            <button type="button" className="btn-primary email-drafts-toolbar-btn" disabled={saving} onClick={submit}>
              <Check size={13} />
              <span>{saving ? 'Saving...' : isNew ? 'Add Task' : 'Save'}</span>
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
