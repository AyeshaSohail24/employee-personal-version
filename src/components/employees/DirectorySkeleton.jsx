import React from 'react';

export default function DirectorySkeleton({ viewMode = 'list' }) {
  if (viewMode === 'card') {
    return (
      <div className="employee-card-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="employee-card skeleton-box" style={{ height: '260px' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="directory-table-card skeleton-box" style={{ height: '360px' }} />
  );
}
