import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable Compact Responsive Data Table for Stage 10 Reports.
 * Refined row height/padding, readable avatars, visible full employee names, status pills, and action links.
 */
export default function ReportTable({ columns = [], data = [], emptyMessage = 'No report data available.', actionLink }) {
  if (!data || data.length === 0) {
    return (
      <div className="table-container-card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-container-card" style={{ width: '100%', overflowX: 'auto' }}>
      <table className="reporting-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-subtle)' }}>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  padding: '0.55rem 0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  fontSize: '0.725rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  width: col.width || 'auto',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
            {actionLink && <th style={{ padding: '0.55rem 0.85rem', textAlign: 'right', width: '90px' }}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={row.id || rowIdx}
              style={{
                borderBottom: '1px solid var(--border-light)',
                transition: 'background-color 0.15s ease',
              }}
            >
              {columns.map((col, colIdx) => (
                <td key={col.key || colIdx} style={{ padding: '0.55rem 0.85rem', verticalAlign: 'middle' }}>
                  {col.render ? col.render(row) : row[col.key] || '—'}
                </td>
              ))}
              {actionLink && (
                <td style={{ padding: '0.55rem 0.85rem', textAlign: 'right', verticalAlign: 'middle' }}>
                  <Link
                    to={typeof actionLink === 'function' ? actionLink(row) : actionLink}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.725rem', padding: '0.25rem 0.55rem', height: '28px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                  >
                    View
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
