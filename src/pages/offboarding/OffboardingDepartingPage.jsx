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
import { offboardingService } from '../../services/offboardingService.js';
import { activityService } from '../../services/activityService.js';
import { OFFBOARDING_INSTANCE_STATUS } from '../../domain/offboardingDomain.js';
import LaunchOffboardingPlanModal from '../../components/offboarding/LaunchOffboardingPlanModal.jsx';
import OverdueOffboardingTasksModal from '../../components/offboarding/OverdueOffboardingTasksModal.jsx';

// Canonical Offboarding Progress page — consolidates what used to be split across the separate
// Offboarding Dashboard (KPI cards + overdue exit tasks panel) and Offboarding Employee Directory
// ("Departing Employees", the filterable instance table) pages. Both of those routes/nav entries
// were retired; this page keeps serving the existing /offboarding/departing route so no internal
// link needed to change. Offboarding's own instance/status model (OFFBOARDING_INSTANCE_STATUS,
// derivedStatus) is used throughout — nothing from onboardingDomain is imported here.
export default function OffboardingDepartingPage() {
  const [instances, setInstances] = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'Employee' | 'Intern'
  const [loading, setLoading] = useState(true);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
  const [isMarkingAllComplete, setIsMarkingAllComplete] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const allInsts = await offboardingService.getAllInstances();
      setInstances(allInsts);

      // Fetch overdue activities that belong to Offboarding — same source-filtered query the old
      // Dashboard used, just now surfaced through the popup pattern instead of an inline panel.
      const overdues = await activityService.getOverdueActivities();
      const offboardingOverdues = overdues.filter((a) => a.source === 'Offboarding');
      setOverdueTasks(offboardingOverdues);
    } catch (err) {
      console.error('Failed to load offboarding progress data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Summary card metrics — same derivedStatus-based calculations the old Dashboard used.
  const activeInstances = instances.filter((i) => i.derivedStatus !== OFFBOARDING_INSTANCE_STATUS.COMPLETED);
  const inProgressCount = instances.filter((i) => i.derivedStatus === OFFBOARDING_INSTANCE_STATUS.IN_PROGRESS).length;
  const needsAttentionCount = instances.filter((i) => i.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION).length;
  const completedCount = instances.filter((i) => i.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED).length;

  // Offboarding progress population: everyone with a current (or historical) offboarding plan
  // instance. Unlike Onboarding's Employees page, this intentionally does NOT also list
  // Departing/Former employees who have no instance yet — that population was never shown here
  // before this refactor, and inventing it is out of scope for a navigation/consolidation task.
  const filteredInstances = instances.filter((inst) => {
    const emp = inst.employee || {};

    if (typeFilter !== 'all' && emp.directoryType !== typeFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = emp.fullName?.toLowerCase().includes(q);
      const matchId = emp.employeeId?.toLowerCase().includes(q);
      const matchTemplate = inst.template?.name?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchTemplate) return false;
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

  // Mirrors the Onboarding Progress page's "Mark All as Complete" behavior exactly: executes
  // immediately (no confirmation step), targets only the exact set of activity IDs shown in the
  // popup at click time, and guards against a double-click firing the bulk completion twice.
  const handleMarkAllOverdueComplete = async () => {
    if (isMarkingAllComplete) return;
    setIsMarkingAllComplete(true);
    try {
      const idsToComplete = overdueTasks.map((t) => t.id);
      await activityService.markCompleteMany(idsToComplete);
      await loadData();
    } catch (err) {
      alert(`Failed to complete overdue tasks: ${err.message}`);
    } finally {
      setIsMarkingAllComplete(false);
    }
  };

  return (
    <div className="page-layout-container">
      {/* Page Header */}
      <div className="onboarding-dashboard-header">
        <div className="header-text-group">
          <h1 className="page-title">Offboarding Progress</h1>
          <p className="page-subtitle">
            View and track individual offboarding progress for employees and interns.
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
            <span>Launch Offboarding Plan</span>
          </button>
        </div>
      </div>

      {/* Metric KPI Summary Grid */}
      <div className="summary-cards-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Active Exit Plans</span>
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
          <div className="summary-card-subtext">Departing staff actively offboarding</div>
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
          <div className="summary-card-subtext">On-track clearance workflows</div>
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
          <div className="summary-card-subtext">Overdue tasks or unassigned items</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Completed Exit Plans</span>
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
          <div className="summary-card-subtext">Fully cleared former staff</div>
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

      {/* Progress Table */}
      <div className="table-container-card">
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading offboarding progress...
          </div>
        ) : filteredInstances.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ marginBottom: '0.5rem', color: 'var(--border-dark)' }} />
            <h3>No Offboarding Progress Found</h3>
            <p style={{ fontSize: '0.85rem' }}>
              No offboarding workflows currently match the selected filter or search query.
            </p>
          </div>
        ) : (
          <div className="onboarding-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="presence-data-table onboarding-employees-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '22%', textAlign: 'left' }}>Employee</th>
                  <th style={{ width: '14%', textAlign: 'left' }}>Department</th>
                  <th style={{ width: '13%', textAlign: 'center' }}>Final Working Date</th>
                  <th style={{ width: '17%', textAlign: 'left' }}>Offboarding Plan</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Progress</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInstances.map((inst) => {
                  const emp = inst.employee || {};
                  const isCompleted = inst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED;
                  const isNeedsAttn = inst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION;

                  return (
                    <tr key={inst.id} className="presence-table-row">
                      <td>
                        <div className="emp-identity-block">
                          <div className="emp-avatar-circle">
                            {emp.photo || 'EM'}
                          </div>
                          <div className="emp-identity-text">
                            <div className="emp-name-text" style={{ whiteSpace: 'nowrap' }}>
                              {emp.fullName || 'Unknown Employee'}
                            </div>
                            <div className="emp-id-subtext">{emp.employeeId || 'N/A'}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '0.815rem', color: 'var(--text-main)' }}>
                          {emp.department?.name || 'Department N/A'}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.815rem' }}>
                        {inst.anchorDate}
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-main)' }}>
                          {inst.template ? inst.template.name : 'Custom Exit Plan'}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          {inst.progress.completedRequiredCount} / {inst.progress.requiredTasksCount} required tasks
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                          <div style={{ width: '60px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${inst.progress.progressPercentage}%`,
                                height: '100%',
                                background: isNeedsAttn ? '#EF4444' : isCompleted ? '#10B981' : '#129FA9',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.735rem', fontWeight: 700 }}>
                            {inst.progress.progressPercentage}%
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="presence-badge"
                          style={
                            isCompleted
                              ? { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }
                              : isNeedsAttn
                              ? { backgroundColor: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }
                              : { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                          }
                        >
                          {inst.derivedStatus}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <Link
                          to={`/offboarding/employees/${emp.id}`}
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
      <LaunchOffboardingPlanModal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Overdue Tasks Modal — Mark All as Complete executes immediately (no confirmation step) */}
      <OverdueOffboardingTasksModal
        isOpen={isOverdueModalOpen}
        onClose={() => setIsOverdueModalOpen(false)}
        tasks={overdueTasks}
        onMarkComplete={handleMarkTaskComplete}
        onMarkAllComplete={handleMarkAllOverdueComplete}
        isMarkingAllComplete={isMarkingAllComplete}
      />
    </div>
  );
}
