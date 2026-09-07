import React, { useState, useEffect } from 'react';
import { UserX, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { reportingService } from '../../services/reportingService';
import { useRole } from '../../state/RoleContext';
import ReportFilterBar from '../../components/reporting/ReportFilterBar';
import ReportTable from '../../components/reporting/ReportTable';
import RestrictedAccessCard from '../../components/reporting/RestrictedAccessCard';

export default function DeparturesReportPage() {
  const roleContext = useRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      const res = await reportingService.getDeparturesReport({
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
        <p style={{ color: 'var(--text-muted)' }}>Loading offboarding & departures report...</p>
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

  const { offboardingMetrics, departingEmployees, departments } = data;

  const columns = [
    {
      key: 'employee',
      label: 'Departing / Former Employee',
      width: '220px',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              fontSize: '0.725rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {row.photo || 'DE'}
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
    { key: 'finalWorkingDate', label: 'Final Working Date', width: '150px' },
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
          Offboarding & Departures Clearance Report
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Tracking departing staff exit progress, clearance compliance, and historical exit records.
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
        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #B45309' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>DEPARTING EMPLOYEES</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{offboardingMetrics.departingCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Currently in departure lifecycle</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>ACTIVE EXIT PLANS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{offboardingMetrics.activePlansCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{offboardingMetrics.inProgressCount} In Progress · {offboardingMetrics.needsAttentionCount} Needs Attention</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #DC2626' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>NEEDS ATTENTION</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626' }}>{offboardingMetrics.needsAttentionCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Unresolved required exit tasks</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>COMPLETED EXIT PLANS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669' }}>{offboardingMetrics.completedCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Clearance fully verified</div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-main)' }}>
          Departing & Former Exit Clearance Records ({departingEmployees.length})
        </h3>
        <ReportTable columns={columns} data={departingEmployees} emptyMessage="No departing or former exit records found matching filter criteria." actionLink="/offboarding/departing" />
      </div>
    </div>
  );
}
