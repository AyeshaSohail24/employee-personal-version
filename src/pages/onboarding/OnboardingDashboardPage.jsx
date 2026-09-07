import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Play,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  UserPlus,
  ArrowUpRight,
} from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';
import { activityService } from '../../services/activityService.js';
import { PLAN_INSTANCE_STATUS } from '../../domain/onboardingDomain.js';
import LaunchPlanModal from '../../components/onboarding/LaunchPlanModal.jsx';

export default function OnboardingDashboardPage() {
  const [instances, setInstances] = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const allInsts = await onboardingService.getAllInstances();
      setInstances(allInsts);

      // Fetch overdue activities that belong to Onboarding
      const overdues = await activityService.getOverdueActivities();
      const onboardingOverdues = overdues.filter((a) => a.source === 'Onboarding');
      setOverdueTasks(onboardingOverdues);
    } catch (err) {
      console.error('Failed to load onboarding dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeInstances = instances.filter((i) => i.derivedStatus !== PLAN_INSTANCE_STATUS.COMPLETED);
  const inProgressCount = instances.filter((i) => i.derivedStatus === PLAN_INSTANCE_STATUS.IN_PROGRESS).length;
  const needsAttentionCount = instances.filter((i) => i.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION).length;
  const completedCount = instances.filter((i) => i.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED).length;

  const handleMarkTaskComplete = async (actId) => {
    try {
      await activityService.markComplete(actId);
      await loadDashboardData();
    } catch (err) {
      alert(`Failed to complete task: ${err.message}`);
    }
  };

  return (
    <div className="page-layout-container">
      {/* Page Header */}
      <div className="onboarding-dashboard-header">
        <div className="header-text-group">
          <h1 className="page-title">Onboarding Dashboard</h1>
          <p className="page-subtitle">
            Manage onboarding plans, launch workflows, and track new joiner progress.
          </p>
        </div>
        <div className="header-actions">
          <Link
            to="/onboarding/plans"
            className="btn-secondary btn-header-action"
          >
            <UserPlus size={15} />
            <span>Manage Plan Templates</span>
          </Link>
          <button
            type="button"
            className="btn-primary btn-header-action"
            onClick={() => setIsLaunchModalOpen(true)}
          >
            <Play size={15} />
            <span>Launch Onboarding Plan</span>
          </button>
        </div>
      </div>

      {/* Metric KPI Summary Grid */}
      <div className="summary-cards-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Active Plans</span>
            <div
              className="summary-card-icon"
              style={{
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary-active)',
                borderColor: '#99E6EB',
              }}
            >
              <Users size={17} />
            </div>
          </div>
          <div className="summary-card-value" style={{ color: 'var(--color-primary-active)' }}>
            {activeInstances.length}
          </div>
          <div className="summary-card-subtext">New joiners actively onboarding</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">In Progress</span>
            <div
              className="summary-card-icon"
              style={{
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                borderColor: '#BFDBFE',
              }}
            >
              <Clock size={17} />
            </div>
          </div>
          <div className="summary-card-value" style={{ color: '#2563EB' }}>
            {inProgressCount}
          </div>
          <div className="summary-card-subtext">On-track onboarding workflows</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Needs Attention</span>
            <div
              className="summary-card-icon"
              style={{
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                borderColor: '#FECACA',
              }}
            >
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="summary-card-value" style={{ color: '#DC2626' }}>
            {needsAttentionCount}
          </div>
          <div className="summary-card-subtext">Overdue tasks or inactive assignees</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Completed Plans</span>
            <div
              className="summary-card-icon"
              style={{
                backgroundColor: '#ECFDF5',
                color: '#059669',
                borderColor: '#A7F3D0',
              }}
            >
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="summary-card-value" style={{ color: '#059669' }}>
            {completedCount}
          </div>
          <div className="summary-card-subtext">Fully onboarded employees</div>
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div className="onboarding-main-grid">
        {/* Left Column: Active Onboarding Plans */}
        <div className="table-container-card">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Active Onboarding Workflows
            </h3>
            <Link to="/onboarding/employees" style={{ fontSize: '0.815rem', color: 'var(--color-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              View All Employees <ChevronRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading active onboarding workflows...
            </div>
          ) : activeInstances.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No active onboarding plans running. Click "Launch Onboarding Plan" to start one.
            </div>
          ) : (
            <table className="presence-data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '28%', textAlign: 'left' }}>Employee</th>
                  <th style={{ width: '24%', textAlign: 'left' }}>Plan Template</th>
                  <th style={{ width: '18%', textAlign: 'center' }}>Start Date</th>
                  <th style={{ width: '18%', textAlign: 'center' }}>Progress</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeInstances.map((inst) => {
                  const emp = inst.employee || {};
                  const isNeedsAttn = inst.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION;

                  return (
                    <tr key={inst.id} className="presence-table-row">
                      <td>
                        <div className="emp-identity-block">
                          <div className="emp-avatar-circle">{emp.photo || 'EM'}</div>
                          <div className="emp-identity-text">
                            <div className="emp-name-text" style={{ whiteSpace: 'nowrap' }}>
                              {emp.fullName || 'Unknown Employee'}
                            </div>
                            <div className="emp-id-subtext">{emp.employeeId || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-main)' }}>
                          {inst.template ? inst.template.name : 'Custom Plan'}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          {inst.progress.completedRequiredCount} / {inst.progress.requiredTasksCount} required tasks
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.815rem' }}>
                        {inst.anchorDate}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.785rem', fontWeight: 700 }}>
                              {inst.progress.progressPercentage}%
                            </span>
                            {isNeedsAttn && (
                              <span style={{ fontSize: '0.685rem', padding: '0.1rem 0.35rem', background: '#FEF2F2', color: '#DC2626', borderRadius: '4px', fontWeight: 600 }}>
                                Attention
                              </span>
                            )}
                          </div>
                          <div style={{ width: '80px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${inst.progress.progressPercentage}%`,
                                height: '100%',
                                background: isNeedsAttn ? '#EF4444' : '#129FA9',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Link
                          to={`/onboarding/employees/${emp.id}`}
                          className="btn-compact-override"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.725rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <span>Progress</span>
                          <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right Column: Overdue Onboarding Tasks Alert List */}
        <div className="table-container-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <AlertTriangle size={18} style={{ color: '#DC2626' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Overdue Onboarding Tasks ({overdueTasks.length})
            </h3>
          </div>

          {overdueTasks.length === 0 ? (
            <div style={{ padding: '1.5rem 0', textAlign: 'center', color: '#059669', fontSize: '0.85rem' }}>
              <CheckCircle2 size={24} style={{ marginBottom: '0.35rem' }} />
              <div>All onboarding tasks are on schedule!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {overdueTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: '0.75rem',
                    background: '#FEF2F2',
                    borderRadius: '6px',
                    border: '1px solid #FECACA',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.815rem', color: '#991B1B' }}>
                      {task.title}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#DC2626', fontWeight: 700 }}>
                      Due {task.dueDate}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.735rem', color: '#7F1D1D' }}>
                    For: <strong>{task.relatedEmployee?.fullName || 'Employee'}</strong> · Assigned: {task.assigneeEmployee?.fullName || 'Unassigned'}
                  </div>
                  <div style={{ textAlign: 'right', marginTop: '0.2rem' }}>
                    <button
                      type="button"
                      className="btn-compact-override"
                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', backgroundColor: '#FFF', color: '#059669', borderColor: '#A7F3D0' }}
                      onClick={() => handleMarkTaskComplete(task.id)}
                    >
                      Mark Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Launch Plan Modal */}
      <LaunchPlanModal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        onSuccess={() => loadDashboardData()}
      />
    </div>
  );
}
