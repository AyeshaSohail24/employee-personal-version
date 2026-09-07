import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Plus,
  Edit,
  Copy,
  CheckCircle2,
  XCircle,
  Play,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';
import LaunchPlanModal from '../../components/onboarding/LaunchPlanModal.jsx';

export default function OnboardingPlansPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [preselectedTplId, setPreselectedTplId] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await onboardingService.getAllTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load onboarding templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await onboardingService.toggleTemplateActive(id);
      await loadTemplates();
    } catch (err) {
      alert(`Failed to toggle template status: ${err.message}`);
    }
  };

  const handleOpenLaunchModal = (tplId) => {
    setPreselectedTplId(tplId);
    setIsLaunchModalOpen(true);
  };

  return (
    <div className="page-layout-container">
      {/* Page Header */}
      <div className="page-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Onboarding Plan Templates</h1>
          <p className="page-subtitle">
            Configure reusable onboarding plan templates, relative task schedules, and assignment rules.
          </p>
        </div>
        <Link to="/onboarding/plans/new" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
          <Plus size={16} />
          <span>Create Plan Template</span>
        </Link>
      </div>

      {/* Templates Grid / List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading plan templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="table-container-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <FileText size={36} style={{ color: 'var(--border-dark)', marginBottom: '0.5rem' }} />
          <h3>No Plan Templates Configured</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Click "Create Plan Template" to build your first reusable onboarding workflow.
          </p>
          <Link to="/onboarding/plans/new" className="btn-primary">
            Create Plan Template
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {templates.map((tpl) => (
            <div key={tpl.id} className="table-container-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#FFF' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.725rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', background: tpl.department ? '#EFF6FF' : '#F1F5F9', color: tpl.department ? '#1D4ED8' : '#475569' }}>
                    {tpl.department ? tpl.department.name : 'General (All Depts)'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(tpl.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    title={tpl.active !== false ? 'Deactivate Template' : 'Activate Template'}
                  >
                    <span className="presence-badge" style={tpl.active !== false ? { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' } : { backgroundColor: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1' }}>
                      {tpl.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                </div>

                <h3 style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {tpl.name}
                </h3>

                <p style={{ fontSize: '0.815rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '1rem', minHeight: '2.8em' }}>
                  {tpl.description || 'No description provided.'}
                </p>

                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.785rem', color: 'var(--text-muted)', padding: '0.5rem 0', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', marginBottom: '1rem' }}>
                  <div>
                    Total Tasks: <strong style={{ color: 'var(--text-main)' }}>{tpl.taskCount}</strong>
                  </div>
                  <div>
                    Required: <strong style={{ color: '#DC2626' }}>{tpl.requiredTaskCount}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link
                  to={`/onboarding/plans/${tpl.id}/edit`}
                  className="btn-secondary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.785rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                >
                  <Edit size={13} />
                  <span>Edit Plan</span>
                </Link>

                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.785rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  onClick={() => handleOpenLaunchModal(tpl.id)}
                  disabled={tpl.active === false}
                >
                  <Play size={13} />
                  <span>Launch</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Launch Plan Modal */}
      <LaunchPlanModal
        isOpen={isLaunchModalOpen}
        onClose={() => {
          setIsLaunchModalOpen(false);
          setPreselectedTplId(null);
        }}
        preselectedTemplateId={preselectedTplId}
        onSuccess={() => loadTemplates()}
      />
    </div>
  );
}
