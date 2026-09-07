import React, { useState, useEffect } from 'react';
import { UserPlus, UserCheck, Calendar, Clock } from 'lucide-react';
import { reportingService } from '../../services/reportingService';
import { useRole } from '../../state/RoleContext';
import ReportFilterBar from '../../components/reporting/ReportFilterBar';
import ReportTable from '../../components/reporting/ReportTable';
import RestrictedAccessCard from '../../components/reporting/RestrictedAccessCard';

export default function HiresReportPage() {
  const roleContext = useRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      const res = await reportingService.getHiresReport({
        referenceDate: '2026-09-03',
        filters: { search, departmentId },
        roleContext,
        userEmployeeId: 'emp-004',
      });
      setData(res);
      setLoading(false);
    }
    loadReport();
  }, [search, departmentId, roleContext.currentRole]);

  if (loading) {
    return (
      <div className="page-container" style={{ padding: '1.5rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading onboarding & hires report...</p>
      </div>
    );
  }

  if (data?.isRestricted) {
    return (
      <div className="page-container" style={{ padding: '1.5rem' }}>
        <RestrictedAccessCard />
      </div>
    );
  }

  const { onboardingMetrics, newJoiners, departments } = data;

  const columns = [
    {
      key: 'employee',
      label: 'New Joiner',
      width: '220px',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              fontSize: '0.725rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {row.photo || 'NJ'}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{row.fullName}</div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{row.employeeId}</div>
          </div>
        </div>
      ),
    },
    { key: 'departmentName', label: 'Department', width: '180px' },
    { key: 'positionTitle', label: 'Position', width: '200px' },
    { key: 'startDate', label: 'Start Date', width: '130px' },
    {
      key: 'status',
      label: 'Lifecycle Status',
      width: '130px',
      render: (row) => <span className={`status-badge status-${row.status.toLowerCase()}`}>{row.status}</span>,
    },
  ];

  return (
    <div className="page-container" style={{ padding: '1.5rem' }}>
      <div className="reporting-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>
          Onboarding & Hires Pipeline Report
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Tracking incoming talent pipeline, onboarding plan activation, and new joiner integration status.
        </p>
      </div>

      <ReportFilterBar
        search={search}
        onSearchChange={setSearch}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        departments={departments}
        onReset={() => {
          setSearch('');
          setDepartmentId('');
        }}
      />

      {/* KPI Row */}
      <div className="reporting-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #2563EB' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>NEW JOINERS PIPELINE</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{onboardingMetrics.newJoinersCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Onboarding + Upcoming hires</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>ACTIVE ONBOARDING PLANS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{onboardingMetrics.activePlansCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{onboardingMetrics.inProgressCount} In Progress · {onboardingMetrics.needsAttentionCount} Needs Attention</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #7C3AED' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>UPCOMING HIRES</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{onboardingMetrics.upcomingHiresCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Not started yet</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>COMPLETED ONBOARDINGS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669' }}>{onboardingMetrics.completedCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Fully completed plans</div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-main)' }}>
          New Joiners & Upcoming Pipeline Roster ({newJoiners.length})
        </h3>
        <ReportTable columns={columns} data={newJoiners} emptyMessage="No new joiners or upcoming hires found matching filter criteria." actionLink="/onboarding/dashboard" />
      </div>
    </div>
  );
}
