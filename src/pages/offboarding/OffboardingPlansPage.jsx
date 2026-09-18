import React, { useState, useEffect } from 'react';
import { Globe2, GraduationCap, Building2, Plus, Trash2 } from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';

function formatRelativeOffset(days) {
  const value = days || 0;
  if (value === 0) return 'Day 0';
  return value > 0 ? `Day +${value}` : `Day ${value}`;
}

// A scope's configured tasks, editable right here — no separate "Manage Tasks" page. Mirrors
// onboarding/OnboardingPlansPage.jsx's ScopeCard exactly (same add/delete contract), just wired
// to offboardingService. Add appends a task (Day 0, default activity type — fine-grained
// timing/description/activity-type stays a job for a later dedicated editor if this app ever
// needs one); delete removes one.
function ScopeCard({ icon, title, description, tasks, emptyStateMessage, taskCount, onAddTask, onDeleteTask, compact = false, emphasized = false }) {
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

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onAddTask(trimmed);
      setNewTaskTitle('');
    } catch (err) {
      alert(`Failed to add task: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId) => {
    if (saving) return;
    setSaving(true);
    try {
      await onDeleteTask(taskId);
    } catch (err) {
      alert(`Failed to delete task: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

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
              <tr key={task.id}>
                <td className="onboarding-scope-task-title">{task.title}</td>
                <td className="onboarding-scope-task-timing-cell">
                  <span className="onboarding-scope-task-timing">{formatRelativeOffset(task.relativeOffsetDays)}</span>
                </td>
                <td className="onboarding-scope-task-delete-cell">
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    title="Delete task"
                    aria-label={`Delete ${task.title}`}
                    disabled={saving}
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
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
    departmentCardDescription: 'Tasks added specifically for Interns in this department.',
    departmentEmptyState: 'No intern-specific tasks configured for this department. Intern Universal Tasks will still apply.',
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

  // Shared add/delete for both the Universal card and every Department card — mirrors
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
          {/* Universal Tasks — full width. Content depends entirely on the selected filter:
              Employee Universal and Intern Universal are two separate, non-overlapping task
              sets, even though the card title itself stays the generic "Universal Tasks" (the
              active filter already provides the person-type context). */}
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
              onDeleteTask={(taskId) => handleDeleteTask('universal', null, taskId)}
            />
          </section>

          {/* Department-Specific Tasks — compact scalable grid, rendered dynamically from every
              real department. Each card means "tasks added specifically for the selected person
              type in this department" — never a mix of Employee and Intern tasks for the same
              department. */}
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
                    description={meta.departmentCardDescription}
                    tasks={row.tasks}
                    emptyStateMessage={meta.departmentEmptyState}
                    taskCount={row.taskCount}
                    onAddTask={(title) => handleAddTask('department', row.department.id, title)}
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
