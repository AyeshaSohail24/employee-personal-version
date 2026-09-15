import { employeeService } from './employeeService.js';
import { getDaysDifference, getTodayLocalDateString } from '../utils/dateUtils.js';

// Statuses whose CURRENT actual end date (contractEndDate) is operationally meaningful for an
// "approaching end of current period" alert. Deliberately excludes:
// - Upcoming: hasn't started yet, nothing is "ending".
// - Onboarding: at the START of their lifecycle — even though the data model allows a
//   contractEndDate to be set this early (e.g. a fixed-term internship), surfacing them here
//   would conflate "just beginning" with "wrapping up", which is not what this widget is for.
// - Former: contractEndDate is a HISTORICAL fact by definition once someone is Former — it will
//   always be in the past (or coincidentally reused for a data quirk), never a live "ending soon"
//   signal, so Former is excluded regardless of what the date math would say.
const ENDING_SOON_ELIGIBLE_STATUSES = ['Active', 'Departing'];
const ENDING_SOON_WINDOW_DAYS = 7;

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
  async getDashboardSummary({ personnelType = 'All', referenceDate = getTodayLocalDateString() } = {}) {
    const allEmployees = await employeeService.getAll({ hydrate: true });

    const personnel = personnelType === 'All'
      ? allEmployees
      : allEmployees.filter((e) => e.directoryType === personnelType);

    // Calculate individual lifecycle counts — 5 separate states, never combined.
    const counts = {
      Upcoming: 0,
      Onboarding: 0,
      Active: 0,
      Departing: 0,
      Former: 0,
    };

    personnel.forEach((emp) => {
      if (counts[emp.status] !== undefined) {
        counts[emp.status] += 1;
      }
    });

    const total = personnel.length;

    // Build lifecycle distribution array for all 5 statuses, in dashboard display order.
    // Percentage denominator is ALWAYS `total` (the currently-filtered set) — never the
    // unfiltered All-personnel total — so switching the personnel-type filter recalculates every
    // percentage against its own correct base. Safe against 0 total (no NaN/divide-by-zero).
    const lifecycleDistribution = ['Upcoming', 'Onboarding', 'Active', 'Departing', 'Former'].map((status) => {
      const count = counts[status];
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return { status, count, percentage };
    });

    // Ending Within 7 Days: 0 <= daysUntilEnd <= 7, inclusive, using the person's own canonical
    // contractEndDate (the SAME field the Personnel directory's Dates column and Duration
    // calculation already use — never a separate dashboard-only end date). getDaysDifference()
    // does pure YYYY-MM-DD string date math (no time-of-day component), so a person can never
    // disappear from the list due to time-of-day/timezone comparison quirks. Missing or
    // malformed contractEndDate values safely resolve to NaN, which fails every numeric
    // comparison below and is therefore naturally excluded — no crash, no fabricated date.
    const endingWithin7Days = personnel
      .filter((emp) => ENDING_SOON_ELIGIBLE_STATUSES.includes(emp.status) && emp.contractEndDate)
      .map((emp) => ({
        ...emp,
        daysUntilEnd: getDaysDifference(emp.contractEndDate, referenceDate),
      }))
      .filter((emp) => Number.isFinite(emp.daysUntilEnd) && emp.daysUntilEnd >= 0 && emp.daysUntilEnd <= ENDING_SOON_WINDOW_DAYS)
      .sort((a, b) => a.daysUntilEnd - b.daysUntilEnd || a.fullName.localeCompare(b.fullName));

    return {
      personnelType,
      total,
      metrics: {
        total,
        upcomingCount: counts.Upcoming,
        onboardingCount: counts.Onboarding,
        activeCount: counts.Active,
        departingCount: counts.Departing,
        formerCount: counts.Former,
      },
      lifecycleDistribution,
      endingWithin7Days,
    };
  },
};
