import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserPlus, UserMinus, UserX, AlertCircle, RefreshCw } from 'lucide-react';
import { dashboardService } from '../../services/dashboardService';
import StatCard from '../../components/dashboard/StatCard';
import LifecycleDistribution from '../../components/dashboard/LifecycleDistribution';
import NewJoinersWidget from '../../components/dashboard/NewJoinersWidget';
import DepartingWidget from '../../components/dashboard/DepartingWidget';
import DepartmentSnapshotWidget from '../../components/dashboard/DepartmentSnapshotWidget';
import DashboardSkeleton from '../../components/dashboard/DashboardSkeleton';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await dashboardService.getDashboardSummary();
      setData(summary);
    } catch (err) {
      console.error('DashboardPage: Failed to fetch dashboard summary', err);
      setError('Unable to load HR dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">HR Dashboard</h1>
            <p className="page-description">Workforce headcount, lifecycle distribution, and organization snapshot</p>
          </div>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">HR Dashboard</h1>
            <p className="page-description">Workforce headcount, lifecycle distribution, and organization snapshot</p>
          </div>
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

  const { metrics, lifecycleDistribution, newJoinersAndUpcoming, departingEmployees, departmentSnapshot } = data;
  const currentWorkforceHeadcount = metrics.activeCount + metrics.onboardingCount + metrics.departingCount;

  return (
    <div className="dashboard-page-wrapper">
      {/* Header Title */}
      <div className="page-header">
        <div>
          <h1 className="page-title">HR Dashboard</h1>
          <p className="page-description">Workforce headcount, lifecycle distribution, and organization snapshot</p>
        </div>
      </div>

      {/* 1. Stat Cards Grid */}
      <div className="stat-cards-grid">
        <StatCard
          icon={UserCheck}
          title="Active Employees"
          value={metrics.activeCount}
          subtitle="Currently employed workforce"
          linkTo="/employees/active"
          badgeBg="#ECFDF5"
          badgeColor="#059669"
        />

        <StatCard
          icon={UserPlus}
          title="New Joiners & Upcoming"
          value={metrics.newJoinersGroupCount}
          subtitle={`${metrics.onboardingCount} Onboarding · ${metrics.upcomingCount} Upcoming`}
          linkTo="/employees/new-joiners"
          badgeBg="var(--color-primary-light)"
          badgeColor="var(--color-primary)"
        />

        <StatCard
          icon={UserMinus}
          title="Departing Employees"
          value={metrics.departingCount}
          subtitle="Undergoing offboarding transition"
          linkTo="/employees/departing"
          badgeBg="#FFFBEB"
          badgeColor="#D97706"
        />

        <StatCard
          icon={UserX}
          title="Former Employees"
          value={metrics.formerCount}
          subtitle="Archived historical records"
          linkTo="/employees/former"
          badgeBg="#F1F5F9"
          badgeColor="#64748B"
        />
      </div>

      {/* 2. Lifecycle Distribution Section */}
      <div style={{ marginTop: '1.5rem' }}>
        <LifecycleDistribution distribution={lifecycleDistribution} />
      </div>

      {/* 3. Main Dashboard Widgets Grid */}
      <div className="dashboard-content-grid" style={{ marginTop: '1.5rem' }}>
        {/* Left Column: New Joiners & Departing Widgets */}
        <div className="dashboard-column-main">
          <NewJoinersWidget employees={newJoinersAndUpcoming} />
          <div style={{ marginTop: '1.5rem' }}>
            <DepartingWidget employees={departingEmployees} />
          </div>
        </div>

        {/* Right Column: Organization Snapshot Widget */}
        <div className="dashboard-column-side">
          <DepartmentSnapshotWidget departments={departmentSnapshot} totalActiveWorkforce={currentWorkforceHeadcount} />
        </div>
      </div>
    </div>
  );
}
