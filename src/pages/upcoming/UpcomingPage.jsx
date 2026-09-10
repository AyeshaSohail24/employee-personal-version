import React, { useCallback, useEffect, useState } from 'react';
import { List, LayoutGrid, Bell, Mail, Send, RefreshCw } from 'lucide-react';
import { upcomingCandidateService } from '../../services/upcomingCandidateService.js';
import { departmentService } from '../../services/departmentService.js';
import CandidateSummaryCards from '../../components/upcoming/CandidateSummaryCards.jsx';
import CandidateToolbar from '../../components/upcoming/CandidateToolbar.jsx';
import CandidateTable from '../../components/upcoming/CandidateTable.jsx';
import SendEmailModal from '../../components/upcoming/SendEmailModal.jsx';
import NotificationsPanel from '../../components/upcoming/NotificationsPanel.jsx';
import EmailDraftsPanel from '../../components/upcoming/EmailDraftsPanel.jsx';
import DirectoryEmptyState from '../../components/employees/DirectoryEmptyState.jsx';

export default function UpcomingPage() {
  const [activeTab, setActiveTab] = useState('candidates'); // 'candidates' | 'rejected' | 'drafts'

  const [allCandidates, setAllCandidates] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [summary, setSummary] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [offerType, setOfferType] = useState('All');
  const [emailStatus, setEmailStatus] = useState('All');
  const [responseStatus, setResponseStatus] = useState('All');

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sendModalCandidates, setSendModalCandidates] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    departmentService.getAll({ withCount: false }).then(setDepartments).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const scope = activeTab === 'rejected' ? 'rejected' : 'active';
      const [filtered, all, summaryData, unread] = await Promise.all([
        upcomingCandidateService.queryCandidates({ scope, search, departmentId, offerType, emailStatus, responseStatus }),
        upcomingCandidateService.getAll(),
        upcomingCandidateService.getSummary(),
        upcomingCandidateService.getUnreadReplyCount(),
      ]);
      setCandidates(filtered);
      setAllCandidates(all);
      setSummary(summaryData);
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to load Upcoming candidates:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, departmentId, offerType, emailStatus, responseStatus]);

  useEffect(() => {
    if (activeTab !== 'drafts') loadData();
  }, [loadData, activeTab]);

  // Selection never survives a tab switch or a filter-driven result change it no longer applies to
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  const handleResetFilters = () => {
    setSearch('');
    setDepartmentId('');
    setOfferType('All');
    setEmailStatus('All');
    setResponseStatus('All');
  };

  const hasActiveFilters = Boolean(search.trim()) || Boolean(departmentId) || offerType !== 'All' || emailStatus !== 'All' || responseStatus !== 'All';

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = (checked) => {
    setSelectedIds(checked ? new Set(candidates.map((c) => c.id)) : new Set());
  };

  const handleAccept = async (id) => {
    await upcomingCandidateService.acceptCandidate(id);
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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(candidate.id);
      return next;
    });
    await loadData();
  };

  const handleRestore = async (id) => {
    await upcomingCandidateService.restoreCandidate(id);
    await loadData();
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage('');
    try {
      await upcomingCandidateService.syncCandidates();
      await loadData();
      setSyncMessage('Candidate data refreshed');
    } catch (err) {
      setSyncMessage('Sync failed — please try again');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 2500);
    }
  };

  const handleOpenSendSelected = () => {
    const selected = candidates.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) return;
    setSendModalCandidates(selected);
  };

  const handleSendAllPending = () => {
    const pending = candidates.filter((c) => c.emailStatus === 'Pending');
    if (pending.length === 0) return;
    if (!window.confirm(`Send ${pending.length} Pending Email${pending.length === 1 ? '' : 's'}?\n\nThis opens the review screen for all candidates whose Email Status is currently Pending. Already Sent or Replied candidates will not be resent.`)) {
      return;
    }
    setSendModalCandidates(pending);
  };

  const handleSendComplete = async () => {
    setSelectedIds(new Set());
    await loadData();
  };

  const handleViewNotification = async (candidateId) => {
    await upcomingCandidateService.markNotificationRead(candidateId);
    await loadData();
  };

  const pendingCount = candidates.filter((c) => c.emailStatus === 'Pending').length;

  return (
    <div className="directory-page-wrapper">
      <div className="employees-page-header page-header">
        <div>
          <h1 className="page-title">Upcoming</h1>
          <p className="page-description">Shortlisted candidates and the pre-onboarding offer workflow</p>
        </div>
        <div className="header-actions">
          {syncMessage && <span className="sync-status-text">{syncMessage}</span>}
          <button type="button" className="btn-secondary btn-header-action" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw size={15} className={isSyncing ? 'icon-spin' : undefined} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Candidates'}</span>
          </button>
          <button
            type="button"
            className="btn-secondary btn-header-action candidate-notification-btn"
            onClick={() => setIsNotificationsOpen(true)}
          >
            <Bell size={15} />
            <span>Replies</span>
            {unreadCount > 0 && <span className="candidate-notification-badge">{unreadCount}</span>}
          </button>
          <button
            type="button"
            className="btn-secondary btn-header-action"
            onClick={() => setActiveTab('drafts')}
          >
            <Mail size={15} />
            <span>Email Drafts</span>
          </button>
          <button
            type="button"
            className="btn-primary btn-header-action"
            onClick={handleOpenSendSelected}
            disabled={activeTab !== 'candidates' || selectedIds.size === 0}
            title={selectedIds.size === 0 ? 'Select at least one candidate' : undefined}
          >
            <Send size={15} />
            <span>Send Email{selectedIds.size > 1 ? ` (${selectedIds.size})` : ''}</span>
          </button>
        </div>
      </div>

      <CandidateSummaryCards summary={summary} loading={loading && allCandidates.length === 0} />

      <div className="view-switcher-group candidate-tab-switcher">
        <button className={`view-btn ${activeTab === 'candidates' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('candidates')}>
          <List size={16} />
          <span>Candidates</span>
        </button>
        <button className={`view-btn ${activeTab === 'rejected' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('rejected')}>
          <LayoutGrid size={16} />
          <span>Rejected</span>
        </button>
        <button className={`view-btn ${activeTab === 'drafts' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('drafts')}>
          <Mail size={16} />
          <span>Email Drafts</span>
        </button>
      </div>

      {activeTab === 'drafts' ? (
        <EmailDraftsPanel />
      ) : (
        <>
          <CandidateToolbar
            search={search}
            onSearchChange={setSearch}
            selectedDept={departmentId}
            onDeptChange={setDepartmentId}
            selectedOfferType={offerType}
            onOfferTypeChange={setOfferType}
            selectedEmailStatus={emailStatus}
            onEmailStatusChange={setEmailStatus}
            selectedResponse={responseStatus}
            onResponseChange={setResponseStatus}
            onResetFilters={handleResetFilters}
            departments={departments}
            showResponseFilter={activeTab === 'candidates'}
            hasActiveFilters={hasActiveFilters}
          />

          {activeTab === 'candidates' && pendingCount > 0 && (
            <div className="send-all-pending-row">
              <span className="table-text-secondary">{pendingCount} candidate{pendingCount === 1 ? '' : 's'} with Pending emails</span>
              <button type="button" className="btn-primary btn-header-action" onClick={handleSendAllPending}>
                Send {pendingCount} Pending Email{pendingCount === 1 ? '' : 's'}
              </button>
            </div>
          )}

          <div style={{ marginTop: '1.25rem' }}>
            {loading ? (
              <div className="directory-table-card skeleton-box" style={{ height: '320px' }} />
            ) : candidates.length === 0 ? (
              <DirectoryEmptyState
                onResetFilters={handleResetFilters}
                message={activeTab === 'rejected' ? 'No rejected candidates.' : 'No candidates match the current search or filter criteria.'}
              />
            ) : (
              <CandidateTable
                candidates={candidates}
                mode={activeTab === 'rejected' ? 'rejected' : 'active'}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onAccept={handleAccept}
                onReject={handleReject}
                onUndoAccept={handleUndoAccept}
                onRestore={handleRestore}
              />
            )}
          </div>
        </>
      )}

      <SendEmailModal
        isOpen={Boolean(sendModalCandidates)}
        onClose={() => setSendModalCandidates(null)}
        candidates={sendModalCandidates || []}
        onSent={handleSendComplete}
      />

      <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        candidates={allCandidates}
        onView={handleViewNotification}
      />
    </div>
  );
}
