import React, { useState, useEffect, useCallback } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { presenceService } from '../../services/presenceService';
import { departmentService } from '../../services/departmentService';
import PresenceSummaryCards from '../../components/presence/PresenceSummaryCards';
import PresenceTable from '../../components/presence/PresenceTable';
import OverrideModal from '../../components/presence/OverrideModal';
import OverrideHistoryModal from '../../components/presence/OverrideHistoryModal';
import PresenceSkeleton from '../../components/presence/PresenceSkeleton';

export default function PresencePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [presenceStateFilter, setPresenceStateFilter] = useState('All');
  const [departmentId, setDepartmentId] = useState('');
  const [workModeFilter, setWorkModeFilter] = useState('All');

  // Modal States
  const [overrideEmp, setOverrideEmp] = useState(null);
  const [historyEmp, setHistoryEmp] = useState(null);

  // Dropdown Options
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    async function loadDepts() {
      try {
        const list = await departmentService.getAll({ withCount: false });
        setDepartments(list);
      } catch (err) {
        console.error('Failed to load departments for presence page:', err);
      }
    }
    loadDepts();
  }, []);

  const fetchPresenceData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await presenceService.getPresenceOverview({
        search,
        presenceStateFilter,
        departmentId,
        workModeFilter,
        referenceDate: '2026-09-03',
      });
      setData(res);
    } catch (err) {
      console.error('Failed to fetch presence overview:', err);
    } finally {
      setLoading(false);
    }
  }, [search, presenceStateFilter, departmentId, workModeFilter]);

  useEffect(() => {
    fetchPresenceData();
  }, [fetchPresenceData]);

  // Actions
  const handleApplyOverride = async (overrideData) => {
    await presenceService.createPresenceOverride(overrideData);
    await fetchPresenceData();
  };

  const handleClearOverride = async (empId) => {
    await presenceService.clearPresenceOverride(empId, 'Ayesha Z. (HR Admin)');
    await fetchPresenceData();
  };

  const handleResetFilters = () => {
    setSearch('');
    setPresenceStateFilter('All');
    setDepartmentId('');
    setWorkModeFilter('All');
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    presenceStateFilter !== 'All' ||
    Boolean(departmentId) ||
    workModeFilter !== 'All';

  return (
    <div className="presence-page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Work Status & Presence</h1>
          <p className="page-description">
            Real-time operational presence overview, work mode policies, and manual audit overrides
          </p>
        </div>
        <div className="directory-count-badge">
          {data ? `${data.filteredCount} of ${data.totalCount} employees` : '15 employees'}
        </div>
      </div>

      {/* Summary KPI Cards */}
      {data && (
        <PresenceSummaryCards
          summary={data.summary}
          selectedFilter={presenceStateFilter}
          onSelectFilter={setPresenceStateFilter}
        />
      )}

      {/* Toolbar Controls */}
      <div className="directory-toolbar-card" style={{ marginTop: '1.5rem', marginBottom: '1.25rem' }}>
        <div className="toolbar-top-row">
          {/* Search Box */}
          <div className="toolbar-search-box">
            <Search size={18} className="toolbar-search-icon" />
            <input
              type="text"
              className="toolbar-search-input"
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Presence State Filter */}
          <div className="filter-item">
            <label htmlFor="presence-state-filter">Presence State:</label>
            <select
              id="presence-state-filter"
              className="filter-select"
              value={presenceStateFilter}
              onChange={(e) => setPresenceStateFilter(e.target.value)}
            >
              <option value="All">All States</option>
              <option value="Present">Present</option>
              <option value="Remote">Remote</option>
              <option value="On Leave">On Leave</option>
              <option value="Absent">Absent</option>
              <option value="Not Scheduled">Not Scheduled</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="filter-item">
            <label htmlFor="dept-filter">Department:</label>
            <select
              id="dept-filter"
              className="filter-select"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Work Mode Filter */}
          <div className="filter-item">
            <label htmlFor="workmode-filter">Work Mode:</label>
            <select
              id="workmode-filter"
              className="filter-select"
              value={workModeFilter}
              onChange={(e) => setWorkModeFilter(e.target.value)}
            >
              <option value="All">All Modes</option>
              <option value="On-site">On-site</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button type="button" className="btn-reset-filters" onClick={handleResetFilters}>
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table / Loading */}
      {loading ? (
        <PresenceSkeleton />
      ) : !data || data.employees.length === 0 ? (
        <div className="directory-empty-card">
          <p className="empty-title">No matching presence records found</p>
          <p className="empty-description">Try adjusting your search criteria or presence filters.</p>
          <button type="button" className="empty-reset-btn" onClick={handleResetFilters}>
            Reset All Filters
          </button>
        </div>
      ) : (
        <PresenceTable
          employees={data.employees}
          onOpenOverride={setOverrideEmp}
          onClearOverride={handleClearOverride}
          onOpenHistory={setHistoryEmp}
        />
      )}

      {/* Override Modal */}
      {overrideEmp && (
        <OverrideModal
          employee={overrideEmp}
          onClose={() => setOverrideEmp(null)}
          onSubmit={handleApplyOverride}
        />
      )}

      {/* Override History Modal */}
      {historyEmp && (
        <OverrideHistoryModal
          employee={historyEmp}
          onClose={() => setHistoryEmp(null)}
        />
      )}
    </div>
  );
}
