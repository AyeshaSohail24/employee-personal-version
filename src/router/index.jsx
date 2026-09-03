import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';

import DashboardPage from '../pages/dashboard/DashboardPage';

// Employees Pages
import AllEmployeesPage from '../pages/employees/AllEmployeesPage';
import ActiveEmployeesPage from '../pages/employees/ActiveEmployeesPage';
import NewJoinersPage from '../pages/employees/NewJoinersPage';
import DepartingEmployeesPage from '../pages/employees/DepartingEmployeesPage';
import FormerEmployeesPage from '../pages/employees/FormerEmployeesPage';

// Presence Page
import PresencePage from '../pages/presence/PresencePage';

// Organization Pages
import DepartmentsPage from '../pages/organization/DepartmentsPage';
import OrgChartPage from '../pages/organization/OrgChartPage';
import JobPositionsPage from '../pages/organization/JobPositionsPage';
import WorkLocationsPage from '../pages/organization/WorkLocationsPage';

// Onboarding Pages
import OnboardingDashboardPage from '../pages/onboarding/OnboardingDashboardPage';
import OnboardingEmployeesPage from '../pages/onboarding/OnboardingEmployeesPage';
import OnboardingPlansPage from '../pages/onboarding/OnboardingPlansPage';

// Offboarding Pages
import OffboardingDashboardPage from '../pages/offboarding/OffboardingDashboardPage';
import OffboardingDepartingPage from '../pages/offboarding/OffboardingDepartingPage';
import OffboardingPlansPage from '../pages/offboarding/OffboardingPlansPage';

// Activities Pages
import MyActivitiesPage from '../pages/activities/MyActivitiesPage';
import AllActivitiesPage from '../pages/activities/AllActivitiesPage';
import OverdueActivitiesPage from '../pages/activities/OverdueActivitiesPage';

// Reporting Pages
import WorkforceOverviewPage from '../pages/reporting/WorkforceOverviewPage';
import HeadcountReportPage from '../pages/reporting/HeadcountReportPage';
import HiresReportPage from '../pages/reporting/HiresReportPage';
import DeparturesReportPage from '../pages/reporting/DeparturesReportPage';
import RetentionReportPage from '../pages/reporting/RetentionReportPage';

// Configuration Pages
import OrganizationConfigPage from '../pages/configuration/OrganizationConfigPage';
import EmployeesConfigPage from '../pages/configuration/EmployeesConfigPage';
import PresenceConfigPage from '../pages/configuration/PresenceConfigPage';
import LifecycleConfigPage from '../pages/configuration/LifecycleConfigPage';
import ActivitiesConfigPage from '../pages/configuration/ActivitiesConfigPage';
import DocumentsConfigPage from '../pages/configuration/DocumentsConfigPage';
import PermissionsConfigPage from '../pages/configuration/PermissionsConfigPage';

import NotFoundPage from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },

      // Presence route
      { path: 'presence', element: <PresencePage /> },

      // Employees routes
      {
        path: 'employees',
        children: [
          { index: true, element: <AllEmployeesPage /> },
          { path: 'active', element: <ActiveEmployeesPage /> },
          { path: 'new-joiners', element: <NewJoinersPage /> },
          { path: 'departing', element: <DepartingEmployeesPage /> },
          { path: 'former', element: <FormerEmployeesPage /> },
          { path: 'presence', element: <PresencePage /> },
        ],
      },

      // Organization routes
      {
        path: 'organization',
        children: [
          { path: 'departments', element: <DepartmentsPage /> },
          { path: 'org-chart', element: <OrgChartPage /> },
          { path: 'job-positions', element: <JobPositionsPage /> },
          { path: 'work-locations', element: <WorkLocationsPage /> },
        ],
      },

      // Onboarding routes
      {
        path: 'onboarding',
        children: [
          { path: 'dashboard', element: <OnboardingDashboardPage /> },
          { path: 'employees', element: <OnboardingEmployeesPage /> },
          { path: 'plans', element: <OnboardingPlansPage /> },
        ],
      },

      // Offboarding routes
      {
        path: 'offboarding',
        children: [
          { path: 'dashboard', element: <OffboardingDashboardPage /> },
          { path: 'departing', element: <OffboardingDepartingPage /> },
          { path: 'plans', element: <OffboardingPlansPage /> },
        ],
      },

      // Activities routes
      {
        path: 'activities',
        children: [
          { path: 'my', element: <MyActivitiesPage /> },
          { path: 'all', element: <AllActivitiesPage /> },
          { path: 'overdue', element: <OverdueActivitiesPage /> },
        ],
      },

      // Reporting routes
      {
        path: 'reporting',
        children: [
          { path: 'overview', element: <WorkforceOverviewPage /> },
          { path: 'headcount', element: <HeadcountReportPage /> },
          { path: 'hires', element: <HiresReportPage /> },
          { path: 'departures', element: <DeparturesReportPage /> },
          { path: 'retention', element: <RetentionReportPage /> },
        ],
      },

      // Configuration routes
      {
        path: 'configuration',
        children: [
          { path: 'organization', element: <OrganizationConfigPage /> },
          { path: 'employees', element: <EmployeesConfigPage /> },
          { path: 'presence', element: <PresenceConfigPage /> },
          { path: 'lifecycle', element: <LifecycleConfigPage /> },
          { path: 'activities', element: <ActivitiesConfigPage /> },
          { path: 'documents', element: <DocumentsConfigPage /> },
          { path: 'permissions', element: <PermissionsConfigPage /> },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
