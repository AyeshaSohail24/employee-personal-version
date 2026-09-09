import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';

import DashboardPage from '../pages/dashboard/DashboardPage';

// Employees Page
import AllEmployeesPage from '../pages/employees/AllEmployeesPage';

// Onboarding Pages
import OnboardingDashboardPage from '../pages/onboarding/OnboardingDashboardPage';
import OnboardingEmployeesPage from '../pages/onboarding/OnboardingEmployeesPage';
import OnboardingEmployeeDetailPage from '../pages/onboarding/OnboardingEmployeeDetailPage';
import OnboardingPlansPage from '../pages/onboarding/OnboardingPlansPage';
import PlanEditorPage from '../pages/onboarding/PlanEditorPage';

// Offboarding Pages
import OffboardingDashboardPage from '../pages/offboarding/OffboardingDashboardPage';
import OffboardingDepartingPage from '../pages/offboarding/OffboardingDepartingPage';
import OffboardingEmployeeDetailPage from '../pages/offboarding/OffboardingEmployeeDetailPage';
import OffboardingPlansPage from '../pages/offboarding/OffboardingPlansPage';
import OffboardingPlanEditorPage from '../pages/offboarding/PlanEditorPage';

// Activities Pages
import MyActivitiesPage from '../pages/activities/MyActivitiesPage';
import AllActivitiesPage from '../pages/activities/AllActivitiesPage';
import OverdueActivitiesPage from '../pages/activities/OverdueActivitiesPage';

import NotFoundPage from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },

      // Employees route (Single Employee Directory)
      { path: 'employees', element: <AllEmployeesPage /> },

      // Onboarding routes
      {
        path: 'onboarding',
        children: [
          { index: true, element: <Navigate to="/onboarding/dashboard" replace /> },
          { path: 'dashboard', element: <OnboardingDashboardPage /> },
          { path: 'employees', element: <OnboardingEmployeesPage /> },
          { path: 'employees/:employeeId', element: <OnboardingEmployeeDetailPage /> },
          { path: 'plans', element: <OnboardingPlansPage /> },
          { path: 'plans/new', element: <PlanEditorPage /> },
          { path: 'plans/:planId/edit', element: <PlanEditorPage /> },
        ],
      },

      // Offboarding routes
      {
        path: 'offboarding',
        children: [
          { index: true, element: <Navigate to="/offboarding/dashboard" replace /> },
          { path: 'dashboard', element: <OffboardingDashboardPage /> },
          { path: 'departing', element: <OffboardingDepartingPage /> },
          { path: 'employees/:employeeId', element: <OffboardingEmployeeDetailPage /> },
          { path: 'plans', element: <OffboardingPlansPage /> },
          { path: 'plans/new', element: <OffboardingPlanEditorPage /> },
          { path: 'plans/:planId/edit', element: <OffboardingPlanEditorPage /> },
        ],
      },

      // Activities routes
      {
        path: 'activities',
        children: [
          { index: true, element: <Navigate to="/activities/my" replace /> },
          { path: 'my', element: <MyActivitiesPage /> },
          { path: 'all', element: <AllActivitiesPage /> },
          { path: 'overdue', element: <OverdueActivitiesPage /> },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

