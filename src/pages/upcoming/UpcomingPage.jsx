import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, X, CheckCircle2 } from 'lucide-react';
import { upcomingCandidateService } from '../../services/upcomingCandidateService.js';
import { candidateEmailService } from '../../services/candidateEmailService.js';
import { apiClient } from '../../services/apiClient.js';
import { sortCandidates } from '../../domain/candidateDomain.js';
import CandidateTable from '../../components/upcoming/CandidateTable.jsx';
import CandidateSearchResults from '../../components/upcoming/CandidateSearchResults.jsx';
import DirectoryEmptyState from '../../components/employees/DirectoryEmptyState.jsx';
import EmailDraftsPanel from '../../components/upcoming/EmailDraftsPanel.jsx';
import AcceptCandidateModal from '../../components/upcoming/AcceptCandidateModal.jsx';
import { Select } from '../../components/common/Select.jsx';

const PAGE_TABS = [
  { key: 'messages', label: 'Messages' },
  { key: 'drafts', label: 'Email Drafts' },
];

const SORT_FIELD_OPTIONS = [
  { value: 'date', label: 'Shortlisted' },
  { value: 'name', label: 'Name' },
  { value: 'dept', label: 'Department' },
];

const SORT_DIRECTION_OPTIONS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
];

// An "unseen" candidate is one whose reply hasn't been reviewed yet (emailStatus 'Replied' with
// notificationRead still false) — the same condition that drives the row highlight in
// CandidateTable, so the tab and the highlight always agree on what counts as new/urgent.
function isUnseen(candidate) {
  return candidate.emailStatus === 'Replied' && !candidate.notificationRead;
}

const STATUS_TABS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'sent', label: 'Sent', match: (c) => c.emailStatus === 'Sent' },
  { key: 'received', label: 'Received', match: (c) => c.emailStatus === 'Replied' },
  { key: 'unseen', label: 'Unseen', match: isUnseen },
];

export default function UpcomingPage() {
  const [pageTab, setPageTab] = useState('messages');
  const [allCandidates, setAllCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusTab, setStatusTab] = useState('all');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState([]);

  // The real Departments service (GET /departments), not the mock departmentService — each
  // candidate's department.id is matched against this same list server-side
  // (server/db/upcomingCandidates.js), so the filter's values line up with the candidates'.
  useEffect(() => {
    apiClient.get('/departments')
      .then(({ departments: list }) => setDepartments(list))
      .catch((err) => console.error('Failed to load department filter options:', err));
  }, []);

  const fetchAll = useCallback(() => upcomingCandidateService.queryCandidates({ scope: 'active' }), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setAllCandidates(await fetchAll());
    } catch (err) {
      console.error('Failed to load Upcoming candidates:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Manual refresh — reuses the same fetch as loadData() but never flips `loading`, so the
  // table stays visible (only the icon spins) instead of flashing back to the skeleton.
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      setAllCandidates(await fetchAll());
    } catch (err) {
      console.error('Failed to refresh Upcoming candidates:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const unseenCount = useMemo(() => allCandidates.filter(isUnseen).length, [allCandidates]);

  const candidates = useMemo(() => {
    const tab = STATUS_TABS.find((t) => t.key === statusTab) || STATUS_TABS[0];
    let filtered = allCandidates.filter(tab.match);

    if (departmentFilter) {
      filtered = filtered.filter((c) => c.department && c.department.id === departmentFilter);
    }

    return sortCandidates(filtered, `${sortField}-${sortDirection}`);
  }, [allCandidates, statusTab, departmentFilter, sortField, sortDirection]);

  const isSearchActive = search.trim().length > 0;

  // Gmail-style search: matches name, email, AND full message content (subject/body across
  // every sent/received message in each candidate's thread) via candidateEmailService, not just
  // the fields on the candidate record — debounced since it fetches each candidate's thread.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return undefined;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      candidateEmailService.searchCandidates(q)
        .then(setSearchResults)
        .catch((err) => console.error('Candidate search failed:', err))
        .finally(() => setIsSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Accept opens the Accept form (AcceptCandidateModal): on success the candidate is now an
  // Onboarding intern, so they drop out of this list on the reload below.
  const [acceptingCandidate, setAcceptingCandidate] = useState(null);
  const [acceptedMessage, setAcceptedMessage] = useState('');

  const handleAccept = (candidate) => {
    setAcceptedMessage('');
    setAcceptingCandidate(candidate);
  };

  const handleAccepted = async (result) => {
    const name = acceptingCandidate?.fullName || 'The candidate';
    setAcceptingCandidate(null);
    const ref = result?.intern?.refNumber ? ` as ${result.intern.refNumber}` : '';
    setAcceptedMessage(`${name} was added to the Interns database${ref} and is now in Onboarding and Personnel.`);
    await loadData();
  };

  const handleUndoAccept = async (candidate) => {
    if (!window.confirm(`Undo acceptance for ${candidate.fullName}?\n\nThis will move the candidate back to Awaiting Response. Email history and reply status will be preserved.`)) {
      return;
    }
    await upcomingCandidateService.undoAcceptCandidate(candidate.id);
    await loadData();
  };

  const handleReject = async (candidate) => {
    if (!window.confirm(`Move candidate to Rejected?\n\n${candidate.fullName} will be removed from the active Candidates pipeline and preserved in the Rejected tab.`)) {
      return;
    }
    await upcomingCandidateService.rejectCandidate(candidate.id);
    await loadData();
  };

  return (
    <div className="directory-page-wrapper">
      <div className="employees-page-header page-header">
        <div>
          <h1 className="page-title">Upcoming Personnel</h1>
          <p className="page-description">Shortlisted candidates and the pre-onboarding offer workflow</p>
          <p className="directory-row-click-hint">Note: Click on a candidate’s name to open their conversation and send an email directly.</p>
          <p className="directory-row-click-hint">
            Message filters: <strong>All</strong> = all candidate conversations | <strong>Sent</strong> = messages sent to candidates | <strong>Received</strong> = messages received from candidates | <strong>Unseen</strong> = conversations with new messages not yet viewed.
          </p>
        </div>
      </div>

      {acceptingCandidate && (
        <AcceptCandidateModal
          candidate={acceptingCandidate}
          onClose={() => setAcceptingCandidate(null)}
          onAccepted={handleAccepted}
        />
      )}
      {acceptedMessage && (
        <div className="sync-status-text" role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0 0 1rem' }}>
          <CheckCircle2 size={15} />
          <span>{acceptedMessage}</span>
          <button type="button" className="modal-close-btn" aria-label="Dismiss" onClick={() => setAcceptedMessage('')}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="underline-tabs">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`underline-tab-item ${pageTab === tab.key ? 'active' : ''}`}
            onClick={() => setPageTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {pageTab === 'drafts' ? (
        <div style={{ marginTop: '1.25rem' }}>
          <EmailDraftsPanel />
        </div>
      ) : (
      <>
      <div className="toolbar-search-box" style={{ marginTop: '1.25rem' }}>
        <Search size={18} className="toolbar-search-icon" />
        <input
          type="text"
          className="toolbar-search-input"
          placeholder="Search name, email, or message..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={isSearchActive ? { paddingRight: '2.25rem' } : undefined}
        />
        {isSearchActive && (
          <button type="button" className="toolbar-search-clear-btn" onClick={() => setSearch('')} title="Clear search">
            <X size={15} />
          </button>
        )}
      </div>

      {isSearchActive ? (
        <div style={{ marginTop: '1.25rem' }}>
          {isSearching ? (
            <div className="directory-table-card skeleton-box" style={{ height: '220px' }} />
          ) : (
            <CandidateSearchResults results={searchResults} query={search.trim()} />
          )}
        </div>
      ) : (
        <>
          <div className="filters-group" style={{ marginTop: '1.25rem' }}>
            <div className="filter-item">
              <label htmlFor="cand-sort-field">Sort by:</label>
              <Select
                id="cand-sort-field"
                variant="filter"
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                options={SORT_FIELD_OPTIONS}
              />
            </div>
            <div className="filter-item">
              <label htmlFor="cand-sort-direction">Order:</label>
              <Select
                id="cand-sort-direction"
                variant="filter"
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value)}
                options={SORT_DIRECTION_OPTIONS}
              />
            </div>
            <div className="filter-item">
              <label htmlFor="cand-dept-filter">Department:</label>
              <Select
                id="cand-dept-filter"
                variant="filter"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                placeholder="All Departments"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </div>
          </div>

          <div className="underline-tabs">
            <button
              type="button"
              className="underline-tab-refresh-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh candidates"
            >
              <RefreshCw size={15} className={isRefreshing ? 'icon-spin' : undefined} />
            </button>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`underline-tab-item ${statusTab === tab.key ? 'active' : ''}`}
                onClick={() => setStatusTab(tab.key)}
              >
                {tab.label}
                {tab.key === 'unseen' && unseenCount > 0 && (
                  <span className="underline-tab-badge">{unseenCount}</span>
                )}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            {loading ? (
              <div className="directory-table-card skeleton-box" style={{ height: '320px' }} />
            ) : candidates.length === 0 ? (
              <DirectoryEmptyState message="No candidates match the current search or filter criteria." />
            ) : (
              <CandidateTable
                candidates={candidates}
                mode="active"
                onAccept={handleAccept}
                onReject={handleReject}
                onUndoAccept={handleUndoAccept}
              />
            )}
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
