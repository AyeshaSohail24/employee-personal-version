import React, { useState, useEffect } from 'react';
import { Shield, Search, CheckCircle2, Lock, Info } from 'lucide-react';
import { useRole } from '../../state/RoleContext';
import { permissionService } from '../../services/permissionService';

export default function PermissionsConfigPage() {
  const { currentRole } = useRole();

  const [matrixData, setMatrixData] = useState({ roles: [], groups: [], matrix: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const data = await permissionService.getPermissionMatrix();
        setMatrixData(data);
      } catch (err) {
        console.error('Failed to load permission matrix:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const categories = ['All', 'Core HR & Employees', 'Workforce Operations', 'Configuration Master Data', 'Security & Access Control'];

  // Flatten and filter capabilities based on search & category
  const allCapabilities = matrixData.groups.flatMap((g) =>
    g.capabilities.map((c) => ({ ...c, category: g.category }))
  );

  const filteredCapabilities = allCapabilities.filter((cap) => {
    const matchesSearch =
      cap.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cap.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cap.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || cap.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="config-page-wrapper">
      {/* 1. Header Card */}
      <div className="config-header-card">
        <div className="config-header-left">
          <div className="config-header-icon teal">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="config-header-title">Permissions & Roles Configuration</h1>
            <p className="config-header-desc">
              Canonical 3-role capability matrix and administrative access controls for the Rizurf HR Portal.
            </p>
          </div>
        </div>
        <div className="config-header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="config-expiry-badge active" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            <Info size={14} />
            <span>Canonical Role Model</span>
          </span>
        </div>
      </div>

      {/* 2. Search & Category Filter Toolbar */}
      <div className="documents-config-toolbar">
        {/* Search Field */}
        <div className="toolbar-search-box">
          <Search size={18} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search capabilities by name, description, or key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search capabilities"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="documents-config-filter-row" role="tablist" aria-label="Permission Category Filters">
          {categories.map((cat) => {
            const count =
              cat === 'All'
                ? allCapabilities.length
                : allCapabilities.filter((c) => c.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                className={`documents-config-filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={selectedCategory === cat}
              >
                <span>{cat}</span>
                <span className="documents-config-filter-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Permissions Matrix Card */}
      <div className="config-table-card">
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading permissions & capabilities matrix...
          </div>
        ) : filteredCapabilities.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No capabilities found matching your search criteria.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="config-table-wrapper desktop-only">
              <table className="config-table permissions-matrix-table">
                <colgroup>
                  <col className="col-perm-capability" />
                  <col className="col-perm-desc" />
                  <col className="col-perm-role col-perm-hr-admin" />
                  <col className="col-perm-role col-perm-hr" />
                  <col className="col-perm-role col-perm-manager" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="perm-th-capability">CAPABILITY / FEATURE</th>
                    <th className="perm-th-desc">DESCRIPTION & SCOPE</th>
                    <th className="perm-th-role">HR ADMIN</th>
                    <th className="perm-th-role">HR</th>
                    <th className="perm-th-role">MANAGER</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCapabilities.map((cap) => {
                    const hrAdminGranted = matrixData.matrix[cap.key]?.['HR Admin'];
                    const hrGranted = matrixData.matrix[cap.key]?.['HR'];
                    const managerGranted = matrixData.matrix[cap.key]?.['Manager'];

                    return (
                      <tr key={cap.key}>
                        <td className="perm-td-capability">
                          <div className="config-name-cell">
                            <div className="config-item-name" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {cap.label}
                            </div>
                            <div className="config-item-desc" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', fontFamily: 'monospace' }}>
                              {cap.key}
                            </div>
                          </div>
                        </td>
                        <td className="perm-td-desc">
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {cap.description}
                          </span>
                        </td>
                        <td className="perm-td-role">
                          {hrAdminGranted ? (
                            <span className="config-pill-active">
                              <CheckCircle2 size={12} style={{ marginRight: '0.25rem', flexShrink: 0 }} /> Granted
                            </span>
                          ) : (
                            <span className="config-pill-inactive">
                              <Lock size={12} style={{ marginRight: '0.25rem', flexShrink: 0 }} /> Restricted
                            </span>
                          )}
                        </td>
                        <td className="perm-td-role">
                          {hrGranted ? (
                            <span className="config-pill-active">
                              <CheckCircle2 size={12} style={{ marginRight: '0.25rem', flexShrink: 0 }} /> Granted
                            </span>
                          ) : (
                            <span className="config-pill-inactive">
                              <Lock size={12} style={{ marginRight: '0.25rem', flexShrink: 0 }} /> Restricted
                            </span>
                          )}
                        </td>
                        <td className="perm-td-role">
                          {managerGranted ? (
                            <span className="config-pill-active">
                              <CheckCircle2 size={12} style={{ marginRight: '0.25rem', flexShrink: 0 }} /> Granted
                            </span>
                          ) : (
                            <span className="config-pill-inactive">
                              <Lock size={12} style={{ marginRight: '0.25rem', flexShrink: 0 }} /> Restricted
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="config-mobile-cards mobile-only">
              {filteredCapabilities.map((cap) => {
                const hrAdminGranted = matrixData.matrix[cap.key]?.['HR Admin'];
                const hrGranted = matrixData.matrix[cap.key]?.['HR'];
                const managerGranted = matrixData.matrix[cap.key]?.['Manager'];

                return (
                  <div key={cap.key} className="config-mobile-card">
                    <div className="config-mobile-card-header">
                      <div>
                        <div className="config-item-name">{cap.label}</div>
                        <span className="config-code-badge">{cap.key}</span>
                      </div>
                      <span className="config-pill-category">{cap.category}</span>
                    </div>
                    <p className="config-mobile-card-desc">{cap.description}</p>
                    <div className="config-mobile-card-meta" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.75rem', textAlign: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HR Admin</div>
                        <strong style={{ fontSize: '0.8rem', color: hrAdminGranted ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                          {hrAdminGranted ? 'Granted' : 'Restricted'}
                        </strong>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HR</div>
                        <strong style={{ fontSize: '0.8rem', color: hrGranted ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                          {hrGranted ? 'Granted' : 'Restricted'}
                        </strong>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Manager</div>
                        <strong style={{ fontSize: '0.8rem', color: managerGranted ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                          {managerGranted ? 'Granted' : 'Restricted'}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
