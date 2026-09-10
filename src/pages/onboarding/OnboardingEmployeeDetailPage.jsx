import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  FileText,
  RotateCcw,
  Eye,
  Plus,
} from 'lucide-react';
import { employeeService } from '../../services/employeeService.js';
import { onboardingService } from '../../services/onboardingService.js';
import { activityService } from '../../services/activityService.js';
import { PLAN_INSTANCE_STATUS } from '../../domain/onboardingDomain.js';
import LaunchPlanModal from '../../components/onboarding/LaunchPlanModal.jsx';
import AddTaskModal from '../../components/onboarding/AddTaskModal.jsx';

export default function OnboardingEmployeeDetailPage() {
  const { employeeId } = useParams();
  const [employee, setEmployee] = useState(null);
  const [planInstance, setPlanInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [employeeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const emp = await employeeService.getById(employeeId);
      setEmployee(emp);

      const instances = await onboardingService.getAllInstances({ employeeId });
      if (instances && instances.length > 0) {
        setPlanInstance(instances[0]);
      } else {
        setPlanInstance(null);
      }
    } catch (err) {
      console.error('Failed to load onboarding employee detail:', err);
    } finally {
      setLoading(false);
    }
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
          Loading employee onboarding detail...
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
            Back to Onboarding Employees
          </Link>
        </div>
      </div>
    );
  }

  const currentStartDate = employee.effectiveEmploymentRecord?.effectiveFrom || employee.startDate;
  const isStartDateMismatch = planInstance && planInstance.anchorDate && currentStartDate && planInstance.anchorDate !== currentStartDate;
  const isFormerEmployee = employee.status === 'Former';

  return (
    <div className="page-layout-container">
      {/* Back Link */}
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/onboarding/employees" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
          <ArrowLeft size={14} /> Back to Onboarding Employees
        </Link>
      </div>

      {/* Header Summary Card */}
      <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#FFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="emp-identity-block" style={{ gap: '1rem' }}>
            <div className="emp-avatar-circle" style={{ width: '48px', height: '48px', fontSize: '1.1rem', background: isFormerEmployee ? '#64748B' : undefined }}>
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
            <div style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>Anchor Start Date</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
              <span>{currentStartDate || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Warning Banners */}
        {isStartDateMismatch && (
          <div style={{ marginTop: '1rem', padding: '0.65rem 0.85rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', fontSize: '0.815rem', color: '#B45309', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={15} />
            <span>
              <strong>Start date changed since plan launch</strong> (Original Anchor: {planInstance.anchorDate}, Current Date: {currentStartDate}). Existing activity due dates remain intact.
            </span>
          </div>
        )}

        {isFormerEmployee && (
          <div style={{ marginTop: '1rem', padding: '0.65rem 0.85rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', fontSize: '0.815rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={15} />
            <span>
              <strong>Employee status changed to Former</strong>. Plan execution is retained in history and marked Needs Attention.
            </span>
          </div>
        )}
      </div>

      {/* Workflow Progress Section */}
      {!planInstance ? (
        <div className="table-container-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <FileText size={36} style={{ color: 'var(--border-dark)', marginBottom: '0.5rem' }} />
          <h3>No Onboarding Plan Running</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            {employee.fullName} does not have an active onboarding plan launched.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsLaunchModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Play size={14} />
            <span>Launch Onboarding Plan</span>
          </button>
        </div>
      ) : (
        <div>
          {/* Progress Overview Card */}
          <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#FFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  {planInstance.template ? planInstance.template.name : 'Onboarding Plan'}
                </h3>
                <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                  Launched on {planInstance.createdAt ? planInstance.createdAt.slice(0, 10) : planInstance.startedAt}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  className="presence-badge"
                  style={
                    planInstance.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED
                      ? { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0', padding: '0.3rem 0.75rem', fontSize: '0.815rem' }
                      : planInstance.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION
                      ? { backgroundColor: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA', padding: '0.3rem 0.75rem', fontSize: '0.815rem' }
                      : { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE', padding: '0.3rem 0.75rem', fontSize: '0.815rem' }
                  }
                >
                  {planInstance.derivedStatus}
                </span>

                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {planInstance.progress.progressPercentage}%
                </span>
              </div>
            </div>

            {/* Big Progress Bar */}
            <div style={{ width: '100%', height: '10px', background: '#E2E8F0', borderRadius: '5px', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: `${planInstance.progress.progressPercentage}%`,
                  height: '100%',
                  background: planInstance.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION ? '#EF4444' : '#129FA9',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.785rem', color: 'var(--text-muted)' }}>
              <span>
                Required Tasks: <strong>{planInstance.progress.completedRequiredCount} of {planInstance.progress.requiredTasksCount}</strong> completed
              </span>
              <span>
                Total Tasks: <strong>{planInstance.progress.completedTasksCount} of {planInstance.progress.totalTasks}</strong> finished
              </span>
            </div>
          </div>

          {/* Task Breakdown Table */}
          <div className="table-container-card">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Onboarding Task Breakdown & Operational Status
              </h3>
              <button
                type="button"
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem', flexShrink: 0 }}
                onClick={() => setIsAddTaskModalOpen(true)}
              >
                <Plus size={14} />
                <span>Add Task</span>
              </button>
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
                {planInstance.progress.tasks.map((task) => {
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

      {/* Launch Plan Modal */}
      <LaunchPlanModal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        preselectedEmployeeId={employee.id}
        onSuccess={() => loadData()}
      />

      {/* Add Task Modal (employee-specific plan instance only) */}
      {planInstance && (
        <AddTaskModal
          isOpen={isAddTaskModalOpen}
          onClose={() => setIsAddTaskModalOpen(false)}
          planInstanceId={planInstance.id}
          employeeName={employee.fullName}
          onSuccess={() => loadData()}
        />
      )}
    </div>
  );
}
