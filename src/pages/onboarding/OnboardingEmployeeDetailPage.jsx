import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import { employeeService } from '../../services/employeeService.js';
import { onboardingService } from '../../services/onboardingService.js';
import Avatar from '../../components/common/Avatar.jsx';
import InlinePlanTaskEditor from '../../components/plans/InlinePlanTaskEditor.jsx';
import { toLocalDateString, getTodayLocalDateString } from '../../utils/dateUtils.js';

// Real-data onboarding detail view for one (real) intern's local employee
// record — reached from OnboardingEmployeesPage's "View Progress" link. The
// plan itself is never launched from here: it's launched at Accept, or with
// Launch Plan on the Progress page (server/db/onboarding.js's
// ensureOnboardingPlan()), composed from Universal + their
// department's active tasks. This page views it, checks off tasks, and can add or edit (in place,
// no popup) or remove a single task for this person only (their own copy — Onboarding > Plans is unchanged).
// "2026-09-17T00:00:00.000Z" -> "2026-09-17" (DATE columns arrive as full timestamps).
function toDateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

export default function OnboardingEmployeeDetailPage() {
  const { employeeId } = useParams();
  const [searchParams] = useSearchParams();
  const openedFromHistory = searchParams.get('from') === 'history';
  const [employee, setEmployee] = useState(null);
  const [instance, setInstance] = useState(null);
  const [taskInstances, setTaskInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  // Ticking a task updates the page straight away; these keep the background save + refresh in step.
  const savingTaskIds = useRef(new Set());
  const changeVersion = useRef(0);

  useEffect(() => {
    loadData();
  }, [employeeId]);

  // The full-page "Loading…" is only for the first load; refreshes after a change happen quietly.
  const loadData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const version = changeVersion.current;
    try {
      const [emp, plan] = await Promise.all([
        employeeService.getById(employeeId),
        onboardingService.getRealInstanceForEmployee(employeeId),
      ]);
      // A tick made while this was loading wins — don't overwrite it with older data.
      if (silent && version !== changeVersion.current) return;
      setEmployee(emp);
      setInstance(plan.instance);
      setTaskInstances(plan.taskInstances || []);
    } catch (err) {
      if (silent) return;
      console.error('Failed to load onboarding employee detail:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleToggleTaskComplete = async (task) => {
    if (savingTaskIds.current.has(task.id)) return;
    const completed = !task.completed;
    const setTaskState = (done, completedAt) => setTaskInstances((prev) => prev.map((t) => (
      t.id === task.id ? { ...t, completed: done, completed_at: completedAt } : t
    )));
    changeVersion.current += 1;
    savingTaskIds.current.add(task.id);
    setTaskState(completed, completed ? new Date().toISOString() : null);
    try {
      await onboardingService.setRealTaskInstanceCompleted(task.id, completed);
    } catch (err) {
      setTaskState(task.completed, task.completed_at);
      alert(`Failed to update task state: ${err.message}`);
    } finally {
      savingTaskIds.current.delete(task.id);
    }
    // Quietly pick up anything the server changed alongside (plan completed, status moved on).
    if (savingTaskIds.current.size === 0) loadData({ silent: true });
  };

  const handleAddTask = async (details) => {
    await onboardingService.addRealTaskToInstance(instance.id, details);
    setIsAddingTask(false);
    await loadData({ silent: true });
  };

  const handleSaveTask = async (details) => {
    await onboardingService.updateRealTaskInstance(editingTask.id, details);
    setEditingTask(null);
    await loadData({ silent: true });
  };

  const handleDeleteTask = async (task) => {
    const name = employee?.fullName || 'this person';
    if (!window.confirm(`Remove "${task.title}" from ${name}'s onboarding plan?

Only ${name}'s plan changes — the task stays in Onboarding > Plans for everyone else. This can't be undone.`)) {
      return;
    }
    setDeletingId(task.id);
    try {
      await onboardingService.deleteRealTaskInstance(task.id);
      await loadData({ silent: true });
    } catch (err) {
      alert(`Failed to remove the task: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-layout-container">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading onboarding detail...
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="page-layout-container">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <h2>Employee Not Found</h2>
          <Link to="/onboarding/employees" className="btn-secondary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Back to Onboarding Progress
          </Link>
        </div>
      </div>
    );
  }

  const today = getTodayLocalDateString();
  const totalTasks = taskInstances.length;
  const completedTasks = taskInstances.filter((t) => t.completed).length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Historical (read-only) record: opened from Onboarding History, or the person has already moved
  // on from Onboarding (Active/Offboarding/Former). Reference only — no Add/Edit/Delete/Done/Reopen.
  const isHistorical = openedFromHistory || (employee.status && employee.status !== 'Onboarding');
  const requiredTasks = taskInstances.filter((t) => t.required);
  const planComplete = requiredTasks.length > 0 && requiredTasks.every((t) => t.completed);
  const completedOn = toDateOnly(instance?.completed_at)
    || taskInstances.map((t) => toLocalDateString(t.completed_at)).filter(Boolean).sort().pop()
    || '';
  const backTo = isHistorical ? '/onboarding/employees?view=history' : '/onboarding/employees';
  const backLabel = isHistorical ? 'Back to Onboarding History' : 'Back to Onboarding Progress';

  return (
    <div className="page-layout-container">
      <div style={{ marginBottom: '1rem' }}>
        <Link to={backTo} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
          <ArrowLeft size={14} /> {backLabel}
        </Link>
      </div>

      {isHistorical && instance && (
        <div className={`onboarding-history-banner ${planComplete ? '' : 'is-incomplete'}`}>
          {planComplete ? <CheckCircle2 size={18} /> : <FileText size={18} />}
          <div>
            <strong>
              {planComplete
                ? `Onboarding completed${completedOn ? ` on ${completedOn}` : ''}`
                : 'Onboarding record (not completed)'}
            </strong>
            <span>
              This is a read-only record of {employee.fullName}’s onboarding for reference
              {employee.status ? ` — they are now ${employee.status}` : ''}.
            </span>
          </div>
        </div>
      )}

      {/* Header Summary Card */}
      <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#FFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="emp-identity-block" style={{ gap: '1rem' }}>
            <Avatar
              photoUrl={employee.photoUrl}
              initials={employee.photo || 'EM'}
              style={{ width: '48px', height: '48px', fontSize: '1.1rem' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {employee.fullName}
                </h2>
                <span className={`emp-status-sub-pill ${employee.status.toLowerCase()}`}>
                  {employee.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {employee.department?.name || 'Department N/A'} · ID: <strong>{employee.employeeId}</strong>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>Anchor Start Date</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
              <span>{toDateOnly(instance?.anchor_date || employee.startDate) || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Progress Section */}
      {!instance ? (
        <div className="table-container-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <FileText size={36} style={{ color: 'var(--border-dark)', marginBottom: '0.5rem' }} />
          <h3>No Onboarding Plan Running</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {employee.fullName} doesn't have onboarding tasks yet. A plan launches automatically
            once a Universal task, or a task for {employee.department?.name || 'their department'},
            is configured under Onboarding &gt; Plans.
          </p>
        </div>
      ) : (
        <div>
          {/* Progress Overview Card */}
          <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#FFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Onboarding Plan</h3>
                <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                  Launched on {toDateOnly(instance.started_at)}
                </span>
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                {progressPercentage}%
              </span>
            </div>

            <div style={{ width: '100%', height: '10px', background: '#E2E8F0', borderRadius: '5px', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: `${progressPercentage}%`,
                  height: '100%',
                  background: '#129FA9',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            <div style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
              <strong>{completedTasks} of {totalTasks}</strong> tasks completed
            </div>
          </div>

          {/* Task Breakdown Table */}
          <div className="table-container-card">
            <div className="plan-task-breakdown-header">
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Onboarding Task Breakdown
              </h3>
              {isHistorical ? (
                <span className="onboarding-history-pill">Read-only record</span>
              ) : (
                <button
                  type="button"
                  className="btn-primary dept-mapping-done"
                  onClick={() => { setEditingTask(null); setIsAddingTask(true); }}
                  title={`Add a task to ${employee.fullName}'s plan only`}
                >
                  <Plus size={15} />
                  <span>Add Task</span>
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="presence-data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '5%', textAlign: 'center' }}>#</th>
                    <th style={{ width: '45%', textAlign: 'left' }}>Task Title</th>
                    <th style={{ width: '14%', textAlign: 'center' }}>Relative Timing</th>
                    <th style={{ width: '14%', textAlign: 'center' }}>Due Date</th>
                    <th style={{ width: '22%', textAlign: 'center' }}>{isHistorical ? 'Completed On' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {taskInstances.map((task) => {
                    const isDone = Boolean(task.completed);
                    // Open tasks: light yellow on the due date, light red once it has passed.
                    const dueDate = (task.due_date || task.originally_calculated_due_date || '').slice(0, 10);
                    const dueClass = isHistorical || isDone || !dueDate ? ''
                      : dueDate === today ? ' plan-task-row-due-today'
                      : dueDate < today ? ' plan-task-row-overdue'
                      : '';

                    if (editingTask?.id === task.id) {
                      return (
                        <InlinePlanTaskEditor
                          key={task.id}
                          task={task}
                          anchorDate={toDateOnly(instance.anchor_date)}
                          anchorLabel="start date"
                          onSubmit={handleSaveTask}
                          onCancel={() => setEditingTask(null)}
                        />
                      );
                    }

                    return (
                      <tr key={task.id} className={`presence-table-row${dueClass}`} style={isDone ? { opacity: 0.8, backgroundColor: '#F8FAFC' } : undefined}>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{task.sequence}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', textDecoration: isDone ? 'line-through' : 'none' }}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{task.description}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.725rem', fontWeight: 600 }}>
                            Day {task.relative_offset_days >= 0 ? `+${task.relative_offset_days}` : task.relative_offset_days}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {(task.due_date || task.originally_calculated_due_date || '').slice(0, 10)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isHistorical ? (
                            <span className={isDone ? 'onboarding-history-done' : 'onboarding-history-open'}>
                              {isDone ? (toLocalDateString(task.completed_at) || 'Done') : 'Not done'}
                            </span>
                          ) : (
                          <div className="plan-task-actions">
                            <input
                              type="checkbox"
                              className="plan-task-checkbox"
                              checked={isDone}
                              onChange={() => handleToggleTaskComplete(task)}
                              title={isDone ? 'Done — untick to reopen' : 'Tick when done'}
                              aria-label={`${isDone ? 'Reopen' : 'Mark done'}: ${task.title}`}
                            />
                            <button
                              type="button"
                              className="plan-task-icon-btn"
                              title={`Edit this task for ${employee.fullName} only`}
                              aria-label={`Edit ${task.title}`}
                              onClick={() => { setIsAddingTask(false); setEditingTask(task); }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="plan-task-icon-btn plan-task-icon-btn-danger"
                              title={`Remove this task from ${employee.fullName}'s plan only`}
                              aria-label={`Delete ${task.title}`}
                              disabled={deletingId === task.id}
                              onClick={() => handleDeleteTask(task)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {isAddingTask && (
                    <InlinePlanTaskEditor
                      anchorDate={toDateOnly(instance.anchor_date)}
                      anchorLabel="start date"
                      planLabel="onboarding"
                      onSubmit={handleAddTask}
                      onCancel={() => setIsAddingTask(false)}
                    />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
