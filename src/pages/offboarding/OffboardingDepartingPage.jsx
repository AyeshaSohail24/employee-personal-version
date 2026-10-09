import React, { useState, useEffect } from 'react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
} from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import Avatar from '../../components/common/Avatar.jsx';

const HISTORY_STATUS_STYLES = {
  Active: { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' },
  Offboarding: { backgroundColor: '#FFFBEB', color: '#D97706', borderColor: '#FDE68A' },
  Former: { backgroundColor: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' },
  Onboarding: { backgroundColor: 'var(--color-primary-light)', color: 'var(--primary-600)', borderColor: 'var(--color-primary-border)' },
};

// Offboarding History — completed offboarding plans, kept for reference after people move on to
// Former (mirrors Onboarding → Progress's History; its own data from GET /offboarding/history).
function OffboardingHistoryTable({ records, totalCount, loading, onOpen, onDelete, deletingId }) {
  return (
    <>
      <p className="onboarding-history-intro">
        Completed offboarding records, kept for reference after each person moves on.
      </p>

      <div className="table-container-card">
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading offboarding history...</div>
        ) : records.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={32} style={{ marginBottom: '0.5rem', color: 'var(--border-dark)' }} />
            <h3>{totalCount === 0 ? 'No Completed Offboarding Yet' : 'No Records Found'}</h3>
            <p style={{ fontSize: '0.85rem' }}>
              {totalCount === 0
                ? 'Completed offboarding plans will appear here once someone finishes offboarding.'
                : 'No completed offboarding records match the search.'}
            </p>
          </div>
        ) : (
          <div className="onboarding-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="presence-data-table onboarding-employees-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '28%', textAlign: 'left' }}>Intern</th>
                  <th style={{ width: '20%', textAlign: 'left' }}>Department</th>
                  <th style={{ width: '16%', textAlign: 'center' }}>Final Working Date</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Completed On</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Current Status</th>
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
                    title="Open the completed offboarding record"
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
                      {/* Still in Offboarding: a new plan would be launched automatically, so the
                          record can only be deleted once they've moved on (server refuses too). */}
                      <button
                        type="button"
                        className="plan-task-icon-btn plan-task-icon-btn-danger"
                        title={record.currentStatus === 'Offboarding'
                          ? "Can be deleted once they're no longer in Offboarding — deleting it now would launch a new offboarding plan for them"
                          : 'Delete this offboarding record'}
                        aria-label={`Delete the offboarding record for ${record.fullName}`}
                        disabled={deletingId === record.planInstanceId || record.currentStatus === 'Offboarding'}
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

// The real intern roster (Interns DB), joined server-side with whatever local offboarding plan each
// person has — see offboardingService.getInternsProgress() / server/db/internSync.js. Plans are
// launched automatically once someone is in Offboarding (internSync.js's autoLaunchOffboardingPlans()).
// The Current tab only lists people the Interns DB has in Offboarding right now; History lists every
// completed offboarding plan from this app's own tables, so it's kept after someone becomes Former.
export default function OffboardingDepartingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'history' ? 'history' : 'current';
  const setView = (next) => setSearchParams(next === 'history' ? { view: 'history' } : {});
  const [interns, setInterns] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [deletingHistoryId, setDeletingHistoryId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Permanently deletes one completed offboarding record (plan + tasks). The person isn't affected.
  const handleDeleteHistory = async (record) => {
    const label = `${record.fullName}${record.refNumber ? ` (${record.refNumber})` : ''}`;
    if (!window.confirm(`Delete the completed offboarding record for ${label}?

This permanently removes their offboarding plan and its tasks from History. Their Personnel record, status and end date are not affected. This can't be undone.`)) {
      return;
    }
    setDeletingHistoryId(record.planInstanceId);
    try {
      await offboardingService.deleteHistoryRecord(record.planInstanceId);
      await loadData();
    } catch (err) {
      alert(`Failed to delete the offboarding record: ${err.message}`);
    } finally {
      setDeletingHistoryId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // `silent` (the automatic refresh): no loading screen, and anything that fails to load keeps
  // what's shown (including History).
  const loadData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      // History failing (e.g. a slow Departments lookup) never blanks the current roster.
      const [roster, completed] = await Promise.all([
        offboardingService.getInternsProgress(),
        offboardingService.getOffboardingHistory().catch((err) => {
          console.error('Failed to load offboarding history:', err);
          return silent ? null : [];
        }),
      ]);
      setInterns(roster);
      if (completed) setHistory(completed);
    } catch (err) {
      console.error('Failed to load interns:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Re-read the live roster every 10 minutes while the tab is visible (src/hooks/useAutoRefresh.js).
  useAutoRefresh(() => loadData({ silent: true }));

  // Summary card metrics. Completed = every completed offboarding plan (History), including people
  // now Former — not only those still in the current roster.
  const activeInterns = interns.filter((i) => i.plan && i.plan.status !== 'Completed');
  const inProgressCount = interns.filter((i) => i.plan?.status === 'In Progress').length;
  const needsAttentionCount = interns.filter((i) => i.plan?.status === 'Needs Attention').length;
  const completedCount = history.length;

  const visibleHistory = history.filter((record) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return record.fullName.toLowerCase().includes(q) || (record.refNumber || '').toLowerCase().includes(q);
  });

  // Current tab: a completed plan moves to History only (like Onboarding, where completing moves the
  // person on to Active). The Interns DB keeps them in Offboarding until their end date, so the
  // roster still returns them — they're just not listed here.
  const visibleInterns = interns.filter((intern) => {
    if (intern.plan?.status === 'Completed') return false;
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
          <h1 className="page-title">Offboarding Progress</h1>
          <p className="page-subtitle">
            View and track individual offboarding progress for interns.
          </p>
          <p className="directory-row-click-hint">
            <strong>Note:</strong> Click the Completed Exit Plans card to view history.
          </p>
        </div>
      </div>

      {/* Metric KPI Summary Grid */}
      <div className="summary-cards-grid onboarding-summary-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Active Exit Plans</span>
            <div
              className="summary-card-icon"
              style={{
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary-active)',
                borderColor: 'var(--color-primary-border)',
              }}
            >
              <Users size={17} />
            </div>
          </div>
          <div className="summary-card-value" style={{ color: 'var(--color-primary-active)' }}>
            {activeInterns.length}
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

        <button
          type="button"
          className={`summary-card summary-card-link ${view === 'history' ? 'is-selected' : ''}`}
          onClick={() => setView('history')}
          title="Open Offboarding History"
        >
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
          <div className="summary-card-subtext">Offboarding workflows completed</div>
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
        <OffboardingHistoryTable
          records={visibleHistory}
          totalCount={history.length}
          loading={loading}
          onOpen={(record) => navigate(`/offboarding/employees/${record.employeeId}?from=history`)}
          onDelete={handleDeleteHistory}
          deletingId={deletingHistoryId}
        />
      ) : (
      <>

      {/* Progress Table */}
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
                  <th style={{ width: '28%', textAlign: 'left' }}>Intern</th>
                  <th style={{ width: '18%', textAlign: 'left' }}>Department</th>
                  <th style={{ width: '18%', textAlign: 'center' }}>Final Working Date</th>
                  <th style={{ width: '18%', textAlign: 'center' }}>Progress</th>
                  <th style={{ width: '18%', textAlign: 'center' }}>Status</th>
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
                      onClick={isClickable ? () => navigate(`/offboarding/employees/${intern.localEmployeeId}`) : undefined}
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
                        {formatDateDisplay(String(plan ? plan.anchorDate : intern.endDate || ''))}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {plan ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                            <div style={{ width: '60px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${plan.progressPercentage}%`,
                                  height: '100%',
                                  background: plan.status === 'Needs Attention' ? 'var(--down)' : plan.status === 'Completed' ? 'var(--ok)' : 'var(--primary)',
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
                              plan.status === 'Completed' || plan.status === 'In Progress'
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
      </>
      )}
    </div>
  );
}
