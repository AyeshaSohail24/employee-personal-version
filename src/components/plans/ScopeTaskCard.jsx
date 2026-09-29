import React, { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';

// Shared Plans-page building blocks for Onboarding → Plans and Offboarding → Plans: a scope card
// (Universal or one department) listing its shared tasks with their relative timing (Day -3 /
// Day 0 / Day +7), Edit and Add in place (InlineTaskEditor), and Delete. Each page supplies its own
// service calls (onAddTask / onEditTask / onDeleteTask) and the date timing is counted from
// (anchorLabel), so Onboarding and Offboarding data stay fully separate.

// Relative timing = days from each person's anchor date (Onboarding: start date; Offboarding: last
// working day): -3 = 3 days before, 0 = on the day, +7 = 7 days after. Shown on every task and
// edited in place.
export function formatRelativeOffset(days) {
  const n = Number(days) || 0;
  return `Day ${n > 0 ? `+${n}` : n}`;
}

export function describeRelativeOffset(days, anchorLabel = 'start date') {
  if (days === 0) return `On the ${anchorLabel}`;
  const n = Math.abs(days);
  return `${n} day${n === 1 ? '' : 's'} ${days < 0 ? 'before' : 'after'} the ${anchorLabel}`;
}

const OFFSET_PATTERN = /^[+-]?\d{1,3}$/;
// "-3" / "0" / "+7" -> number of days (within ±365), or null if it isn't a whole number of days.
export const parseOffset = (value) => {
  const v = String(value).trim();
  if (!OFFSET_PATTERN.test(v)) return null;
  const n = parseInt(v, 10);
  return Math.abs(n) <= 365 ? n : null;
};

// In-place editor for one task (also used for a new task): title, relative timing (days) with a
// plain-language hint, and description. Enter saves, Escape cancels.
function InlineTaskEditor({ initial, saving, submitLabel, onSubmit, onCancel, anchorLabel = 'start date' }) {
  const [title, setTitle] = useState(initial.title || '');
  const [offset, setOffset] = useState(String(initial.relativeOffsetDays ?? 0));
  const [description, setDescription] = useState(initial.description || '');
  const [error, setError] = useState('');
  const offsetDays = parseOffset(offset);

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Enter a task title.'); return; }
    if (offsetDays === null) { setError('Timing must be a whole number of days between -365 and 365 (e.g. -3, 0, 7).'); return; }
    try {
      await onSubmit({ title: title.trim(), relativeOffsetDays: offsetDays, description: description.trim() });
    } catch (err) {
      setError(err?.message || 'Could not save this task.');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <div className="scope-task-inline-editor" onKeyDown={onKeyDown}>
      <div className="scope-task-inline-row">
        <input
          type="text"
          className="form-input scope-task-inline-title"
          placeholder="Task title"
          value={title}
          maxLength={255}
          autoFocus
          disabled={saving}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Task title"
        />
        <div className="scope-task-inline-timing">
          <span className="scope-task-inline-day">Day</span>
          <input
            type="text"
            inputMode="numeric"
            className="form-input scope-task-inline-offset"
            value={offset}
            disabled={saving}
            onChange={(e) => setOffset(e.target.value.replace(/[^\d+-]/g, ''))}
            aria-label="Relative timing in days"
            title={`Days from the ${anchorLabel}: -3 = before, 0 = on the day, 7 = after`}
          />
        </div>
      </div>
      <div className={`scope-task-inline-hint ${offsetDays === null ? 'is-invalid' : ''}`}>
        {offsetDays === null ? 'Enter a whole number of days, e.g. -3, 0 or 7' : describeRelativeOffset(offsetDays, anchorLabel)}
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
      {error && <div className="scope-task-inline-error">{error}</div>}
      <div className="scope-task-inline-actions">
        <button type="button" className="btn-secondary email-drafts-toolbar-btn" disabled={saving} onClick={onCancel}>
          <X size={13} />
          <span>Cancel</span>
        </button>
        <button type="button" className="btn-primary email-drafts-toolbar-btn" disabled={saving} onClick={submit}>
          <Check size={13} />
          <span>{saving ? 'Saving...' : submitLabel}</span>
        </button>
      </div>
    </div>
  );
}

// One task row: title (+ description), its relative timing (Day -3 / Day 0 / Day +7), and Edit /
// Delete. Edit turns the row into InlineTaskEditor in place — no popup.
function TaskRow({ task, saving, editing, onEditStart, onEditCancel, onEditSave, onDelete, anchorLabel }) {
  const offset = Number(task.relativeOffsetDays) || 0;
  if (editing) {
    return (
      <tr>
        <td colSpan={3}>
          <InlineTaskEditor initial={task} saving={saving} submitLabel="Save" onSubmit={onEditSave} onCancel={onEditCancel} anchorLabel={anchorLabel} />
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td className="onboarding-scope-task-title">
        <div>{task.title}</div>
        {task.description && <div className="onboarding-scope-task-description">{task.description}</div>}
      </td>
      <td className="onboarding-scope-task-timing-cell">
        <span className="onboarding-scope-task-timing" title={describeRelativeOffset(offset, anchorLabel)}>
          {formatRelativeOffset(offset)}
        </span>
      </td>
      <td className="onboarding-scope-task-action-cell">
        <button type="button" className="icon-btn" title="Edit task" aria-label={`Edit ${task.title}`} disabled={saving} onClick={onEditStart}>
          <Pencil size={13} />
        </button>
        <button type="button" className="icon-btn icon-btn-danger" title="Delete task" aria-label={`Delete ${task.title}`} disabled={saving} onClick={() => onDelete(task.id)}>
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

// A scope's configured tasks. Edit and Add both happen in place (InlineTaskEditor); delete removes
// one. All three hand the full desired task list up to the parent, which does the actual
// replace-by-scope save (onboardingService.saveScopeTasks) and reloads — every other task in the
// scope is re-sent with its own stored timing/description, unchanged.
export default function ScopeCard({ icon, title, description, tasks, emptyStateMessage, taskCount, onAddTask, onDeleteTask, onEditTask, compact = false, emphasized = false, anchorLabel = 'start date' }) {
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const cardClassName = [
    'table-container-card',
    'onboarding-scope-card',
    compact ? 'onboarding-scope-card--compact' : '',
    emphasized ? 'onboarding-scope-card--emphasized' : '',
  ].filter(Boolean).join(' ');

  const iconClassName = [
    'onboarding-scope-card-icon',
    compact ? 'onboarding-scope-card-icon--compact' : '',
    emphasized ? 'onboarding-scope-card-icon--emphasized' : '',
  ].filter(Boolean).join(' ');

  // Errors propagate to the inline editor (shown there).
  const withSaving = async (action) => {
    setSaving(true);
    try {
      await action();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId) => {
    try {
      await withSaving(() => onDeleteTask(taskId));
    } catch (err) {
      alert(`Failed to delete task: ${err.message}`);
    }
  };

  const handleEditSave = (taskId) => (fields) => withSaving(async () => {
    await onEditTask(taskId, fields);
    setEditingId(null);
  });

  const handleAddSave = (fields) => withSaving(async () => {
    await onAddTask(fields);
    setAdding(false);
  });

  return (
    <div className={cardClassName}>
      <div className="onboarding-scope-card-header">
        <div className={iconClassName}>
          {icon}
        </div>
        <div>
          <h3 className={`onboarding-scope-card-title ${compact ? 'onboarding-scope-card-title--compact' : ''}`}>
            {title}
          </h3>
          {description && (
            <p className="onboarding-scope-card-description">{description}</p>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        !adding && (
          <div className="onboarding-scope-task-list-empty">
            {emptyStateMessage}
          </div>
        )
      ) : (
        <table className="onboarding-scope-task-table">
          <tbody>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                saving={saving}
                editing={editingId === task.id}
                onEditStart={() => { setAdding(false); setEditingId(task.id); }}
                onEditCancel={() => setEditingId(null)}
                onEditSave={handleEditSave(task.id)}
                onDelete={handleDelete}
                anchorLabel={anchorLabel}
              />
            ))}
          </tbody>
        </table>
      )}

      {adding ? (
        <InlineTaskEditor
          initial={{ title: '', relativeOffsetDays: 0, description: '' }}
          saving={saving}
          submitLabel="Add Task"
          onSubmit={handleAddSave}
          onCancel={() => setAdding(false)}
          anchorLabel={anchorLabel}
        />
      ) : (
        <div className="onboarding-scope-add-task-row">
          <button type="button" className="btn-secondary email-drafts-toolbar-btn" disabled={saving} onClick={() => { setEditingId(null); setAdding(true); }}>
            <Plus size={14} />
            <span>Add Task</span>
          </button>
        </div>
      )}

      <div className="onboarding-scope-card-footer">
        <div className="onboarding-scope-card-counts">
          <strong className="onboarding-scope-card-count-main">{taskCount}</strong> task{taskCount === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}
