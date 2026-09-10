import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';

import DashboardPage from '../pages/dashboard/DashboardPage';

// Employees Page
import AllEmployeesPage from '../pages/employees/AllEmployeesPage';

// Upcoming (Candidate / Offer Workflow) Page
import UpcomingPage from '../pages/upcoming/UpcomingPage';

// Onboarding Pages
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

// Notes Pages (personal HR notepad — replaces the old Activities module)
import MyNotesPage from '../pages/notes/MyNotesPage';
import PinnedNotesPage from '../pages/notes/PinnedNotesPage';
import ArchivedNotesPage from '../pages/notes/ArchivedNotesPage';

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

      // Upcoming route (shortlisted candidate / offer workflow, pre-onboarding)
      { path: 'upcoming', element: <UpcomingPage /> },

      // Onboarding routes
      {
        path: 'onboarding',
        children: [
          { index: true, element: <Navigate to="/onboarding/employees" replace /> },
          { path: 'employees', element: <OnboardingEmployeesPage /> },
          { path: 'employees/:employeeId', element: <OnboardingEmployeeDetailPage /> },
          { path: 'plans', element: <OnboardingPlansPage /> },
          { path: 'plans/:scopeSegment', element: <PlanEditorPage /> },
          { path: 'plans/:scopeSegment/:departmentId', element: <PlanEditorPage /> },
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

      // Notes routes (personal HR notepad)
      {
        path: 'notes',
        children: [
          { index: true, element: <MyNotesPage /> },
          { path: 'pinned', element: <PinnedNotesPage /> },
          { path: 'archived', element: <ArchivedNotesPage /> },
        ],
      },

      // Legacy Activities routes — the Activities module was removed; these are safety
      // redirects only (not exposed anywhere in the UI) so any old bookmarked/shared link
      // lands somewhere useful instead of a dead 404.
      { path: 'activities', element: <Navigate to="/notes" replace /> },
      { path: 'activities/my', element: <Navigate to="/notes" replace /> },
      { path: 'activities/all', element: <Navigate to="/notes" replace /> },
      { path: 'activities/overdue', element: <Navigate to="/notes" replace /> },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

