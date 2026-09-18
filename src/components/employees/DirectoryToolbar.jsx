import React from 'react';
import { Search, LayoutGrid, List, GanttChartSquare, RotateCcw } from 'lucide-react';
import { Select } from '../common/Select.jsx';

// Personnel type segmented filter — replaces the old Type dropdown (Employee/Intern) with the
// same All/Employees/Interns pattern already used by the Dashboard's own personnel-type filter.
// Values ('All'/'Employee'/'Intern') match employeeService.queryEmployees()'s typeFilter and the
// hydrated employee.directoryType field exactly, so no value translation is needed anywhere.
const PERSONNEL_TYPE_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'Employee', label: 'Employees' },
  { value: 'Intern', label: 'Interns' },
];

export default function DirectoryToolbar({
  search,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedDept,
  onDeptChange,
  selectedType = 'All',
  onTypeChange,
  selectedMode = 'All',
  onModeChange,
  selectedSort,
  onSortChange,
  viewMode,
  onViewModeChange,
  onResetFilters,
  departments = [],
  statuses = [],
  showStatusFilter = false,
  hasActiveFilters = false,
}) {
  return (
    <div className="directory-toolbar-card">
      {/* Search — its own row (deliberately NOT sharing a row with the view-mode switcher
          anymore; see .toolbar-search-row's comment in index.css for why this uses a dedicated
          class rather than the shared .toolbar-top-row CandidateToolbar.jsx still uses). */}
      <div className="toolbar-search-row">
        <div className="toolbar-search-box">
          <Search size={18} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search ID, name, email, department..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Two independent high-level segmented controls, same row: All/Employees/Interns (WHICH
          personnel — left) and List/Card/Timeline (HOW they're displayed — right). Each reuses
          the exact same .view-switcher-group/.view-btn pattern (teal active-state styling) but
          they remain two separate groups, never merged into one control. */}
      <div className="toolbar-controls-row">
        <div className="view-switcher-group" role="tablist" aria-label="Personnel type filter">
          {PERSONNEL_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={selectedType === opt.value}
              className={`view-btn ${selectedType === opt.value ? 'active' : ''}`}
              onClick={() => onTypeChange(opt.value)}
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="view-switcher-group">
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="List View"
            type="button"
          >
            <List size={18} />
            <span>List</span>
          </button>
          <button
            className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => onViewModeChange('card')}
            title="Card View"
            type="button"
          >
            <LayoutGrid size={18} />
            <span>Card</span>
          </button>
          <button
            className={`view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => onViewModeChange('timeline')}
            title="Timeline View"
            type="button"
          >
            <GanttChartSquare size={18} />
            <span>Timeline</span>
          </button>
        </div>
      </div>

      {/* Detailed filters row — deliberately a NEW class (.toolbar-filters-row), not the shared
          .toolbar-bottom-row CandidateToolbar.jsx still uses. Stacks two independent sub-rows:
          the 4 filters (an explicit CSS Grid, always one row on desktop — see
          .personnel-filters-group's own comment in index.css for exactly how that's guaranteed),
          and, only when a filter is active, Reset Filters UNDERNEATH on its own row — never a
          grid item itself, so it can never consume a column or push Sort By out of the grid. */}
      <div className="toolbar-filters-row">
        {/* Filters Group — .personnel-filters-group is a Personnel-only modifier on the shared
            .filters-group class (still used as-is, unmodified, by CandidateToolbar.jsx); it
            switches this row from flex to an explicit 5-column CSS Grid. */}
        <div className="filters-group personnel-filters-group">
          {/* Department Filter */}
          <div className="filter-item">
            <label htmlFor="dept-filter">Department:</label>
            <Select
              id="dept-filter"
              variant="filter"
              value={selectedDept}
              onChange={(e) => onDeptChange(e.target.value)}
              placeholder="All Departments"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>

          {/* Mode Filter */}
          <div className="filter-item">
            <label htmlFor="mode-filter">Mode:</label>
            <Select
              id="mode-filter"
              variant="filter"
              value={selectedMode}
              onChange={(e) => onModeChange(e.target.value)}
              options={[
                { value: 'All', label: 'All Modes' },
                { value: 'On-site', label: 'On-site' },
                { value: 'Remote', label: 'Remote' },
                { value: 'Hybrid', label: 'Hybrid' },
              ]}
            />
          </div>

          {/* Status Filter (Only visible on /employees route) — options come from the Interns
              DB's own status vocabulary (GET /employees/statuses), not a hardcoded list; see
              that route's own doc comment in server/routes/employees.js for the Offboarding ->
              Departing mapping and why Upcoming is always added. 'All' stays a real option (not
              the Select's own placeholder, which would use value: '' instead) because
              statusFilter's existing "no filter" sentinel is the string 'All' everywhere else in
              this container (URL param default, hasActiveFilters, handleResetFilters). */}
          {showStatusFilter && (
            <div className="filter-item">
              <label htmlFor="status-filter">Status:</label>
              <Select
                id="status-filter"
                variant="filter"
                value={selectedStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                options={[{ value: 'All', label: 'All Statuses' }, ...statuses.map((s) => ({ value: s, label: s }))]}
              />
            </div>
          )}

          {/* Sort Selection */}
          <div className="filter-item">
            <label htmlFor="sort-select">Sort By:</label>
            <Select
              id="sort-select"
              variant="filter"
              value={selectedSort}
              onChange={(e) => onSortChange(e.target.value)}
              options={[
                { value: 'name-asc', label: 'Name (A–Z)' },
                { value: 'name-desc', label: 'Name (Z–A)' },
                { value: 'id-asc', label: 'ID (Ascending)' },
                { value: 'id-desc', label: 'ID (Descending)' },
                { value: 'date-desc', label: 'Start Date: Newest' },
                { value: 'date-asc', label: 'Start Date: Oldest' },
              ]}
            />
          </div>
        </div>

        {/* Reset Filters — its OWN row underneath the 5 filters (never a sibling competing for
            horizontal space on the same line), left-aligned with them, shown only when a filter
            is active. */}
        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={onResetFilters} type="button">
            <RotateCcw size={14} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
