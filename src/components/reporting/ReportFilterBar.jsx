import React from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import Select from '../common/Select';

export default function ReportFilterBar({
  search = '',
  onSearchChange,
  departmentId = '',
  onDepartmentChange,
  departments = [],
  workModeFilter = 'All',
  onWorkModeChange,
  onReset,
}) {
  return (
    <div className="reporting-filter-bar table-container-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-control"
            placeholder="Search report by name, ID, position..."
            value={search}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            style={{ paddingLeft: '2.25rem', height: '38px', fontSize: '0.85rem', width: '100%' }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {/* Department Select */}
          {departments.length > 0 && (
            <Select
              variant="filter"
              value={departmentId}
              onChange={(e) => onDepartmentChange && onDepartmentChange(e.target.value)}
              style={{ minWidth: '160px' }}
              options={[
                { value: '', label: 'All Departments' },
                ...departments.map((d) => ({ value: d.id, label: d.name }))
              ]}
            />
          )}

          {/* Work Mode Select */}
          {onWorkModeChange && (
            <Select
              variant="filter"
              value={workModeFilter}
              onChange={(e) => onWorkModeChange(e.target.value)}
              style={{ minWidth: '140px' }}
              options={[
                { value: 'All', label: 'All Work Modes' },
                { value: 'On-site', label: 'On-site' },
                { value: 'Hybrid', label: 'Hybrid' },
                { value: 'Remote', label: 'Remote' }
              ]}
            />
          )}

          {/* Reset Button */}
          {onReset && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onReset}
              style={{ height: '38px', padding: '0 0.85rem', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RefreshCw size={14} />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
