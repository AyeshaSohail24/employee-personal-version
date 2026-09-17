import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, UserPlus, UserMinus, UserX, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { dashboardService } from '../../services/dashboardService';
import StatCard from '../../components/dashboard/StatCard';
import EndingWithin7DaysWidget from '../../components/dashboard/EndingWithin7DaysWidget';
import SoonestDueTasksWidget from '../../components/dashboard/SoonestDueTasksWidget';
import DashboardSkeleton from '../../components/dashboard/DashboardSkeleton';
import PersonnelProfileModal from '../../components/employees/PersonnelProfileModal';

// Same 3-way segmented control style already used elsewhere in the app (e.g. Launch Plan's
// employee/intern picker) — this is a PERSONNEL TYPE filter, not a lifecycle status filter.
const PERSONNEL_TYPE_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'Employee', label: 'Employees' },
  { value: 'Intern', label: 'Interns' },
];

export default function DashboardPage() {
  const [personnelType, setPersonnelType] = useState('All');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileEmployeeId, setProfileEmployeeId] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await dashboardService.getDashboardSummary({ personnelType });
      setData(summary);
    } catch (err) {
      console.error('DashboardPage: Failed to fetch dashboard summary', err);
      setError('Unable to load HR dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [personnelType]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const personnelTypeSwitcher = (
    <div className="view-switcher-group">
      {PERSONNEL_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`view-btn ${personnelType === opt.value ? 'active' : ''}`}
          onClick={() => setPersonnelType(opt.value)}
        >
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div>
        <div className="page-header dashboard-page-header">
          <div>
            <h1 className="page-title">HR Dashboard</h1>
            <p className="page-description">Personnel lifecycle counts and upcoming end dates</p>
          </div>
          {personnelTypeSwitcher}
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header dashboard-page-header">
          <div>
            <h1 className="page-title">HR Dashboard</h1>
            <p className="page-description">Personnel lifecycle counts and upcoming end dates</p>
          </div>
          {personnelTypeSwitcher}
        </div>
        <div className="placeholder-card" style={{ borderColor: '#FCA5A5' }}>
          <div className="placeholder-icon" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
            <AlertCircle size={28} />
          </div>
          <h2 className="placeholder-title">{error}</h2>
          <button className="tag-badge" style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }} onClick={fetchDashboardData}>
            <RefreshCw size={14} /> Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const { metrics, endingWithin7Days } = data;

  return (
    <div className="dashboard-page-wrapper">
      {/* Header Title + Personnel Type Filter */}
      <div className="page-header dashboard-page-header">
        <div>
          <h1 className="page-title">HR Dashboard</h1>
          <p className="page-description">Personnel lifecycle counts and upcoming end dates</p>
        </div>
        {personnelTypeSwitcher}
      </div>

      {/* 1. Five Lifecycle Count Cards — information-only (no navigation/linkTo): these summarize
          counts, they don't drill into Personnel. See Personnel module for detailed records. */}
      <div className="stat-cards-grid">
        <StatCard
          icon={Clock}
          title="Upcoming"
          value={metrics.upcomingCount}
          subtitle="Scheduled to start"
          badgeBg="#EFF6FF"
          badgeColor="#2563EB"
        />

        <StatCard
          icon={UserPlus}
          title="Onboarding"
          value={metrics.onboardingCount}
          subtitle="Currently onboarding"
          badgeBg="var(--color-primary-light)"
          badgeColor="var(--color-primary)"
        />

        <StatCard
          icon={UserCheck}
          title="Active"
          value={metrics.activeCount}
          subtitle="Currently active personnel"
          badgeBg="#ECFDF5"
          badgeColor="#059669"
        />

        <StatCard
          icon={UserMinus}
          title="Offboarding"
          value={metrics.departingCount}
          subtitle="Currently in offboarding"
          badgeBg="#FFFBEB"
          badgeColor="#D97706"
        />

        <StatCard
          icon={UserX}
          title="Former"
          value={metrics.formerCount}
          subtitle="Historical personnel records"
          badgeBg="#F1F5F9"
          badgeColor="#64748B"
        />
      </div>

      {/* 2. Ending Within 7 Days + Soonest Due Tasks — side by side (never a single stretched
          full-width bar), each with its OWN internal vertical scroll past a bounded height so a
          widget with many rows never grows the page itself taller. Workforce Lifecycle
          Distribution was removed earlier (redundant with the 5 lifecycle count cards above). */}
      <div className="dashboard-widgets-row" style={{ marginTop: '2.25rem' }}>
        <EndingWithin7DaysWidget people={endingWithin7Days} onViewProfile={setProfileEmployeeId} />
        <SoonestDueTasksWidget />
      </div>

      {/* Personnel Profile Modal — reuses the SAME modal the Personnel directory's own View
          Profile action uses; no second profile implementation. */}
      <PersonnelProfileModal
        isOpen={Boolean(profileEmployeeId)}
        onClose={() => setProfileEmployeeId(null)}
        employeeId={profileEmployeeId}
      />
    </div>
  );
}
