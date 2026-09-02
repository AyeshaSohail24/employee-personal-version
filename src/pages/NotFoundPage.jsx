import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="placeholder-card" style={{ marginTop: '2rem' }}>
      <div className="placeholder-icon" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
        <AlertTriangle size={28} />
      </div>
      <h1 className="placeholder-title" style={{ fontSize: '1.5rem' }}>404 — Page Not Found</h1>
      <p className="placeholder-body" style={{ marginBottom: '1.5rem' }}>
        The requested route does not exist in the Rizurf Employees App layout shell.
      </p>
      <Link to="/dashboard" className="tag-badge" style={{ textDecoration: 'none', padding: '0.4rem 1rem' }}>
        Return to Dashboard
      </Link>
    </div>
  );
}
