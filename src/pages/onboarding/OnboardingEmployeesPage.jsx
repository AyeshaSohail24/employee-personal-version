import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  ArrowUpRight,
  UsersRound,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
} from 'lucide-react';
import { employeeService } from '../../services/employeeService.js';
import { onboardingService } from '../../services/onboardingService.js';
import { activityService } from '../../services/activityService.js';
import { PLAN_INSTANCE_STATUS, resolveAllOnboardingHistory } from '../../domain/onboardingDomain.js';
import LaunchPlanModal from '../../components/onboarding/LaunchPlanModal.jsx';
import OverdueTasksModal from '../../components/onboarding/OverdueTasksModal.jsx';

export default function OnboardingEmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [instances, setInstances] = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'Employee' | 'Intern'
  const [loading, setLoading] = useState(true);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allEmps, allInsts] = await Promise.all([
        employeeService.getAll(),
        onboardingService.getAllInstances(),
      ]);
      setEmployees(allEmps);
      setInstances(allInsts);

      // Fetch overdue activities that belong to Onboarding
      const overdues = await activityService.getOverdueActivities();
      const onboardingOverdues = overdues.filter((a) => a.source === 'Onboarding');
      setOverdueTasks(onboardingOverdues);
    } catch (err) {
      console.error('Failed to load onboarding employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const instanceMap = new Map(instances.map((i) => [i.employeeId, i]));

  // Summary card metrics — same calculations previously shown on the Onboarding Dashboard
  const activeInstances = instances.filter((i) => i.derivedStatus !== PLAN_INSTANCE_STATUS.COMPLETED);
  const inProgressCount = instances.filter((i) => i.derivedStatus === PLAN_INSTANCE_STATUS.IN_PROGRESS).length;
  const needsAttentionCount = instances.filter((i) => i.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION).length;
  const completedCount = instances.filter((i) => i.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED).length;

  // Onboarding progress population: everyone Upcoming/Onboarding, or who has (or had) a plan
  const onboardingWorkforce = resolveAllOnboardingHistory(employees, instanceMap).filter((emp) => {
    if (typeFilter !== 'all' && emp.directoryType !== typeFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = emp.fullName.toLowerCase().includes(q);
      const matchId = emp.employeeId.toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }

    return true;
  });

  const handleMarkTaskComplete = async (actId) => {
    try {
      await activityService.markComplete(actId);
      await loadData();
    } catch (err) {
      alert(`Failed to complete task: ${err.message}`);
    }
  };

  return (
    <div className="page-layout-container">
      {/* Page Header */}
      <div className="onboarding-dashboard-header">
        <div className="header-text-group">
          <h1 className="page-title">Onboarding Employees</h1>
          <p className="page-subtitle">
            View and track individual onboarding progress for employees and interns.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-secondary btn-header-action candidate-notification-btn"
            onClick={() => setIsOverdueModalOpen(true)}
          >
            <AlertTriangle size={15} />
            <span>Overdue Tasks</span>
            {overdueTasks.length > 0 && (
              <span className="candidate-notification-badge">{overdueTasks.length}</span>
            )}
          </button>
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

      {/* Filter Bar */}
      <div className="table-toolbar-card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem 1rem', flexWrap: 'wrap' }}>
        <div className="view-switcher-group">
          <button
            type="button"
            className={`view-btn ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            <Users size={15} />
            <span>All</span>
          </button>
          <button
            type="button"
            className={`view-btn ${typeFilter === 'Employee' ? 'active' : ''}`}
            onClick={() => setTypeFilter('Employee')}
          >
            <UsersRound size={15} />
            <span>Employees</span>
          </button>
          <button
            type="button"
            className={`view-btn ${typeFilter === 'Intern' ? 'active' : ''}`}
            onClick={() => setTypeFilter('Intern')}
          >
            <GraduationCap size={15} />
            <span>Interns</span>
          </button>
        </div>

        <div className="toolbar-search-box" style={{ maxWidth: '280px' }}>
          <Search size={16} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search employee name or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Employees Table */}
      <div className="table-container-card">
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading onboarding employees...
          </div>
        ) : onboardingWorkforce.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ marginBottom: '0.5rem', color: 'var(--border-dark)' }} />
            <h3>No Onboarding Employees Found</h3>
            <p style={{ fontSize: '0.85rem' }}>
              No employees currently match the selected filter or search query.
            </p>
          </div>
        ) : (
          <div className="onboarding-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="presence-data-table onboarding-employees-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '24%', textAlign: 'left' }}>Employee</th>
                  <th style={{ width: '15%', textAlign: 'left' }}>Department</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Start Date</th>
                  <th style={{ width: '17%', textAlign: 'left' }}>Onboarding Plan</th>
                  <th style={{ width: '13%', textAlign: 'center' }}>Progress</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '9%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {onboardingWorkforce.map((emp) => {
                  const inst = instanceMap.get(emp.id);

                  return (
                    <tr key={emp.id} className="presence-table-row">
                      <td>
                        <div className="emp-identity-block">
                          <div className="emp-avatar-circle" style={emp.status === 'Former' ? { background: '#64748B' } : undefined}>
                            {emp.photo || 'EM'}
                          </div>
                          <div className="emp-identity-text">
                            <div className="emp-name-text" style={{ whiteSpace: 'nowrap' }}>
                              {emp.fullName}
                            </div>
                            <div className="emp-id-subtext">{emp.employeeId}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '0.815rem', color: 'var(--text-main)' }}>
                          {emp.department?.name || 'Department N/A'}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.815rem' }}>
                        {inst ? inst.anchorDate : (emp.effectiveEmploymentRecord?.effectiveFrom || emp.startDate || 'N/A')}
                      </td>

                      <td>
                        <div style={{ fontSize: '0.815rem', color: 'var(--text-main)' }}>
                          {inst ? (inst.template ? inst.template.name : 'Custom Plan') : (
                            <span style={{ color: 'var(--text-muted)' }}>No active plan</span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {inst ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                            <div style={{ width: '60px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${inst.progress.progressPercentage}%`,
                                  height: '100%',
                                  background: inst.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION ? '#EF4444' : '#129FA9',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.735rem', fontWeight: 700 }}>
                              {inst.progress.progressPercentage}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {inst ? (
                          <span
                            className="presence-badge"
                            style={
                              inst.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED
                                ? { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }
                                : inst.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION
                                ? { backgroundColor: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }
                                : { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                            }
                          >
                            {inst.derivedStatus}
                          </span>
                        ) : (
                          <span className="presence-badge" style={{ backgroundColor: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1' }}>
                            Not Started
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <Link
                          to={`/onboarding/employees/${emp.id}`}
                          className="btn-compact-override"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}
                        >
                          <span>View Progress</span>
                          <ArrowUpRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Launch Plan Modal */}
      <LaunchPlanModal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Overdue Tasks Modal */}
      <OverdueTasksModal
        isOpen={isOverdueModalOpen}
        onClose={() => setIsOverdueModalOpen(false)}
        tasks={overdueTasks}
        onMarkComplete={handleMarkTaskComplete}
      />
    </div>
  );
}
