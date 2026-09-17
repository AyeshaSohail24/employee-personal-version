import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { employeeService } from '../../services/employeeService.js';
import { onboardingService } from '../../services/onboardingService.js';

// Real-data onboarding detail view for one (real) intern's local employee
// record — reached from OnboardingEmployeesPage's "View Progress" link. The
// plan itself is never launched from here: it's auto-launched the moment the
// intern first appears with no plan yet (server/db/onboarding.js's
// listInternsWithAutoLaunchedOnboarding()), composed from Universal + their
// department's active tasks. This page only views it and checks off tasks —
// editing/dropping a plan has no real-backend equivalent yet.
export default function OnboardingEmployeeDetailPage() {
  const { employeeId } = useParams();
  const [employee, setEmployee] = useState(null);
  const [instance, setInstance] = useState(null);
  const [taskInstances, setTaskInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    loadData();
  }, [employeeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [emp, plan] = await Promise.all([
        employeeService.getById(employeeId),
        onboardingService.getRealInstanceForEmployee(employeeId),
      ]);
      setEmployee(emp);
      setInstance(plan.instance);
      setTaskInstances(plan.taskInstances || []);
    } catch (err) {
      console.error('Failed to load onboarding employee detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTaskComplete = async (taskInstanceId, isCompleted) => {
    setTogglingId(taskInstanceId);
    try {
      await onboardingService.setRealTaskInstanceCompleted(taskInstanceId, !isCompleted);
      await loadData();
    } catch (err) {
      alert(`Failed to update task state: ${err.message}`);
    } finally {
      setTogglingId(null);
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

  const totalTasks = taskInstances.length;
  const completedTasks = taskInstances.filter((t) => t.completed).length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="page-layout-container">
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/onboarding/employees" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
          <ArrowLeft size={14} /> Back to Onboarding Progress
        </Link>
      </div>

      {/* Header Summary Card */}
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
            <div style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>Anchor Start Date</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
              <span>{instance?.anchor_date || employee.startDate || 'N/A'}</span>
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
                  Launched on {instance.started_at}
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
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Onboarding Task Breakdown
              </h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="presence-data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '5%', textAlign: 'center' }}>#</th>
                    <th style={{ width: '52%', textAlign: 'left' }}>Task Title</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Relative Timing</th>
                    <th style={{ width: '18%', textAlign: 'center' }}>Due Date</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {taskInstances.map((task) => {
                    const isDone = Boolean(task.completed);

                    return (
                      <tr key={task.id} className="presence-table-row" style={isDone ? { opacity: 0.8, backgroundColor: '#F8FAFC' } : undefined}>
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
                          <button
                            type="button"
                            className={isDone ? 'btn-compact-clear' : 'btn-compact-override'}
                            style={!isDone ? { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' } : undefined}
                            disabled={togglingId === task.id}
                            onClick={() => handleToggleTaskComplete(task.id, isDone)}
                          >
                            {isDone ? <RotateCcw size={11} /> : <CheckCircle2 size={11} />}
                            <span>{isDone ? 'Reopen' : 'Done'}</span>
                          </button>
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
    </div>
  );
}
