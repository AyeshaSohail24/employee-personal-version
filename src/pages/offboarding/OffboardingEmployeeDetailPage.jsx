import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  RotateCcw,
  Play,
  FileText,
  Plus,
  Trash2,
  Pencil,
  XCircle,
} from 'lucide-react';
import { employeeService } from '../../services/employeeService.js';
import { offboardingService } from '../../services/offboardingService.js';
import { activityService } from '../../services/activityService.js';
import { OFFBOARDING_INSTANCE_STATUS, isActiveOffboardingPlanStatus } from '../../domain/offboardingDomain.js';
import LaunchOffboardingPlanModal from '../../components/offboarding/LaunchOffboardingPlanModal.jsx';
import AddOffboardingTaskModal from '../../components/offboarding/AddOffboardingTaskModal.jsx';
import EditOffboardingTaskModal from '../../components/offboarding/EditOffboardingTaskModal.jsx';
import DeleteOffboardingTaskModal from '../../components/offboarding/DeleteOffboardingTaskModal.jsx';
import DropOffboardingPlanModal from '../../components/offboarding/DropOffboardingPlanModal.jsx';

// Individual Offboarding Progress page — refactored to match Onboarding's detail page UX
// structure (page-level Drop Plan, single plan-summary card, simplified task table, Add/Delete
// Task). All offboarding-specific rules (Final Working Date anchor, OFFBOARDING_INSTANCE_STATUS,
// checkOffboardingEligibility, composeOffboardingTasks) remain entirely independent of
// onboarding's own domain/service layer — only the UI pattern was mirrored.
export default function OffboardingEmployeeDetailPage() {
  const { employeeId } = useParams();
  const [employee, setEmployee] = useState(null);
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [taskPendingEdit, setTaskPendingEdit] = useState(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState(null);
  const [isDropPlanModalOpen, setIsDropPlanModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [employeeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const emp = await employeeService.getById(employeeId);
      setEmployee(emp);

      const instances = await offboardingService.getAllInstances({ employeeId });
      if (instances && instances.length > 0) {
        setInstance(instances[0]);
      } else {
        setInstance(null);
      }
    } catch (err) {
      console.error('Failed to load offboarding employee detail:', err);
    } finally {
      setLoading(false);
    }
  };

  // A Dropped plan is a permanent historical record — task modification triggers/modals must
  // stop being offered once instance.derivedStatus === DROPPED. Deliberately NOT gated on
  // isActiveOffboardingPlanStatus() (which also excludes COMPLETED): Completed plans keep their
  // existing, unrelated behavior — only DROPPED is a new read-only rule. Re-evaluated on every
  // instance change (e.g. right after Drop Plan succeeds and loadData() refreshes), so a modal
  // that happened to be open at the moment of transition can never linger open against a
  // now-read-only plan.
  useEffect(() => {
    if (instance && instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.DROPPED) {
      setIsAddTaskModalOpen(false);
      setTaskPendingEdit(null);
      setTaskPendingDelete(null);
      setIsDropPlanModalOpen(false);
    }
  }, [instance]);

  const handleEditTaskSuccess = async () => {
    setTaskPendingEdit(null);
    await loadData();
  };

  const handleDeleteTaskSuccess = async () => {
    setTaskPendingDelete(null);
    await loadData();
  };

  const handleDropPlanSuccess = async () => {
    setIsDropPlanModalOpen(false);
    await loadData();
  };

  const handleToggleTaskComplete = async (activityId, isCompleted) => {
    try {
      if (isCompleted) {
        await activityService.reopen(activityId);
      } else {
        await activityService.markComplete(activityId);
      }
      await loadData();
    } catch (err) {
      alert(`Failed to update task state: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="page-layout-container">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading employee offboarding detail...
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="page-layout-container">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <h2>Employee Not Found</h2>
          <Link to="/offboarding/departing" className="btn-secondary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Back to Offboarding Progress
          </Link>
        </div>
      </div>
    );
  }

  // Dropped-only read-only gate — see the useEffect above for why this is intentionally narrower
  // than isActiveOffboardingPlanStatus() (Completed plans are unaffected by this task).
  const isDropped = Boolean(instance) && instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.DROPPED;

  return (
    <div className="page-layout-container">
      {/* Page-Level Navigation/Action Row — Back link on the left, Drop Plan (page-level
          destructive action, not employee-card or plan-summary content) on the far right. Same
          isActiveOffboardingPlanStatus() gate as Onboarding's equivalent row; when it doesn't
          apply this is a plain single-child flex row, so no empty right-side placeholder is ever
          left behind. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <Link to="/offboarding/departing" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
          <ArrowLeft size={14} /> Back to Offboarding Progress
        </Link>

        {instance && isActiveOffboardingPlanStatus(instance.derivedStatus) && (
          <button
            type="button"
            className="btn-danger"
            title="Drop offboarding plan"
            onClick={() => setIsDropPlanModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem', flexShrink: 0 }}
          >
            <XCircle size={14} />
            <span>Drop Plan</span>
          </button>
        )}
      </div>

      {/* Employee Information Card */}
      <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#FFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="emp-identity-block" style={{ gap: '1rem' }}>
            <div className="emp-avatar-circle" style={{ width: '48px', height: '48px', fontSize: '1.1rem' }}>
              {employee.photo || 'EM'}
            </div>
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
                {employee.position?.name || 'Position N/A'} · {employee.department?.name || 'Department N/A'} · ID: <strong>{employee.employeeId}</strong>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>Final Working Date</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Calendar size={14} style={{ color: '#DC2626' }} />
              <span>{instance ? instance.anchorDate : (employee.contractEndDate || 'Not Confirmed')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Progress Section */}
      {!instance ? (
        <div className="table-container-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <FileText size={36} style={{ color: 'var(--border-dark)', marginBottom: '0.5rem' }} />
          <h3>No Offboarding Plan Running</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            {employee.fullName} does not have an active offboarding plan launched.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsLaunchModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Play size={14} />
            <span>Launch Offboarding Plan</span>
          </button>
        </div>
      ) : (
        <div>
          {/* Plan Summary Card */}
          <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#FFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  {instance.template ? instance.template.name : 'Offboarding Plan'}
                </h3>
                <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                  Launched on {instance.createdAt ? instance.createdAt.slice(0, 10) : instance.startedAt}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span
                  className="presence-badge"
                  style={
                    instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED
                      ? { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0', padding: '0.3rem 0.75rem', fontSize: '0.815rem' }
                      : instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION
                      ? { backgroundColor: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA', padding: '0.3rem 0.75rem', fontSize: '0.815rem' }
                      : instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.DROPPED
                      ? { backgroundColor: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1', padding: '0.3rem 0.75rem', fontSize: '0.815rem' }
                      : { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE', padding: '0.3rem 0.75rem', fontSize: '0.815rem' }
                  }
                >
                  {instance.derivedStatus}
                </span>

                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#DC2626' }}>
                  {instance.progress.progressPercentage}%
                </span>
              </div>
            </div>

            {/* Big Progress Bar */}
            <div style={{ width: '100%', height: '10px', background: '#E2E8F0', borderRadius: '5px', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: `${instance.progress.progressPercentage}%`,
                  height: '100%',
                  background: instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION
                    ? '#EF4444'
                    : instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.DROPPED
                    ? '#94A3B8'
                    : '#DC2626',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            <div style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
              <strong>{instance.progress.completedTasksCount} of {instance.progress.totalTasks}</strong> tasks completed
            </div>
          </div>

          {/* Task Breakdown Table */}
          <div className="table-container-card">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Offboarding Task Breakdown & Operational Status
              </h3>
              {!isDropped && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem', flexShrink: 0 }}
                  onClick={() => setIsAddTaskModalOpen(true)}
                >
                  <Plus size={14} />
                  <span>Add Task</span>
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="presence-data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '5%', textAlign: 'center' }}>#</th>
                    <th style={{ width: '42%', textAlign: 'left' }}>Task Title</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Relative Timing</th>
                    <th style={{ width: '18%', textAlign: 'center' }}>Due Date</th>
                    <th style={{ width: '20%', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {instance.progress.tasks.map((task) => {
                    const act = task.linkedActivity;
                    const isDone = task.isCompleted;

                    return (
                      <tr key={task.id} className="presence-table-row" style={isDone ? { opacity: 0.8, backgroundColor: '#F8FAFC' } : undefined}>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{task.sequence}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', textDecoration: isDone ? 'line-through' : 'none' }}>
                            {task.currentTitle}
                          </div>
                          {task.description && (
                            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{task.description}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.725rem', fontWeight: 600 }}>
                            Day {task.relativeOffsetDays >= 0 ? `+${task.relativeOffsetDays}` : task.relativeOffsetDays}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {task.currentDueDate}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isDropped ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              {act && (
                                <button
                                  type="button"
                                  className={isDone ? 'btn-compact-clear' : 'btn-compact-override'}
                                  style={!isDone ? { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' } : undefined}
                                  onClick={() => handleToggleTaskComplete(act.id, isDone)}
                                >
                                  {isDone ? <RotateCcw size={11} /> : <CheckCircle2 size={11} />}
                                  <span>{isDone ? 'Reopen' : 'Done'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="icon-btn"
                                title="Edit task"
                                aria-label="Edit task"
                                onClick={() => setTaskPendingEdit(task)}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn icon-btn-danger"
                                title="Delete task"
                                aria-label="Delete task"
                                onClick={() => setTaskPendingDelete(task)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Launch Offboarding Plan Modal */}
      <LaunchOffboardingPlanModal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        onSuccess={() => loadData()}
        initialEmployeeId={employee.id}
      />

      {/* Add Task Modal (employee-specific plan instance only) — never offered for a Dropped plan */}
      {instance && !isDropped && (
        <AddOffboardingTaskModal
          isOpen={isAddTaskModalOpen}
          onClose={() => setIsAddTaskModalOpen(false)}
          planInstanceId={instance.id}
          employeeName={employee.fullName}
          onSuccess={() => loadData()}
        />
      )}

      {/* Edit Task Modal (employee-specific plan instance only — reusable Plans configuration untouched) — never offered for a Dropped plan */}
      {instance && !isDropped && (
        <EditOffboardingTaskModal
          isOpen={Boolean(taskPendingEdit)}
          onClose={() => setTaskPendingEdit(null)}
          planInstanceId={instance.id}
          task={taskPendingEdit}
          employeeName={employee.fullName}
          anchorDate={instance.anchorDate}
          onSuccess={handleEditTaskSuccess}
        />
      )}

      {/* Delete Task Modal (employee-specific plan instance only — reusable Plans configuration untouched) — never offered for a Dropped plan */}
      {instance && !isDropped && (
        <DeleteOffboardingTaskModal
          isOpen={Boolean(taskPendingDelete)}
          onClose={() => setTaskPendingDelete(null)}
          planInstanceId={instance.id}
          task={taskPendingDelete}
          employeeName={employee.fullName}
          onSuccess={handleDeleteTaskSuccess}
        />
      )}

      {/* Drop Plan Modal (only ever opened while the plan is active) */}
      {instance && (
        <DropOffboardingPlanModal
          isOpen={isDropPlanModalOpen}
          onClose={() => setIsDropPlanModalOpen(false)}
          planInstance={instance}
          employeeName={employee.fullName}
          onSuccess={handleDropPlanSuccess}
        />
      )}
    </div>
  );
}
