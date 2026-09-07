import React from 'react';
import { ShieldAlert } from 'lucide-react';

/**
 * Displayed when an Employee user attempts to view organization-wide HR reports.
 */
export default function RestrictedAccessCard({ title = 'Access Restricted' }) {
  return (
    <div
      className="table-container-card"
      style={{
        padding: '3rem 2rem',
        textAlign: 'center',
        maxWidth: '560px',
        margin: '2rem auto',
        border: '1px solid var(--border-light)',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#FEF2F2',
          color: '#DC2626',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
        }}
      >
        <ShieldAlert size={28} />
      </div>
      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
        Organization-wide HR reporting and workforce analytics require Manager, HR, or HR Admin permissions. Please contact your administrator if you need access.
      </p>
    </div>
  );
}
