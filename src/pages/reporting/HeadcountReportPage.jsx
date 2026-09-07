import React, { useState, useEffect } from 'react';
import { Users, Building2, MapPin, Laptop } from 'lucide-react';
import { reportingService } from '../../services/reportingService';
import { useRole } from '../../state/RoleContext';
import ReportFilterBar from '../../components/reporting/ReportFilterBar';
import { HorizontalBarChart, StackedBarChart } from '../../components/reporting/CustomBarChart';
import ReportTable from '../../components/reporting/ReportTable';
import RestrictedAccessCard from '../../components/reporting/RestrictedAccessCard';

export default function HeadcountReportPage() {
  const roleContext = useRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [workModeFilter, setWorkModeFilter] = useState('All');

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      const res = await reportingService.getHeadcountReport({
        referenceDate: '2026-09-03',
        filters: { search, departmentId, workModeFilter },
        roleContext,
        userEmployeeId: 'emp-004',
      });
      setData(res);
      setLoading(false);
    }
    loadReport();
  }, [search, departmentId, workModeFilter, roleContext.currentRole]);

  if (loading) {
    return (
      <div className="page-container" style={{ padding: '1.5rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading headcount report...</p>
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

  const { workforceMetrics, breakdowns, employees, departments } = data;

  // Find top department
  const topDept = (breakdowns?.byDepartment || []).reduce((max, d) => (d.count > max.count ? d : max), { name: 'N/A', count: 0 });

  const columns = [
    {
      key: 'employee',
      label: 'Employee Name',
      width: '220px',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              fontSize: '0.725rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {row.photo || 'EM'}
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
    { key: 'locationName', label: 'Work Location', width: '160px' },
    {
      key: 'workMode',
      label: 'Work Mode',
      width: '120px',
      render: (row) => {
        const mode = row.workMode || 'On-site';
        let bg = '#F3F4F6';
        let color = '#374151';
        if (mode === 'Hybrid') {
          bg = '#ECFDF5';
          color = '#047857';
        } else if (mode === 'Remote') {
          bg = '#EFF6FF';
          color = '#1D4ED8';
        }
        return <span style={{ padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.725rem', fontWeight: 700, backgroundColor: bg, color }}>{mode}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => <span className={`status-badge status-${row.status.toLowerCase()}`}>{row.status}</span>,
    },
  ];

  return (
    <div className="page-container" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div className="reporting-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>
          Headcount & Workforce Composition Report
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Detailed organizational headcount distribution across departments, locations, and work arrangements.
        </p>
      </div>

      {/* Filter Bar */}
      <ReportFilterBar
        search={search}
        onSearchChange={setSearch}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        departments={departments}
        workModeFilter={workModeFilter}
        onWorkModeChange={setWorkModeFilter}
        onReset={() => {
          setSearch('');
          setDepartmentId('');
          setWorkModeFilter('All');
        }}
      />

      {/* 4-Column Desktop KPI Row */}
      <div className="reporting-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>CURRENT HEADCOUNT</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{workforceMetrics.totalHeadcount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Excludes Former & Upcoming</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #2563EB' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>LARGEST DEPARTMENT</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{topDept.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{topDept.count} active employees</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>WORK LOCATIONS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{breakdowns?.byLocation?.length || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Across all physical sites</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #7C3AED' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>UPCOMING PIPELINE</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{workforceMetrics.upcomingCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Future hires scheduled</div>
        </div>
      </div>

      {/* Visual Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <HorizontalBarChart title="Headcount by Department" items={breakdowns?.byDepartment || []} />
        <HorizontalBarChart title="Headcount by Work Location" items={breakdowns?.byLocation || []} accentColor="#2563EB" />
      </div>

      {/* Employee Roster Table */}
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-main)' }}>
          Active Workforce Roster ({employees.length})
        </h3>
        <ReportTable columns={columns} data={employees} emptyMessage="No employees found matching filter criteria." actionLink={(row) => `/employees`} />
      </div>
    </div>
  );
}
