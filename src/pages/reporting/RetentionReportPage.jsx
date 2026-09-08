import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckSquare, Clock, UserCheck } from 'lucide-react';
import { reportingService } from '../../services/reportingService';
import { useRole } from '../../state/RoleContext';
import ReportFilterBar from '../../components/reporting/ReportFilterBar';
import { HorizontalBarChart, StackedBarChart } from '../../components/reporting/CustomBarChart';
import RestrictedAccessCard from '../../components/reporting/RestrictedAccessCard';

export default function RetentionReportPage() {
  const roleContext = useRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      const res = await reportingService.getOperationalHealthReport({
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
        <p style={{ color: 'var(--text-muted)' }}>Loading operational health report...</p>
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

  const { presenceMetrics, activityMetrics, departments } = data;

  const presenceSegments = [
    { label: 'Present', count: presenceMetrics.presentCount || 0, color: '#059669' },
    { label: 'Remote', count: presenceMetrics.remoteCount || 0, color: '#2563EB' },
    { label: 'On Leave', count: presenceMetrics.leaveCount || 0, color: '#D97706' },
    { label: 'Absent', count: presenceMetrics.absentCount || 0, color: '#DC2626' },
    { label: 'Not Scheduled', count: presenceMetrics.notScheduledCount || 0, color: '#6B7280' },
    { label: 'Unknown (No Signal)', count: presenceMetrics.unknownCount || 0, color: '#9CA3AF' },
  ];

  const sourceItems = Object.entries(activityMetrics.sourceCounts || {}).map(([src, count]) => ({
    name: `${src} Activity Source`,
    count,
    percentage: Math.round((count / (activityMetrics.totalActivities || 1)) * 100),
  }));

  const workloadItems = (activityMetrics.assigneeWorkloads || []).map((w) => ({
    name: w.name,
    count: w.openCount,
    percentage: Math.round((w.openCount / (activityMetrics.openCount || 1)) * 100),
  }));

  return (
    <div className="page-container" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div className="reporting-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>
              Operational Health Report
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              Monitoring daily workforce presence status, task activity bottlenecks, and task resolution velocity.
            </p>
          </div>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, padding: '0.3rem 0.65rem', borderRadius: '12px', backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid var(--border-light)' }}>
            Note: Longitudinal retention analytics require multi-year historical data
          </span>
        </div>
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
        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>PRESENCE SIGNALS COVERAGE</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669' }}>{presenceMetrics.signalCoverageRate || 0}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{presenceMetrics.knownSignalCount || 0} of {presenceMetrics.totalWorkforce || 0} with known status</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #DC2626' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>OVERDUE ACTIVITY RATIO</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626' }}>{activityMetrics.overdueRatio}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{activityMetrics.overdueCount} overdue of {activityMetrics.totalActivities} activities</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #2563EB' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>OPEN ACTIVITIES</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{activityMetrics.openCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{activityMetrics.completedCount} completed</div>
        </div>

        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #D97706' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>UNASSIGNED TASKS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706' }}>{activityMetrics.unassignedCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Requires assignee allocation</div>
        </div>
      </div>

      {/* Visual Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <StackedBarChart title="Workplace Attendance & Presence Health Snapshot" segments={presenceSegments} totalCount={presenceMetrics.totalWorkforce} />
        <HorizontalBarChart title="Activity Workload Distribution by Assignee" items={workloadItems} accentColor="#2563EB" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
        <HorizontalBarChart title="Activities by Source Engine" items={sourceItems} accentColor="var(--color-primary)" />
      </div>
    </div>
  );
}
