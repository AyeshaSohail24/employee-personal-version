import React from 'react';
import { Search, Plus, RotateCcw, Filter } from 'lucide-react';
import Select from '../common/Select';

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
            <Select
              variant="filter"
              value={filters.typeId || ''}
              onChange={(e) => handleSelectChange('typeId', e.target.value)}
              options={[
                { value: '', label: 'All Types' },
                ...activityTypes.map((t) => ({ value: t.id, label: t.name }))
              ]}
            />
          </div>

          {/* Assignee Filter (Hidden on 'my' view) */}
          {!isMyView && (
            <div className="filter-item">
              <span>Assignee:</span>
              <Select
                variant="filter"
                value={filters.assigneeId || ''}
                onChange={(e) => handleSelectChange('assigneeId', e.target.value)}
                options={[
                  { value: '', label: 'All Assignees' },
                  ...employees.map((emp) => ({
                    value: emp.id,
                    label: `${emp.fullName} (${emp.employeeId})`
                  }))
                ]}
              />
            </div>
          )}

          {/* Related Employee Filter */}
          <div className="filter-item">
            <span>Related To:</span>
            <Select
              variant="filter"
              value={filters.employeeId || ''}
              onChange={(e) => handleSelectChange('employeeId', e.target.value)}
              options={[
                { value: '', label: 'All Employees' },
                ...employees.map((emp) => ({
                  value: emp.id,
                  label: `${emp.fullName} (${emp.status})`
                }))
              ]}
            />
          </div>

          {/* Due State Filter (Hidden on 'overdue' view) */}
          {!isOverdueView && (
            <div className="filter-item">
              <span>Status:</span>
              <Select
                variant="filter"
                value={filters.dueState || ''}
                onChange={(e) => handleSelectChange('dueState', e.target.value)}
                options={[
                  { value: '', label: 'All States' },
                  { value: 'Overdue', label: 'Overdue' },
                  { value: 'Due Today', label: 'Due Today' },
                  { value: 'Upcoming', label: 'Upcoming' },
                  { value: 'Completed', label: 'Completed' }
                ]}
              />
            </div>
          )}

          {/* Source Filter */}
          <div className="filter-item">
            <span>Source:</span>
            <Select
              variant="filter"
              value={filters.source || ''}
              onChange={(e) => handleSelectChange('source', e.target.value)}
              options={[
                { value: '', label: 'All Sources' },
                { value: 'Manual', label: 'Manual' },
                { value: 'Onboarding', label: 'Onboarding' },
                { value: 'Offboarding', label: 'Offboarding' },
                { value: 'System', label: 'System' }
              ]}
            />
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
          <Select
            variant="filter"
            value={filters.sortBy || 'dueDate'}
            onChange={(e) => handleSelectChange('sortBy', e.target.value)}
            options={[
              { value: 'dueDate', label: 'Due Date (Earliest)' },
              { value: 'createdAt', label: 'Creation Date' },
              { value: 'title', label: 'Title (A-Z)' }
            ]}
          />
        </div>
      </div>
    </div>
  );
}
