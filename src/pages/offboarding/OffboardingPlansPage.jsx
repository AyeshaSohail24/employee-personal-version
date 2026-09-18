import React, { useState, useEffect } from 'react';
import { Globe2, GraduationCap, Building2, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';

// One task row — mirrors onboarding/OnboardingPlansPage.jsx's TaskRow exactly. Click the pencil
// to edit its title in place (Enter/the check saves, Escape/the X cancels), or the trash to
// delete it. Timing (relativeOffsetDays) is no longer shown or edited here — every task managed
// from this page stays Day 0.
function TaskRow({ task, saving, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);

  useEffect(() => {
    setTitle(task.title);
  }, [task.title]);

  const startEdit = () => {
    if (saving) return;
    setTitle(task.title);
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const commit = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === task.title) return cancel();
    await onEdit(task.id, { title: trimmed });
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') cancel();
  };

  if (editing) {
    return (
      <tr>
        <td>
          <input
            type="text"
            className="form-input onboarding-scope-task-edit-title"
            value={title}
            autoFocus
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </td>
        <td className="onboarding-scope-task-action-cell">
          <button type="button" className="icon-btn" title="Save" disabled={saving} onClick={commit}>
            <Check size={13} />
          </button>
          <button type="button" className="icon-btn" title="Cancel" disabled={saving} onClick={cancel}>
            <X size={13} />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="onboarding-scope-task-title">{task.title}</td>
      <td className="onboarding-scope-task-action-cell">
        <button type="button" className="icon-btn" title="Edit task" aria-label={`Edit ${task.title}`} disabled={saving} onClick={startEdit}>
          <Pencil size={13} />
        </button>
        <button type="button" className="icon-btn icon-btn-danger" title="Delete task" aria-label={`Delete ${task.title}`} disabled={saving} onClick={() => onDelete(task.id)}>
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

// A scope's configured tasks, editable right here — no separate "Manage Tasks" page. Mirrors
// onboarding/OnboardingPlansPage.jsx's ScopeCard exactly (same add/edit/delete contract), just
// wired to offboardingService.
function ScopeCard({ icon, title, description, tasks, emptyStateMessage, taskCount, onAddTask, onDeleteTask, onEditTask, compact = false, emphasized = false }) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [saving, setSaving] = useState(false);

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

  const runMutation = async (action, errorLabel) => {
    setSaving(true);
    try {
      await action();
    } catch (err) {
      alert(`Failed to ${errorLabel}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed || saving) return;
    runMutation(async () => {
      await onAddTask(trimmed);
      setNewTaskTitle('');
    }, 'add task');
  };

  const handleDelete = (taskId) => runMutation(() => onDeleteTask(taskId), 'delete task');
  const handleEdit = (taskId, updates) => runMutation(() => onEditTask(taskId, updates), 'save task');

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
        <div className="onboarding-scope-task-list-empty">
          {emptyStateMessage}
        </div>
      ) : (
        <table className="onboarding-scope-task-table">
          <tbody>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} saving={saving} onDelete={handleDelete} onEdit={handleEdit} />
            ))}
          </tbody>
        </table>
      )}

      <form className="onboarding-scope-add-task-row" onSubmit={handleAdd}>
        <input
          type="text"
          className="form-input"
          placeholder="Add a task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          disabled={saving}
        />
        <button type="submit" className="btn-secondary" disabled={saving || !newTaskTitle.trim()}>
          <Plus size={14} />
          <span>Add</span>
        </button>
      </form>

      <div className="onboarding-scope-card-footer">
        <div className="onboarding-scope-card-counts">
          <strong className="onboarding-scope-card-count-main">{taskCount}</strong> task{taskCount === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}

// Single source of truth for every piece of copy that depends on which person type is currently
// selected. Only 'intern' is reachable right now (the Employees tab is removed for now — see
// OffboardingDepartingPage.jsx's identical scoping); the 'employee' scope-task data model
// underneath is untouched, so restoring it later is just re-adding the tab, not rebuilding this.
// Offboarding-specific wording throughout (exit clearance framing, never onboarding's).
const PERSON_TYPE_META = {
  intern: {
    label: 'Interns',
    icon: <GraduationCap size={15} />,
    universalSubtitle: 'Included for every intern or apprentice regardless of department.',
    universalEmptyState: "No universal tasks configured yet. Add tasks here to include them in every intern's offboarding plan.",
    departmentEmptyState: 'No department-specific tasks yet.',
  },
};

export default function OffboardingPlansPage() {
  const personType = 'intern';
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await offboardingService.getScopesSummary(personType);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load offboarding task scope summary:', err);
    } finally {
      setLoading(false);
    }
  };

  // Shared add/edit/delete for both the Universal card and every Department card — mirrors
  // onboarding/OnboardingPlansPage.jsx's identical helpers exactly, wired to offboardingService.
  const existingTasksFor = (scopeType, departmentId) =>
    scopeType === 'universal'
      ? summary.universal.tasks
      : summary.departments.find((row) => row.department.id === departmentId)?.tasks ?? [];

  const handleAddTask = async (scopeType, departmentId, title) => {
    const newTasks = [
      ...existingTasksFor(scopeType, departmentId),
      { title, activityTypeId: 1, relativeOffsetDays: 0 },
    ];
    await offboardingService.saveScopeTasks(scopeType, personType, departmentId, newTasks);
    await loadSummary();
  };

  const handleEditTask = async (scopeType, departmentId, taskId, updates) => {
    const newTasks = existingTasksFor(scopeType, departmentId).map((t) => (t.id === taskId ? { ...t, ...updates } : t));
    await offboardingService.saveScopeTasks(scopeType, personType, departmentId, newTasks);
    await loadSummary();
  };

  const handleDeleteTask = async (scopeType, departmentId, taskId) => {
    const newTasks = existingTasksFor(scopeType, departmentId).filter((t) => t.id !== taskId);
    await offboardingService.saveScopeTasks(scopeType, personType, departmentId, newTasks);
    await loadSummary();
  };

  const meta = PERSON_TYPE_META[personType];

  return (
    <div className="page-layout-container">
      <div className="page-header-container">
        <div className="onboarding-plans-header">
          <h1 className="page-title">Offboarding Plans</h1>
          <p className="page-subtitle">
            Configure reusable offboarding tasks for interns. Universal and department-specific tasks are combined automatically when offboarding is launched.
          </p>
        </div>
      </div>

      {loading || !summary ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading offboarding task scopes...
        </div>
      ) : (
        <div className="onboarding-scope-sections">
          {/* Universal Tasks — full width. */}
          <section>
            <ScopeCard
              emphasized
              icon={<Globe2 size={20} />}
              title="Universal Tasks"
              description={meta.universalSubtitle}
              tasks={summary.universal.tasks}
              emptyStateMessage={meta.universalEmptyState}
              taskCount={summary.universal.taskCount}
              onAddTask={(title) => handleAddTask('universal', null, title)}
              onEditTask={(taskId, updates) => handleEditTask('universal', null, taskId, updates)}
              onDeleteTask={(taskId) => handleDeleteTask('universal', null, taskId)}
            />
          </section>

          {/* Department-Specific Tasks — compact scalable grid, rendered dynamically from every
              real department. */}
          <section>
            <h2 className="onboarding-scope-section-title">Department-Specific Tasks</h2>
            {summary.departments.length === 0 ? (
              <div className="table-container-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No departments configured yet.
              </div>
            ) : (
              <div className="onboarding-scope-grid-dept">
                {summary.departments.map((row) => (
                  <ScopeCard
                    key={row.department.id}
                    compact
                    icon={<Building2 size={16} />}
                    title={row.department.name}
                    tasks={row.tasks}
                    emptyStateMessage={meta.departmentEmptyState}
                    taskCount={row.taskCount}
                    onAddTask={(title) => handleAddTask('department', row.department.id, title)}
                    onEditTask={(taskId, updates) => handleEditTask('department', row.department.id, taskId, updates)}
                    onDeleteTask={(taskId) => handleDeleteTask('department', row.department.id, taskId)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
