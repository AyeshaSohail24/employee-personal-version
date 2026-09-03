import React from 'react';

export default function PresenceSkeleton() {
  return (
    <div className="presence-skeleton-wrapper">
      <div className="presence-summary-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="presence-summary-card skeleton-box" style={{ height: '80px' }} />
        ))}
      </div>
      <div className="table-container-card skeleton-box" style={{ height: '400px', marginTop: '1.5rem' }} />
    </div>
  );
}
