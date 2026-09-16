import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Select } from '../common/Select.jsx';
import { EXIT_TYPES } from '../../domain/formerDomain.js';

// Same All/Employees/Interns segmented pattern used by Personnel's DirectoryToolbar — values
// ('All'/'Employee'/'Intern') match formerService.getFormerDirectory()'s typeFilter and the
// hydrated employee.directoryType field exactly.
const PERSONNEL_TYPE_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'Employee', label: 'Employees' },
  { value: 'Intern', label: 'Interns' },
];

export default function FormerToolbar({
  search,
  onSearchChange,
  selectedType = 'All',
  onTypeChange,
  selectedDept,
  onDeptChange,
  selectedExitType,
  onExitTypeChange,
  selectedSort,
  onSortChange,
  onResetFilters,
  departments = [],
  hasActiveFilters = false,
}) {
  return (
    <div className="directory-toolbar-card">
      <div className="toolbar-search-row">
        <div className="toolbar-search-box">
          <Search size={18} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search Personnel ID, name, email, department..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="toolbar-controls-row">
        <div className="view-switcher-group" role="tablist" aria-label="Former personnel type filter">
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
      </div>

      <div className="toolbar-filters-row">
        {/* .former-filters-group is a 3-column modifier (Department / Exit Type / Sort By — fewer
            filters than Personnel's 5, so an even 1fr/1fr/1fr split, no hand-measured weights
            needed) on the same shared .filters-group class. */}
        <div className="filters-group former-filters-group">
          <div className="filter-item">
            <label htmlFor="former-dept-filter">Department:</label>
            <Select
              id="former-dept-filter"
              variant="filter"
              value={selectedDept}
              onChange={(e) => onDeptChange(e.target.value)}
              placeholder="All Departments"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>

          <div className="filter-item">
            <label htmlFor="former-exit-type-filter">Exit Type:</label>
            <Select
              id="former-exit-type-filter"
              variant="filter"
              value={selectedExitType}
              onChange={(e) => onExitTypeChange(e.target.value)}
              placeholder="All Exit Types"
              options={EXIT_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>

          <div className="filter-item">
            <label htmlFor="former-sort-select">Sort By:</label>
            <Select
              id="former-sort-select"
              variant="filter"
              value={selectedSort}
              onChange={(e) => onSortChange(e.target.value)}
              options={[
                { value: 'finalDate-desc', label: 'Final Working Date: Newest' },
                { value: 'finalDate-asc', label: 'Final Working Date: Oldest' },
                { value: 'name-asc', label: 'Name (A–Z)' },
                { value: 'name-desc', label: 'Name (Z–A)' },
              ]}
            />
          </div>
        </div>

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
