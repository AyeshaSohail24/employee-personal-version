import { lazy } from 'react';

// One loader per page. Each is a separate chunk (Vite splits on dynamic import()), and calling a
// loader a second time just returns the already-loaded module, so prefetchAllPages() warming them
// up means React.lazy() resolves instantly when the user actually navigates there.
const loaders = {
  DashboardPage: () => import('../pages/dashboard/DashboardPage'),
  AllEmployeesPage: () => import('../pages/employees/AllEmployeesPage'),
  PersonnelDetailsPage: () => import('../pages/employees/PersonnelDetailsPage'),
  UpcomingPage: () => import('../pages/upcoming/UpcomingPage'),
  CandidateThreadPage: () => import('../pages/upcoming/CandidateThreadPage'),
  OnboardingEmployeesPage: () => import('../pages/onboarding/OnboardingEmployeesPage'),
  OnboardingEmployeeDetailPage: () => import('../pages/onboarding/OnboardingEmployeeDetailPage'),
  OnboardingPlansPage: () => import('../pages/onboarding/OnboardingPlansPage'),
  PlanEditorPage: () => import('../pages/onboarding/PlanEditorPage'),
  OffboardingDepartingPage: () => import('../pages/offboarding/OffboardingDepartingPage'),
  OffboardingEmployeeDetailPage: () => import('../pages/offboarding/OffboardingEmployeeDetailPage'),
  OffboardingPlansPage: () => import('../pages/offboarding/OffboardingPlansPage'),
  OffboardingPlanEditorPage: () => import('../pages/offboarding/PlanEditorPage'),
  MyNotesPage: () => import('../pages/notes/MyNotesPage'),
  PinnedNotesPage: () => import('../pages/notes/PinnedNotesPage'),
  ArchivedNotesPage: () => import('../pages/notes/ArchivedNotesPage'),
  FormerPersonnelPage: () => import('../pages/former/FormerPersonnelPage'),
  HistoricalRecordPage: () => import('../pages/former/HistoricalRecordPage'),
  NotFoundPage: () => import('../pages/NotFoundPage'),
};

export const pages = Object.fromEntries(
  Object.entries(loaders).map(([name, load]) => [name, lazy(load)]),
);

export function prefetchAllPages() {
  for (const load of Object.values(loaders)) load().catch(() => {});
}
