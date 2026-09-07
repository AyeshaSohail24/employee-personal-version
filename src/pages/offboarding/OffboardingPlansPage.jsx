import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Play,
  Building,
  ListChecks,
} from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';
import LaunchOffboardingPlanModal from '../../components/offboarding/LaunchOffboardingPlanModal.jsx';

export default function OffboardingPlansPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await offboardingService.getAllTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load offboarding templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await offboardingService.toggleTemplateActive(id);
      await loadTemplates();
    } catch (err) {
      alert(`Failed to toggle template status: ${err.message}`);
    }
  };

  return (
    <div className="page-layout-container">
      {/* Page Header */}
      <div className="onboarding-dashboard-header">
        <div className="header-text-group">
          <h1 className="page-title">Offboarding Plan Templates</h1>
          <p className="page-subtitle">
            Manage reusable exit clearance templates, relative task offsets, and assignment rules.
          </p>
        </div>
        <div className="header-actions">
          <Link
            to="/offboarding/plans/new"
            className="btn-primary btn-header-action"
          >
            <Plus size={16} />
            <span>Create Exit Template</span>
          </Link>
        </div>
      </div>

      {/* Template Library Cards Grid */}
      {loading ? (
        <div className="table-container-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading offboarding templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="table-container-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileText size={36} style={{ color: 'var(--color-primary)', marginBottom: '0.75rem' }} />
          <h3>No Offboarding Templates Found</h3>
          <p style={{ maxWidth: '420px', margin: '0.5rem auto 1.25rem auto', fontSize: '0.875rem' }}>
            Get started by creating your first reusable offboarding clearance template.
          </p>
          <Link to="/offboarding/plans/new" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} /> Create Exit Template
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="table-container-card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: tpl.active ? 1 : 0.65,
                border: '1px solid var(--border-light)',
              }}
            >
              <div>
                {/* Header Badge Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--color-primary-light)',
                      color: 'var(--color-primary-active)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Building size={12} />
                    {tpl.department ? tpl.department.name : 'General / All Departments'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(tpl.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: tpl.active ? '#059669' : '#64748B',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                  >
                    {tpl.active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    <span>{tpl.active ? 'Active' : 'Inactive'}</span>
                  </button>
                </div>

                {/* Title & Description */}
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-navy-header)' }}>
                  {tpl.name}
                </h3>
                <p style={{ fontSize: '0.815rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: '0 0 1rem 0' }}>
                  {tpl.description}
                </p>

                {/* Metrics Pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.785rem', color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                    <ListChecks size={15} style={{ color: 'var(--color-primary)' }} />
                    {tpl.taskCount} Tasks Total
                  </span>
                  <span>·</span>
                  <span style={{ color: '#DC2626', fontWeight: 600 }}>
                    {tpl.requiredTaskCount} Required
                  </span>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link
                  to={`/offboarding/plans/${tpl.id}/edit`}
                  style={{
                    fontSize: '0.815rem',
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Edit2 size={14} /> Edit Template
                </Link>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setSelectedTemplateId(tpl.id);
                    setIsLaunchModalOpen(true);
                  }}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.785rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Play size={13} /> Launch
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Launch Plan Modal */}
      <LaunchOffboardingPlanModal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        onSuccess={() => loadTemplates()}
      />
    </div>
  );
}
