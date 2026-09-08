import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserPlus, UserX, Clock, ArrowRight, Activity, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { reportingService } from '../../services/reportingService';
import { useRole } from '../../state/RoleContext';
import ReportFilterBar from '../../components/reporting/ReportFilterBar';
import { HorizontalBarChart, StackedBarChart } from '../../components/reporting/CustomBarChart';
import RestrictedAccessCard from '../../components/reporting/RestrictedAccessCard';

export default function WorkforceOverviewPage() {
  const roleContext = useRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [workModeFilter, setWorkModeFilter] = useState('All');

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      const res = await reportingService.getWorkforceOverviewReport({
        referenceDate: '2026-09-03',
        filters: { search, departmentId, workModeFilter },
        roleContext,
        userEmployeeId: 'emp-004', // Marcus Tan for Manager role demo context
      });
      setData(res);
      setLoading(false);
    }
    loadReport();
  }, [search, departmentId, workModeFilter, roleContext.currentRole]);

  if (loading) {
    return (
      <div className="page-container" style={{ padding: '1.5rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading workforce overview report...</p>
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

  const { workforceMetrics, presenceMetrics, activityMetrics, onboardingMetrics, offboardingMetrics, breakdowns, departments } = data;

  const workModeSegments = (breakdowns?.byWorkMode || []).map((m) => {
    let color = '#2563EB';
    if (m.mode === 'Hybrid') color = 'var(--color-primary)';
    if (m.mode === 'Remote') color = '#7C3AED';
    return { label: m.mode, count: m.count, color };
  });

  const presenceSegments = [
    { label: 'Present', count: presenceMetrics.presentCount || 0, color: '#059669' },
    { label: 'Remote', count: presenceMetrics.remoteCount || 0, color: '#2563EB' },
    { label: 'On Leave', count: presenceMetrics.leaveCount || 0, color: '#D97706' },
    { label: 'Absent', count: presenceMetrics.absentCount || 0, color: '#DC2626' },
    { label: 'Not Scheduled', count: presenceMetrics.notScheduledCount || 0, color: '#6B7280' },
    { label: 'Unknown (No Signal)', count: presenceMetrics.unknownCount || 0, color: '#9CA3AF' },
  ];

  return (
    <div className="page-container" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div className="reporting-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>
            Workforce Overview
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            Executive HR operational dashboard, active headcount distribution, and presence status.
          </p>
        </div>
        {roleContext.isManager && (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
            Team Managed Scoping Active
          </span>
        )}
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
        {/* KPI 1: Current Headcount */}
        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>CURRENT HEADCOUNT</span>
            <Users size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{workforceMetrics.totalHeadcount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {workforceMetrics.activeCount} Active · {workforceMetrics.onboardingCount} Onboarding
          </div>
        </div>

        {/* KPI 2: Presence Signals */}
        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PRESENCE SIGNALS</span>
            <UserCheck size={18} style={{ color: '#059669' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{presenceMetrics.knownSignalCount || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.2rem', fontWeight: 600 }}>
            {presenceMetrics.knownSignalCount || 0} of {presenceMetrics.totalWorkforce || 0} with known status ({presenceMetrics.signalCoverageRate || 0}% coverage)
          </div>
        </div>

        {/* KPI 3: New Joiners Pipeline */}
        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #2563EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', uppercase: 'true' }}>NEW JOINERS PIPELINE</span>
            <UserPlus size={18} style={{ color: '#2563EB' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{workforceMetrics.newJoinersPipelineCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {onboardingMetrics.onboardingEmployeesCount} Onboarding · {onboardingMetrics.upcomingHiresCount} Upcoming
          </div>
        </div>

        {/* KPI 4: Overdue Activities */}
        <div className="table-container-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #DC2626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', uppercase: 'true' }}>OVERDUE ACTIVITIES</span>
            <AlertTriangle size={18} style={{ color: '#DC2626' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626' }}>{activityMetrics.overdueCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {activityMetrics.openCount} total open activities
          </div>
        </div>
      </div>

      {/* Grid Section 1: Department Distribution & Presence Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <HorizontalBarChart title="Headcount by Department" items={breakdowns?.byDepartment || []} accentColor="var(--color-primary)" />
        <StackedBarChart title="Workplace Presence Distribution Today" segments={presenceSegments} totalCount={presenceMetrics.totalWorkforce} />
      </div>

      {/* Grid Section 2: Work Mode Distribution & Quick Operational Links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <StackedBarChart title="Work Arrangement Distribution (Work Mode)" segments={workModeSegments} totalCount={workforceMetrics.totalHeadcount} />

        {/* Operational Quick Actions Panel */}
        <div className="table-container-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-main)' }}>
              Operational Management Quick Links
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Action summary indicators linking directly to active module views:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <Link to="/activities/overdue" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', borderRadius: '6px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', textDecoration: 'none', fontSize: '0.825rem', fontWeight: 600 }}>
                <span>Review {activityMetrics.overdueCount} Overdue Tasks</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/offboarding/departing" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', borderRadius: '6px', backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', color: '#B45309', textDecoration: 'none', fontSize: '0.825rem', fontWeight: 600 }}>
                <span>Manage {offboardingMetrics.departingCount} Departing Employees</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/onboarding/dashboard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', borderRadius: '6px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', textDecoration: 'none', fontSize: '0.825rem', fontWeight: 600 }}>
                <span>Track {onboardingMetrics.activePlansCount} Active Onboarding Plans</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
