import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Plus } from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { employeeTypeService } from '../../services/employeeTypeService';
import { locationService } from '../../services/locationService';
import { apiClient, ApiError } from '../../services/apiClient';

import DirectoryToolbar from './DirectoryToolbar';
import EmployeeListView from './EmployeeListView';
import EmployeeCardView from './EmployeeCardView';
import EmployeeTimelineView from './EmployeeTimelineView';
import DirectoryEmptyState from './DirectoryEmptyState';
import DirectorySkeleton from './DirectorySkeleton';
import CreateEmployeeModal from './CreateEmployeeModal';

export default function DirectoryPageContainer({
  title = 'Personnel Directory',
  description = 'Browse, filter, and manage Rizurf personnel records',
  baseLifecycleScope = 'All',
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [employees, setEmployees] = useState([]);
  const [baseCount, setBaseCount] = useState(0);
  const [totalFilteredCount, setTotalFilteredCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Read URL query parameters for initial state / deep linking
  const urlStatus = searchParams.get('status') || 'All';
  const urlDeptId = searchParams.get('departmentId') || '';
  const urlType = searchParams.get('type') || 'All';
  const urlMode = searchParams.get('mode') || 'All';

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [departmentId, setDepartmentId] = useState(urlDeptId);
  const [typeFilter, setTypeFilter] = useState(urlType);
  const [modeFilter, setModeFilter] = useState(urlMode);
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'card' | 'timeline'

  // Sync state if URL search parameters change externally
  useEffect(() => {
    setStatusFilter(urlStatus);
    setDepartmentId(urlDeptId);
    setTypeFilter(urlType);
    setModeFilter(urlMode);
  }, [urlStatus, urlDeptId, urlType, urlMode]);

  // Dropdown Options — read through to the real Departments service (department-zeta.vercel.app,
  // via GET /departments — server/routes/orgStructure.js), not the mock departmentService.js:
  // real employee records' department.id (server/db/employeeHydration.js) already comes from
  // there, so the filter's own option values have to match that same source or "Department"
  // filtering silently matches nothing.
  const [departments, setDepartments] = useState([]);

  const loadDepartments = useCallback(async () => {
    try {
      const { departments: depts } = await apiClient.get('/departments');
      setDepartments(depts);
    } catch (err) {
      console.error('Failed to load department filter options:', err);
    }
  }, []);

  // Status filter options — derived from the Interns DB's own status vocabulary (GET
  // /employees/statuses), not hardcoded; see that route's doc comment in
  // server/routes/employees.js for the Offboarding -> Departing mapping and why Upcoming is
  // always included even though the Interns DB has no equivalent stage.
  const [statuses, setStatuses] = useState([]);

  const loadStatuses = useCallback(async () => {
    try {
      const { statuses: list } = await apiClient.get('/employees/statuses');
      setStatuses(list);
    } catch (err) {
      console.error('Failed to load status filter options:', err);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
    loadStatuses();
  }, [loadDepartments, loadStatuses]);

  // Fetch queried employees whenever scope or filter states change
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeService.queryEmployees({
        baseLifecycleScope,
        statusFilter,
        departmentId,
        typeFilter,
        modeFilter,
        search,
        sortBy,
      });

      setEmployees(res.employees);
      setBaseCount(res.baseCount);
      setTotalFilteredCount(res.totalFilteredCount);
    } catch (err) {
      console.error('Failed to query employees:', err);
    } finally {
      setLoading(false);
    }
  }, [baseLifecycleScope, statusFilter, departmentId, typeFilter, modeFilter, search, sortBy]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Sync Employees: reconciles the roster from the Interns DB (employeeService.syncEmployees(),
  // POST /employees/sync), then re-reads the employee list AND both filter-option lists that
  // ultimately come from that same Interns DB — a department or status term added/renamed at
  // the source should show up here too, not just employees.
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage('');
    try {
      await employeeService.syncEmployees();
      await Promise.all([fetchEmployees(), loadDepartments(), loadStatuses()]);
      setSyncMessage('Personnel data refreshed');
    } catch (err) {
      console.error('Failed to sync employees:', err);
      // Surface the server's actual reason (e.g. "Your role does not permit write access.",
      // an Interns DB connectivity error) instead of a generic message that hides it — the
      // previous "Sync failed — please try again" gave no way to tell a permissions problem
      // from a real outage without opening DevTools.
      const detail = err instanceof ApiError && err.message ? err.message : null;
      setSyncMessage(detail ? `Sync failed — ${detail}` : 'Sync failed — please try again');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 6000);
    }
  };

  // Create Employee
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreateSubmit = async (employeeData, initialRecordData) => {
    await employeeService.createDirectoryEmployee(employeeData, initialRecordData);
    await fetchEmployees();
  };

  // Reset interactive filters & clear URL query parameters without overriding route baseLifecycleScope!
  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setDepartmentId('');
    setTypeFilter('All');
    setModeFilter('All');
    setSortBy('name-asc');
    setSearchParams({}); // Clears URL query parameters cleanly
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    (baseLifecycleScope === 'All' && statusFilter !== 'All') ||
    Boolean(departmentId) ||
    typeFilter !== 'All' ||
    modeFilter !== 'All' ||
    sortBy !== 'name-asc';

  // Result count formatting — "personnel" is already collective/plural, so it reads correctly
  // for any count (1 personnel, 18 personnel) without an "-s" suffix.
  const resultCountText =
    totalFilteredCount === baseCount
      ? `${baseCount} personnel`
      : `${totalFilteredCount} of ${baseCount} personnel (Filtered)`;

  return (
    <div className="directory-page-wrapper">
      {/* Header & Page Title */}
      <div className="employees-page-header page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
          {viewMode === 'list' && (
            <p className="directory-row-click-hint">Note: Click any personnel row to view their full details.</p>
          )}
        </div>
        <div className="header-actions">
          <div className="directory-count-badge">{resultCountText}</div>
          {syncMessage && <span className="sync-status-text">{syncMessage}</span>}
          <button
            type="button"
            className="btn-secondary btn-header-action"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw size={15} className={isSyncing ? 'icon-spin' : undefined} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Personnel'}</span>
          </button>
          <button
            type="button"
            className="btn-primary btn-header-action"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={15} />
            <span>Create Personnel</span>
          </button>
        </div>
      </div>

      {/* Toolbar controls */}
      <DirectoryToolbar
        search={search}
        onSearchChange={setSearch}
        selectedStatus={statusFilter}
        onStatusChange={(val) => {
          setStatusFilter(val);
          const nextParams = new URLSearchParams(searchParams);
          if (val && val !== 'All') {
            nextParams.set('status', val);
          } else {
            nextParams.delete('status');
          }
          setSearchParams(nextParams);
        }}
        selectedDept={departmentId}
        onDeptChange={(val) => {
          setDepartmentId(val);
          if (!val) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('departmentId');
            setSearchParams(nextParams);
          }
        }}
        selectedType={typeFilter}
        onTypeChange={setTypeFilter}
        selectedMode={modeFilter}
        onModeChange={setModeFilter}
        selectedSort={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onResetFilters={handleResetFilters}
        departments={departments}
        statuses={statuses}
        showStatusFilter={baseLifecycleScope === 'All'}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Directory Views / Loading / Empty States */}
      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <DirectorySkeleton viewMode={viewMode} />
        ) : employees.length === 0 ? (
          <DirectoryEmptyState onResetFilters={handleResetFilters} />
        ) : viewMode === 'list' ? (
          <EmployeeListView employees={employees} />
        ) : viewMode === 'card' ? (
          <EmployeeCardView employees={employees} />
        ) : (
          <EmployeeTimelineView employees={employees} />
        )}
      </div>

      {/* Create Personnel Modal */}
      <CreateEmployeeModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />
    </div>
  );
}
