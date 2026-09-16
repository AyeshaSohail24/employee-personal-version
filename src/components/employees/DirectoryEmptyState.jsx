import React from 'react';
import { SearchX, RotateCcw } from 'lucide-react';

export default function DirectoryEmptyState({ onResetFilters, message = 'No employees match the current search or filter criteria.' }) {
  return (
    <div className="directory-empty-card">
      <div className="empty-icon-badge">
        <SearchX size={32} />
      </div>
      <h3 className="empty-title">No Employees Found</h3>
      <p className="empty-description">{message}</p>
      {onResetFilters && (
        <button className="empty-reset-btn" onClick={onResetFilters} type="button">
          <RotateCcw size={16} />
          <span>Reset Search & Filters</span>
        </button>
      )}
    </div>
  );
}
