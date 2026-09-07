import React from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';

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
            <select
              className="form-control"
              value={departmentId}
              onChange={(e) => onDepartmentChange && onDepartmentChange(e.target.value)}
              style={{ height: '38px', fontSize: '0.85rem', minWidth: '160px' }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {/* Work Mode Select */}
          {onWorkModeChange && (
            <select
              className="form-control"
              value={workModeFilter}
              onChange={(e) => onWorkModeChange(e.target.value)}
              style={{ height: '38px', fontSize: '0.85rem', minWidth: '140px' }}
            >
              <option value="All">All Work Modes</option>
              <option value="On-site">On-site</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Remote">Remote</option>
            </select>
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
