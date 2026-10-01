import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { describeRelativeOffset, parseOffset } from './ScopeTaskCard.jsx';
import { getTodayLocalDateString, addDaysToLocalDate } from '../../utils/dateUtils.js';

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

// Day offset as typed/shown in the Relative Timing box: "+15", "-2", "0".
const formatOffset = (n) => (n === null ? '' : n > 0 ? `+${n}` : String(n));

/**
 * Edits one task in one person's Onboarding/Offboarding plan in place (no popup), laid out in the
 * task table's own columns: title + description (+ Required when adding) | Relative Timing
 * (Day [n]) | Due Date | Save/Cancel. With no `task` it adds a new one instead.
 *
 * Timing has ONE source of truth — the due date. The Day box and the date picker are two ways of
 * setting it: typing a Day recalculates the due date from the plan's anchor (Onboarding: start
 * date, Offboarding: last working day), and picking a date rewrites the Day. Save sends only the
 * due date (the server works the Day out from it), so the two can never disagree.
 *
 * A due date can't be before today; an existing task that's already overdue keeps its date as long
 * as it isn't changed. Enter saves, Escape cancels. The page supplies onSubmit ({ title,
 * description, dueDate } — plus `required` when adding), so Onboarding and Offboarding each keep
 * their own service calls.
 */
export default function InlinePlanTaskEditor({ task = null, anchorDate, anchorLabel = 'start date', planLabel = 'onboarding', onSubmit, onCancel }) {
  const isNew = !task;
  const today = getTodayLocalDateString();
  const anchor = String(anchorDate || '').slice(0, 10);
  const originalDueDate = isNew ? '' : String(task.due_date || task.originally_calculated_due_date || '').slice(0, 10);
  // A new task starts on the anchor date, or today if that has already passed.
  const initialDueDate = isNew ? [anchor, today].sort().pop() : originalDueDate;
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [offsetText, setOffsetText] = useState(() => formatOffset(daysFromAnchor(initialDueDate, anchor)));
  const [required, setRequired] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const offsetDays = parseOffset(offsetText);

  // Day typed -> due date follows (only once it's a whole number of days; "-" alone waits).
  const handleOffsetChange = (value) => {
    const cleaned = value.replace(/[^\d+-]/g, '');
    setOffsetText(cleaned);
    const n = parseOffset(cleaned);
    if (n !== null && anchor) setDueDate(addDaysToLocalDate(anchor, n));
  };

  // Date picked -> Day follows.
  const handleDateChange = (value) => {
    setDueDate(value);
    setOffsetText(formatOffset(daysFromAnchor(value, anchor)));
  };

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Enter a task title.'); return; }
    if (!dueDate) { setError('Choose a due date.'); return; }
    if (offsetDays === null || offsetDays !== daysFromAnchor(dueDate, anchor)) {
      setError('Relative timing must be a whole number of days between -365 and 365 (e.g. -2, 0, 15).');
      return;
    }
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
    <tr className={`plan-task-inline-row${isNew ? ' is-new' : ''}`} onKeyDown={onKeyDown}>
      <td className="plan-task-inline-seq">{isNew ? '' : task.sequence}</td>
      <td>
        <div className="plan-task-inline-fields">
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
        </div>
      </td>
      <td className="plan-task-inline-timing-cell">
        <div className="scope-task-inline-timing">
          <span className="scope-task-inline-day">Day</span>
          <input
            type="text"
            inputMode="numeric"
            className="form-input scope-task-inline-offset"
            value={offsetText}
            disabled={saving || !anchor}
            onChange={(e) => handleOffsetChange(e.target.value)}
            aria-label="Relative timing in days"
            title={`Days from the ${anchorLabel}: -2 = before, 0 = on the day, 15 = after`}
          />
        </div>
        <div className={`scope-task-inline-hint ${offsetDays === null ? 'is-invalid' : ''}`}>
          {offsetDays === null ? 'Whole days, e.g. -2, 0 or 15' : describeRelativeOffset(offsetDays, anchorLabel)}
        </div>
      </td>
      <td className="plan-task-inline-date-cell">
        <input
          type="date"
          className="form-input plan-task-inline-date"
          value={dueDate}
          min={today}
          disabled={saving}
          onChange={(e) => handleDateChange(e.target.value)}
          aria-label="Due date"
        />
      </td>
      <td className="plan-task-inline-actions-cell">
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
      </td>
    </tr>
  );
}
