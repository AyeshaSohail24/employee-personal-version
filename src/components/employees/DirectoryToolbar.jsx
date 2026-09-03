import React from 'react';
import { Search, LayoutGrid, List, RotateCcw } from 'lucide-react';

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
              <select
                id="status-filter"
                className="filter-select"
                value={selectedStatus}
                onChange={(e) => onStatusChange(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Onboarding">Onboarding</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Departing">Departing</option>
                <option value="Former">Former</option>
              </select>
            </div>
          )}

          {/* Department Filter */}
          <div className="filter-item">
            <label htmlFor="dept-filter">Department:</label>
            <select
              id="dept-filter"
              className="filter-select"
              value={selectedDept}
              onChange={(e) => onDeptChange(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Employee Type Filter */}
          <div className="filter-item">
            <label htmlFor="type-filter">Type:</label>
            <select
              id="type-filter"
              className="filter-select"
              value={selectedType}
              onChange={(e) => onTypeChange(e.target.value)}
            >
              <option value="">All Types</option>
              {employeeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div className="filter-item">
            <label htmlFor="loc-filter">Location:</label>
            <select
              id="loc-filter"
              className="filter-select"
              value={selectedLoc}
              onChange={(e) => onLocChange(e.target.value)}
            >
              <option value="">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selection */}
          <div className="filter-item">
            <label htmlFor="sort-select">Sort By:</label>
            <select
              id="sort-select"
              className="filter-select"
              value={selectedSort}
              onChange={(e) => onSortChange(e.target.value)}
            >
              <option value="name-asc">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="date-desc">Start Date: Newest</option>
              <option value="date-asc">Start Date: Oldest</option>
            </select>
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
