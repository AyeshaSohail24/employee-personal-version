import React, { useState, useEffect } from 'react';
import { Globe2, GraduationCap, Building2, Plus, Trash2, Pencil } from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';
import ScopeTaskModal, { formatRelativeOffset, describeRelativeOffset } from '../../components/onboarding/ScopeTaskModal.jsx';

// One task row: title (+ description), its relative timing (Day -3 / Day 0 / Day +7), and Edit
// (opens ScopeTaskModal) / Delete. Edits are handed up to the parent card, which does the actual
// replace-by-scope save (onboardingService.saveScopeTasks) and reloads.
function TaskRow({ task, saving, onDelete, onEditRequest }) {
  const offset = Number(task.relativeOffsetDays) || 0;
  return (
    <tr>
      <td className="onboarding-scope-task-title">
        <div>{task.title}</div>
        {task.description && <div className="onboarding-scope-task-description">{task.description}</div>}
      </td>
      <td className="onboarding-scope-task-timing-cell">
        <span className="onboarding-scope-task-timing" title={describeRelativeOffset(offset)}>
          {formatRelativeOffset(offset)}
        </span>
      </td>
      <td className="onboarding-scope-task-action-cell">
        <button type="button" className="icon-btn" title="Edit task" aria-label={`Edit ${task.title}`} disabled={saving} onClick={() => onEditRequest(task)}>
          <Pencil size={13} />
        </button>
        <button type="button" className="icon-btn icon-btn-danger" title="Delete task" aria-label={`Delete ${task.title}`} disabled={saving} onClick={() => onDelete(task.id)}>
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

// A scope's configured tasks. Add Task and Edit open ScopeTaskModal (title, relative timing,
// description); delete removes one. All three hand the full desired task list up to the parent,
// which does the actual replace-by-scope save (onboardingService.saveScopeTasks) and reloads —
// every other task in the scope is re-sent with its own stored timing/description, unchanged.
function ScopeCard({ icon, title, description, tasks, emptyStateMessage, taskCount, onAddTask, onDeleteTask, onEditTask, compact = false, emphasized = false }) {
  const [saving, setSaving] = useState(false);
  const [modalTask, setModalTask] = useState(undefined); // undefined = closed, null = new, object = editing

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

  const handleDelete = (taskId) => runMutation(() => onDeleteTask(taskId), 'delete task');

  // Errors propagate to the modal (shown there) instead of an alert.
  const handleModalSave = async (fields) => {
    setSaving(true);
    try {
      if (modalTask) await onEditTask(modalTask.id, fields);
      else await onAddTask(fields);
      setModalTask(undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cardClassName}>
      {modalTask !== undefined && (
        <ScopeTaskModal
          task={modalTask}
          scopeLabel={title}
          onClose={() => setModalTask(undefined)}
          onSave={handleModalSave}
        />
      )}
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
              <TaskRow key={task.id} task={task} saving={saving} onDelete={handleDelete} onEditRequest={setModalTask} />
            ))}
          </tbody>
        </table>
      )}

      <div className="onboarding-scope-add-task-row">
        <button type="button" className="btn-secondary email-drafts-toolbar-btn" disabled={saving} onClick={() => setModalTask(null)}>
          <Plus size={14} />
          <span>Add Task</span>
        </button>
      </div>

      <div className="onboarding-scope-card-footer">
        <div className="onboarding-scope-card-counts">
          <strong className="onboarding-scope-card-count-main">{taskCount}</strong> task{taskCount === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}

// Single source of truth for every piece of copy that depends on which person type is
// currently selected — the Universal card's subtitle/empty-state all read from here. Only
// 'intern' is reachable right now (the Employees tab is removed for now — see
// OnboardingEmployeesPage.jsx's identical scoping); the 'employee' scope-task data model
// underneath is untouched, so restoring it later is just re-adding the tab, not rebuilding this.
const PERSON_TYPE_META = {
  intern: {
    label: 'Interns',
    icon: <GraduationCap size={15} />,
    universalSubtitle: 'Included for every intern or apprentice regardless of department.',
    universalEmptyState: "No universal tasks configured yet. Add tasks here to include them in every intern's onboarding plan.",
    departmentEmptyState: 'No department-specific tasks yet.',
  },
};

export default function OnboardingPlansPage() {
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
      const data = await onboardingService.getScopesSummary(personType);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load onboarding task scope summary:', err);
    } finally {
      setLoading(false);
    }
  };

  // Shared add/edit/delete for both the Universal card and every Department card — scopeType +
  // departmentId (null for Universal) is all that distinguishes them. Every mutation replaces
  // the whole scope's task list (saveScopeTasks' existing replace-by-key contract), so each one
  // always starts from the tasks this page already has in `summary` rather than re-fetching first.
  const existingTasksFor = (scopeType, departmentId) =>
    scopeType === 'universal'
      ? summary.universal.tasks
      : summary.departments.find((row) => row.department.id === departmentId)?.tasks ?? [];

  // New task: title, relative timing and description from ScopeTaskModal (default activity type,
  // as before). Every existing task is re-sent with its own stored timing/description/required.
  const handleAddTask = async (scopeType, departmentId, { title, relativeOffsetDays, description }) => {
    const newTasks = [
      ...existingTasksFor(scopeType, departmentId),
      { title, activityTypeId: 1, relativeOffsetDays, description },
    ];
    await onboardingService.saveScopeTasks(scopeType, personType, departmentId, newTasks);
    await loadSummary();
  };

  const handleEditTask = async (scopeType, departmentId, taskId, updates) => {
    const newTasks = existingTasksFor(scopeType, departmentId).map((t) => (t.id === taskId ? { ...t, ...updates } : t));
    await onboardingService.saveScopeTasks(scopeType, personType, departmentId, newTasks);
    await loadSummary();
  };

  const handleDeleteTask = async (scopeType, departmentId, taskId) => {
    const newTasks = existingTasksFor(scopeType, departmentId).filter((t) => t.id !== taskId);
    await onboardingService.saveScopeTasks(scopeType, personType, departmentId, newTasks);
    await loadSummary();
  };

  const meta = PERSON_TYPE_META[personType];

  return (
    <div className="page-layout-container">
      <div className="page-header-container">
        <div className="onboarding-plans-header">
          <h1 className="page-title">Onboarding Plans</h1>
          <p className="page-subtitle">
            Configure reusable onboarding tasks for interns. Universal and department-specific tasks are combined automatically when onboarding is launched.
          </p>
        </div>
      </div>

      {loading || !summary ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading onboarding task scopes...
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
              onAddTask={(fields) => handleAddTask('universal', null, fields)}
              onEditTask={(taskId, updates) => handleEditTask('universal', null, taskId, updates)}
              onDeleteTask={(taskId) => handleDeleteTask('universal', null, taskId)}
            />
          </section>

          {/* Department-Specific Tasks — compact scalable grid, rendered dynamically. Each
              card means "tasks added specifically for interns in this department". */}
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
                    onAddTask={(fields) => handleAddTask('department', row.department.id, fields)}
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
