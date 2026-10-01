import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
} from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import Avatar from '../../components/common/Avatar.jsx';

const HISTORY_STATUS_STYLES = {
  Active: { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' },
  Offboarding: { backgroundColor: '#FFFBEB', color: '#D97706', borderColor: '#FDE68A' },
  Former: { backgroundColor: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' },
  Onboarding: { backgroundColor: '#E6F7F8', color: '#0E848D', borderColor: '#99E6EB' },
};

// Onboarding History — completed onboarding plans, kept for reference after people move on.
function OnboardingHistoryTable({ records, totalCount, loading, onOpen, onDelete, deletingId }) {
  return (
    <>
      <p className="onboarding-history-intro">
        Completed onboarding records, kept for reference after each person moves on.
      </p>

      <div className="table-container-card">
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading onboarding history...</div>
        ) : records.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={32} style={{ marginBottom: '0.5rem', color: 'var(--border-dark)' }} />
            <h3>{totalCount === 0 ? 'No Completed Onboarding Yet' : 'No Records Found'}</h3>
            <p style={{ fontSize: '0.85rem' }}>
              {totalCount === 0
                ? 'Completed onboarding plans will appear here once someone finishes onboarding.'
                : 'No completed onboarding records match the search.'}
            </p>
          </div>
        ) : (
          <div className="onboarding-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="presence-data-table onboarding-employees-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '29%', textAlign: 'left' }}>Intern</th>
                  <th style={{ width: '21%', textAlign: 'left' }}>Department</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Start Date</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Completed On</th>
                  <th style={{ width: '14%', textAlign: 'center' }}>Current Status</th>
                  <th style={{ width: '6%', textAlign: 'center' }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.planInstanceId}
                    className="presence-table-row"
                    onClick={() => onOpen(record)}
                    style={{ cursor: 'pointer' }}
                    title="Open the completed onboarding record"
                  >
                    <td>
                      <div className="emp-identity-block">
                        <Avatar
                          photoUrl={record.photoUrl}
                          initials={record.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                        />
                        <div className="emp-identity-text">
                          <div className="emp-name-text" style={{ whiteSpace: 'nowrap' }}>{record.fullName}</div>
                          <div className="emp-id-subtext">{record.refNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.815rem', color: 'var(--text-main)' }}>
                        {record.department?.name || 'Department N/A'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.815rem' }}>
                      {formatDateDisplay(String(record.anchorDate || ''))}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.815rem', fontWeight: 600 }}>
                      {record.completedAt ? formatDateDisplay(String(record.completedAt)) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="presence-badge" style={HISTORY_STATUS_STYLES[record.currentStatus] || HISTORY_STATUS_STYLES.Former}>
                        {record.currentStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="plan-task-icon-btn plan-task-icon-btn-danger"
                        title="Delete this onboarding record"
                        aria-label={`Delete the onboarding record for ${record.fullName}`}
                        disabled={deletingId === record.planInstanceId}
                        onClick={(e) => { e.stopPropagation(); onDelete(record); }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// The real intern roster (Interns DB), joined server-side with each person's local onboarding
// plan (onboardingService.getInternsProgress() / server/db/onboarding.js's
// listInternsForOnboardingProgress()). Read/display only: plans are launched at Accept. An
// Onboarding intern with no plan (e.g. added directly in the Interns DB, or Accept couldn't
// launch it) shows "Plan not launched" with the reason and a Launch Plan / Retry Launch button,
// which never creates a second plan (ensureOnboardingPlan()).
export default function OnboardingEmployeesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'history' ? 'history' : 'current';
  const setView = (next) => setSearchParams(next === 'history' ? { view: 'history' } : {});
  const [interns, setInterns] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [deletingHistoryId, setDeletingHistoryId] = useState(null);

  // Permanently deletes one completed onboarding record (plan + tasks). The person isn't affected.
  const handleDeleteHistory = async (record) => {
    const label = `${record.fullName}${record.refNumber ? ` (${record.refNumber})` : ''}`;
    if (!window.confirm(`Delete the completed onboarding record for ${label}?

This permanently removes their onboarding plan and its tasks from History. Their Personnel record and status are not affected. This can't be undone.`)) {
      return;
    }
    setDeletingHistoryId(record.planInstanceId);
    try {
      await onboardingService.deleteHistoryRecord(record.planInstanceId);
      await loadData();
    } catch (err) {
      alert(`Failed to delete the onboarding record: ${err.message}`);
    } finally {
      setDeletingHistoryId(null);
    }
  };
  const [loading, setLoading] = useState(true);
  // Launch Plan / Retry Launch state per intern: { busy, failedReason }.
  const [launchState, setLaunchState] = useState({});

  const handleLaunchPlan = async (intern) => {
    setLaunchState((prev) => ({ ...prev, [intern.internId]: { busy: true } }));
    try {
      const result = await onboardingService.ensurePlanForIntern(intern.internId);
      if (result.status === 'not_launched') {
        setLaunchState((prev) => ({ ...prev, [intern.internId]: { busy: false, failedReason: result.reason } }));
        return;
      }
      setLaunchState((prev) => ({ ...prev, [intern.internId]: undefined }));
      await loadData();
    } catch (err) {
      setLaunchState((prev) => ({ ...prev, [intern.internId]: { busy: false, failedReason: err.message || 'Could not launch the plan.' } }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // History failing (e.g. a slow Departments lookup) never blanks the current roster.
      const [roster, completed] = await Promise.all([
        onboardingService.getInternsProgress(),
        onboardingService.getOnboardingHistory().catch((err) => {
          console.error('Failed to load onboarding history:', err);
          return [];
        }),
      ]);
      setInterns(roster);
      setHistory(completed);
    } catch (err) {
      console.error('Failed to load interns:', err);
    } finally {
      setLoading(false);
    }
  };

  // Summary cards. Active = every current plan not yet completed (the overall workload), split into
  // In Progress (on track, including 0% plans) and Needs Attention (an overdue required task).
  // Completed = every completed onboarding plan, including people now Active/Offboarding/Former.
  const activeInterns = interns.filter((i) => i.plan && i.plan.status !== 'Completed');
  const inProgressCount = activeInterns.filter((i) => i.plan.status === 'In Progress').length;
  const needsAttentionCount = activeInterns.filter((i) => i.plan.status === 'Needs Attention').length;
  const completedCount = history.length;

  const visibleHistory = history.filter((record) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return record.fullName.toLowerCase().includes(q) || (record.refNumber || '').toLowerCase().includes(q);
  });

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
          <p className="directory-row-click-hint">
            <strong>Note:</strong> Click the Completed Plans card to view history.
          </p>
        </div>
      </div>

      {/* Metric KPI Summary Grid */}
      <div className="summary-cards-grid onboarding-summary-grid" style={{ marginBottom: '1.75rem' }}>
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
          <div className="summary-card-subtext">Workflows underway and on track</div>
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

        <button
          type="button"
          className={`summary-card summary-card-link ${view === 'history' ? 'is-selected' : ''}`}
          onClick={() => setView('history')}
          title="Open Onboarding History"
        >
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
          <div className="summary-card-subtext">Onboarding workflows completed</div>
        </button>
      </div>

      {/* Tabs on the left, search on the right — the search box filters whichever tab is open. */}
      <div className="underline-tabs onboarding-tabs-row" style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          className={`underline-tab-item ${view === 'current' ? 'active' : ''}`}
          onClick={() => setView('current')}
        >
          Current
          {activeInterns.length > 0 && <span className="underline-tab-badge underline-tab-badge-muted">{activeInterns.length}</span>}
        </button>
        <button
          type="button"
          className={`underline-tab-item ${view === 'history' ? 'active' : ''}`}
          onClick={() => setView('history')}
        >
          History
          {completedCount > 0 && <span className="underline-tab-badge underline-tab-badge-muted">{completedCount}</span>}
        </button>
        <div className="toolbar-search-box onboarding-tabs-search">
          <Search size={16} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder={view === 'history' ? 'Search name or ref number' : 'Search intern name or ref number'}
            value={view === 'history' ? historySearch : search}
            onChange={(e) => (view === 'history' ? setHistorySearch : setSearch)(e.target.value)}
          />
        </div>
      </div>

      {view === 'history' ? (
        <OnboardingHistoryTable
          records={visibleHistory}
          totalCount={history.length}
          loading={loading}
          onOpen={(record) => navigate(`/onboarding/employees/${record.employeeId}?from=history`)}
          onDelete={handleDeleteHistory}
          deletingId={deletingHistoryId}
        />
      ) : (
      <>

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
                  <th style={{ width: '30%', textAlign: 'left' }}>Intern</th>
                  <th style={{ width: '20%', textAlign: 'left' }}>Department</th>
                  <th style={{ width: '16%', textAlign: 'center' }}>Start Date</th>
                  <th style={{ width: '18%', textAlign: 'center' }}>Progress</th>
                  <th style={{ width: '16%', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleInterns.map((intern) => {
                  const plan = intern.plan;
                  const isClickable = Boolean(intern.localEmployeeId);
                  const launch = launchState[intern.internId];

                  return (
                    <tr
                      key={intern.internId}
                      className="presence-table-row"
                      onClick={isClickable ? () => navigate(`/onboarding/employees/${intern.localEmployeeId}`) : undefined}
                      style={isClickable ? { cursor: 'pointer' } : undefined}
                    >
                      <td>
                        <div className="emp-identity-block">
                          <Avatar
                            photoUrl={intern.photoUrl}
                            initials={intern.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                          />
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
                        {formatDateDisplay(String(plan ? plan.anchorDate : intern.startDate || ''))}
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
                          <button
                            type="button"
                            className="btn-primary onboarding-launch-btn"
                            disabled={launch?.busy}
                            onClick={(e) => { e.stopPropagation(); handleLaunchPlan(intern); }}
                            title="Launch this person's onboarding plan from the Universal + department tasks"
                          >
                            {launch?.busy ? 'Launching...' : launch?.failedReason ? 'Retry Launch' : 'Launch Plan'}
                          </button>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {plan ? (
                          <span
                            className="presence-badge"
                            style={
                              plan.status === 'Completed' || (plan.status === 'In Progress' && plan.progressPercentage > 0)
                                ? { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }
                                : plan.status === 'Needs Attention'
                                ? { backgroundColor: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }
                                : { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                            }
                          >
                            {plan.status === 'In Progress' && plan.progressPercentage === 0 ? 'Not Started' : plan.status}
                          </span>
                        ) : (
                          <div className="onboarding-launch-status">
                            <span className="presence-badge" style={{ backgroundColor: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' }}>
                              Plan not launched
                            </span>
                            {(launch?.failedReason || intern.launchIssue) && (
                              <span className="onboarding-launch-reason">{launch?.failedReason || intern.launchIssue}</span>
                            )}
                          </div>
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
      </>
      )}
    </div>
  );
}
