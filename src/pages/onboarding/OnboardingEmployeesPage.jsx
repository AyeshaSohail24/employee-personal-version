import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';

// The real intern roster (Interns DB), joined server-side with whatever
// local onboarding plan each person has, auto-launching one from Universal +
// their department's active tasks the moment they show up with none — see
// onboardingService.getInternsProgress() / server/db/onboarding.js's
// listInternsWithAutoLaunchedOnboarding(). There is no manual "Launch"
// action: HR configures tasks under Onboarding > Plans and every intern is
// assigned automatically from there.
export default function OnboardingEmployeesPage() {
  const navigate = useNavigate();
  const [interns, setInterns] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      setInterns(await onboardingService.getInternsProgress());
    } catch (err) {
      console.error('Failed to load interns:', err);
    } finally {
      setLoading(false);
    }
  };

  // Summary card metrics
  const activeInterns = interns.filter((i) => i.plan && i.plan.status !== 'Completed');
  const inProgressCount = interns.filter((i) => i.plan?.status === 'In Progress').length;
  const needsAttentionCount = interns.filter((i) => i.plan?.status === 'Needs Attention').length;
  const completedCount = interns.filter((i) => i.plan?.status === 'Completed').length;

  const visibleInterns = interns.filter((intern) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = intern.fullName.toLowerCase().includes(q);
      const matchRef = (intern.refNumber || '').toLowerCase().includes(q);
      if (!matchName && !matchRef) return false;
    }
    return true;
  });

  return (
    <div className="page-layout-container">
      {/* Page Header */}
      <div className="onboarding-dashboard-header">
        <div className="header-text-group">
          <h1 className="page-title">Onboarding Progress</h1>
          <p className="page-subtitle">
            View and track individual onboarding progress for interns.
          </p>
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
            {activeInterns.length}
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
          <div className="summary-card-subtext">Overdue or at-risk required tasks</div>
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
      <div className="table-toolbar-card" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem 1rem', flexWrap: 'wrap' }}>
        <div className="toolbar-search-box" style={{ maxWidth: '280px' }}>
          <Search size={16} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search intern name or ref number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Interns Table */}
      <div className="table-container-card">
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading interns...
          </div>
        ) : visibleInterns.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ marginBottom: '0.5rem', color: 'var(--border-dark)' }} />
            <h3>No Interns Found</h3>
            <p style={{ fontSize: '0.85rem' }}>
              No interns currently match the search query.
            </p>
          </div>
        ) : (
          <div className="onboarding-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="presence-data-table onboarding-employees-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '26%', textAlign: 'left' }}>Intern</th>
                  <th style={{ width: '16%', textAlign: 'left' }}>Department</th>
                  <th style={{ width: '13%', textAlign: 'center' }}>Start Date</th>
                  <th style={{ width: '19%', textAlign: 'left' }}>Onboarding Plan</th>
                  <th style={{ width: '14%', textAlign: 'center' }}>Progress</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleInterns.map((intern) => {
                  const plan = intern.plan;
                  const isClickable = Boolean(intern.localEmployeeId);

                  return (
                    <tr
                      key={intern.internId}
                      className="presence-table-row"
                      onClick={isClickable ? () => navigate(`/onboarding/employees/${intern.localEmployeeId}`) : undefined}
                      style={isClickable ? { cursor: 'pointer' } : undefined}
                    >
                      <td>
                        <div className="emp-identity-block">
                          <div className="emp-avatar-circle">
                            {intern.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div className="emp-identity-text">
                            <div className="emp-name-text" style={{ whiteSpace: 'nowrap' }}>
                              {intern.fullName}
                            </div>
                            <div className="emp-id-subtext">{intern.refNumber}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '0.815rem', color: 'var(--text-main)' }}>
                          {intern.department?.name || 'Department N/A'}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.815rem' }}>
                        {plan ? plan.anchorDate : (intern.startDate || 'N/A')}
                      </td>

                      <td>
                        <div style={{ fontSize: '0.815rem', color: 'var(--text-main)' }}>
                          {plan ? `${plan.taskCount} task${plan.taskCount === 1 ? '' : 's'}` : (
                            <span style={{ color: 'var(--text-muted)' }}>No active plan</span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {plan ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                            <div style={{ width: '60px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${plan.progressPercentage}%`,
                                  height: '100%',
                                  background: plan.status === 'Needs Attention' ? '#EF4444' : '#129FA9',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.735rem', fontWeight: 700 }}>
                              {plan.progressPercentage}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {plan ? (
                          <span
                            className="presence-badge"
                            style={
                              plan.status === 'Completed'
                                ? { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }
                                : plan.status === 'Needs Attention'
                                ? { backgroundColor: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }
                                : { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                            }
                          >
                            {plan.status}
                          </span>
                        ) : (
                          <span className="presence-badge" style={{ backgroundColor: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1' }}>
                            Not Started
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
