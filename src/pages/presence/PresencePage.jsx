import React, { useState, useEffect, useCallback } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { presenceService } from '../../services/presenceService';
import { departmentService } from '../../services/departmentService';
import PresenceSummaryCards from '../../components/presence/PresenceSummaryCards';
import PresenceTable from '../../components/presence/PresenceTable';
import OverrideModal from '../../components/presence/OverrideModal';
import OverrideHistoryModal from '../../components/presence/OverrideHistoryModal';
import PresenceSkeleton from '../../components/presence/PresenceSkeleton';
import { Select } from '../../components/common/Select.jsx';

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
            <Select
              id="presence-state-filter"
              variant="filter"
              value={presenceStateFilter}
              onChange={(e) => setPresenceStateFilter(e.target.value)}
              options={[
                { value: 'All', label: 'All States' },
                { value: 'Present', label: 'Present' },
                { value: 'Remote', label: 'Remote' },
                { value: 'On Leave', label: 'On Leave' },
                { value: 'Absent', label: 'Absent' },
                { value: 'Not Scheduled', label: 'Not Scheduled' },
                { value: 'Unknown', label: 'Unknown' },
              ]}
            />
          </div>

          {/* Department Filter */}
          <div className="filter-item">
            <label htmlFor="dept-filter">Department:</label>
            <Select
              id="dept-filter"
              variant="filter"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="All Departments"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>

          {/* Work Mode Filter */}
          <div className="filter-item">
            <label htmlFor="workmode-filter">Work Mode:</label>
            <Select
              id="workmode-filter"
              variant="filter"
              value={workModeFilter}
              onChange={(e) => setWorkModeFilter(e.target.value)}
              options={[
                { value: 'All', label: 'All Modes' },
                { value: 'On-site', label: 'On-site' },
                { value: 'Remote', label: 'Remote' },
                { value: 'Hybrid', label: 'Hybrid' },
              ]}
            />
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
