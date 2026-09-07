import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  Play,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserX,
} from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';
import { employeeService } from '../../services/employeeService.js';
import { OFFBOARDING_INSTANCE_STATUS } from '../../domain/offboardingDomain.js';
import LaunchOffboardingPlanModal from '../../components/offboarding/LaunchOffboardingPlanModal.jsx';

export default function OffboardingDepartingPage() {
  const [instances, setInstances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('departing'); // 'departing' | 'needsAttention' | 'completed' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [selectedLaunchEmpId, setSelectedLaunchEmpId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allInsts, allEmps] = await Promise.all([
        offboardingService.getAllInstances(),
        employeeService.getAll(),
      ]);
      setInstances(allInsts);
      setEmployees(allEmps);
    } catch (err) {
      console.error('Failed to load offboarding directory data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchForEmployee = (empId) => {
    setSelectedLaunchEmpId(empId);
    setIsLaunchModalOpen(true);
  };

  // Filter instances by active tab and search query
  const filteredInstances = instances.filter((inst) => {
    const emp = inst.employee || {};
    const matchesSearch =
      !searchQuery ||
      emp.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.template?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'departing') {
      return emp.status === 'Departing' || inst.derivedStatus !== OFFBOARDING_INSTANCE_STATUS.COMPLETED;
    }
    if (activeTab === 'needsAttention') {
      return inst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION;
    }
    if (activeTab === 'completed') {
      return inst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED;
    }
    return true; // 'all'
  });

  return (
    <div className="page-layout-container">
      {/* Page Header */}
      <div className="onboarding-dashboard-header">
        <div className="header-text-group">
          <h1 className="page-title">Offboarding Employee Directory</h1>
          <p className="page-subtitle">
            Track clearance progress, final working dates, and historical offboarding workflows.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-primary btn-header-action"
            onClick={() => handleLaunchForEmployee(null)}
          >
            <Play size={15} />
            <span>Launch Offboarding Plan</span>
          </button>
        </div>
      </div>

      {/* Directory Filter Bar & Tabs */}
      <div className="table-container-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#F1F5F9', padding: '0.25rem', borderRadius: '8px' }}>
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === 'departing' ? 'active' : ''}`}
              onClick={() => setActiveTab('departing')}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.815rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: activeTab === 'departing' ? '#FFF' : 'transparent',
                color: activeTab === 'departing' ? 'var(--color-primary)' : 'var(--text-muted)',
                boxShadow: activeTab === 'departing' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Departing ({instances.filter((i) => i.derivedStatus !== OFFBOARDING_INSTANCE_STATUS.COMPLETED).length})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === 'needsAttention' ? 'active' : ''}`}
              onClick={() => setActiveTab('needsAttention')}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.815rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: activeTab === 'needsAttention' ? '#FFF' : 'transparent',
                color: activeTab === 'needsAttention' ? '#DC2626' : 'var(--text-muted)',
                boxShadow: activeTab === 'needsAttention' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Needs Attention ({instances.filter((i) => i.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION).length})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.815rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: activeTab === 'completed' ? '#FFF' : 'transparent',
                color: activeTab === 'completed' ? '#059669' : 'var(--text-muted)',
                boxShadow: activeTab === 'completed' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Completed ({instances.filter((i) => i.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED).length})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.815rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: activeTab === 'all' ? '#FFF' : 'transparent',
                color: activeTab === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: activeTab === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              All Workflows ({instances.length})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search employee or template..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.25rem',
                fontSize: '0.825rem',
                border: '1px solid var(--border-light)',
                borderRadius: '20px',
                outline: 'none',
                backgroundColor: '#FFF',
              }}
            />
          </div>

        </div>
      </div>

      {/* Directory Table */}
      <div className="table-container-card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading offboarding directory...
          </div>
        ) : filteredInstances.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No offboarding workflows found for the selected filter.
          </div>
        ) : (
          <table className="presence-data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '25%', textAlign: 'left' }}>Employee</th>
                <th style={{ width: '22%', textAlign: 'left' }}>Plan Template</th>
                <th style={{ width: '16%', textAlign: 'center' }}>Final Working Date</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Status</th>
                <th style={{ width: '14%', textAlign: 'center' }}>Progress</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstances.map((inst) => {
                const emp = inst.employee || {};
                const isCompleted = inst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED;
                const isNeedsAttn = inst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION;

                return (
                  <tr key={inst.id} className="presence-table-row">
                    <td>
                      <div className="emp-identity-block">
                        <div className="emp-avatar-circle" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                          {emp.photo || 'EM'}
                        </div>
                        <div className="emp-identity-text">
                          <div className="emp-name-text" style={{ whiteSpace: 'nowrap' }}>
                            {emp.fullName || 'Unknown Employee'}
                          </div>
                          <div className="emp-id-subtext">{emp.employeeId || 'N/A'} · {emp.status}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-main)' }}>
                        {inst.template ? inst.template.name : 'Custom Exit Plan'}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        {inst.progress.completedRequiredCount} / {inst.progress.requiredTasksCount} required tasks
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.815rem', fontWeight: 600 }}>
                      {inst.anchorDate}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.725rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '12px',
                          fontWeight: 700,
                          backgroundColor: isCompleted ? '#ECFDF5' : isNeedsAttn ? '#FEF2F2' : '#EFF6FF',
                          color: isCompleted ? '#059669' : isNeedsAttn ? '#DC2626' : '#2563EB',
                        }}
                      >
                        {inst.derivedStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.785rem', fontWeight: 700 }}>
                          {inst.progress.progressPercentage}%
                        </span>
                        <div style={{ width: '70px', height: '5px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${inst.progress.progressPercentage}%`,
                              height: '100%',
                              background: isNeedsAttn ? '#EF4444' : isCompleted ? '#10B981' : '#129FA9',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link
                        to={`/offboarding/employees/${emp.id}`}
                        className="btn-compact-override"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.725rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                      >
                        <span>View</span>
                        <ArrowUpRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Launch Plan Modal */}
      <LaunchOffboardingPlanModal
        isOpen={isLaunchModalOpen}
        onClose={() => {
          setIsLaunchModalOpen(false);
          setSelectedLaunchEmpId(null);
        }}
        onSuccess={() => loadData()}
        initialEmployeeId={selectedLaunchEmpId}
      />
    </div>
  );
}
