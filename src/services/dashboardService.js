import { employeeService } from './employeeService.js';
import { departmentService } from './departmentService.js';

/**
 * Service providing aggregated summary metrics for the HR Dashboard.
 */
export const dashboardService = {
  /**
   * Retrieves aggregated data for the Dashboard overview.
   * @returns {Promise<Object>} Dashboard summary object
   */
  async getDashboardSummary() {
    const employees = await employeeService.getAll({ hydrate: true });
    const departments = await departmentService.getAll({ withCount: true });

    // Calculate individual lifecycle counts
    const counts = {
      Active: 0,
      Onboarding: 0,
      Upcoming: 0,
      Departing: 0,
      Former: 0,
    };

    employees.forEach((emp) => {
      if (counts[emp.status] !== undefined) {
        counts[emp.status] += 1;
      }
    });

    const total = employees.length;

    // Build lifecycle distribution array for all 5 statuses
    const lifecycleDistribution = Object.keys(counts).map((status) => {
      const count = counts[status];
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        status,
        count,
        percentage,
      };
    });

    // New Joiners widget: Onboarding & Upcoming employees
    const newJoinersAndUpcoming = employees
      .filter((e) => e.status === 'Onboarding' || e.status === 'Upcoming')
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

    // Departing widget: Departing employees
    const departingEmployees = employees.filter((e) => e.status === 'Departing');

    // Department snapshot: Active departments sorted by currentHeadcount
    const departmentSnapshot = departments
      .filter((d) => d.currentHeadcount > 0)
      .sort((a, b) => b.currentHeadcount - a.currentHeadcount);

    return {
      totalEmployees: total,
      metrics: {
        totalEmployees: total,
        activeCount: counts.Active,
        onboardingCount: counts.Onboarding,
        upcomingCount: counts.Upcoming,
        newJoinersGroupCount: counts.Onboarding + counts.Upcoming,
        departingCount: counts.Departing,
        formerCount: counts.Former,
      },
      lifecycleDistribution,
      newJoinersAndUpcoming,
      departingEmployees,
      departmentSnapshot,
    };
  },
};
