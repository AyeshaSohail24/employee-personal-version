import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Play,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  UserCheck,
} from 'lucide-react';
import { employeeService } from '../../services/employeeService.js';
import { onboardingService } from '../../services/onboardingService.js';
import { PLAN_INSTANCE_STATUS } from '../../domain/onboardingDomain.js';
import LaunchPlanModal from '../../components/onboarding/LaunchPlanModal.jsx';

export default function OnboardingEmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [instances, setInstances] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active_onboarding'); // 'active_onboarding' | 'all' | 'former_open'
  const [loading, setLoading] = useState(true);

  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [preselectedEmpId, setPreselectedEmpId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const allEmps = await employeeService.getAll();
      const allInsts = await onboardingService.getAllInstances();

      setEmployees(allEmps);
      setInstances(allInsts);
    } catch (err) {
      console.error('Failed to load onboarding employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const instanceMap = new Map(instances.map((i) => [i.employeeId, i]));

  // Filter target onboarding workforce population
  const onboardingWorkforce = employees.filter((emp) => {
    const activeInst = instanceMap.get(emp.id);

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = emp.fullName.toLowerCase().includes(q);
      const matchId = emp.employeeId.toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }

    if (statusFilter === 'former_open') {
      return emp.status === 'Former' && activeInst && activeInst.derivedStatus !== PLAN_INSTANCE_STATUS.COMPLETED;
    }

    if (statusFilter === 'active_onboarding') {
      if (emp.status === 'Upcoming' || emp.status === 'Onboarding') return true;
      if (emp.status === 'Active' && activeInst && activeInst.derivedStatus !== PLAN_INSTANCE_STATUS.COMPLETED) return true;
      return false;
    }

    // 'all'
    if (emp.status === 'Upcoming' || emp.status === 'Onboarding') return true;
    if (activeInst) return true;
    return false;
  });

  const handleOpenLaunchModal = (empId = null) => {
    setPreselectedEmpId(empId);
    setIsLaunchModalOpen(true);
  };

  return (
    <div className="page-layout-container">
      {/* Page Header */}
      <div className="page-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Onboarding Employees</h1>
          <p className="page-subtitle">
            Track workflow progress, anchor start dates, and task completion for new joiners.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => handleOpenLaunchModal()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Play size={15} />
          <span>Launch Onboarding Plan</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="table-toolbar-card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className={statusFilter === 'active_onboarding' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setStatusFilter('active_onboarding')}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.815rem' }}
          >
            Active Onboarding
          </button>
          <button
            type="button"
            className={statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setStatusFilter('all')}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.815rem' }}
          >
            All Onboarding History
          </button>
          <button
            type="button"
            className={statusFilter === 'former_open' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setStatusFilter('former_open')}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.815rem' }}
          >
            Open Plans (Inactive/Former)
          </button>
        </div>

        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control-input"
            style={{ paddingLeft: '2rem', fontSize: '0.815rem' }}
            placeholder="Search employee name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Employees Table */}
      <div className="table-container-card">
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading onboarding employees...
          </div>
        ) : onboardingWorkforce.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ marginBottom: '0.5rem', color: 'var(--border-dark)' }} />
            <h3>No Onboarding Employees Found</h3>
            <p style={{ fontSize: '0.85rem' }}>
              No employees currently match the selected onboarding filter or search query.
            </p>
          </div>
        ) : (
          <table className="presence-data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '25%', textAlign: 'left' }}>Employee</th>
                <th style={{ width: '20%', textAlign: 'left' }}>Department & Position</th>
                <th style={{ width: '14%', textAlign: 'center' }}>Anchor Start Date</th>
                <th style={{ width: '21%', textAlign: 'left' }}>Active Plan & Progress</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Workflow Status</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {onboardingWorkforce.map((emp) => {
                const inst = instanceMap.get(emp.id);
                const isFormer = emp.status === 'Former';
                const isDeparting = emp.status === 'Departing';

                return (
                  <tr key={emp.id} className="presence-table-row">
                    <td>
                      <div className="emp-identity-block">
                        <div className="emp-avatar-circle" style={isFormer ? { background: '#64748B' } : undefined}>
                          {emp.photo || 'EM'}
                        </div>
                        <div className="emp-identity-text">
                          <div className="emp-name-text" style={{ whiteSpace: 'nowrap' }}>
                            {emp.fullName}
                          </div>
                          <div className="emp-id-subtext">{emp.employeeId}</div>
                          <div>
                            <span className={`emp-status-sub-pill ${emp.status.toLowerCase()}`} style={{ marginLeft: 0 }}>
                              {emp.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-main)' }}>
                        {emp.position?.name || 'Position N/A'}
                      </div>
                      <div style={{ fontSize: '0.735rem', color: 'var(--text-muted)' }}>
                        {emp.department?.name || 'Department N/A'}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.815rem', fontWeight: 600 }}>
                      {emp.effectiveEmploymentRecord?.effectiveFrom || emp.startDate || 'N/A'}
                    </td>

                    <td>
                      {inst ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.815rem', color: 'var(--text-main)' }}>
                            {inst.template ? inst.template.name : 'Custom Plan'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <div style={{ flex: 1, height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${inst.progress.progressPercentage}%`,
                                  height: '100%',
                                  background: inst.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION ? '#EF4444' : '#129FA9',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.735rem', fontWeight: 700 }}>
                              {inst.progress.progressPercentage}%
                            </span>
                          </div>
                          <div style={{ fontSize: '0.715rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                            {inst.progress.completedRequiredCount} / {inst.progress.requiredTasksCount} required tasks complete
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.785rem', color: 'var(--text-muted)', italic: 'true' }}>
                          No active onboarding plan
                        </div>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {inst ? (
                        <span
                          className="presence-badge"
                          style={
                            inst.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED
                              ? { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }
                              : inst.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION
                              ? { backgroundColor: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }
                              : { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                          }
                        >
                          {inst.derivedStatus}
                        </span>
                      ) : (
                        <span className="presence-badge" style={{ backgroundColor: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1' }}>
                          Not Started
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                        <Link
                          to={`/onboarding/employees/${emp.id}`}
                          className="btn-compact-override"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.725rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <span>Detail</span>
                          <ArrowUpRight size={11} />
                        </Link>
                        {!inst && (
                          <button
                            type="button"
                            className="btn-compact-clear"
                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                            onClick={() => handleOpenLaunchModal(emp.id)}
                          >
                            Launch Plan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Launch Plan Modal */}
      <LaunchPlanModal
        isOpen={isLaunchModalOpen}
        onClose={() => {
          setIsLaunchModalOpen(false);
          setPreselectedEmpId(null);
        }}
        preselectedEmployeeId={preselectedEmpId}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
