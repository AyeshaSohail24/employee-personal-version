import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Building,
  Briefcase,
  Play,
} from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';
import { activityService } from '../../services/activityService.js';
import { employeeService } from '../../services/employeeService.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import { OFFBOARDING_INSTANCE_STATUS } from '../../domain/offboardingDomain.js';
import LaunchOffboardingPlanModal from '../../components/offboarding/LaunchOffboardingPlanModal.jsx';

export default function OffboardingEmployeeDetailPage() {
  const { employeeId } = useParams();
  const [employee, setEmployee] = useState(null);
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [employeeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const emp = await employeeService.getById(employeeId);
      setEmployee(emp);

      const instances = await offboardingService.getAllInstances({ employeeId });
      if (instances.length > 0) {
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

  const handleToggleTaskComplete = async (activityId, isCompleted) => {
    try {
      if (isCompleted) {
        await activityService.reopen(activityId);
      } else {
        await activityService.markComplete(activityId);
      }
      await loadData();
    } catch (err) {
      alert(`Failed to update task status: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="page-layout-container" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading offboarding plan details...
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="page-layout-container" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2>Employee Not Found</h2>
        <Link to="/offboarding/departing" className="btn-secondary" style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={16} /> Return to Offboarding Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="page-layout-container">
      {/* Top Navigation Back Action */}
      <div style={{ marginBottom: '1rem' }}>
        <Link
          to="/offboarding/departing"
          style={{ fontSize: '0.825rem', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}
        >
          <ArrowLeft size={15} /> Back to Offboarding Directory
        </Link>
      </div>

      {/* Employee Profile & Summary Banner */}
      <div className="table-container-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              fontSize: '1.25rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.15)',
            }}
          >
            {employee.photo || 'EM'}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-navy-header)' }}>
                {employee.fullName}
              </h1>
              <span
                style={{
                  fontSize: '0.725rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  backgroundColor: employee.status === 'Departing' ? '#FEF2F2' : '#F1F5F9',
                  color: employee.status === 'Departing' ? '#DC2626' : '#64748B',
                }}
              >
                {employee.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', fontSize: '0.815rem', color: 'var(--text-muted)' }}>
              <span>ID: <strong>{employee.employeeId}</strong></span>
              <span><Building size={14} style={{ inlineSize: '14px', verticalAlign: 'middle' }} /> {employee.currentRecord?.department?.name || 'Department'}</span>
              <span><Briefcase size={14} style={{ inlineSize: '14px', verticalAlign: 'middle' }} /> {employee.currentRecord?.position?.title || 'Position'}</span>
            </div>
          </div>
        </div>

        {/* Right Info: Final Working Date & Launch Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Final Working Date
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
              <Calendar size={18} />
              <span>{instance ? instance.anchorDate : (employee.contractEndDate || employee.currentRecord?.effectiveTo || 'Not Confirmed')}</span>
            </div>
          </div>

          {!instance && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsLaunchModalOpen(true)}
              style={{ padding: '0.45rem 1rem', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Play size={15} />
              <span>Launch Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Instance Workflow Progress & Timeline Section */}
      {!instance ? (
        <div className="table-container-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Clock size={36} style={{ color: 'var(--color-primary)', marginBottom: '0.75rem' }} />
          <h3>No Offboarding Plan Active</h3>
          <p style={{ maxWidth: '480px', margin: '0.5rem auto 1.25rem auto', fontSize: '0.875rem' }}>
            {employee.fullName} does not have an active offboarding clearance plan running. Click "Launch Plan" to initiate the exit clearance workflow.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsLaunchModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Play size={15} />
            <span>Launch Offboarding Plan</span>
          </button>
        </div>
      ) : (
        <>
          {/* Progress Header Card */}
          <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Plan Template
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {instance.template ? instance.template.name : 'Custom Plan'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Clearance Status
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                <span
                  style={{
                    fontSize: '0.785rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontWeight: 700,
                    backgroundColor: instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED ? '#ECFDF5' : instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION ? '#FEF2F2' : '#EFF6FF',
                    color: instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED ? '#059669' : instance.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION ? '#DC2626' : '#2563EB',
                  }}
                >
                  {instance.derivedStatus}
                </span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Required Tasks Progress
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {instance.progress.completedRequiredCount} / {instance.progress.requiredTasksCount} ({instance.progress.progressPercentage}%)
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Tasks Finished
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {instance.progress.completedTasksCount} / {instance.progress.totalTasks} tasks
              </div>
            </div>
          </div>

          {/* Timeline & Task Instance Table */}
          <div className="table-container-card">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Offboarding Task Execution Timeline
              </h3>
              <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                Relative offsets calculated from Final Working Date ({instance.anchorDate})
              </span>
            </div>

            <table className="presence-data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '6%', textAlign: 'left' }}>#</th>
                  <th style={{ width: '32%', textAlign: 'left' }}>Offboarding Task</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Relative Timing</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Calculated Due Date</th>
                  <th style={{ width: '18%', textAlign: 'left' }}>Assignee</th>
                  <th style={{ width: '14%', textAlign: 'center' }}>Completion</th>
                </tr>
              </thead>
              <tbody>
                {instance.taskInstances.map((ti) => {
                  const act = ti.linkedActivity || {};
                  const isDone = Boolean(act.completed);

                  const offsetLabel = ti.relativeOffsetDays === 0
                    ? 'Day 0 (Exit)'
                    : ti.relativeOffsetDays < 0
                    ? `Day ${ti.relativeOffsetDays}`
                    : `Day +${ti.relativeOffsetDays}`;

                  return (
                    <tr key={ti.id} className="presence-table-row">
                      <td style={{ fontWeight: 700 }}>{ti.sequence}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          {ti.currentTitle || ti.title}
                        </div>
                        <div style={{ fontSize: '0.735rem', color: 'var(--text-muted)' }}>
                          {ti.description}
                        </div>
                        {ti.required && (
                          <span style={{ fontSize: '0.685rem', color: '#DC2626', fontWeight: 700 }}>Required</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.815rem' }}>
                        {offsetLabel}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.815rem' }}>
                        {ti.currentDueDate || ti.originallyCalculatedDueDate}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.815rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {act.assigneeEmployee ? act.assigneeEmployee.fullName : 'Unassigned'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Rule: {ti.assignmentRule}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-compact-override"
                          onClick={() => handleToggleTaskComplete(act.id, isDone)}
                          style={{
                            padding: '0.2rem 0.6rem',
                            fontSize: '0.725rem',
                            backgroundColor: isDone ? '#ECFDF5' : '#FFF',
                            color: isDone ? '#059669' : 'var(--text-main)',
                            borderColor: isDone ? '#A7F3D0' : 'var(--border-light)',
                            fontWeight: 600,
                          }}
                        >
                          {isDone ? 'Completed' : 'Mark Done'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Launch Plan Modal */}
      <LaunchOffboardingPlanModal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        onSuccess={() => loadData()}
        initialEmployeeId={employeeId}
      />
    </div>
  );
}
