import React from 'react';
import { Search, LayoutGrid, List, RotateCcw } from 'lucide-react';
import { Select } from '../common/Select.jsx';

export default function DirectoryToolbar({
  search,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedDept,
  onDeptChange,
  selectedType,
  onTypeChange,
  selectedLoc,
  onLocChange,
  selectedSort,
  onSortChange,
  viewMode,
  onViewModeChange,
  onResetFilters,
  departments = [],
  employeeTypes = [],
  locations = [],
  showStatusFilter = false,
  hasActiveFilters = false,
}) {
  return (
    <div className="directory-toolbar-card">
      <div className="toolbar-top-row">
        {/* Search Input */}
        <div className="toolbar-search-box">
          <Search size={18} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search by name, ID, position, department, email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* View Switcher Toggle */}
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
        </div>
      </div>

      <div className="toolbar-bottom-row">
        {/* Filters Group */}
        <div className="filters-group">
          {/* Status Filter (Only visible on /employees route) */}
          {showStatusFilter && (
            <div className="filter-item">
              <label htmlFor="status-filter">Status:</label>
              <Select
                id="status-filter"
                variant="filter"
                value={selectedStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                options={[
                  { value: 'All', label: 'All Statuses' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Onboarding', label: 'Onboarding' },
                  { value: 'Upcoming', label: 'Upcoming' },
                  { value: 'Departing', label: 'Departing' },
                  { value: 'Former', label: 'Former' },
                ]}
              />
            </div>
          )}

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

          {/* Employee Type Filter */}
          <div className="filter-item">
            <label htmlFor="type-filter">Type:</label>
            <Select
              id="type-filter"
              variant="filter"
              value={selectedType}
              onChange={(e) => onTypeChange(e.target.value)}
              placeholder="All Types"
              options={employeeTypes.map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>

          {/* Location Filter */}
          <div className="filter-item">
            <label htmlFor="loc-filter">Location:</label>
            <Select
              id="loc-filter"
              variant="filter"
              value={selectedLoc}
              onChange={(e) => onLocChange(e.target.value)}
              placeholder="All Locations"
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
            />
          </div>

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
                { value: 'date-desc', label: 'Start Date: Newest' },
                { value: 'date-asc', label: 'Start Date: Oldest' },
              ]}
            />
          </div>
        </div>

        {/* Clear Filters Button */}
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
