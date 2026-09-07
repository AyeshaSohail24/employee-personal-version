import { employeeService } from './employeeService.js';
import { employmentRecordService } from './employmentRecordService.js';
import { departmentService } from './departmentService.js';
import { locationService } from './locationService.js';
import { positionService } from './positionService.js';
import { presenceService } from './presenceService.js';
import { activityService } from './activityService.js';
import { onboardingService } from './onboardingService.js';
import { offboardingService } from './offboardingService.js';
import { getCurrentWorkforce } from '../domain/employmentDomain.js';
import {
  calculateWorkforceMetrics,
  calculateHeadcountBreakdowns,
  calculatePresenceAnalytics,
  calculateActivityAnalytics,
  calculateOnboardingAnalytics,
  calculateOffboardingAnalytics,
  filterReportDataset,
  applyCanonicalManagerScoping,
  enrichReportingEmployeeList,
} from '../domain/reportingDomain.js';

export const reportingService = {
  /**
   * Helper to load base datasets and apply canonical Manager role scoping if applicable.
   */
  async _loadBaseData({ roleContext = {}, userEmployeeId = '', referenceDate = new Date() } = {}) {
    const [employees, records, departments, locations, positions] = await Promise.all([
      employeeService.getAll({ hydrate: true }),
      employmentRecordService.getAll(),
      departmentService.getAll(),
      locationService.getAll(),
      positionService.getAll(),
    ]);

    let scopedEmployees = employees;
    if (roleContext.isManager && userEmployeeId) {
      scopedEmployees = applyCanonicalManagerScoping(employees, records, userEmployeeId, referenceDate);
    }

    return {
      employees: scopedEmployees,
      records,
      departments,
      locations,
      positions,
      isRestricted: roleContext.isEmployee,
    };
  },

  /**
   * Gets Workforce Overview report data.
   */
  async getWorkforceOverviewReport(params = {}) {
    const { referenceDate = '2026-09-03', filters = {}, roleContext = {}, userEmployeeId = '' } = params;

    const base = await this._loadBaseData({ roleContext, userEmployeeId, referenceDate });
    if (base.isRestricted) return { isRestricted: true };

    const currentWorkforce = getCurrentWorkforce(base.employees, base.records, referenceDate);
    const filteredEmployees = filterReportDataset(currentWorkforce, filters);

    const workforceMetrics = calculateWorkforceMetrics(base.employees, base.records, referenceDate);
    const presenceOverview = await presenceService.getPresenceOverview({ referenceDate, ...filters });
    const presenceMetrics = calculatePresenceAnalytics(presenceOverview);

    const activities = await activityService.getAll();
    const activityMetrics = calculateActivityAnalytics(activities, referenceDate);

    const [onboardingInstances, onboardingTemplates, offboardingInstances, offboardingTemplates] =
      await Promise.all([
        onboardingService.getAllInstances(),
        onboardingService.getAllTemplates(),
        offboardingService.getAllInstances(),
        offboardingService.getAllTemplates(),
      ]);

    const onboardingMetrics = calculateOnboardingAnalytics(onboardingInstances, onboardingTemplates, base.employees);
    const offboardingMetrics = calculateOffboardingAnalytics(offboardingInstances, offboardingTemplates, base.employees);
    const breakdowns = calculateHeadcountBreakdowns(
      filteredEmployees,
      base.records,
      base.departments,
      base.locations,
      base.positions,
      referenceDate
    );

    return {
      isRestricted: false,
      workforceMetrics,
      presenceMetrics,
      activityMetrics,
      onboardingMetrics,
      offboardingMetrics,
      breakdowns,
      departments: base.departments,
    };
  },

  /**
   * Gets Headcount Breakdown report data.
   * Strictly filters roster to Current Workforce (15 employees) and enriches all metadata.
   */
  async getHeadcountReport(params = {}) {
    const { referenceDate = '2026-09-03', filters = {}, roleContext = {}, userEmployeeId = '' } = params;

    const base = await this._loadBaseData({ roleContext, userEmployeeId, referenceDate });
    if (base.isRestricted) return { isRestricted: true };

    const currentWorkforce = getCurrentWorkforce(base.employees, base.records, referenceDate);
    const filteredWorkforce = filterReportDataset(currentWorkforce, filters);
    const enrichedWorkforce = enrichReportingEmployeeList(filteredWorkforce);

    const workforceMetrics = calculateWorkforceMetrics(base.employees, base.records, referenceDate);
    const breakdowns = calculateHeadcountBreakdowns(
      currentWorkforce,
      base.records,
      base.departments,
      base.locations,
      base.positions,
      referenceDate
    );

    return {
      isRestricted: false,
      workforceMetrics,
      breakdowns,
      employees: enrichedWorkforce,
      departments: base.departments,
      locations: base.locations,
    };
  },

  /**
   * Gets Hires & Onboarding Pipeline report data.
   */
  async getHiresReport(params = {}) {
    const { referenceDate = '2026-09-03', filters = {}, roleContext = {}, userEmployeeId = '' } = params;

    const base = await this._loadBaseData({ roleContext, userEmployeeId, referenceDate });
    if (base.isRestricted) return { isRestricted: true };

    const [onboardingInstances, onboardingTemplates] = await Promise.all([
      onboardingService.getAllInstances(),
      onboardingService.getAllTemplates(),
    ]);

    const onboardingMetrics = calculateOnboardingAnalytics(onboardingInstances, onboardingTemplates, base.employees);
    const newJoiners = base.employees.filter((e) => e.status === 'Onboarding' || e.status === 'Upcoming');
    const filteredNewJoiners = filterReportDataset(newJoiners, filters);
    const enrichedNewJoiners = enrichReportingEmployeeList(filteredNewJoiners);

    return {
      isRestricted: false,
      onboardingMetrics,
      newJoiners: enrichedNewJoiners,
      instances: onboardingInstances,
      departments: base.departments,
    };
  },

  /**
   * Gets Departures & Offboarding report data.
   */
  async getDeparturesReport(params = {}) {
    const { referenceDate = '2026-09-03', filters = {}, roleContext = {}, userEmployeeId = '' } = params;

    const base = await this._loadBaseData({ roleContext, userEmployeeId, referenceDate });
    if (base.isRestricted) return { isRestricted: true };

    const [offboardingInstances, offboardingTemplates] = await Promise.all([
      offboardingService.getAllInstances(),
      offboardingService.getAllTemplates(),
    ]);

    const offboardingMetrics = calculateOffboardingAnalytics(offboardingInstances, offboardingTemplates, base.employees);
    const departingAndFormer = base.employees.filter((e) => e.status === 'Departing' || e.status === 'Former');
    const filteredDeparting = filterReportDataset(departingAndFormer, filters);
    const enrichedDeparting = enrichReportingEmployeeList(filteredDeparting, offboardingInstances);

    return {
      isRestricted: false,
      offboardingMetrics,
      departingEmployees: enrichedDeparting,
      instances: offboardingInstances,
      departments: base.departments,
    };
  },

  /**
   * Gets Operational Health report data.
   */
  async getOperationalHealthReport(params = {}) {
    const { referenceDate = '2026-09-03', filters = {}, roleContext = {}, userEmployeeId = '' } = params;

    const base = await this._loadBaseData({ roleContext, userEmployeeId, referenceDate });
    if (base.isRestricted) return { isRestricted: true };

    const presenceOverview = await presenceService.getPresenceOverview({ referenceDate, ...filters });
    const presenceMetrics = calculatePresenceAnalytics(presenceOverview);

    const activities = await activityService.getAll();
    const activityMetrics = calculateActivityAnalytics(activities, referenceDate);

    return {
      isRestricted: false,
      presenceMetrics,
      activityMetrics,
      departments: base.departments,
    };
  },
};
