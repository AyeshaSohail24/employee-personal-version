import { employeeService } from './employeeService.js';

// The Interns DB calls the offboarding stage "Offboarding"; older local records may say "Departing".
// Both count as Offboarding on the Dashboard.
const STATUS_ALIASES = { Departing: 'Offboarding' };

/**
 * Service providing aggregated summary metrics for the HR Dashboard.
 */
export const dashboardService = {
  /**
   * Retrieves aggregated data for the Dashboard overview, optionally scoped to one personnel
   * type. `personnelType` filtering happens ONCE, immediately after loading the hydrated
   * employee set — every dashboard area (lifecycle counts, distribution, Ending Within 7 Days)
   * is then calculated from that SAME filtered array, so the three areas can never disagree with
   * each other for a given filter selection.
   *
   * @param {Object} [options]
   * @param {'All'|'Employee'|'Intern'} [options.personnelType='All']
   * @param {string} [options.referenceDate] - 'YYYY-MM-DD', defaults to today (local)
   * @returns {Promise<Object>} Dashboard summary object
   */
  async getDashboardSummary({ personnelType = 'All' } = {}) {
    const allEmployees = await employeeService.getAll({ hydrate: true });

    const personnel = personnelType === 'All'
      ? allEmployees
      : allEmployees.filter((e) => e.directoryType === personnelType);

    // Calculate individual lifecycle counts — 5 separate states, never combined.
    const counts = {
      Upcoming: 0,
      Onboarding: 0,
      Active: 0,
      Offboarding: 0,
      Former: 0,
    };

    personnel.forEach((emp) => {
      const status = STATUS_ALIASES[emp.status] ?? emp.status;
      if (counts[status] !== undefined) {
        counts[status] += 1;
      }
    });

    const total = personnel.length;

    // Build lifecycle distribution array for all 5 statuses, in dashboard display order.
    // Percentage denominator is ALWAYS `total` (the currently-filtered set) — never the
    // unfiltered All-personnel total — so switching the personnel-type filter recalculates every
    // percentage against its own correct base. Safe against 0 total (no NaN/divide-by-zero).
    const lifecycleDistribution = ['Upcoming', 'Onboarding', 'Active', 'Offboarding', 'Former'].map((status) => {
      const count = counts[status];
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return { status, count, percentage };
    });

    return {
      personnelType,
      total,
      metrics: {
        total,
        upcomingCount: counts.Upcoming,
        onboardingCount: counts.Onboarding,
        activeCount: counts.Active,
        departingCount: counts.Offboarding,
        formerCount: counts.Former,
      },
      lifecycleDistribution,
    };
  },
};
