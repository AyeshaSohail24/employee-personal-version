import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';

// Every page is its own lazily-loaded chunk — see lazyPages.js (and AppShell's idle prefetch).
import { pages } from './lazyPages';

const {
  DashboardPage,
  AllEmployeesPage,
  PersonnelDetailsPage,
  UpcomingPage,
  CandidateThreadPage,
  OnboardingEmployeesPage,
  OnboardingEmployeeDetailPage,
  OnboardingPlansPage,
  PlanEditorPage,
  OffboardingDepartingPage,
  OffboardingEmployeeDetailPage,
  OffboardingPlansPage,
  OffboardingPlanEditorPage,
  MyNotesPage,
  PinnedNotesPage,
  ArchivedNotesPage,
  FormerPersonnelPage,
  HistoricalRecordPage,
  NotFoundPage,
} = pages;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },

      // Employees route (Single Employee Directory)
      { path: 'employees', element: <AllEmployeesPage /> },
      { path: 'employees/:employeeId', element: <PersonnelDetailsPage /> },

      // Upcoming route (shortlisted candidate / offer workflow, pre-onboarding)
      { path: 'upcoming', element: <UpcomingPage /> },
      { path: 'upcoming/:candidateId', element: <CandidateThreadPage /> },

      // Onboarding routes
      {
        path: 'onboarding',
        children: [
          { index: true, element: <Navigate to="/onboarding/employees" replace /> },
          { path: 'employees', element: <OnboardingEmployeesPage /> },
          { path: 'employees/:employeeId', element: <OnboardingEmployeeDetailPage /> },
          { path: 'plans', element: <OnboardingPlansPage /> },
          { path: 'plans/:personType/universal', element: <PlanEditorPage /> },
          { path: 'plans/:personType/department/:departmentId', element: <PlanEditorPage /> },
        ],
      },

      // Offboarding routes
      {
        path: 'offboarding',
        children: [
          { index: true, element: <Navigate to="/offboarding/departing" replace /> },
          // Legacy Dashboard route — its unique content (KPI cards + overdue exit tasks) was
          // consolidated into the canonical Offboarding Progress page below; this redirect keeps
          // any old bookmarked/shared /offboarding/dashboard link from landing on a 404.
          { path: 'dashboard', element: <Navigate to="/offboarding/departing" replace /> },
          { path: 'departing', element: <OffboardingDepartingPage /> },
          { path: 'employees/:employeeId', element: <OffboardingEmployeeDetailPage /> },
          { path: 'plans', element: <OffboardingPlansPage /> },
          { path: 'plans/:personType/universal', element: <OffboardingPlanEditorPage /> },
          { path: 'plans/:personType/department/:departmentId', element: <OffboardingPlanEditorPage /> },
        ],
      },

      // Former Personnel routes (historical, lifecycle-filtered view — status: Former — over the
      // same Personnel identity employeeService already owns; no duplicate dataset)
      { path: 'former', element: <FormerPersonnelPage /> },
      { path: 'former/:employeeId', element: <HistoricalRecordPage /> },

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

