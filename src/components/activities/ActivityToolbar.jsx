import React from 'react';
import { Search, Plus, RotateCcw, Filter } from 'lucide-react';

export default function ActivityToolbar({
  scope = 'all', // 'my' | 'all' | 'overdue'
  filters = {},
  setFilters,
  onResetFilters,
  onOpenCreateModal,
  activityTypes = [],
  employees = [],
  canCreate = true,
}) {
  const handleSearchChange = (e) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
  };

  const handleSelectChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const isMyView = scope === 'my';
  const isOverdueView = scope === 'overdue';

  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.typeId) ||
    Boolean(filters.assigneeId) ||
    Boolean(filters.employeeId) ||
    Boolean(filters.dueState) ||
    Boolean(filters.source);

  return (
    <div className="directory-toolbar-card">
      <div className="toolbar-top-row">
        {/* Search Input */}
        <div className="toolbar-search-box">
          <Search className="toolbar-search-icon" size={16} />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search activities by title, notes, employee or assignee..."
            value={filters.search || ''}
            onChange={handleSearchChange}
          />
        </div>

        {/* Create Activity Button */}
        {canCreate && (
          <button type="button" className="btn-primary" onClick={onOpenCreateModal}>
            <Plus size={16} style={{ marginRight: '0.35rem' }} />
            <span>Create Activity</span>
          </button>
        )}
      </div>

      <div className="toolbar-bottom-row">
        <div className="filters-group">
          <Filter size={15} style={{ color: 'var(--text-muted)' }} />

          {/* Activity Type Filter */}
          <div className="filter-item">
            <span>Type:</span>
            <select
              className="filter-select"
              value={filters.typeId || ''}
              onChange={(e) => handleSelectChange('typeId', e.target.value)}
            >
              <option value="">All Types</option>
              {activityTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee Filter (Hidden on 'my' view) */}
          {!isMyView && (
            <div className="filter-item">
              <span>Assignee:</span>
              <select
                className="filter-select"
                value={filters.assigneeId || ''}
                onChange={(e) => handleSelectChange('assigneeId', e.target.value)}
              >
                <option value="">All Assignees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Related Employee Filter */}
          <div className="filter-item">
            <span>Related To:</span>
            <select
              className="filter-select"
              value={filters.employeeId || ''}
              onChange={(e) => handleSelectChange('employeeId', e.target.value)}
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.status})
                </option>
              ))}
            </select>
          </div>

          {/* Due State Filter (Hidden on 'overdue' view) */}
          {!isOverdueView && (
            <div className="filter-item">
              <span>Status:</span>
              <select
                className="filter-select"
                value={filters.dueState || ''}
                onChange={(e) => handleSelectChange('dueState', e.target.value)}
              >
                <option value="">All States</option>
                <option value="Overdue">Overdue</option>
                <option value="Due Today">Due Today</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          )}

          {/* Source Filter */}
          <div className="filter-item">
            <span>Source:</span>
            <select
              className="filter-select"
              value={filters.source || ''}
              onChange={(e) => handleSelectChange('source', e.target.value)}
            >
              <option value="">All Sources</option>
              <option value="Manual">Manual</option>
              <option value="Onboarding">Onboarding</option>
              <option value="Offboarding">Offboarding</option>
              <option value="System">System</option>
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button type="button" className="clear-filters-btn" onClick={onResetFilters}>
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="filter-item">
          <span>Sort By:</span>
          <select
            className="filter-select"
            value={filters.sortBy || 'dueDate'}
            onChange={(e) => handleSelectChange('sortBy', e.target.value)}
          >
            <option value="dueDate">Due Date (Earliest)</option>
            <option value="createdAt">Creation Date</option>
            <option value="title">Title (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
