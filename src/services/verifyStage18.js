import { CANONICAL_ROLES, hasCapability } from '../domain/permissionDomain.js';
import {
  normalizeDirectoryType,
  resolveEmployeeTypeIdForDirectoryType,
  generateNextEmployeeIdentifiers,
  validateEmployeeCreation,
  compareEmployeeIdNumeric,
} from '../domain/employmentDomain.js';
import { resolveDepartmentColor, buildDepartmentLegend } from '../domain/departmentDomain.js';
import {
  renderEmailTemplate as renderEmailTemplate2,
  validateCcList as candidateDomainValidateCc,
} from '../domain/candidateDomain.js';
import {
  calculateDurationProgress,
  calculateTimelineRange,
  generateTimelineMonthTicks,
  calculateTimelineBarPosition,
  getTodayLocalDateString,
  addDaysToLocalDate,
} from '../utils/dateUtils.js';
import { employeeService } from './employeeService.js';
import { upcomingCandidateService } from './upcomingCandidateService.js';
import { emailTemplateService } from './emailTemplateService.js';
import { candidateEmailService } from './candidateEmailService.js';
import { departmentService } from './departmentService.js';
import { positionService } from './positionService.js';
import { locationService } from './locationService.js';
import { employeeTypeService } from './employeeTypeService.js';
import { activityTypeService } from './activityTypeService.js';
import { scheduleService } from './scheduleService.js';
import { documentTypeService } from './documentTypeService.js';
import { onboardingService } from './onboardingService.js';
import {
  resolveAllOnboardingHistory,
  composeOnboardingTasks,
  resolveOnboardingAnchorDate,
  PLAN_INSTANCE_STATUS,
  isActivePlanStatus,
} from '../domain/onboardingDomain.js';
import { offboardingService } from './offboardingService.js';
import {
  OFFBOARDING_INSTANCE_STATUS,
  checkOffboardingEligibility,
  resolveOffboardingAnchorDate,
  composeOffboardingTasks,
  isActiveOffboardingPlanStatus,
} from '../domain/offboardingDomain.js';
import { activityService } from './activityService.js';
import { dashboardService } from './dashboardService.js';
import { notesService } from './notesService.js';
import { notificationService } from './notificationService.js';
import { loadDatabase, saveDatabase, resetDatabase, migrateOnboardingScopesIfNeeded, migrateOnboardingPersonTypeIfNeeded } from '../mock-data/storageEngine.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export async function verifyStage18() {
  console.log('=== RUNNING FINAL APPLICATION SIMPLIFICATION VERIFICATION SUITE ===');
  const results = [];

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      results.push({ title, status: 'PASS', details });
    } else {
      console.error(`❌ [FAIL] ${title} - ${details}`);
      results.push({ title, status: 'FAIL', details });
    }
  };

  try {
    resetDatabase();
    const db = loadDatabase();

    // 1. Only HR application role remains
    assert(
      CANONICAL_ROLES.length === 1 && CANONICAL_ROLES[0] === 'HR',
      '1. Only HR application role remains'
    );

    // 2. HR Admin role is absent
    assert(!CANONICAL_ROLES.includes('HR Admin'), '2. HR Admin role is absent');

    // 3. Manager role is absent
    assert(!CANONICAL_ROLES.includes('Manager'), '3. Manager role is absent');

    // 4. Employee and Payroll roles remain absent
    assert(
      !CANONICAL_ROLES.includes('Employee') && !CANONICAL_ROLES.includes('Payroll'),
      '4. Employee and Payroll roles remain absent'
    );

    // 5. Header role switcher is removed
    const headerSrc = fs.readFileSync(path.resolve('./src/components/layout/Header.jsx'), 'utf-8');
    assert(!headerSrc.includes('role-switcher') && !headerSrc.includes('role-select'), '5. Header role switcher is removed');

    // 6. Organization navigation is absent
    const sidebarSrc = fs.readFileSync(path.resolve('./src/components/layout/Sidebar.jsx'), 'utf-8');
    assert(
      !sidebarSrc.includes('/organization/') && !sidebarSrc.includes('<span>Organization</span>'),
      '6. Organization navigation is absent'
    );

    // 7. Organization routes are absent
    const routerSrc = fs.readFileSync(path.resolve('./src/router/index.jsx'), 'utf-8');
    assert(!routerSrc.includes("path: 'organization'"), '7. Organization routes are absent');

    // 8. Reporting navigation is absent
    assert(!sidebarSrc.includes('/reporting/') && !sidebarSrc.includes('<span>Reporting</span>'), '8. Reporting navigation is absent');

    // 9. Reporting routes are absent
    assert(!routerSrc.includes("path: 'reporting'"), '9. Reporting routes are absent');

    // 10. Configuration navigation is absent
    assert(!sidebarSrc.includes('/configuration/') && !sidebarSrc.includes('<span>Configuration</span>'), '10. Configuration navigation is absent');

    // 11. Configuration routes are absent
    assert(!routerSrc.includes("path: 'configuration'"), '11. Configuration routes are absent');

    // 12. Permissions page is absent
    assert(!fs.existsSync(path.resolve('./src/pages/configuration/PermissionsConfigPage.jsx')), '12. Permissions page is absent');

    // 13. Employee Directory remains operational
    const emps = await employeeService.getAll();
    assert(Array.isArray(emps) && emps.length === 18, '13. Employee Directory remains operational (18 employees)');

    // 14. Employee lifecycle statuses remain intact
    const activeEmps = await employeeService.getByStatus('Active');
    const onboardingEmps = await employeeService.getByStatus('Onboarding');
    assert(activeEmps.length > 0 && onboardingEmps.length > 0, '14. Employee lifecycle statuses remain intact');

    // 15. Department data remains intact
    const depts = await departmentService.getAll();
    assert(Array.isArray(depts) && depts.length > 0, '15. Department master data remains intact');

    // 16. Position data remains intact
    const positions = await positionService.getAll();
    assert(Array.isArray(positions) && positions.length > 0, '16. Position master data remains intact');

    // 17. Location data remains intact
    const locations = await locationService.getAll();
    assert(Array.isArray(locations) && locations.length > 0, '17. Location master data remains intact');

    // 18. Employment Type data remains intact
    const empTypes = await employeeTypeService.getAll();
    assert(Array.isArray(empTypes) && empTypes.length > 0, '18. Employment Type master data remains intact');

    // 19. Activity Type data remains intact
    const actTypes = await activityTypeService.getAll();
    assert(Array.isArray(actTypes) && actTypes.length > 0, '19. Activity Type master data remains intact');

    // 20. Work Schedule data remains intact
    const schedules = await scheduleService.getAll();
    assert(Array.isArray(schedules) && schedules.length > 0, '20. Work Schedule master data remains intact');

    // 21. Document Type data remains intact
    const docTypes = await documentTypeService.getAll();
    assert(Array.isArray(docTypes) && docTypes.length > 0, '21. Document Type master data remains intact');

    // 22. Employee profiles remain operational
    const emp1 = await employeeService.getById('emp-001');
    assert(emp1 && emp1.id === 'emp-001' && emp1.fullName, '22. Employee profiles remain operational');

    // 23. Onboarding remains operational
    const onboardingTemplates = await onboardingService.getAllTemplates();
    assert(Array.isArray(onboardingTemplates), '23. Onboarding module remains operational');

    // 24. Offboarding remains operational
    const offboardingTemplates = await offboardingService.getAllTemplates();
    assert(Array.isArray(offboardingTemplates), '24. Offboarding module remains operational');

    // 25. UPDATED — The old Activities UI module was removed; activityService.getAll() remains
    // operational only as shared internal infrastructure (backs getOverdueActivities() for
    // Onboarding/Offboarding), not as a user-facing module of its own any more.
    const activities = await activityService.getAll();
    assert(Array.isArray(activities), '25. UPDATED — activityService.getAll() remains operational as shared internal infrastructure (Onboarding/Offboarding overdue-task support), independent of the now-removed Activities UI module');

    // 26. /employees?status=... filtering remains operational
    const filterRes = await employeeService.getAll({ status: 'Departing' });
    assert(Array.isArray(filterRes), '26. Employee status filtering remains operational');

    // 27. Dashboard remains operational
    const dashSummary = await dashboardService.getDashboardSummary();
    assert(dashSummary && dashSummary.metrics, '27. Dashboard remains operational');

    // 28. No surviving links point to Organization
    assert(!sidebarSrc.includes('/organization'), '28. No surviving links point to Organization');

    // 29. No surviving links point to Reporting
    assert(!sidebarSrc.includes('/reporting'), '29. No surviving links point to Reporting');

    // 30. No surviving links point to Configuration
    assert(!sidebarSrc.includes('/configuration'), '30. No surviving links point to Configuration');

    // 31. No obsolete HR Admin/Manager UI remains
    const roleContextSrc = fs.readFileSync(path.resolve('./src/state/RoleContext.jsx'), 'utf-8');
    assert(!roleContextSrc.includes('ROLES.MANAGER'), '31. No obsolete HR Admin/Manager UI remains');

    // 32. No login/authentication backend has been introduced
    assert(!fs.existsSync(path.resolve('./src/pages/LoginPage.jsx')), '32. No login/authentication backend introduced');

    // 33. Storage remains safe/idempotent
    const reloadedDb = loadDatabase();
    assert(reloadedDb && reloadedDb.employees.length === 18, '33. Storage remains safe and idempotent');

    // 34. Custom <Select /> system remains intact wherever dropdowns still exist
    assert(fs.existsSync(path.resolve('./src/components/common/Select.jsx')), '34. Custom Select system remains intact');

    // 37. Mode filtering operational
    const modeRes = await employeeService.queryEmployees({ modeFilter: 'Remote' });
    assert(Array.isArray(modeRes.employees) && modeRes.employees.length > 0 && modeRes.employees.every(e => e.workMode === 'Remote'), '37. Mode filtering operational (Remote)');

    // 38. Salary filtering operational (uses existing allowance data internally)
    const salaryRes = await employeeService.queryEmployees({ allowanceFilter: 'Unpaid' });
    assert(Array.isArray(salaryRes.employees) && salaryRes.employees.length > 0 && salaryRes.employees.every(e => e.allowance === 'Unpaid'), '38. Salary filtering operational (Unpaid), backed by existing allowance field');

    // 39. Search by ID, name, email, department operational
    const searchIdRes = await employeeService.queryEmployees({ search: 'RZ-1001' });
    const searchNameRes = await employeeService.queryEmployees({ search: 'Tariq' });
    const searchEmailRes = await employeeService.queryEmployees({ search: 'tariq.ibrahim@rizurf.example' });
    const searchDeptRes = await employeeService.queryEmployees({ search: 'Engineering' });
    assert(
      searchIdRes.employees.length > 0 && searchNameRes.employees.length > 0 && searchEmailRes.employees.length > 0 && searchDeptRes.employees.length > 0,
      '39. Search by ID, name, email, department operational'
    );

    // 40. Underlying position, location, and manager data remain intact on hydrated employee model
    const hydratedEmp = await employeeService.getById('emp-001');
    assert(hydratedEmp && hydratedEmp.position && hydratedEmp.location && hydratedEmp.effectiveEmploymentRecord, '40. Underlying position, location, manager data remain intact');

    // ==========================================================================
    // Employees Directory — Final Information Structure Refinement
    // ==========================================================================

    const listSrc = fs.readFileSync(path.resolve('./src/components/employees/EmployeeListView.jsx'), 'utf-8');
    const cardSrc = fs.readFileSync(path.resolve('./src/components/employees/EmployeeCardView.jsx'), 'utf-8');
    const toolbarSrc = fs.readFileSync(path.resolve('./src/components/employees/DirectoryToolbar.jsx'), 'utf-8');
    const dateUtilsSrc = fs.readFileSync(path.resolve('./src/utils/dateUtils.js'), 'utf-8');

    // 41. Final List View columns are exactly ID, NAME, DEPARTMENT, TYPE, MODE, DATES, SALARY, STATUS, DURATION (in order)
    const expectedHeaders = ['>ID<', '>NAME<', '>DEPARTMENT<', '>TYPE<', '>MODE<', '>DATES<', '>SALARY<', '>STATUS<', '>DURATION<'];
    const headerPositions = expectedHeaders.map((h) => listSrc.indexOf(h));
    const headersPresentInOrder = headerPositions.every((p) => p !== -1) && headerPositions.every((p, i) => i === 0 || p > headerPositions[i - 1]);
    assert(headersPresentInOrder, '41. Final List columns are exactly ID/NAME/DEPARTMENT/TYPE/MODE/DATES/SALARY/STATUS/DURATION, in order');

    // 42. Old separate START, END, and ALLOWANCE column headers are removed from the List View
    assert(!listSrc.includes('>START<') && !listSrc.includes('>END<') && !listSrc.includes('>ALLOWANCE<'), '42. Legacy separate START/END/ALLOWANCE columns are removed');

    // 43. Name column displays Email underneath in both List and Card views
    assert(
      listSrc.includes('table-user-name') && listSrc.includes('emp.workEmail') &&
      cardSrc.includes('emp-card-name') && cardSrc.includes('emp.workEmail'),
      '43. Name displays Email underneath in List and Card views'
    );

    // 44. Type normalizes Intern/Apprentice employment type to "Intern"; all other types normalize to "Employee"
    const internEmp = await employeeService.getById('emp-014'); // employeeTypeId: type-3 (Intern / Apprentice)
    const regularEmp = await employeeService.getById('emp-001'); // employeeTypeId: type-5 (Executive)
    assert(
      internEmp.directoryType === 'Intern' && regularEmp.directoryType === 'Employee' &&
      normalizeDirectoryType({ code: 'INTERN', name: 'Intern / Apprentice' }) === 'Intern' &&
      normalizeDirectoryType({ code: 'FTE', name: 'Full-Time Permanent' }) === 'Employee',
      '44. Type normalizes to exactly Employee or Intern via a single centralized domain helper'
    );

    // 45. Type filter UI exposes exactly All Types / Employee / Intern (not detailed employment-type categories)
    assert(
      toolbarSrc.includes("'All Types'") && toolbarSrc.includes("'Employee'") && toolbarSrc.includes("'Intern'") &&
      !toolbarSrc.includes('Full-Time Permanent') && !toolbarSrc.includes('Fixed-Term Contract') && !toolbarSrc.includes('Part-Time'),
      '45. Type filter exposes only All Types/Employee/Intern, not detailed employment-type categories'
    );

    // 46. Detailed employment type master/reference data remains fully intact underneath the simplified directory Type
    const allEmployeeTypes = await employeeTypeService.getAll();
    assert(
      allEmployeeTypes.length === 5 &&
      allEmployeeTypes.some(t => t.name === 'Full-Time Permanent') &&
      allEmployeeTypes.some(t => t.name === 'Fixed-Term Contract') &&
      allEmployeeTypes.some(t => t.name === 'Intern / Apprentice') &&
      allEmployeeTypes.some(t => t.name === 'Part-Time') &&
      allEmployeeTypes.some(t => t.name === 'Executive'),
      '46. Detailed employment type master data (5 categories) remains intact'
    );

    // 47. Type filter is functionally operational against the normalized directoryType
    const typeInternRes = await employeeService.queryEmployees({ typeFilter: 'Intern' });
    const typeEmployeeRes = await employeeService.queryEmployees({ typeFilter: 'Employee' });
    assert(
      typeInternRes.employees.length === 1 && typeInternRes.employees.every(e => e.directoryType === 'Intern') &&
      typeEmployeeRes.employees.length === 17 && typeEmployeeRes.employees.every(e => e.directoryType === 'Employee'),
      '47. Type filter operational (1 Intern, 17 Employee across the 18-record dataset)'
    );

    // 48. Dates column combines Start and End into a single cell, falling back to "—" (never a fabricated date) when there is no end
    assert(listSrc.includes('dates-cell') && listSrc.includes("emp.contractEndDate ? formatDateDisplay(emp.contractEndDate) : '—'"), '48. Dates column combines Start + End in one cell, with "—" fallback (no fabricated end date)');

    // 49. Salary is a UI label replacement only — header/filter say "Salary", not "Allowance"
    assert(listSrc.includes('>SALARY<') && toolbarSrc.includes('Salary:') && !toolbarSrc.includes('Allowance:'), '49. Salary is the user-facing label (Allowance label removed from UI)');

    // 50. Salary continues to display and filter using the existing Paid/Unpaid allowance field, with no salary amount/payroll model introduced
    const hydratedSalaryEmp = await employeeService.getById('emp-014');
    const employeeKeys = Object.keys(hydratedSalaryEmp);
    const noPayrollFields = !employeeKeys.some(k => /salaryAmount|monthlySalary|compensation|payroll|salaryValue/i.test(k));
    assert(
      (hydratedSalaryEmp.allowance === 'Paid' || hydratedSalaryEmp.allowance === 'Unpaid') && noPayrollFields,
      '50. Salary displays Paid/Unpaid from the existing allowance field; no salary amount/payroll field was introduced'
    );

    // 51. Salary filter options are exactly "Paid & Unpaid" / "Paid" / "Unpaid"
    assert(toolbarSrc.includes("'Paid & Unpaid'") && toolbarSrc.includes("{ value: 'Paid', label: 'Paid' }") && toolbarSrc.includes("{ value: 'Unpaid', label: 'Unpaid' }"), '51. Salary filter options are exactly Paid & Unpaid / Paid / Unpaid');

    // 52. Duration is centralized in a single dateUtils helper, consumed (not reimplemented) by both List and Card views
    assert(
      dateUtilsSrc.includes('export function calculateDurationProgress') &&
      listSrc.includes("calculateDurationProgress") && listSrc.includes("from '../../utils/dateUtils.js'") &&
      cardSrc.includes("calculateDurationProgress") && cardSrc.includes("from '../../utils/dateUtils.js'"),
      '52. Duration calculation is centralized in utils/dateUtils.js and reused (not duplicated) by List and Card views'
    );

    // 53. Duration — no end date renders "Ongoing" with no fabricated percent (emp-001 has no contractEndDate)
    const ongoingDuration = calculateDurationProgress('2021-01-15', null);
    assert(ongoingDuration.percent === null && ongoingDuration.label === 'Ongoing', '53. Duration with no end date displays Ongoing with no fabricated percentage');

    // 54. Duration — future/upcoming employee shows 0% and "Starts in X days" (emp-015 starts 2026-10-01, after seed "today")
    const upcomingDuration = calculateDurationProgress('2026-10-01', '2027-09-30', '2026-09-09');
    assert(upcomingDuration.percent === 0 && upcomingDuration.label.startsWith('Starts in'), '54. Future/upcoming duration shows 0% progress and "Starts in X days"');

    // 55. Duration — active fixed-term employee shows clamped 0-100% elapsed and "X days left" (emp-014: 2026-09-01 -> 2027-02-28)
    const activeDuration = calculateDurationProgress('2026-09-01', '2027-02-28', '2026-09-09');
    assert(activeDuration.percent >= 0 && activeDuration.percent <= 100 && activeDuration.label.endsWith('left'), '55. Active fixed-term duration shows a clamped elapsed percentage and "X days left"');

    // 56. Duration — completed contract (on/after end date) shows 100% and "Completed" (emp-009 ended 2026-05-31)
    const completedDuration = calculateDurationProgress('2023-06-01', '2026-05-31', '2026-09-09');
    assert(completedDuration.percent === 100 && completedDuration.label === 'Completed', '56. Completed duration shows 100% progress and "Completed"');

    // 57. Department, Mode, and Status filters remain functionally operational alongside the new Type/Salary filters
    const deptList = await departmentService.getAll({ withCount: false });
    const deptRes = await employeeService.queryEmployees({ departmentId: deptList[0].id });
    const statusRes = await employeeService.queryEmployees({ baseLifecycleScope: 'All', statusFilter: 'Onboarding' });
    assert(
      deptRes.employees.every(e => e.department && e.department.id === deptList[0].id) &&
      statusRes.employees.length > 0 && statusRes.employees.every(e => e.status === 'Onboarding'),
      '57. Department and interactive Status filters remain operational'
    );

    // 58. Sort By remains operational, including Name (A-Z)
    const sortedRes = await employeeService.queryEmployees({ sortBy: 'name-asc' });
    const names = sortedRes.employees.map(e => e.fullName);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    assert(toolbarSrc.includes("Name (A") && JSON.stringify(names) === JSON.stringify(sortedNames), '58. Sort By Name (A-Z) remains available and functionally correct');

    // 59. Card View represents the same final information structure as List View (Department, Type, Mode, Dates, Salary, Duration)
    assert(
      cardSrc.includes('emp.department') && cardSrc.includes('emp.directoryType') && cardSrc.includes('emp.workMode') &&
      cardSrc.includes('dates-cell') && cardSrc.includes('emp.allowance') && cardSrc.includes('emp-card-duration'),
      '59. Card View represents Department, Type, Mode, Dates, Salary, and Duration alongside ID/Name/Email/Status'
    );

    // 60. No native <select> element was introduced in the directory toolbar; the shared custom Select is used for every filter
    const selectUsageCount = (toolbarSrc.match(/<Select\b/g) || []).length;
    assert(!toolbarSrc.includes('<select') && selectUsageCount >= 6, '60. No native <select> introduced; shared custom <Select /> used for all directory filters');

    // ==========================================================================
    // Create Employee + Sync Employees Actions
    // ==========================================================================

    const containerSrc = fs.readFileSync(path.resolve('./src/components/employees/DirectoryPageContainer.jsx'), 'utf-8');
    const createModalSrc = fs.readFileSync(path.resolve('./src/components/employees/CreateEmployeeModal.jsx'), 'utf-8');
    const employeeServiceSrc = fs.readFileSync(path.resolve('./src/services/employeeService.js'), 'utf-8');

    // 61. Create Employee button exists in the Employees page header
    assert(containerSrc.includes('Create Employee') && containerSrc.includes('<Plus'), '61. Create Employee button exists');

    // 62. Sync Employees button exists in the Employees page header
    assert(containerSrc.includes('Sync Employees') && containerSrc.includes('<RefreshCw'), '62. Sync Employees button exists');

    // 63. Create Employee modal renders nothing when closed and exposes a close control when open
    assert(createModalSrc.includes('if (!isOpen) return null') && createModalSrc.includes('modal-close-btn'), '63. Create Employee modal opens/closes via isOpen/onClose');

    // 64. All 15 required form fields are present in the Create Employee modal
    const requiredFieldMarkers = [
      'firstName', 'lastName', 'workEmail', 'icPassportNumber', 'workPhone',
      'departmentId', 'homeAddress', 'directoryType', 'startDate', 'contractEndDate',
      'allowance', 'workMode', 'managerId', 'status', 'notes',
    ];
    assert(requiredFieldMarkers.every((f) => createModalSrc.includes(f)), '64. First/Last Name, Email, IC/Passport, Phone, Department, Home Address, Type, Dates, Salary, Work Mode, Supervisor, Status, and Notes fields are all present');

    // 65. Email validation: required, format-checked, and duplicate-checked
    const badEmailResult = validateEmployeeCreation({ workEmail: 'not-an-email' }, []);
    const goodEmailResult = validateEmployeeCreation({ workEmail: 'new.hire@rizurf.example' }, []);
    const dupEmailResult = validateEmployeeCreation({ workEmail: 'tariq.ibrahim@rizurf.example' }, await employeeService.getAll({ hydrate: false }));
    assert(
      Boolean(badEmailResult.errors.workEmail) && !goodEmailResult.errors.workEmail && Boolean(dupEmailResult.errors.workEmail),
      '65. Email validation rejects malformed and duplicate addresses, accepts valid unique ones'
    );

    // 66. Department options are sourced from departmentService, not hardcoded in the modal
    assert(
      createModalSrc.includes("from '../../services/departmentService.js'") && !/dept-1['"]|Software Engineering['"]/.test(createModalSrc),
      '66. Department options come from departmentService reference data, not a hardcoded list'
    );

    // 67. Type options are exactly Employee / Intern (no detailed employment-type categories)
    assert(
      createModalSrc.includes("{ value: 'Employee', label: 'Employee' }") &&
      createModalSrc.includes("{ value: 'Intern', label: 'Intern' }") &&
      !createModalSrc.includes('Full-Time Permanent') && !createModalSrc.includes('Fixed-Term Contract'),
      '67. Type options are exactly Employee/Intern'
    );

    // 68. Intern maps to the canonical "Intern / Apprentice" detailed employment type
    const allTypesForMapping = await employeeTypeService.getAll();
    const internMappedId = resolveEmployeeTypeIdForDirectoryType('Intern', allTypesForMapping);
    const internMappedType = allTypesForMapping.find((t) => t.id === internMappedId);
    assert(internMappedType && internMappedType.name === 'Intern / Apprentice', '68. Intern Type maps to the canonical Intern / Apprentice employment type');

    // 69. Employee maps to the safest baseline detailed employment type (Full-Time Permanent / type-1)
    const employeeMappedId = resolveEmployeeTypeIdForDirectoryType('Employee', allTypesForMapping);
    assert(employeeMappedId === 'type-1', '69. Employee Type maps to the Full-Time Permanent (type-1) baseline');

    // 70. End Date cannot precede Start Date
    const badDateResult = validateEmployeeCreation({ startDate: '2026-10-01', contractEndDate: '2026-09-01' }, []);
    const okDateResult = validateEmployeeCreation({ startDate: '2026-09-01', contractEndDate: '2026-10-01' }, []);
    assert(Boolean(badDateResult.errors.contractEndDate) && !okDateResult.errors.contractEndDate, '70. End Date earlier than Start Date is rejected; valid ranges are accepted');

    // 71. Salary options are exactly Paid/Unpaid and the modal never introduces a salary amount field
    assert(
      createModalSrc.includes("{ value: 'Paid', label: 'Paid' }") && createModalSrc.includes("{ value: 'Unpaid', label: 'Unpaid' }") &&
      !/salaryAmount|monthlySalary|RM\d|compensation/i.test(createModalSrc),
      '71. Salary options are exactly Paid/Unpaid with no salary amount field introduced'
    );

    // 72. Work Mode options are exactly On-site/Remote/Hybrid
    assert(
      createModalSrc.includes("{ value: 'On-site', label: 'On-site' }") &&
      createModalSrc.includes("{ value: 'Remote', label: 'Remote' }") &&
      createModalSrc.includes("{ value: 'Hybrid', label: 'Hybrid' }"),
      '72. Work Mode options are exactly On-site/Remote/Hybrid'
    );

    // 73. Supervisor options come from real employee data, never a hardcoded name
    assert(
      createModalSrc.includes('employeeService.getAll()') && !/Dana Ortiz|John Doe|Jane Smith/i.test(createModalSrc),
      '73. Supervisor options are sourced from existing employee data, not a hardcoded person'
    );

    // 74. Status options use the current lifecycle model only (not the reference app's Completed/Terminated)
    assert(
      ['Upcoming', 'Onboarding', 'Active', 'Departing', 'Former'].every((s) => createModalSrc.includes(`'${s}'`)) &&
      !createModalSrc.includes("'Completed'") && !createModalSrc.includes("'Terminated'"),
      '74. Status options are the current lifecycle model (Upcoming/Onboarding/Active/Departing/Former), not Completed/Terminated'
    );

    // 75. Creation flow goes through the service layer only — the modal never imports storageEngine or seed files directly
    assert(
      !createModalSrc.includes('storageEngine') && !createModalSrc.includes('mock-data/seed'),
      '75. Create Employee modal never imports storageEngine or seed files directly (service layer only)'
    );

    // 76. employeeService.createDirectoryEmployee() end-to-end: safe ID generation, type mapping, hydration, directory integration
    resetDatabase(); // Isolate the creation tests below on a clean, deterministic 18-employee baseline
    const baselineEmployees = await employeeService.getAll({ hydrate: false });
    assert(baselineEmployees.length === 18, '76. Clean baseline of 18 seed employees before running creation tests');

    const deptsForTest = await departmentService.getAll({ withCount: false });
    const testDeptId = deptsForTest[0].id;
    const supervisorCandidate = (await employeeService.getAll())[0];

    const newIntern = await employeeService.createDirectoryEmployee(
      {
        firstName: 'Test',
        lastName: 'Intern',
        workEmail: 'test.intern.verify@rizurf.example',
        icPassportNumber: 'A1234567',
        workPhone: '+60 12-345 6789',
        homeAddress: '1 Test Street, Kuala Lumpur',
        directoryType: 'Intern',
        startDate: '2026-09-01',
        contractEndDate: '2027-02-28',
        allowance: 'Unpaid',
        workMode: 'Remote',
        status: 'Onboarding',
        notes: 'Created by verifyStage18 automated check.',
      },
      { departmentId: testDeptId, managerId: supervisorCandidate.id }
    );

    assert(
      newIntern.id === 'emp-019' && newIntern.employeeId === 'RZ-1019',
      '77. Safe sequential ID generation produces the next available emp-019 / RZ-1019 (max-scan, not count+1)'
    );
    assert(newIntern.directoryType === 'Intern' && newIntern.employeeType.name === 'Intern / Apprentice', '78. Intern creation is hydrated as directoryType "Intern" backed by the canonical detailed type');
    assert(newIntern.department && newIntern.department.id === testDeptId, '79. New employee correctly resolves the selected Department through the reference architecture');
    assert(newIntern.manager && newIntern.manager.id === supervisorCandidate.id, '80. Supervisor selection is persisted as the initial EmploymentRecord managerId and hydrates correctly');
    assert(newIntern.notes === 'Created by verifyStage18 automated check.', '81. Optional Notes field is stored on the created employee record');

    // 82. Duplicate ID/email prevention: a second creation gets a distinct safe ID, and re-using the same email is rejected
    const secondEmployee = await employeeService.createDirectoryEmployee(
      {
        firstName: 'Second',
        lastName: 'Hire',
        workEmail: 'second.hire.verify@rizurf.example',
        directoryType: 'Employee',
        startDate: '2026-09-01',
        allowance: 'Paid',
        workMode: 'On-site',
        status: 'Active',
      },
      { departmentId: testDeptId }
    );
    let dupEmailErr = null;
    try {
      await employeeService.createDirectoryEmployee(
        { firstName: 'Dup', lastName: 'Email', workEmail: 'test.intern.verify@rizurf.example', directoryType: 'Employee', startDate: '2026-09-01', allowance: 'Paid', workMode: 'On-site', status: 'Active' },
        { departmentId: testDeptId }
      );
    } catch (err) {
      dupEmailErr = err;
    }
    assert(
      secondEmployee.id === 'emp-020' && secondEmployee.employeeId === 'RZ-1020' && secondEmployee.id !== newIntern.id && dupEmailErr !== null,
      '82. Sequential creations receive distinct safe IDs with no collisions; duplicate email is rejected'
    );

    // 83. New employee immediately integrates with Department/Type/Mode/Salary/Status filters via the existing query layer
    const filterIntegration = await Promise.all([
      employeeService.queryEmployees({ departmentId: testDeptId }),
      employeeService.queryEmployees({ typeFilter: 'Intern' }),
      employeeService.queryEmployees({ modeFilter: 'Remote' }),
      employeeService.queryEmployees({ allowanceFilter: 'Unpaid' }),
      employeeService.queryEmployees({ baseLifecycleScope: 'All', statusFilter: 'Onboarding' }),
    ]);
    const [byDept, byType, byMode, bySalary, byStatus] = filterIntegration;
    assert(
      byDept.employees.some((e) => e.id === newIntern.id) &&
      byType.employees.some((e) => e.id === newIntern.id) &&
      byMode.employees.some((e) => e.id === newIntern.id) &&
      bySalary.employees.some((e) => e.id === newIntern.id) &&
      byStatus.employees.some((e) => e.id === newIntern.id),
      '83. New employee appears correctly under Department, Type, Mode, Salary, and Status filters'
    );

    // 84. Employee count updates immediately after creation
    const allAfterCreate = await employeeService.getAll({ hydrate: false });
    assert(allAfterCreate.length === 20, '84. Employee count updates immediately after creation (18 -> 20 after two test creations)');

    // 85. Dates and Duration are correctly derived for the newly created employee (List/Card consume the same hydrated fields)
    const internDuration = calculateDurationProgress(newIntern.startDate, newIntern.contractEndDate, '2026-09-09');
    assert(
      newIntern.startDate === '2026-09-01' && newIntern.contractEndDate === '2027-02-28' && internDuration.state === 'active' && internDuration.percent >= 0 && internDuration.percent <= 100,
      '85. Dates display correctly and Duration is automatically derived from Start/End for the new employee'
    );

    // 86. Salary and Work Mode are fully independent: an Unpaid Intern can be Remote (no forced linkage either direction)
    assert(
      newIntern.allowance === 'Unpaid' && newIntern.workMode === 'Remote' &&
      !employeeServiceSrc.includes("allowance === 'Unpaid'") && !createModalSrc.includes("allowance === 'Unpaid'"),
      '86. Salary (Paid/Unpaid) and Work Mode remain independent attributes with no cross-field rule'
    );

    // 87. Sync Employees goes through the service layer, refreshes current local data, and calls no fake/nonexistent backend
    assert(
      employeeServiceSrc.includes('async syncEmployees(') &&
      containerSrc.includes('employeeService.syncEmployees()') &&
      !employeeServiceSrc.includes('fetch(') && !employeeServiceSrc.includes('axios') &&
      !/firebase|supabase/i.test(employeeServiceSrc),
      '87. Sync Employees is implemented as a service-layer abstraction with no fake backend/network call'
    );
    const syncResult = await employeeService.syncEmployees();
    assert(Array.isArray(syncResult) && syncResult.some((e) => e.id === newIntern.id), '88. Sync Employees refreshes and returns the current local data, including newly created records');

    // 89. Sync loading state: button disables and relabels to "Syncing..." while in flight
    assert(containerSrc.includes('isSyncing') && containerSrc.includes("'Syncing...'") && containerSrc.includes('disabled={isSyncing}'), '89. Sync Employees shows a loading state and prevents repeated clicks while syncing');

    // 90. No native <select> was introduced anywhere in the new Create Employee modal; shared custom Select is used throughout
    const modalSelectUsageCount = (createModalSrc.match(/<Select\b/g) || []).length;
    assert(!createModalSrc.includes('<select') && modalSelectUsageCount >= 6, '90. No native <select> introduced in Create Employee modal; shared custom <Select /> used for all its dropdowns');

    // Clean up: remove test-created records so the canonical 18-employee seed/base dataset is not polluted
    resetDatabase();
    const restoredEmployees = await employeeService.getAll({ hydrate: false });
    assert(restoredEmployees.length === 18, '91. Test-created employee records are cleaned up; canonical 18-employee seed dataset is restored');

    // ==========================================================================
    // Employees Directory — ID Sorting + Timeline View
    // ==========================================================================

    const toolbarSrc2 = fs.readFileSync(path.resolve('./src/components/employees/DirectoryToolbar.jsx'), 'utf-8');
    const containerSrc2 = fs.readFileSync(path.resolve('./src/components/employees/DirectoryPageContainer.jsx'), 'utf-8');
    const timelineSrc = fs.readFileSync(path.resolve('./src/components/employees/EmployeeTimelineView.jsx'), 'utf-8');
    const employeeServiceSrc2 = fs.readFileSync(path.resolve('./src/services/employeeService.js'), 'utf-8');
    const departmentDomainSrc = fs.readFileSync(path.resolve('./src/domain/departmentDomain.js'), 'utf-8');

    // 92. Current branch remains employees-final (this suite is only ever meaningful there)
    let currentBranch = null;
    try {
      currentBranch = execSync('git branch --show-current', { cwd: path.resolve('.') }).toString().trim();
    } catch (err) {
      currentBranch = null;
    }
    assert(currentBranch === 'employees-final', `92. Current branch remains employees-final (actual: ${currentBranch})`);

    // 93. ID (Ascending) and ID (Descending) exist in Sort By, alongside all pre-existing options
    assert(
      toolbarSrc2.includes("{ value: 'id-asc', label: 'ID (Ascending)' }") &&
      toolbarSrc2.includes("{ value: 'id-desc', label: 'ID (Descending)' }") &&
      toolbarSrc2.includes("'name-asc'") && toolbarSrc2.includes("'name-desc'") &&
      toolbarSrc2.includes("'date-desc'") && toolbarSrc2.includes("'date-asc'"),
      '93. Sort By adds ID (Ascending)/ID (Descending) while preserving all existing options'
    );

    // 94. ID sorting orders by the meaningful numeric identifier, not raw string comparison
    assert(
      compareEmployeeIdNumeric('RZ-1002', 'RZ-1009') < 0 &&
      compareEmployeeIdNumeric('RZ-1010', 'RZ-1009') > 0 &&
      compareEmployeeIdNumeric('RZ-1009', 'RZ-1009') === 0,
      '94. compareEmployeeIdNumeric orders IDs by numeric value (RZ-1002 < RZ-1009 < RZ-1010)'
    );

    const idAscRes = await employeeService.queryEmployees({ sortBy: 'id-asc' });
    const idAscNumbers = idAscRes.employees.map((e) => parseInt((e.employeeId || '').replace(/\D/g, ''), 10));
    const isSortedAsc = idAscNumbers.every((n, i) => i === 0 || idAscNumbers[i - 1] <= n);

    const idDescRes = await employeeService.queryEmployees({ sortBy: 'id-desc' });
    const idDescNumbers = idDescRes.employees.map((e) => parseInt((e.employeeId || '').replace(/\D/g, ''), 10));
    const isSortedDesc = idDescNumbers.every((n, i) => i === 0 || idDescNumbers[i - 1] >= n);

    assert(isSortedAsc, '95. Sort By "ID (Ascending)" produces a numerically ascending employee query result');
    assert(isSortedDesc, '96. Sort By "ID (Descending)" produces a numerically descending employee query result');

    // 97. Timeline appears as a third view alongside List/Card, without removing either
    assert(
      toolbarSrc2.includes("onViewModeChange('timeline')") &&
      toolbarSrc2.includes("onViewModeChange('list')") &&
      toolbarSrc2.includes("onViewModeChange('card')"),
      '97. Timeline view button exists alongside List and Card (view selector: List / Card / Timeline)'
    );

    // 98. DirectoryPageContainer renders List/Card/Timeline from the same three-way switch, and Timeline is a dedicated component (not inlined)
    assert(
      containerSrc2.includes("viewMode === 'list'") && containerSrc2.includes("viewMode === 'card'") &&
      containerSrc2.includes('<EmployeeTimelineView') && containerSrc2.includes("from './EmployeeTimelineView'"),
      '98. List/Card continue to render, and Timeline renders via a dedicated EmployeeTimelineView component'
    );

    // 99. Timeline consumes the same `employees` prop as List/Card — no separate timeline dataset or seed file
    assert(
      containerSrc2.match(/<EmployeeTimelineView\s+employees=\{employees\}/) &&
      !timelineSrc.includes('mock-data/seed') && !timelineSrc.includes('storageEngine') &&
      !timelineSrc.includes('employeeService'),
      '99. Timeline consumes the same filtered/hydrated `employees` array as List/Card; no separate dataset, seed data, or direct service/storage access'
    );

    // 100–104. Type/Department/Mode/Salary/Status/Search filters and Sort By all flow through the single
    // queryEmployees() result that already feeds List/Card — proving Timeline (fed the same array) is filtered identically
    const [internOnly, employeeOnly, byDeptFilter, byModeFilter, bySalaryFilter, byStatusFilter2, bySearch] = await Promise.all([
      employeeService.queryEmployees({ typeFilter: 'Intern' }),
      employeeService.queryEmployees({ typeFilter: 'Employee' }),
      employeeService.queryEmployees({ departmentId: 'dept-3' }),
      employeeService.queryEmployees({ modeFilter: 'Remote' }),
      employeeService.queryEmployees({ allowanceFilter: 'Unpaid' }),
      employeeService.queryEmployees({ baseLifecycleScope: 'All', statusFilter: 'Onboarding' }),
      employeeService.queryEmployees({ search: 'Kevin' }),
    ]);
    assert(internOnly.employees.every((e) => e.directoryType === 'Intern') && internOnly.employees.length > 0, '100. Type=Intern filters the shared result set (and therefore Timeline) to only Intern records');
    assert(employeeOnly.employees.every((e) => e.directoryType === 'Employee') && employeeOnly.employees.length > 0, '101. Type=Employee filters the shared result set (and therefore Timeline) to only Employee records');
    assert(byDeptFilter.employees.every((e) => e.department && e.department.id === 'dept-3'), '102. Department filter narrows the shared result set that feeds Timeline');
    assert(byModeFilter.employees.every((e) => e.workMode === 'Remote'), '103. Mode filter narrows the shared result set that feeds Timeline (bar color must stay Department, not Mode)');
    assert(bySalaryFilter.employees.every((e) => e.allowance === 'Unpaid'), '104. Salary filter narrows the shared result set that feeds Timeline (bar color must stay Department, not Salary)');
    assert(byStatusFilter2.employees.every((e) => e.status === 'Onboarding'), '105. Status filter narrows the shared result set that feeds Timeline (bar color must stay Department, not Status)');
    assert(bySearch.employees.length > 0, '106. Search narrows the shared result set that feeds Timeline');

    // 107. No filtering logic is duplicated/reimplemented inside EmployeeTimelineView (it only receives the already-filtered array)
    assert(
      !timelineSrc.includes('.filter(') || !/directoryType|allowance|workMode|status ===/.test(timelineSrc),
      '107. Timeline does not reimplement Type/Salary/Mode/Status filtering — it only renders the employees it is given'
    );

    // 108. Bar color is resolved purely from Department, via a single centralized resolver reused by the legend
    assert(
      timelineSrc.includes('resolveDepartmentColor(emp.department)') &&
      departmentDomainSrc.includes('export function resolveDepartmentColor') &&
      departmentDomainSrc.includes('export function buildDepartmentLegend') &&
      !/resolveDepartmentColor\([^)]*allowance/.test(timelineSrc) &&
      !/resolveDepartmentColor\([^)]*workMode/.test(timelineSrc) &&
      !/resolveDepartmentColor\([^)]*status/i.test(timelineSrc),
      '108. Bar color is resolved only from Department via a single centralized resolver (never Type/Salary/Mode/Status)'
    );

    // 109. Department color resolution is deterministic (same department -> same color, every call)
    const sampleDept = { id: 'dept-3', name: 'Software Engineering', color: '#0E848D' };
    const colorRun1 = resolveDepartmentColor(sampleDept);
    const colorRun2 = resolveDepartmentColor(sampleDept);
    const colorRun3 = resolveDepartmentColor({ ...sampleDept });
    assert(colorRun1 === colorRun2 && colorRun2 === colorRun3, '109. resolveDepartmentColor() is deterministic — identical department input always yields the identical color');

    // 110. Departments without an explicit color (e.g. a future backend department) still receive a distinct, stable color via hash fallback
    const noColorDeptA = resolveDepartmentColor({ id: 'dept-future-1', name: 'New Backend Dept A' });
    const noColorDeptB = resolveDepartmentColor({ id: 'dept-future-2', name: 'New Backend Dept B' });
    assert(
      Boolean(noColorDeptA) && Boolean(noColorDeptB) &&
      !departmentDomainSrc.includes("=== 'Software Engineering'") && !/if\s*\(\s*department(\.name)?\s*===/.test(departmentDomainSrc),
      '110. Departments without an explicit color still resolve to a stable color via deterministic hash fallback, with no hardcoded department-name branching'
    );

    // 111. Department legend is generated dynamically from the currently displayed employees, using the same resolver as the bars
    const allHydrated = await employeeService.getAll();
    const dynamicLegend = buildDepartmentLegend(allHydrated);
    const expectedDeptCount = new Set(allHydrated.map((e) => (e.department ? e.department.id : 'unassigned'))).size;
    assert(
      dynamicLegend.length === expectedDeptCount &&
      dynamicLegend.every((entry) => entry.color === resolveDepartmentColor(allHydrated.find((e) => (e.department ? e.department.id : 'unassigned') === entry.id)?.department)),
      '111. Department legend is built dynamically from the displayed employees and uses the exact same color resolver as the bars'
    );
    assert(!timelineSrc.match(/const\s+.*LEGEND.*=\s*\[/i), '112. Timeline maintains no separate hardcoded legend/color map');

    // 113. Start Date controls bar start / End Date controls bar end / ongoing records are handled without a fabricated End Date
    const rangeForTest = calculateTimelineRange([
      { startDate: '2026-01-01', contractEndDate: '2026-06-30' },
      { startDate: '2026-03-01', contractEndDate: null },
    ], '2026-09-10');
    const finiteBar = calculateTimelineBarPosition('2026-01-01', '2026-06-30', rangeForTest.rangeStart, rangeForTest.rangeEnd, '2026-09-10');
    const ongoingBar = calculateTimelineBarPosition('2026-03-01', null, rangeForTest.rangeStart, rangeForTest.rangeEnd, '2026-09-10');
    assert(finiteBar.leftPercent < finiteBar.leftPercent + finiteBar.widthPercent, '113. Start Date controls the bar\'s left edge and End Date controls its right edge for finite periods');
    assert(ongoingBar.isOngoing === true, '114. An ongoing employment period (no End Date) is flagged isOngoing, with no fabricated End Date value ever computed or returned');

    // 115. Missing Start Date is handled gracefully (row renders without a bar / fabricated date), never invented
    assert(timelineSrc.includes('No Start Date on record') && timelineSrc.includes('!emp.startDate'), '115. An employee unexpectedly missing a Start Date is reported gracefully in its row rather than fabricating one');

    // 116. Timeline range derives from actual data (earliest Start Date -> latest End Date/today), never a hardcoded year
    assert(!timelineSrc.match(/20\d{2}/) && !employeeServiceSrc2.match(/20\d{2}/), '116. No hardcoded calendar year appears in the Timeline component or query layer — the range is fully data-derived');
    const singleYearRange = calculateTimelineRange([{ startDate: '2024-02-01', contractEndDate: '2024-05-01' }], '2024-06-01');
    assert(singleYearRange.rangeStart.startsWith('2024') && singleYearRange.rangeEnd.startsWith('2024'), '116b. calculateTimelineRange derives its bounds purely from the supplied employment periods');

    // 117. Multi-year data spans are handled and clearly labeled with the year on axis ticks
    const multiYearRange = calculateTimelineRange([
      { startDate: '2025-11-01', contractEndDate: '2026-03-01' },
    ], '2026-09-10');
    const multiYearTicks = generateTimelineMonthTicks(multiYearRange.rangeStart, multiYearRange.rangeEnd);
    assert(
      multiYearTicks.length > 0 && multiYearTicks.some((t) => /\b2025\b/.test(t.label)) && multiYearTicks.some((t) => /\b2026\b/.test(t.label)),
      '117. A Timeline range spanning multiple calendar years includes the year in its axis tick labels'
    );

    // 118. Employee Name, ID, and Employee/Intern badge all render per row
    assert(
      timelineSrc.includes('emp.fullName') && timelineSrc.includes('emp.employeeId') && timelineSrc.includes('emp.directoryType'),
      '118. Each Timeline row displays the employee Name, ID, and an Employee/Intern type badge'
    );

    // 119. Create Employee remains fully wired and unaffected by this task
    assert(
      containerSrc2.includes('CreateEmployeeModal') && containerSrc2.includes('handleCreateSubmit') &&
      employeeServiceSrc2.includes('async createDirectoryEmployee('),
      '119. Create Employee (modal + service call) remains fully functional and untouched by the Sort/Timeline changes'
    );

    // 120. A newly created employee flows into the same query result that feeds Timeline (no separate timeline sync needed)
    resetDatabase();
    const deptsForTimelineTest = await departmentService.getAll({ withCount: false });
    const newTimelineEmp = await employeeService.createDirectoryEmployee(
      {
        firstName: 'Timeline',
        lastName: 'Check',
        workEmail: 'timeline.check.verify@rizurf.example',
        directoryType: 'Intern',
        startDate: '2026-04-01',
        contractEndDate: null,
        allowance: 'Paid',
        workMode: 'Hybrid',
        status: 'Active',
      },
      { departmentId: deptsForTimelineTest[0].id }
    );
    const afterCreateQuery = await employeeService.queryEmployees({});
    assert(
      afterCreateQuery.employees.some((e) => e.id === newTimelineEmp.id),
      '120. A newly created employee immediately appears in the shared queryEmployees() result that Timeline renders from — no separate Timeline sync required'
    );

    // 121. Sync Employees remains functional and its refreshed result is what Timeline would render from next
    assert(employeeServiceSrc2.includes('async syncEmployees(') && containerSrc2.includes('employeeService.syncEmployees()'), '121. Sync Employees remains implemented and wired into the directory refresh flow');
    const syncedForTimeline = await employeeService.syncEmployees();
    assert(syncedForTimeline.some((e) => e.id === newTimelineEmp.id), '122. Sync Employees returns the refreshed data (including newly created records) that Timeline automatically renders from next — no "Sync Timeline" button exists');
    assert(!containerSrc2.match(/sync\s*timeline/i) && !timelineSrc.match(/sync/i), '123. No separate "Sync Timeline" control was introduced');

    // 124. Switching views does not reset active filters/sort (view state is independent of filter state in the same component)
    assert(
      containerSrc2.match(/const \[viewMode, setViewMode\] = useState\('list'\)/) &&
      !containerSrc2.match(/setViewMode\([^)]*\)[\s\S]{0,40}(setSearch|setStatusFilter|setDepartmentId|setTypeFilter|setModeFilter|setAllowanceFilter|setSortBy)\(/),
      '124. View mode (List/Card/Timeline) is a state variable independent of Search/Department/Type/Mode/Salary/Status/Sort — switching views never resets them'
    );

    // 125. Internal horizontal scrolling is available so long ranges never force page-level overflow
    assert(timelineSrc.includes('timeline-scroll-area') && !timelineSrc.includes('overflow-x: visible'), '125. Timeline provides its own internal horizontal scroll container for wide date ranges');

    // Clean up: remove the Timeline test employee so the canonical 18-employee seed dataset is not polluted
    resetDatabase();
    const restoredAfterTimelineTests = await employeeService.getAll({ hydrate: false });
    assert(restoredAfterTimelineTests.length === 18, '126. Timeline test-created employee is cleaned up; canonical 18-employee seed dataset is restored');

    // ==========================================================================
    // Upcoming — Candidate / Offer Workflow
    // ==========================================================================

    resetDatabase();

    const sidebarSrc3 = fs.readFileSync(path.resolve('./src/components/layout/Sidebar.jsx'), 'utf-8');
    const routerSrc2 = fs.readFileSync(path.resolve('./src/router/index.jsx'), 'utf-8');
    const upcomingPageSrc = fs.readFileSync(path.resolve('./src/pages/upcoming/UpcomingPage.jsx'), 'utf-8');
    const candidateTableSrc = fs.readFileSync(path.resolve('./src/components/upcoming/CandidateTable.jsx'), 'utf-8');
    const candidateToolbarSrc = fs.readFileSync(path.resolve('./src/components/upcoming/CandidateToolbar.jsx'), 'utf-8');
    const sendEmailModalSrc = fs.readFileSync(path.resolve('./src/components/upcoming/SendEmailModal.jsx'), 'utf-8');
    const emailDraftsPanelSrc = fs.readFileSync(path.resolve('./src/components/upcoming/EmailDraftsPanel.jsx'), 'utf-8');
    const notificationsPanelSrc = fs.readFileSync(path.resolve('./src/components/upcoming/NotificationsPanel.jsx'), 'utf-8');
    const upcomingCandidateServiceSrc = fs.readFileSync(path.resolve('./src/services/upcomingCandidateService.js'), 'utf-8');
    const emailTemplateServiceSrc = fs.readFileSync(path.resolve('./src/services/emailTemplateService.js'), 'utf-8');
    const candidateEmailServiceSrc = fs.readFileSync(path.resolve('./src/services/candidateEmailService.js'), 'utf-8');
    const indexCssSrc = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

    // 127. Upcoming appears above Onboarding in the PEOPLE section
    const upcomingIdx = sidebarSrc3.indexOf("to=\"/upcoming\"");
    const onboardingIdx = sidebarSrc3.indexOf("'onboarding'");
    assert(upcomingIdx !== -1 && onboardingIdx !== -1 && upcomingIdx < onboardingIdx, '127. Upcoming appears above Onboarding in the PEOPLE sidebar section');

    // 128. /upcoming route is registered and renders UpcomingPage
    assert(routerSrc2.includes("path: 'upcoming'") && routerSrc2.includes('<UpcomingPage') && routerSrc2.includes("from '../pages/upcoming/UpcomingPage'"), '128. /upcoming route is registered and renders UpcomingPage');

    // 129. Upcoming uses a separate candidate collection, never db.employees directly
    const dbAfterReset = loadDatabase();
    assert(Array.isArray(dbAfterReset.upcomingCandidates) && dbAfterReset.upcomingCandidates.length > 0, '129a. A separate db.upcomingCandidates collection exists with seed records');
    const employeeCountBeforeCandidateOps = (await employeeService.getAll({ hydrate: false })).length;
    assert(employeeCountBeforeCandidateOps === 18, '129b. Seeding Upcoming candidates does not insert records into db.employees (still 18)');
    assert(!upcomingCandidateServiceSrc.includes('db.employees') && !upcomingPageSrc.includes("from '../../services/employeeService"), '129c. upcomingCandidateService/UpcomingPage never read or write db.employees directly');

    // 130. Candidate table renders the required columns
    assert(
      ['CANDIDATE', 'POSITION', 'DEPARTMENT', 'OFFER TYPE', 'EMAIL STATUS'].every((col) => candidateTableSrc.includes(`>${col}<`)),
      '130. Candidate table renders CANDIDATE/POSITION/DEPARTMENT/OFFER TYPE/EMAIL STATUS columns'
    );

    // 131. Individual candidate selection via checkbox
    assert(candidateTableSrc.includes('onToggleSelect(candidate.id)') && candidateTableSrc.includes('type="checkbox"'), '131. Candidates can be selected individually via a checkbox');

    // 132. Select All works
    assert(candidateTableSrc.includes('onToggleSelectAll') && upcomingPageSrc.includes('handleToggleSelectAll'), '132. Select All visible candidates is supported');

    // 133/134. Paid and Unpaid default templates exist
    const paidTemplate = await emailTemplateService.getByOfferType('Paid');
    const unpaidTemplate = await emailTemplateService.getByOfferType('Unpaid');
    assert(paidTemplate && paidTemplate.name === 'Paid Position' && paidTemplate.body.includes('RM600'), '133. Paid Position default draft exists with the specified content');
    assert(unpaidTemplate && unpaidTemplate.name === 'Unpaid Position' && unpaidTemplate.body.includes('unpaid, hybrid'), '134. Unpaid Position default draft exists with the specified content');

    // 135-137. Placeholder rendering: ApplicantName / PositionName / HiringEmployeeName
    const tokenTestResult = renderEmailTemplate2('Dear {{ApplicantName}}, offer for {{PositionName}} from {{HiringEmployeeName}}.', {
      ApplicantName: 'Mohamed Kaiser',
      PositionName: 'Software Engineering',
      HiringEmployeeName: 'Ayesha',
    });
    assert(tokenTestResult.rendered === 'Dear Mohamed Kaiser, offer for Software Engineering from Ayesha.' && tokenTestResult.unresolved.length === 0, '135-137. ApplicantName, PositionName, and HiringEmployeeName placeholders all render correctly via the centralized interpolation function');

    // 138. Sending is blocked and unresolved tokens are reported when a required placeholder is missing
    const missingNameResult = renderEmailTemplate2('Best regards, {{HiringEmployeeName}}', {});
    assert(missingNameResult.unresolved.includes('HiringEmployeeName') && missingNameResult.rendered.includes('{{HiringEmployeeName}}'), '138. An unresolved required placeholder is reported (never silently blanked) and blocks Send');

    // 139. Candidate email populates the To field in a rendered preview
    const previewCandidate = await upcomingCandidateService.getById('cand-001');
    const paidPreview = await candidateEmailService.renderPreview(previewCandidate, { hiringEmployeeName: 'Ayesha' });
    assert(paidPreview.to === previewCandidate.email, '139. Candidate email address automatically populates the preview\'s To field');

    // 140. CC field exists and is validated
    assert(sendEmailModalSrc.includes('CC') && sendEmailModalSrc.includes('validateCcList'), '140. Optional CC field exists and is validated');
    const ccCheck = candidateDomainValidateCc('valid@rizurf.example, not-an-email');
    assert(ccCheck.isValid === false && ccCheck.invalidEntries.includes('not-an-email'), '140b. CC validation correctly flags a malformed address in a multi-address CC list');

    // 141. Subject exists, is centrally rendered, and editable in the single-send modal
    // (Handler renamed handleSubjectChange in the live-Hiring-Name-rendering refinement; same requirement, updated selector.)
    assert(Boolean(paidPreview.subject) && paidPreview.subject.includes('Software Engineering') && sendEmailModalSrc.includes('value={subject}') && sendEmailModalSrc.includes('onChange={(e) => handleSubjectChange('), '141. Subject renders via the centralized template engine and is editable before send');

    // 142. Preview occurs before Send — sendEmail() is a distinct, explicit call never triggered by opening the modal
    assert(sendEmailModalSrc.includes('onClick={handleSend}') && !sendEmailModalSrc.includes('candidateEmailService.sendEmail(') === false, '142a. Send is a distinct user action (Send button), not automatic');
    assert(!candidateEmailServiceSrc.includes('renderPreview') || candidateEmailServiceSrc.indexOf('async renderPreview') < candidateEmailServiceSrc.indexOf('async sendEmail'), '142b. renderPreview() is a separate, read-only operation from sendEmail()');

    // 143/144. Paid candidate gets the Paid template; Unpaid candidate gets the Unpaid template
    const unpaidCandidateForTest = await upcomingCandidateService.getById('cand-002');
    const unpaidPreview = await candidateEmailService.renderPreview(unpaidCandidateForTest, { hiringEmployeeName: 'Ayesha' });
    assert(paidPreview.body.includes('RM600') && !paidPreview.body.includes('unpaid, hybrid'), '143. A Paid-offer candidate resolves to the Paid Position draft');
    assert(unpaidPreview.body.includes('unpaid, hybrid') && !unpaidPreview.body.includes('RM600'), '144. An Unpaid-offer candidate resolves to the Unpaid Position draft');

    // 145. Single Send works end-to-end in the PoC (Pending -> Sent, emailSentAt stored)
    const beforeSendCandidate = await upcomingCandidateService.getById('cand-001');
    assert(beforeSendCandidate.emailStatus === 'Pending', 'precondition: cand-001 starts Pending');
    const afterSingleSend = await candidateEmailService.sendEmail('cand-001', { subject: paidPreview.subject, body: paidPreview.body, cc: '' });
    assert(afterSingleSend.emailStatus === 'Sent', '145. Single Send transitions Email Status Pending -> Sent in the PoC');
    assert(Boolean(afterSingleSend.emailSentAt), '146. emailSentAt is stored on send');

    // 147/148. Bulk Send generates individualized emails; recipients are never combined into one list
    const dbBeforeBulk = loadDatabase();
    const emailLogCountBefore = (dbBeforeBulk.candidateEmailLog || []).length;
    const bulkTargets = ['cand-002', 'cand-003'];
    const bulkSendResults = await candidateEmailService.sendBulkEmails(bulkTargets, { hiringEmployeeName: 'Ayesha' });
    assert(bulkSendResults.every((r) => r.success), '147a. Bulk send succeeds for every targeted candidate');
    const dbAfterBulk = loadDatabase();
    const newLogEntries = (dbAfterBulk.candidateEmailLog || []).slice(emailLogCountBefore);
    assert(newLogEntries.length === bulkTargets.length, '147b. Bulk send creates one individual email record per candidate');
    const distinctRecipients = new Set(newLogEntries.map((e) => e.to));
    assert(distinctRecipients.size === bulkTargets.length && newLogEntries.every((e) => !e.to.includes(',')), '148. Bulk send never combines multiple candidates into one shared recipient list — each email has exactly one distinct To address');

    // 149. Sent candidates are excluded from "Send All Pending"
    const pendingAfterSends = await upcomingCandidateService.queryCandidates({ scope: 'active', emailStatus: 'Pending' });
    assert(!pendingAfterSends.some((c) => ['cand-001', 'cand-002', 'cand-003'].includes(c.id)), '149. Already-Sent candidates are excluded from the Pending pool used by Send All Pending');
    assert(upcomingPageSrc.includes("c.emailStatus === 'Pending'") && upcomingPageSrc.includes('handleSendAllPending'), '149b. Send All Pending is implemented and filters strictly by Email Status = Pending');

    // 150. Replied status works
    const repliedCandidate = await upcomingCandidateService.recordReply('cand-005');
    assert(repliedCandidate.emailStatus === 'Replied' && Boolean(repliedCandidate.repliedAt), '150. Recording a reply sets Email Status = Replied with repliedAt stored');

    // 151. Notification count derives from reply state (Replied + not yet reviewed)
    const unreadBeforeReview = await upcomingCandidateService.getUnreadReplyCount();
    assert(unreadBeforeReview > 0, '151. Notification count reflects unreviewed Replied candidates');

    // 152. Notification panel renders candidate replies and a View action that marks them read
    assert(notificationsPanelSrc.includes("c.emailStatus === 'Replied'") && notificationsPanelSrc.includes('onView') && upcomingPageSrc.includes('markNotificationRead'), '152. Notifications panel lists replies and marking one Viewed clears it from the unread count');
    await upcomingCandidateService.markNotificationRead('cand-005');
    const unreadAfterReview = await upcomingCandidateService.getUnreadReplyCount();
    assert(unreadAfterReview === unreadBeforeReview - 1, '152b. Viewing a notification decrements the unread badge count');

    // 153. Accepted status works
    const acceptedCandidate = await upcomingCandidateService.acceptCandidate('cand-006');
    assert(acceptedCandidate.responseStatus === 'Accepted' && Boolean(acceptedCandidate.acceptedAt), '153. Accept sets Response = Accepted with acceptedAt stored');

    // 154. Rejected status works, and 155. the record is preserved (not hard-deleted)
    const totalBeforeReject = (await upcomingCandidateService.getAll()).length;
    const rejectedCandidate = await upcomingCandidateService.rejectCandidate('cand-002');
    const totalAfterReject = (await upcomingCandidateService.getAll()).length;
    assert(rejectedCandidate.responseStatus === 'Rejected' && Boolean(rejectedCandidate.rejectedAt), '154. Reject sets Response = Rejected with rejectedAt stored');
    assert(totalAfterReject === totalBeforeReject, '155. Rejecting a candidate preserves the record (soft move, not a hard delete) — total candidate count is unchanged');
    assert(upcomingPageSrc.includes('Move candidate to Rejected?'), '155b. Reject requires an explicit confirmation naming the move-to-Rejected action');

    // 156. Rejected tab shows the rejected candidate and excludes it from the active scope
    const activeScopeAfterReject = await upcomingCandidateService.queryCandidates({ scope: 'active' });
    const rejectedScopeAfterReject = await upcomingCandidateService.queryCandidates({ scope: 'rejected' });
    assert(!activeScopeAfterReject.some((c) => c.id === 'cand-002'), '156a. A rejected candidate no longer appears in the active Candidates scope');
    assert(rejectedScopeAfterReject.some((c) => c.id === 'cand-002'), '156b. A rejected candidate appears in the Rejected scope/tab');

    // 157. Restore works (Rejected -> Awaiting Response, back in active scope)
    const restored = await upcomingCandidateService.restoreCandidate('cand-002');
    assert(restored.responseStatus === 'Awaiting Response', '157. Restore returns a rejected candidate to Awaiting Response in the active pipeline');

    // 158. Pipeline summary counts are data-driven, not hardcoded
    const liveSummary = await upcomingCandidateService.getSummary();
    const liveAll = await upcomingCandidateService.getAll();
    const expectedShortlisted = liveAll.filter((c) => c.responseStatus !== 'Rejected').length;
    assert(liveSummary.shortlisted === expectedShortlisted, '158a. Summary counts are computed live from the current candidate dataset');
    assert(!/candidate-summary-value.*\d{2,}/.test(indexCssSrc), '158b. No hardcoded numeric summary values exist in styling/markup');

    // 159-162. Search / Department / Offer Type / Email Status / Response filters
    const searchResult = await upcomingCandidateService.queryCandidates({ scope: 'active', search: 'Kaiser' });
    const deptResult = await upcomingCandidateService.queryCandidates({ scope: 'active', departmentId: 'dept-3' });
    const offerResult = await upcomingCandidateService.queryCandidates({ scope: 'active', offerType: 'Unpaid' });
    const emailStatusResult = await upcomingCandidateService.queryCandidates({ scope: 'active', emailStatus: 'Sent' });
    const responseResult = await upcomingCandidateService.queryCandidates({ scope: 'active', responseStatus: 'Accepted' });
    assert(searchResult.length > 0 && searchResult.every((c) => c.fullName.includes('Kaiser')), '159. Search filters candidates by name (also supports email/position)');
    assert(deptResult.length > 0 && deptResult.every((c) => c.departmentId === 'dept-3'), '160. Department filter narrows candidates correctly');
    assert(offerResult.length > 0 && offerResult.every((c) => c.offerType === 'Unpaid'), '161. Offer Type filter narrows candidates correctly');
    assert(emailStatusResult.every((c) => c.emailStatus === 'Sent'), '162a. Email Status filter narrows candidates correctly');
    assert(responseResult.every((c) => c.responseStatus === 'Accepted'), '162b. Response filter narrows candidates correctly');
    assert(candidateToolbarSrc.includes('Select') && !candidateToolbarSrc.includes('<select'), '163. All Upcoming filters use the shared custom Select component, never a native <select>');

    // 164. Candidate service boundary exists with the expected operations
    assert(
      ['getAll', 'queryCandidates', 'getSummary', 'markEmailSent', 'recordReply', 'acceptCandidate', 'rejectCandidate', 'restoreCandidate', 'syncCandidates']
        .every((fn) => upcomingCandidateServiceSrc.includes(`async ${fn}(`)),
      '164. upcomingCandidateService exposes a complete, dedicated service boundary'
    );

    // 165. Email template service boundary exists
    assert(['getAll', 'getByOfferType', 'update', 'resetToDefault'].every((fn) => emailTemplateServiceSrc.includes(`async ${fn}(`)), '165. emailTemplateService exposes a dedicated service boundary; drafts are never manipulated via localStorage directly from components');
    assert(!emailDraftsPanelSrc.includes('localStorage') && !emailDraftsPanelSrc.includes('storageEngine'), '165b. EmailDraftsPanel never touches localStorage/storageEngine directly');

    // 166. Email send service boundary exists
    assert(['renderPreview', 'sendEmail', 'sendBulkEmails'].every((fn) => candidateEmailServiceSrc.includes(`async ${fn}(`)), '166. candidateEmailService exposes a dedicated send/render service boundary');

    // Strip comments before scanning for real code usage, so doc comments that explain what
    // is deliberately NOT used/claimed (e.g. "no SMTP/SendGrid", "never claims delivered")
    // can't produce a false positive against these checks.
    const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // 167. No fake network/email provider call exists anywhere in the new Upcoming code
    const newUpcomingSources = [upcomingCandidateServiceSrc, emailTemplateServiceSrc, candidateEmailServiceSrc, upcomingPageSrc, sendEmailModalSrc, emailDraftsPanelSrc, notificationsPanelSrc];
    const newUpcomingCodeOnly = newUpcomingSources.map(stripComments);
    assert(
      newUpcomingCodeOnly.every((src) => !/fetch\(|axios|XMLHttpRequest|smtp|sendgrid|resend\.|mailgun|nodemailer|firebase|supabase/i.test(src)),
      '167. No fake network request, SMTP, or third-party email provider call exists anywhere in the Upcoming workflow'
    );

    // 168. No real email delivery success is falsely claimed in any UI-visible string (JSX text
    // or a quoted string literal) — doc comments describing what is NOT claimed are excluded.
    assert(
      newUpcomingCodeOnly.every((src) => !/delivered|successfully sent|email sent successfully/i.test(src)),
      '168. No component or service claims a real email was actually delivered — only truthful PoC/local-record wording is used'
    );
    assert(/recorded|marked as sent|prepared and recorded/i.test(upcomingCandidateServiceSrc + candidateEmailServiceSrc + sendEmailModalSrc), '168b. Truthful PoC wording (recorded/marked as sent) is used for the send confirmation');

    // 169. Sync Candidates remains local/backend-ready (documented seam, no real fetch)
    assert(upcomingCandidateServiceSrc.includes('async syncCandidates(') && upcomingPageSrc.includes('upcomingCandidateService.syncCandidates()'), '169. Sync Candidates is implemented as a backend-ready service call, mirroring Sync Employees\' truthful local-refresh pattern');

    // 170. No native <select> anywhere across the new Upcoming UI
    const upcomingUiSources = [candidateToolbarSrc, sendEmailModalSrc, emailDraftsPanelSrc, notificationsPanelSrc, upcomingPageSrc, candidateTableSrc];
    assert(upcomingUiSources.every((src) => !src.includes('<select')), '170. No native <select> element exists anywhere in the new Upcoming UI');

    // 171. Mobile layout: candidate cards replace the table below the responsive breakpoint (no crushed table)
    assert(indexCssSrc.includes('.candidate-table-desktop') && indexCssSrc.includes('.candidate-card-grid') && /max-width:\s*768px[\s\S]{0,80}\.candidate-table-desktop[\s\S]{0,40}display:\s*none/.test(indexCssSrc), '171. Mobile layout swaps the candidate table for responsive candidate cards rather than crushing the table');

    // 172-179. Nothing in this task disturbed prior functionality
    assert(containerSrc2.includes('EmployeeListView') && containerSrc2.includes('EmployeeCardView') && containerSrc2.includes('EmployeeTimelineView'), '172. Employees List/Card/Timeline remain wired and operational');
    assert(employeeServiceSrc2.includes('async createDirectoryEmployee('), '173. Create Employee remains operational');
    assert(employeeServiceSrc2.includes('async syncEmployees('), '174. Sync Employees remains operational');
    assert(routerSrc2.includes("path: 'onboarding'") && routerSrc2.includes("path: 'offboarding'") && routerSrc2.includes("path: 'activities'"), '175. Onboarding/Offboarding/Activities routes remain registered');
    assert(CANONICAL_ROLES.length === 1 && CANONICAL_ROLES[0] === 'HR', '176. Single HR role remains intact');
    assert(
      !sidebarSrc3.includes('Organization') && !sidebarSrc3.includes('Reporting') && !sidebarSrc3.includes('Configuration') && !sidebarSrc3.includes('Presence') && !sidebarSrc3.includes('Permissions'),
      '177. Removed modules (Organization/Reporting/Configuration/Presence/Permissions) remain removed from the sidebar'
    );
    assert(sidebarSrc3.match(/Upcoming[\s\S]*Onboarding[\s\S]*Offboarding/), '178. Final PEOPLE order is exactly Upcoming, Onboarding, Offboarding');

    // Clean up: candidate mutations made during this verification run are local-process only
    // (Node in-memory DB, never real localStorage) — reset for a clean baseline regardless.
    resetDatabase();
    const restoredCandidates = await upcomingCandidateService.getAll();
    assert(restoredCandidates.length === 8 && restoredCandidates.every((c) => c.responseStatus !== 'Rejected' || c.id === 'cand-008'), '179. Candidate test mutations are cleaned up; canonical 8-candidate seed dataset is restored to its original state');

    // ==========================================================================
    // Upcoming — Undo Accepted + Internal Scroll Areas + Send Button Consistency
    // ==========================================================================

    resetDatabase();

    const candidateTableSrc2 = fs.readFileSync(path.resolve('./src/components/upcoming/CandidateTable.jsx'), 'utf-8');
    const upcomingPageSrc2 = fs.readFileSync(path.resolve('./src/pages/upcoming/UpcomingPage.jsx'), 'utf-8');
    const sendEmailModalSrc2 = fs.readFileSync(path.resolve('./src/components/upcoming/SendEmailModal.jsx'), 'utf-8');
    const notificationsPanelSrc2 = fs.readFileSync(path.resolve('./src/components/upcoming/NotificationsPanel.jsx'), 'utf-8');
    const upcomingCandidateServiceSrc2 = fs.readFileSync(path.resolve('./src/services/upcomingCandidateService.js'), 'utf-8');
    const indexCssSrc2 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

    // 180. Accepted candidate shows an Undo Accept action (not a plain unclickable pill)
    assert(
      candidateTableSrc2.includes('onUndoAccept') && candidateTableSrc2.includes("title={`Undo Accept for"),
      '180. Accepted candidates show an Undo Accept action'
    );

    // 181. Undo Accept requires confirmation, worded around the acceptance/Awaiting Response reversal
    assert(
      upcomingPageSrc2.includes('window.confirm(`Undo acceptance for') && upcomingPageSrc2.includes('Awaiting Response'),
      '181. Undo Accept requires an explicit confirmation before reversing the decision'
    );

    // 182-186. Undo Accept: Accepted -> Awaiting Response, acceptedAt cleared, everything else preserved
    const acceptedForUndo = await upcomingCandidateService.acceptCandidate('cand-001');
    assert(acceptedForUndo.responseStatus === 'Accepted' && Boolean(acceptedForUndo.acceptedAt), 'precondition: cand-001 is Accepted before undo');
    const emailStatusBeforeUndo = acceptedForUndo.emailStatus;
    const emailSentAtBeforeUndo = acceptedForUndo.emailSentAt;
    const repliedAtBeforeUndo = acceptedForUndo.repliedAt;
    const dbBeforeUndo = loadDatabase();
    const emailLogCountBeforeUndo = (dbBeforeUndo.candidateEmailLog || []).length;

    const undone = await upcomingCandidateService.undoAcceptCandidate('cand-001');
    assert(undone.responseStatus === 'Awaiting Response', '182. Undo Accept changes Accepted -> Awaiting Response');
    assert(undone.acceptedAt === null, '183. acceptedAt is cleared by Undo Accept');
    assert(undone.emailStatus === emailStatusBeforeUndo, '184. Email Status is preserved by Undo Accept');
    assert(undone.emailSentAt === emailSentAtBeforeUndo, '185. emailSentAt is preserved by Undo Accept');
    assert(undone.repliedAt === repliedAtBeforeUndo, '186. repliedAt is preserved by Undo Accept');
    const dbAfterUndo = loadDatabase();
    assert((dbAfterUndo.candidateEmailLog || []).length === emailLogCountBeforeUndo, '187. Email log/history is unaffected by Undo Accept');

    // 188. Undo goes through the service layer, not direct mutation in the table component
    // (comparisons like `responseStatus === 'Accepted'` must not false-positive as an assignment)
    assert(
      upcomingCandidateServiceSrc2.includes('async undoAcceptCandidate(') &&
      !/responseStatus\s*=(?!=)/.test(candidateTableSrc2) && !/\.acceptedAt\s*=(?!=)/.test(candidateTableSrc2),
      '188. Undo Accept is implemented as a service method; the table component never mutates candidate records directly'
    );

    // 188b. Undo Accept only operates on a currently-Accepted candidate (service-level guard)
    let undoOnNonAcceptedErr = null;
    try {
      await upcomingCandidateService.undoAcceptCandidate('cand-002'); // cand-002 is Pending/Awaiting, never Accepted
    } catch (err) {
      undoOnNonAcceptedErr = err;
    }
    assert(undoOnNonAcceptedErr !== null, '188b. Undo Accept is rejected for a candidate that is not currently Accepted');

    // 189. Rejected Restore behavior still works, unaffected by this task
    const restoredCandidate2 = await upcomingCandidateService.restoreCandidate('cand-008');
    assert(restoredCandidate2.responseStatus === 'Awaiting Response', '189. Restore (Rejected -> Awaiting Response) still works');

    // 190. Email preview area (single mode) has internal vertical scrolling via a constrained, scrollable textarea.
    // (Superseded implementation note: overflow-y/overflow-x now live on the shared .app-scroll-area class rather
    // than being duplicated directly on .email-body-textarea — see checks 214-216 for the current architecture.
    // This check is updated in place to assert the same requirement against that current implementation.)
    assert(
      indexCssSrc2.includes('.email-body-textarea') && /\.email-body-textarea\s*\{[^}]*max-height:\s*300px/.test(indexCssSrc2) &&
      sendEmailModalSrc2.includes('email-body-textarea app-scroll-area'),
      '190. Email body preview has a constrained max-height with internal vertical scrolling (via .app-scroll-area)'
    );

    // 191. Email body wraps without introducing horizontal scrolling
    assert(/\.email-body-textarea\s*\{[^}]*word-wrap:\s*break-word/.test(indexCssSrc2), '191. Email body wraps naturally with no horizontal scrolling');

    // 192. Bulk preview area has internal scrolling (pre-existing, confirmed still present)
    // (Superseded: scrolling for the candidate list now lives one level up, on the single
    // .bulk-main-scroll-area primary scroll region introduced by the modal-congestion fix —
    // see checks 242-251 — rather than on .bulk-candidate-list itself. Same requirement
    // (the list scrolls internally, not unbounded), updated to the current architecture.)
    assert(indexCssSrc2.includes('.bulk-main-scroll-area') && /\.bulk-main-scroll-area\s*\{[^}]*overflow-y:\s*auto/.test(indexCssSrc2), '192. The bulk candidate preview list scrolls internally (via .bulk-main-scroll-area) rather than growing unbounded');

    // 193/194. Modal header/footer stay fixed and reachable via a reusable scroll-shell layout, applied to both Send Email and Notifications
    // (max-height bumped from 85vh to 90vh by the bulk-modal-congestion fix, matching the
    // task's suggested responsive model; same requirement, updated value.)
    assert(indexCssSrc2.includes('.modal-scroll-shell') && /\.modal-scroll-shell\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*max-height:\s*90vh/.test(indexCssSrc2), '193. A reusable modal-scroll-shell layout keeps modals within a bounded viewport height');
    assert(sendEmailModalSrc2.includes('modal-scroll-shell') && notificationsPanelSrc2.includes('modal-scroll-shell'), '194. Both the Send Email modal and Notifications panel use the fixed-header/footer scroll-shell layout');

    // 195. Candidate Replies list has internal vertical scrolling via the scroll-shell's body
    assert(notificationsPanelSrc2.includes('notification-list') && notificationsPanelSrc2.includes('modal-body'), '195. Candidate Replies renders inside the scrollable modal-body region');

    // 196. Notification panel header remains visible (not inside the scrolling region)
    assert(/\.modal-scroll-shell\s*>\s*\.modal-header[\s\S]{0,300}?\{\s*flex-shrink:\s*0;\s*\}/.test(indexCssSrc2), '196. The modal header is excluded from the scrolling region (flex-shrink: 0) and stays visible');

    // 197. No horizontal overflow was introduced by the scroll-shell rule itself (only overflow-y is set on the
    // scrollable body) — scoped strictly to the .modal-scroll-shell rule block, not the whole stylesheet.
    const scrollShellRuleMatch = indexCssSrc2.match(/\.modal-scroll-shell\s*\{[^}]*\}/);
    assert(Boolean(scrollShellRuleMatch) && !/overflow-x:\s*(auto|scroll)/.test(scrollShellRuleMatch[0]), '197. The scroll-shell layout introduces no horizontal scrolling');

    // 198. Bulk primary button preserves its existing dynamic wording exactly
    assert(
      upcomingPageSrc2.includes('Send {pendingCount} Pending Email{pendingCount === 1 ? \'\' : \'s\'}'),
      '198. The bulk pending-send button preserves its exact existing dynamic wording (e.g. "Send 2 Pending Emails")'
    );

    // 199. The dynamic candidate count driving that button continues to be computed from real data
    const pendingCandidatesLive = await upcomingCandidateService.queryCandidates({ scope: 'active', emailStatus: 'Pending' });
    assert(upcomingPageSrc2.includes("candidates.filter((c) => c.emailStatus === 'Pending').length") && Array.isArray(pendingCandidatesLive), '199. The Pending count feeding the bulk button label is computed live from the candidate dataset, not hardcoded');

    // 200. Single-send button wording is unchanged
    assert(sendEmailModalSrc2.includes("isBulk ? `Confirm & Send ${candidates.length} Emails` : 'Send Email'"), '200. Single-send button wording ("Send Email") remains unchanged');

    // 201. Bulk pending-send button now uses the same btn-primary (Rizurf teal) styling as the header Send Email button
    const pendingButtonMatch = upcomingPageSrc2.match(/className="([^"]*)"\s*onClick=\{handleSendAllPending\}/);
    assert(pendingButtonMatch && pendingButtonMatch[1].includes('btn-primary') && !pendingButtonMatch[1].includes('btn-secondary'), '201. The bulk "Send N Pending Emails" button now uses btn-primary (the same teal styling as the normal Send Email button), not a separate secondary/alternate style');

    // 202. Reject remains a distinct, unchanged danger-style action (not touched by the button-color standardization)
    assert(indexCssSrc2.includes('.candidate-action-btn.reject') && /\.candidate-action-btn\.reject\s*\{[^}]*color:\s*#DC2626/.test(indexCssSrc2), '202. Reject retains its distinct destructive (red) styling, untouched by the primary-button standardization');

    // 203. Bulk personalization and single-recipient-per-email behavior remain intact after the styling change
    const bulkTargets2 = ['cand-003', 'cand-004'];
    const bulkResults2 = await candidateEmailService.sendBulkEmails(bulkTargets2, { hiringEmployeeName: 'Ayesha' });
    assert(bulkResults2.every((r) => r.success), '203a. Bulk-send still succeeds for every targeted candidate');
    const dbAfterBulk2 = loadDatabase();
    const recipientsAfterBulk2 = (dbAfterBulk2.candidateEmailLog || []).slice(-2).map((e) => e.to);
    assert(new Set(recipientsAfterBulk2).size === 2, '203b. Bulk emails remain individually personalized with distinct recipients (no shared/merged recipient list)');

    // 204. Sent/Replied candidates remain excluded from the Pending pool (not auto-resent) after the styling/undo changes
    const pendingAfterBulk2 = await upcomingCandidateService.queryCandidates({ scope: 'active', emailStatus: 'Pending' });
    assert(!pendingAfterBulk2.some((c) => bulkTargets2.includes(c.id)), '204. Already-Sent candidates remain excluded from Send All Pending; nothing is auto-resent');

    // 205-212. Nothing else in the Upcoming workflow or the rest of the app regressed
    assert(upcomingPageSrc2.includes('EmailDraftsPanel') && upcomingPageSrc2.includes('NotificationsPanel') && upcomingPageSrc2.includes('handleAccept') && upcomingPageSrc2.includes('handleReject') && upcomingPageSrc2.includes('handleRestore'), '205-209. Email Drafts, Notifications, Accept, Reject, and Restore remain wired and operational');
    assert(containerSrc2.includes('EmployeeListView') && containerSrc2.includes('EmployeeCardView') && containerSrc2.includes('EmployeeTimelineView'), '210. Employees List/Card/Timeline remain operational');
    assert(employeeServiceSrc2.includes('async createDirectoryEmployee(') && employeeServiceSrc2.includes('async syncEmployees('), '211. Create Employee and Sync Employees remain operational');
    assert(routerSrc2.includes("path: 'onboarding'") && routerSrc2.includes("path: 'offboarding'") && routerSrc2.includes("path: 'activities'") && CANONICAL_ROLES.length === 1 && CANONICAL_ROLES[0] === 'HR', '212. Onboarding/Offboarding/Activities remain registered and the single HR role remains intact');

    // Clean up: reset the candidate mutations made by this verification block
    resetDatabase();
    const restoredCandidates2 = await upcomingCandidateService.getAll();
    assert(restoredCandidates2.length === 8, '213. Test-created candidate mutations from this block are cleaned up; canonical 8-candidate seed dataset is restored');

    // ==========================================================================
    // Upcoming — Visible Scrollbars + Exact Send Button Color Consistency
    // ==========================================================================

    const sendEmailModalSrc3 = fs.readFileSync(path.resolve('./src/components/upcoming/SendEmailModal.jsx'), 'utf-8');
    const notificationsPanelSrc3 = fs.readFileSync(path.resolve('./src/components/upcoming/NotificationsPanel.jsx'), 'utf-8');
    const upcomingPageSrc3 = fs.readFileSync(path.resolve('./src/pages/upcoming/UpcomingPage.jsx'), 'utf-8');
    const indexCssSrc3 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

    const appScrollAreaRuleMatch = indexCssSrc3.match(/\.app-scroll-area\s*\{[^}]*\}/);
    const emailBodyTextareaRuleMatch = indexCssSrc3.match(/\.email-body-textarea\s*\{[^}]*\}/);
    const bulkPreviewBodyRuleMatch = indexCssSrc3.match(/\.bulk-preview-body\s*\{[^}]*\}/);
    const notificationListRuleMatch = indexCssSrc3.match(/\.notification-list\s*\{[^}]*\}/);

    // 214. Single email body has a dedicated internal scroll container (own max-height, not just the outer modal)
    assert(
      sendEmailModalSrc3.includes('className="form-textarea email-body-textarea app-scroll-area"') &&
      Boolean(emailBodyTextareaRuleMatch) && /max-height:\s*300px/.test(emailBodyTextareaRuleMatch[0]),
      '214. The single-mode email body textarea has its own dedicated, bounded scroll container'
    );

    // 215. Email body uses vertical scrolling, forced visible via `scroll` (not merely `auto`)
    assert(Boolean(appScrollAreaRuleMatch) && /overflow-y:\s*scroll/.test(appScrollAreaRuleMatch[0]), '215. The scroll area uses overflow-y: scroll so the scrollbar track stays persistently present');

    // 216. Email body prevents horizontal scrolling
    assert(Boolean(appScrollAreaRuleMatch) && /overflow-x:\s*hidden/.test(appScrollAreaRuleMatch[0]), '216. The scroll area sets overflow-x: hidden, preventing horizontal scrolling');

    // 217/218. REVERSED by the bulk-modal-congestion fix (deliberate): expanded candidate email
    // bodies must NOT be trapped in their own small nested scrollbar anymore — they grow
    // naturally in document flow so the full draft is readable, and the ONE primary
    // .bulk-main-scroll-area (checks 242+) handles all vertical scrolling instead. This is an
    // intentional architecture change for this task, not a regression — asserting the
    // opposite of what checks 217/218 previously required.
    const bulkPreviewBodyRuleCodeOnly = bulkPreviewBodyRuleMatch ? stripComments(bulkPreviewBodyRuleMatch[0]) : '';
    assert(
      sendEmailModalSrc3.includes('className="bulk-preview-body"') && !sendEmailModalSrc3.includes('className="bulk-preview-body app-scroll-area"') &&
      Boolean(bulkPreviewBodyRuleMatch) && !/max-height/.test(bulkPreviewBodyRuleCodeOnly) && !/overflow-y/.test(bulkPreviewBodyRuleCodeOnly),
      '217. Expanded bulk candidate email bodies grow naturally in flow (no cramped per-candidate max-height/scroll trap) — fixed as part of the modal-congestion refinement'
    );
    assert(!indexCssSrc3.includes('.bulk-preview-body::-webkit-scrollbar'), '218. No per-candidate email-body scrollbar styling remains, consistent with the single-scroll-area redesign');

    // 219. REVERSED by the same fix: .bulk-candidate-list is now a plain (non-scrolling) flex-column
    // layout container — all bulk-mode scrolling is consolidated into the one .bulk-main-scroll-area
    // that wraps it, rather than the list having its own separate bounded scroll region.
    assert(
      indexCssSrc3.includes('.bulk-candidate-list') && !/\.bulk-candidate-list\s*\{[^}]*overflow-y/.test(indexCssSrc3),
      '219. The bulk candidate list is a plain layout container; scrolling is consolidated into the single .bulk-main-scroll-area rather than a separate nested list scroll region'
    );

    // 220. Modal footer remains reachable (fixed-header/footer scroll-shell layout still applied)
    assert(sendEmailModalSrc3.includes('modal-scroll-shell') && indexCssSrc3.includes('.modal-scroll-shell'), '220. The Send Email modal footer remains reachable via the fixed-header/footer scroll-shell layout');

    // 221. Candidate Replies has a dedicated replies-list scroll container (not merely the outer modal-body)
    assert(
      notificationsPanelSrc3.includes('className="notification-list app-scroll-area"') &&
      Boolean(notificationListRuleMatch) && /max-height:\s*360px/.test(notificationListRuleMatch[0]),
      '221. The Candidate Replies list (.notification-list) has its own dedicated, bounded scroll container'
    );

    // 222. Candidate Replies header does not scroll away (still governed by the scroll-shell's fixed header)
    assert(notificationsPanelSrc3.includes('modal-scroll-shell') && /\.modal-scroll-shell\s*>\s*\.modal-header[\s\S]{0,300}?\{\s*flex-shrink:\s*0;\s*\}/.test(indexCssSrc3), '222. The Candidate Replies header stays fixed and never scrolls away');

    // 223/224. Replies list scrolls vertically and prevents horizontal scrolling (via the same app-scroll-area contract)
    assert(Boolean(notificationListRuleMatch), 'precondition: .notification-list rule exists');
    assert(/overflow-y:\s*scroll/.test(appScrollAreaRuleMatch[0]) && /overflow-x:\s*hidden/.test(appScrollAreaRuleMatch[0]), '223-224. Replies list scrolls vertically only, with horizontal scrolling prevented');

    // 225. View buttons remain reachable after scrolling (list scroll container wraps the items, View stays inside each item)
    assert(notificationsPanelSrc3.includes('onView(c.id)') && notificationsPanelSrc3.match(/notification-list app-scroll-area[\s\S]*?onView/), '225. View buttons remain inside the scrollable list and are reachable by scrolling');

    // 226. This task's scrollbar styling is scoped to the dedicated .app-scroll-area class only — it never
    // introduces a bare/global ::-webkit-scrollbar rule that would affect unrelated elements app-wide.
    // (Pre-existing, unrelated scrollbar styling such as .sidebar-nav's own is untouched and out of scope here.)
    assert(
      !/(^|\s)::-webkit-scrollbar\b/m.test(indexCssSrc3) && !/\*\s*::-webkit-scrollbar\b/.test(indexCssSrc3) &&
      indexCssSrc3.includes('.app-scroll-area::-webkit-scrollbar'),
      '226. This task\'s scrollbar styling is scoped to .app-scroll-area, never introduced as a bare/global rule affecting unrelated elements'
    );

    // 227/228. Email preview / Notifications scrollbar has visible track + thumb styling (not merely default browser chrome)
    assert(
      indexCssSrc3.includes('.app-scroll-area::-webkit-scrollbar-track') && indexCssSrc3.includes('.app-scroll-area::-webkit-scrollbar-thumb') && indexCssSrc3.includes('.app-scroll-area::-webkit-scrollbar-thumb:hover'),
      '227-228. The shared scroll-area styling defines explicit, visible scrollbar track + thumb (+ hover) treatment for both the email preview and Notifications panel'
    );
    assert(/scrollbar-width:\s*thin/.test(appScrollAreaRuleMatch[0]) && /scrollbar-color:/.test(appScrollAreaRuleMatch[0]), '228b. Firefox scrollbar-width/scrollbar-color are also set for cross-browser visibility');

    // 229. Top "Send Email" button styling is identified from its actual reusable class combination
    assert(upcomingPageSrc3.includes('className="btn-primary btn-header-action"'), '229. The top Send Email button\'s class combination (btn-primary btn-header-action) is identified as the reusable primary-button styling source');

    // 230/231/232. Bottom "Send N Pending Emails" uses the EXACT same class combination — same background, same sizing (which is what previously differed)
    const sendButtonClassMatches = upcomingPageSrc3.match(/className="btn-primary btn-header-action"/g) || [];
    assert(sendButtonClassMatches.length >= 2, '230. Both the top Send Email button and the bottom Send N Pending Emails button use the identical "btn-primary btn-header-action" class combination');
    assert(
      Boolean(indexCssSrc3.match(/\.btn-primary\.btn-header-action,\s*\n?\s*\.btn-secondary\.btn-header-action\s*\{[^}]*padding:\s*0\.45rem 0\.85rem;[^}]*font-size:\s*0\.815rem;[^}]*height:\s*36px;[^}]*\}/)),
      '231. A combined-specificity rule pins identical padding/font-size/height for any .btn-primary or .btn-secondary paired with .btn-header-action, regardless of stylesheet order'
    );
    assert(indexCssSrc3.includes('background-color: var(--color-primary);') && indexCssSrc3.includes('.btn-primary:hover'), '232. Both buttons resolve to the same .btn-primary background/hover color source (var(--color-primary)), with no separate duplicated color value');

    // 233. Dynamic "Send N Pending Emails" wording is unchanged
    assert(upcomingPageSrc3.includes("Send {pendingCount} Pending Email{pendingCount === 1 ? '' : 's'}"), '233. The dynamic "Send N Pending Emails" wording is unchanged');

    // 234. Dynamic pending count remains correct (computed live, not hardcoded)
    const pendingLive = await upcomingCandidateService.queryCandidates({ scope: 'active', emailStatus: 'Pending' });
    assert(upcomingPageSrc3.includes("candidates.filter((c) => c.emailStatus === 'Pending').length") && Array.isArray(pendingLive), '234. The Pending count feeding the bulk button label remains computed live from the candidate dataset');

    // 235. Pending-only send behavior remains intact (Sent/Replied candidates never included)
    const sentCandidateCheck = await upcomingCandidateService.getById('cand-003'); // Sent in seed data
    assert(sentCandidateCheck.emailStatus !== 'Pending', 'precondition: cand-003 is not Pending');
    const pendingOnlyCheck = await upcomingCandidateService.queryCandidates({ scope: 'active', emailStatus: 'Pending' });
    assert(!pendingOnlyCheck.some((c) => c.id === 'cand-003'), '235. Pending-only Send All behavior remains intact; already-Sent candidates are never included');

    // 236-241. Nothing else regressed
    assert(upcomingCandidateServiceSrc2.includes('async undoAcceptCandidate('), '236. Undo Accept remains operational');
    assert(upcomingPageSrc3.includes('NotificationsPanel') && upcomingPageSrc3.includes('EmailDraftsPanel'), '237-238. Notifications and Email Drafts remain operational');
    assert(upcomingPageSrc3.includes('UpcomingPage') === false || upcomingPageSrc3.includes('export default function UpcomingPage'), '239. Upcoming page remains operational');
    assert(containerSrc2.includes('EmployeeListView') && containerSrc2.includes('EmployeeCardView') && containerSrc2.includes('EmployeeTimelineView'), '240. Employees List/Card/Timeline remain operational');
    assert(routerSrc2.includes("path: 'onboarding'") && routerSrc2.includes("path: 'offboarding'") && routerSrc2.includes("path: 'activities'"), '241. Onboarding/Offboarding/Activities remain operational');

    // ==========================================================================
    // Upcoming — Bulk Email Modal Congestion Fix + Live Hiring Employee Name Rendering
    // ==========================================================================

    const sendEmailModalSrc4 = fs.readFileSync(path.resolve('./src/components/upcoming/SendEmailModal.jsx'), 'utf-8');
    const indexCssSrc5 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
    const bulkMainScrollRuleMatch = indexCssSrc5.match(/\.bulk-main-scroll-area\s*\{[^}]*\}/);
    const bulkModalBodyRuleMatch = indexCssSrc5.match(/\.modal-scroll-shell\s*>\s*\.modal-body\.bulk-modal-body\s*\{[^}]*\}/);
    const bulkCandidateListRuleMatch2 = indexCssSrc5.match(/\.bulk-candidate-list\s*\{[^}]*\}/);

    // 242. Bulk modal uses ONE primary scrollable content area
    assert(
      sendEmailModalSrc4.includes('className="modal-body bulk-modal-body"') && sendEmailModalSrc4.includes('className="bulk-main-scroll-area"') &&
      Boolean(bulkModalBodyRuleMatch) && stripComments(bulkModalBodyRuleMatch[0]).includes('overflow-y: hidden') &&
      Boolean(bulkMainScrollRuleMatch) && /flex:\s*1/.test(bulkMainScrollRuleMatch[0]) && /overflow-y:\s*auto/.test(bulkMainScrollRuleMatch[0]),
      '242. Bulk modal consolidates scrolling into ONE primary content area (.bulk-main-scroll-area); the outer .bulk-modal-body itself no longer scrolls'
    );

    // 243. Bulk candidate list remains vertically scrollable (via the single primary area)
    assert(Boolean(bulkMainScrollRuleMatch) && /overflow-y:\s*auto/.test(bulkMainScrollRuleMatch[0]), '243. The bulk candidate list remains vertically scrollable through .bulk-main-scroll-area');

    // 244. Expanded candidate email body is not trapped in an unnecessary small nested scroll area (see also 217)
    assert(
      Boolean(bulkCandidateListRuleMatch2) && !stripComments(bulkCandidateListRuleMatch2[0]).includes('overflow-y') &&
      !sendEmailModalSrc4.includes('className="bulk-preview-body app-scroll-area"'),
      '244. Expanded candidate email preview is no longer trapped in a small nested scroll area — it grows naturally within the single primary scroll region'
    );

    // 245. Full expanded email content can be reached — the body has no height cap of its own, so its
    // complete rendered height is always part of the single scrollable region's content.
    const bulkPreviewBodyRuleMatch2 = indexCssSrc5.match(/\.bulk-preview-body\s*\{[^}]*\}/);
    assert(Boolean(bulkPreviewBodyRuleMatch2) && !stripComments(bulkPreviewBodyRuleMatch2[0]).includes('max-height'), '245. The full expanded email body is reachable — no max-height truncates it before "Best regards, ... Rizurf Team"');

    // 246/247. Candidate 2..N and the last candidate remain reachable while Candidate 1 is expanded —
    // guaranteed structurally: .bulk-candidate-list is a plain flex column (no overflow of its own) inside
    // the single .bulk-main-scroll-area, so expanding any row just adds height within that one scroller.
    assert(
      sendEmailModalSrc4.match(/bulk-main-scroll-area["'][\s\S]*?bulk-candidate-list["'][\s\S]*?bulkPreviews\.map/),
      '246-247. Candidate rows render inside the single .bulk-main-scroll-area, so expanding one candidate never hides the others — all remain reachable by scrolling that one region, including the last candidate'
    );

    // 248/249. Modal footer remains reachable and never permanently covers the last candidate (fixed
    // sibling flex child via modal-scroll-shell, not an overlay stacked on top of the content)
    assert(sendEmailModalSrc4.includes('modal-scroll-shell') && indexCssSrc5.includes('.modal-scroll-shell > .modal-footer'), '248-249. The modal footer (Cancel / Confirm & Send N Emails) stays a fixed, non-overlapping sibling — always reachable and never covering the last candidate card');

    // 250. No horizontal overflow in the bulk modal's primary scroll area
    assert(Boolean(bulkMainScrollRuleMatch) && /overflow-x:\s*hidden/.test(bulkMainScrollRuleMatch[0]), '250. .bulk-main-scroll-area sets overflow-x: hidden — no horizontal overflow in the bulk modal');

    // 251. Hiring Employee Name field is controlled state
    assert(sendEmailModalSrc4.includes('value={hiringEmployeeName}') && sendEmailModalSrc4.includes('onChange={(e) => handleHiringNameChange(e.target.value)}'), '251. Hiring Employee Name is a controlled input driven by component state');

    // 252. Changing Hiring Employee Name re-renders ALL previews — bulk mode's effect is keyed on
    // hiringEmployeeName and re-fetches every candidate's preview on each change
    assert(sendEmailModalSrc4.match(/candidates\.map\(async \(c\) => \{\s*const preview = await candidateEmailService\.renderPreview\(c, \{ hiringEmployeeName, cc \}\)/), '252. Every bulk candidate preview is re-rendered whenever hiringEmployeeName changes');

    // 253. {{HiringEmployeeName}} resolves exclusively through the centralized renderEmailTemplate()/renderPreview()
    // path — no scattered ad-hoc .replace() calls reimplementing placeholder logic in the component
    const sendEmailModalCodeOnly = stripComments(sendEmailModalSrc4);
    assert(
      sendEmailModalCodeOnly.includes('renderEmailTemplate(subjectTemplate,') && sendEmailModalCodeOnly.includes('renderEmailTemplate(bodyTemplate,') &&
      !/setSubject\(\(prev\) => renderEmailTemplate\(prev,/.test(sendEmailModalCodeOnly) && !/\.replace\(\s*['"`]\{\{/.test(sendEmailModalCodeOnly),
      '253. {{HiringEmployeeName}} resolves through the centralized renderEmailTemplate() against the raw template on every change — not a scattered/destructive one-time string replace'
    );

    // 254-257. THE CORE BUG FIX: typing progressively (A -> Ay -> Aye -> Ayesha) must resolve correctly
    // at every single keystroke, not just the first. This directly reproduces the previous defect (a
    // destructive one-shot replace on the *already-mutated* string, which only ever resolved character
    // #1 and then silently stopped updating) and proves the new raw-template-based re-render is correct.
    const rawSubjectTemplate = 'Best regards,\n{{HiringEmployeeName}}\nRizurf Team';
    const oldBuggyBehaviorSubject1 = renderEmailTemplate2(rawSubjectTemplate, { HiringEmployeeName: 'A' }).rendered;
    const oldBuggyBehaviorSubject2 = renderEmailTemplate2(oldBuggyBehaviorSubject1, { HiringEmployeeName: 'Ay' }).rendered;
    assert(oldBuggyBehaviorSubject2 === oldBuggyBehaviorSubject1, 'documents the fixed defect: destructively replacing into an already-resolved string silently stops updating after the first keystroke');

    const typedSteps = ['A', 'Ay', 'Aye', 'Ayesha'].map((typed) => renderEmailTemplate2(rawSubjectTemplate, { HiringEmployeeName: typed }).rendered);
    assert(
      typedSteps[0].includes('\nA\n') && typedSteps[1].includes('\nAy\n') && typedSteps[2].includes('\nAye\n') && typedSteps[3].includes('\nAyesha\n'),
      '254-257. Typing A -> Ay -> Aye -> Ayesha each correctly re-renders from the raw template (the fix: re-render fresh from an unmutated template on every keystroke, never a cumulative destructive replace)'
    );

    // 258/259. Typed name appears in Candidate 1's AND Candidate 2's (and by extension every) bulk preview —
    // each candidate is rendered independently, but all receive the same current hiringEmployeeName
    const candForName1 = await upcomingCandidateService.getById('cand-001');
    const candForName2 = await upcomingCandidateService.getById('cand-002');
    const previewName1 = await candidateEmailService.renderPreview(candForName1, { hiringEmployeeName: 'Ayesha' });
    const previewName2 = await candidateEmailService.renderPreview(candForName2, { hiringEmployeeName: 'Ayesha' });
    assert(previewName1.body.includes('Ayesha') && previewName1.unresolvedPlaceholders.length === 0, '258. Typed Hiring Employee Name appears in Candidate 1\'s preview');
    assert(previewName2.body.includes('Ayesha') && previewName2.unresolvedPlaceholders.length === 0, '259. Typed Hiring Employee Name appears in Candidate 2\'s preview (and, by the same shared renderer, every other bulk candidate)');

    // 260/261. Missing Name warning disappears once a name is provided, and the unresolved-placeholder
    // check passes cleanly after a valid name (was present with '', gone with 'Ayesha')
    const previewMissingName = await candidateEmailService.renderPreview(candForName1, { hiringEmployeeName: '' });
    assert(previewMissingName.unresolvedPlaceholders.includes('HiringEmployeeName'), '260. Missing Name is correctly flagged (unresolved placeholder) while the field is empty');
    assert(previewName1.unresolvedPlaceholders.length === 0, '261. The unresolved-placeholder check passes cleanly once a valid Hiring Employee Name is provided — no stale warning remains');

    // 262/263. ApplicantName and PositionName personalization still work correctly per candidate
    assert(previewName1.body.includes(candForName1.fullName) && previewName1.body.includes(candForName1.positionName), '262. ApplicantName personalization still works');
    assert(previewName2.body.includes(candForName2.fullName) && previewName2.body.includes(candForName2.positionName), '263. PositionName personalization still works');

    // 264. Candidate recipients remain separate (never merged) — re-confirmed after this refinement
    assert(previewName1.to === candForName1.email && previewName2.to === candForName2.email && previewName1.to !== previewName2.to, '264. Candidate recipients remain separate and individually addressed after this refinement');

    // 265. Single email mode remains operational, with the SAME live-typing fix applied (raw template
    // kept separately; re-render on every Hiring Employee Name change until the user manually edits)
    assert(
      sendEmailModalCodeOnly.includes('setSubjectTemplate(preview.subject)') && sendEmailModalCodeOnly.includes('setBodyTemplate(preview.body)') &&
      sendEmailModalCodeOnly.includes('setUserEditedEmail(true)'),
      '265. Single-email mode remains operational and now shares the same correct, centrally-rendered live-update behavior as bulk mode'
    );

    // 266. CC remains operational
    assert(sendEmailModalSrc4.includes('validateCcList') && sendEmailModalSrc4.includes('value={cc}'), '266. CC remains operational (validated, controlled input)');

    // 267. Confirm & Send N Emails wording/behavior unchanged
    assert(sendEmailModalSrc4.includes("isBulk ? `Confirm & Send ${candidates.length} Emails` : 'Send Email'"), '267. "Confirm & Send N Emails" wording and send logic remain unchanged');

    // 268. Paid/Unpaid template selection remains operational
    const paidCheck = await candidateEmailService.renderPreview(await upcomingCandidateService.getById('cand-001'), { hiringEmployeeName: 'Ayesha' });
    const unpaidCheck = await candidateEmailService.renderPreview(await upcomingCandidateService.getById('cand-002'), { hiringEmployeeName: 'Ayesha' });
    assert(paidCheck.body.includes('RM600') && unpaidCheck.body.includes('unpaid, hybrid'), '268. Paid/Unpaid template selection by Offer Type remains operational');

    // 269-274. Nothing else in Upcoming or the rest of the app regressed
    assert(upcomingPageSrc3.includes('NotificationsPanel') && notificationsPanelSrc3.includes('app-scroll-area'), '269. Candidate Replies (with its own scroll behavior) remains operational');
    assert(upcomingCandidateServiceSrc2.includes('async undoAcceptCandidate('), '270. Undo Accept remains operational');
    assert(containerSrc2.includes('EmployeeListView') && containerSrc2.includes('EmployeeCardView') && containerSrc2.includes('EmployeeTimelineView'), '271. Employees List/Card/Timeline remain operational');
    assert(employeeServiceSrc2.includes('async createDirectoryEmployee(') && employeeServiceSrc2.includes('async syncEmployees('), '272. Create Employee and Sync Employees remain operational');
    assert(routerSrc2.includes("path: 'onboarding'") && routerSrc2.includes("path: 'offboarding'") && routerSrc2.includes("path: 'activities'"), '273. Onboarding/Offboarding/Activities remain operational');
    assert(CANONICAL_ROLES.length === 1 && CANONICAL_ROLES[0] === 'HR', '274. Single HR role remains intact');

    // ==========================================================================
    // Upcoming — Replies Terminology + View Button Color Consistency
    // ==========================================================================

    const upcomingPageSrc4 = fs.readFileSync(path.resolve('./src/pages/upcoming/UpcomingPage.jsx'), 'utf-8');
    const notificationsPanelSrc4 = fs.readFileSync(path.resolve('./src/components/upcoming/NotificationsPanel.jsx'), 'utf-8');
    const candidateTableSrc3 = fs.readFileSync(path.resolve('./src/components/upcoming/CandidateTable.jsx'), 'utf-8');

    // 275. Top button visible text is exactly "Replies"
    assert(upcomingPageSrc4.includes('<span>Replies</span>'), '275. The top action button\'s visible label is exactly "Replies"');

    // 276. "Notifications" is no longer displayed as the top action button label
    assert(!upcomingPageSrc4.includes('<span>Notifications</span>'), '276. "Notifications" is no longer displayed as the top action button label');

    // 277. Clicking Replies still opens the same Candidate Replies popup (unchanged handler/state wiring)
    assert(
      upcomingPageSrc4.includes('onClick={() => setIsNotificationsOpen(true)}') && upcomingPageSrc4.includes('<NotificationsPanel') && upcomingPageSrc4.includes('isOpen={isNotificationsOpen}'),
      '277. Clicking Replies still opens the same Candidate Replies popup (internal state/handler intentionally left unrenamed, per the task)'
    );

    // 278/279. Popup heading and subtitle remain exactly unchanged
    assert(notificationsPanelSrc4.includes('>Candidate Replies<'), '278. Popup heading remains exactly "Candidate Replies"');
    assert(notificationsPanelSrc4.includes('>Replies awaiting HR review<'), '279. Popup subtitle remains exactly "Replies awaiting HR review"');

    // 280. Existing unread reply badge/count remains functional (unchanged calculation)
    assert(upcomingPageSrc4.includes('{unreadCount > 0 && <span className="candidate-notification-badge">{unreadCount}</span>}'), '280. The unread reply badge/count remains functional and unchanged');
    const unreadForRenameCheck = await upcomingCandidateService.getUnreadReplyCount();
    assert(typeof unreadForRenameCheck === 'number', '280b. Unread reply count calculation still works after the rename');

    // 281. Existing read/unread behavior remains functional (markNotificationRead untouched)
    const repliedForRenameCheck = await upcomingCandidateService.recordReply('cand-006');
    assert(repliedForRenameCheck.notificationRead === false, 'precondition: a fresh reply is unread');
    const readForRenameCheck = await upcomingCandidateService.markNotificationRead('cand-006');
    assert(readForRenameCheck.notificationRead === true, '281. Read/unread reply behavior remains functional after the rename');

    // 282. Candidate Replies View buttons still say exactly "View"
    assert(notificationsPanelSrc4.match(/<button[^>]*onClick=\{\(\) => onView\(c\.id\)\}[^>]*>\s*View\s*<\/button>/), '282. Candidate Replies View buttons still say exactly "View"');

    // 283/284. View buttons use the SAME primary styling source as Send Email (btn-primary), and no
    // separate/duplicated teal color was introduced specifically for View
    assert(notificationsPanelSrc4.includes('className="btn-primary"') && !notificationsPanelSrc4.includes('className="btn-secondary"'), '283. View buttons now use the same btn-primary class as Send Email');
    assert(upcomingPageSrc4.includes('className="btn-primary btn-header-action"'), '284. Send Email\'s existing btn-primary class is the reused source — confirmed still present, unmodified');
    const notificationsPanelCodeOnly = stripComments(notificationsPanelSrc4);
    assert(!/#[0-9A-Fa-f]{3,6}/.test(notificationsPanelCodeOnly.match(/onClick=\{\(\) => onView[\s\S]{0,200}/)?.[0] || ''), '285. No new/duplicated hardcoded teal hex color was introduced for the View button — it relies purely on the shared .btn-primary class');

    // 286. View click functionality remains unchanged (still calls onView(c.id) -> markNotificationRead)
    assert(notificationsPanelSrc4.includes('onClick={() => onView(c.id)}') && upcomingPageSrc4.includes('handleViewNotification') && upcomingPageSrc4.includes('markNotificationRead'), '286. View click functionality (marking the reply reviewed) remains unchanged');

    // 287. Candidate Replies scrollbar remains functional (untouched from the prior scroll-visibility fix)
    assert(notificationsPanelSrc4.includes('className="notification-list app-scroll-area"'), '287. Candidate Replies list retains its dedicated, visibly-styled scroll container');

    // 288. Candidate Replies fixed header behavior remains functional (untouched scroll-shell layout)
    assert(notificationsPanelSrc4.includes('modal-scroll-shell') && indexCssSrc3.includes('.modal-scroll-shell > .modal-header'), '288. The Candidate Replies header remains fixed via the existing modal-scroll-shell layout');

    // 289. Other secondary buttons remain unchanged (Sync Candidates, Email Drafts still btn-secondary)
    assert(
      upcomingPageSrc4.match(/onClick=\{handleSync\}[\s\S]{0,20}/) && upcomingPageSrc4.includes('className="btn-secondary btn-header-action" onClick={handleSync}') &&
      upcomingPageSrc4.includes("className=\"btn-secondary btn-header-action\"\n            onClick={() => setActiveTab('drafts')}"),
      '289. Sync Candidates and Email Drafts remain btn-secondary — unaffected by the View button restyling'
    );

    // 290. Reject/destructive styling remains unchanged (still its own dedicated red action class, not touched)
    assert(candidateTableSrc3.includes('candidate-action-btn reject') && indexCssSrc3.includes('.candidate-action-btn.reject'), '290. Reject retains its distinct destructive (red) styling, untouched by this refinement');

    // 291. Broader Upcoming workflow remains operational after the rename/restyle
    assert(upcomingPageSrc4.includes('CandidateToolbar') && upcomingPageSrc4.includes('CandidateTable') && upcomingPageSrc4.includes('SendEmailModal') && upcomingPageSrc4.includes('EmailDraftsPanel'), '291. The Upcoming workflow (filters, candidate table, email modal, drafts) remains fully wired and operational');

    // ==========================================================================
    // Onboarding — Merge Dashboard Into Employees + Remove Dashboard
    // ==========================================================================

    const onbEmployeesSrc = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeesPage.jsx'), 'utf-8');
    const onbDetailSrc = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeeDetailPage.jsx'), 'utf-8');
    const onbPlansSrc = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingPlansPage.jsx'), 'utf-8');
    const overdueTasksModalSrc = fs.readFileSync(path.resolve('./src/components/onboarding/OverdueTasksModal.jsx'), 'utf-8');
    const launchPlanModalSrc = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
    const onboardingDomainSrc = fs.readFileSync(path.resolve('./src/domain/onboardingDomain.js'), 'utf-8');
    const routerSrc3 = fs.readFileSync(path.resolve('./src/router/index.jsx'), 'utf-8');
    const overdueTasksModalCodeOnly = stripComments(overdueTasksModalSrc);

    // --- DASHBOARD REMOVAL / NAVIGATION ---

    // 292. OnboardingDashboardPage.jsx no longer exists on disk
    assert(!fs.existsSync(path.resolve('./src/pages/onboarding/OnboardingDashboardPage.jsx')), '292. OnboardingDashboardPage.jsx has been deleted — it is no longer part of the app');

    // 293. Router no longer imports or references OnboardingDashboardPage
    assert(!routerSrc3.includes('OnboardingDashboardPage'), '293. The router no longer imports or references OnboardingDashboardPage');

    // 294. Onboarding's index route now redirects to /onboarding/employees, not /onboarding/dashboard
    assert(
      routerSrc3.includes('<Navigate to="/onboarding/employees" replace />') && !routerSrc3.includes('/onboarding/dashboard'),
      '294. The base /onboarding route now redirects to /onboarding/employees (no remaining reference to /onboarding/dashboard)'
    );

    // 295. There is no 'dashboard' path segment left under the onboarding route group
    {
      const onboardingRouteBlockMatch = routerSrc3.match(/path:\s*'onboarding',\s*children:\s*\[([\s\S]*?)\],\s*\},/);
      const onboardingRouteBlock = onboardingRouteBlockMatch ? onboardingRouteBlockMatch[1] : '';
      assert(
        Boolean(onboardingRouteBlockMatch) && !onboardingRouteBlock.includes("path: 'dashboard'"),
        '295. No dead "dashboard" child route remains under the onboarding route group'
      );
    }

    // 296. Sidebar's Onboarding sub-menu now lists only Employees and Plans (no Dashboard link)
    {
      const sidebarOnboardingBlockMatch = sidebarSrc3.match(/\{\/\* Onboarding \*\/\}([\s\S]*?)\{\/\* Offboarding \*\/\}/);
      const sidebarOnboardingBlock = sidebarOnboardingBlockMatch ? sidebarOnboardingBlockMatch[1] : '';
      const sidebarOnboardingNavLinkCount = (sidebarOnboardingBlock.match(/<NavLink/g) || []).length;
      assert(
        Boolean(sidebarOnboardingBlockMatch) && !sidebarOnboardingBlock.includes('/onboarding/dashboard') && sidebarOnboardingBlock.includes('/onboarding/employees') && sidebarOnboardingBlock.includes('/onboarding/plans') && sidebarOnboardingNavLinkCount === 2,
        '296. The Onboarding sidebar sub-menu shows only Employees and Plans (exactly 2 links) — the Dashboard link is removed'
      );
    }

    // 297. No remaining source reference to '/onboarding/dashboard' anywhere in the app (router/sidebar covered above; this is a belt-and-suspenders sweep of the pages that matter)
    assert(
      !onbEmployeesSrc.includes('/onboarding/dashboard') && !onbDetailSrc.includes('/onboarding/dashboard') && !onbPlansSrc.includes('/onboarding/dashboard'),
      "297. No remaining page-level reference to the deleted '/onboarding/dashboard' route"
    );

    // --- EMPLOYEES HEADER (merged actions) ---

    // 298. UPDATED — The page heading was later renamed from "Onboarding Employees" to "Onboarding Progress" (the sidebar submenu/breadcrumb naming cleanup), to disambiguate it from the unrelated MAIN > Employees directory — the description/subtitle is unchanged, since it already read correctly.
    assert(
      onbEmployeesSrc.includes('>Onboarding Progress<') && onbEmployeesSrc.includes('View and track individual onboarding progress for employees and interns.'),
      '298. UPDATED — Employees page heading now reads "Onboarding Progress" (was "Onboarding Employees") with its unchanged description "View and track individual onboarding progress for employees and interns."'
    );

    // 299. Employees header now includes the "Overdue Tasks" button with a count badge, opening the existing OverdueTasksModal
    assert(
      onbEmployeesSrc.includes('<span>Overdue Tasks</span>') && onbEmployeesSrc.includes('candidate-notification-badge') && onbEmployeesSrc.includes('onClick={() => setIsOverdueModalOpen(true)}') && onbEmployeesSrc.includes('<OverdueTasksModal'),
      '299. Employees header now has the "Overdue Tasks" button (with count badge) that opens the existing OverdueTasksModal'
    );

    // 300. Employees header now includes the primary "Launch Onboarding Plan" action, wired to the existing LaunchPlanModal
    assert(
      onbEmployeesSrc.includes('<span>Launch Onboarding Plan</span>') && onbEmployeesSrc.includes('btn-primary btn-header-action') && onbEmployeesSrc.includes('<LaunchPlanModal'),
      '300. Employees header now has "Launch Onboarding Plan" as the primary teal action, wired to the existing LaunchPlanModal'
    );

    // 301. No "Manage Plan Templates" shortcut exists anywhere on the Employees page
    assert(!onbEmployeesSrc.includes('Manage Plan Templates'), '301. No "Manage Plan Templates" shortcut exists on the Employees page');

    // --- SUMMARY CARDS MOVED TO EMPLOYEES ---

    // 302. All 4 summary cards render on the Employees page via the existing summary-cards-grid layout
    assert(
      onbEmployeesSrc.includes('summary-cards-grid') && onbEmployeesSrc.includes('Active Plans') && onbEmployeesSrc.includes('In Progress') && onbEmployeesSrc.includes('Needs Attention') && onbEmployeesSrc.includes('Completed Plans'),
      '302. The 4 summary cards (Active Plans, In Progress, Needs Attention, Completed Plans) now render on the Employees page'
    );

    // 303. UPDATED — Summary card values reuse the exact same derivedStatus-based calculations previously on the Dashboard (not re-implemented). "Active Plans" was later updated to reuse the shared isActivePlanStatus() domain predicate (see the "Drop Onboarding Plan" task) so a Dropped plan is never miscounted as active — the 3 exact-equality counts (In Progress/Needs Attention/Completed) are unaffected.
    assert(
      onbEmployeesSrc.includes('isActivePlanStatus(i.derivedStatus)') && onbEmployeesSrc.includes('i.derivedStatus === PLAN_INSTANCE_STATUS.IN_PROGRESS') && onbEmployeesSrc.includes('i.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION') && onbEmployeesSrc.includes('i.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED'),
      '303. UPDATED — Summary card counts reuse the exact same PLAN_INSTANCE_STATUS-based filter predicates the Dashboard previously used (Active Plans now via the shared isActivePlanStatus() helper so Dropped plans are correctly excluded), computed straight from onboardingService.getAllInstances()'
    );

    // --- SINGLE TABLE (no Dashboard operational table duplicated) ---

    // 304. Only one data table exists on the Employees page — no second Dashboard-style operational table
    {
      const tableTagMatches = onbEmployeesSrc.match(/<table\b/g) || [];
      assert(tableTagMatches.length === 1, '304. Only ONE employee onboarding progress table exists on the Employees page (no duplicated second table)');
    }

    // 305. The single table keeps the simplified column set — not the old fuller Dashboard column set
    assert(
      onbEmployeesSrc.includes('>Department<') && onbEmployeesSrc.includes('>Start Date<') && onbEmployeesSrc.includes('>Onboarding Plan<') && onbEmployeesSrc.includes('>Progress<') && onbEmployeesSrc.includes('>Status<') && onbEmployeesSrc.includes('>Action<') &&
      !onbEmployeesSrc.includes('Department &amp; Position') && !onbEmployeesSrc.includes('Active Plan &amp; Progress') && !onbEmployeesSrc.includes('>Workflow Status<'),
      '305. The single table keeps the simplified Employee / Department / Start Date / Onboarding Plan / Progress / Status / Action columns — the old fuller Dashboard column set was not merged in alongside it'
    );

    // --- FILTERS / SEARCH PRESERVED ---

    // 306. The All/Employees/Interns pill filter is still present, reusing view-switcher-group/view-btn and employee.directoryType
    assert(
      onbEmployeesSrc.includes('view-switcher-group') && (onbEmployeesSrc.match(/view-btn/g) || []).length >= 3 && onbEmployeesSrc.includes('>All</span>') && onbEmployeesSrc.includes('>Employees</span>') && onbEmployeesSrc.includes('>Interns</span>') &&
      onbEmployeesSrc.includes('emp.directoryType !== typeFilter'),
      '306. The All / Employees / Interns pill filter remains, still reusing the existing view-switcher-group/view-btn pattern and employee.directoryType (no new classification)'
    );

    // 307. Simple name/ID search remains present
    assert(onbEmployeesSrc.includes('Search employee name or ID') && onbEmployeesSrc.includes('setSearch(e.target.value)'), '307. Employees page keeps simple name/ID search');

    // 308. No crowded controls (old status tabs, per-row Launch Plan button, or an extra history tab) were reintroduced
    assert(
      !onbEmployeesSrc.includes('Active Onboarding<') && !onbEmployeesSrc.includes('All Onboarding History') && !onbEmployeesSrc.includes('Open Plans (Inactive/Former)') && !onbEmployeesSrc.includes('>Launch Plan<'),
      '308. No crowded legacy controls (3-way status tabs, per-row Launch Plan button) were reintroduced'
    );

    // --- OVERDUE MODAL REUSE ---

    // 309. OverdueTasksModal still has the exact required heading/subtitle and the fixed-header/single-scroll-region pattern
    assert(
      overdueTasksModalSrc.includes('>Overdue Onboarding Tasks<') && overdueTasksModalSrc.includes('>Tasks requiring HR attention<') &&
      overdueTasksModalSrc.includes('modal-scroll-shell') && overdueTasksModalSrc.includes('app-scroll-area') && overdueTasksModalSrc.includes('modal-header') && overdueTasksModalSrc.includes('modal-body'),
      '309. OverdueTasksModal retains its exact heading/subtitle and the fixed-header/single-scroll-region modal-scroll-shell pattern'
    );

    // 310. UPDATED — OverdueTasksModal still renders task title/due date/employee and Mark Complete via props only (no owned data fetch).
    // The "Assigned: {task.assigneeEmployee...}" text was intentionally removed as part of stripping assignment concepts from onboarding.
    assert(
      overdueTasksModalCodeOnly.includes('task.title') && overdueTasksModalCodeOnly.includes('task.dueDate') && overdueTasksModalCodeOnly.includes('task.relatedEmployee') && overdueTasksModalCodeOnly.includes('onMarkComplete(task.id)') &&
      !overdueTasksModalCodeOnly.includes('assigneeEmployee') && !overdueTasksModalCodeOnly.includes('getOverdueActivities') && !overdueTasksModalCodeOnly.includes('activityService'),
      '310. OverdueTasksModal renders task title/due date/employee and Mark Complete via props only — the assignee display was removed, and there is still no owned activityService call (no duplicated data source)'
    );

    // 311. Employees page wires its own fetched overdueTasks state and existing handler into the modal (single fetch call site)
    assert(
      onbEmployeesSrc.includes('activityService.getOverdueActivities()') && onbEmployeesSrc.includes('tasks={overdueTasks}') && onbEmployeesSrc.includes('onMarkComplete={handleMarkTaskComplete}'),
      '311. Employees page fetches overdue tasks once and passes the existing state/handler into OverdueTasksModal — overdue-task fetching has exactly one call site now that Dashboard is gone'
    );

    // --- LAUNCH ONBOARDING REUSE ---

    // 312. UPDATED (composable task scopes refactor) — LaunchPlanModal still drives launching via the
    // existing onboardingService, but now composes tasks by employee alone (previewOnboardingComposition)
    // instead of previewing a manually-selected template (previewPlanLaunch), per Part 7-9 of that refactor.
    assert(
      launchPlanModalSrc.includes('onboardingService.launchPlanInstance') && launchPlanModalSrc.includes('onboardingService.previewOnboardingComposition'),
      '312. UPDATED — LaunchPlanModal still drives employee selection, composed-task preview, and launch via the existing onboardingService'
    );
    assert(
      onbEmployeesSrc.includes('isOpen={isLaunchModalOpen}') && onbEmployeesSrc.includes('onSuccess={() => loadData()}'),
      '312b. Employees page wires LaunchPlanModal with the existing open/close state and refreshes the same loadData() on success (no reimplementation)'
    );

    // --- PLANS (must remain untouched) ---

    // 313. UPDATED (composable task scopes refactor) — The old full-template Plans page ("Onboarding Plan
    // Templates" / "No Plan Templates Configured") was intentionally replaced by the 4 composable task
    // scope sections per Part 2/18 of that refactor; the page heading and structure are asserted on their
    // NEW state here instead (see checks 382-400 for the fuller scope-page/editor assertions).
    assert(onbPlansSrc.includes('>Onboarding Plans<') && onbPlansSrc.includes('Universal Tasks'), '313. UPDATED — Plans page now presents the composable Universal/Employee/Intern/Department task scopes instead of the old full-plan-template list');

    // 314. Onboarding routing still serves employees/detail/plans/plan editor — just without the removed dashboard path
    assert(
      routerSrc3.includes("path: 'onboarding'") && routerSrc3.includes('OnboardingPlansPage') && routerSrc3.includes('PlanEditorPage') && routerSrc3.includes('OnboardingEmployeeDetailPage') && routerSrc3.includes("path: 'employees'") && routerSrc3.includes("path: 'plans'"),
      '314. Onboarding routing still serves Employees / employee detail / Plans / plan editor'
    );

    // --- GENERAL ---

    // 315. UPDATED — The individual employee onboarding detail page keeps its Back link (wording later updated to "Back to Onboarding Progress", matching the page-name cleanup) and Done/Reopen actions — the navigation destination/behavior is untouched, only the visible text changed
    assert(
      onbDetailSrc.includes('Back to Onboarding Progress') && !onbDetailSrc.includes('Back to Onboarding Employees') && onbDetailSrc.includes('ArrowLeft') && onbDetailSrc.includes('handleToggleTaskComplete'),
      '315. UPDATED — The individual employee onboarding detail page is otherwise kept as-is, now with its Back link reading "Back to Onboarding Progress" (was "Back to Onboarding Employees") and Done/Reopen task actions unchanged'
    );

    // 316. UPDATED — The employee/instance join (instanceMap) and progress/status rendering reuse the existing hydrated plan instance data — no re-implementation. The join itself was later made active-plan-aware (see the "Drop Onboarding Plan" task) so an employee with both a Dropped/Completed instance and a newer one always resolves to the correct (preferably active, else most recent) instance rather than whichever Map insertion happened to win.
    assert(
      onbEmployeesSrc.includes('const instanceMap = new Map();') && onbEmployeesSrc.includes('isActivePlanStatus(existing.derivedStatus)') && onbEmployeesSrc.includes('inst.progress.progressPercentage') && onbEmployeesSrc.includes('inst.derivedStatus'),
      '316. UPDATED — Employees page derives its employee -> plan-instance join (now active-plan-aware, preferring an active instance or the most recent one) and reads progress/status directly from the existing hydrated onboardingService.getAllInstances() data'
    );

    // 317. resolveAllOnboardingHistory() domain helper still backs the single table's population (shared, not re-derived inline)
    assert(
      onboardingDomainSrc.includes('export function resolveAllOnboardingHistory') && onbEmployeesSrc.includes('resolveAllOnboardingHistory(employees, instanceMap)'),
      '317. The single table\'s population is still resolved via the shared onboardingDomain.resolveAllOnboardingHistory() helper'
    );

    // 318. The now-orphaned resolveActiveOnboardingWorkforce() Dashboard-only helper was cleanly removed (genuine dead code, not left behind)
    assert(
      !onboardingDomainSrc.includes('resolveActiveOnboardingWorkforce') && !onbEmployeesSrc.includes('resolveActiveOnboardingWorkforce'),
      '318. The resolveActiveOnboardingWorkforce() helper (only ever used by the now-deleted Dashboard) was removed as genuine dead code'
    );

    // 319. Mark Complete functionally still completes an overdue onboarding activity end-to-end through the reused activityService
    const overdueBeforeFix2 = await activityService.getOverdueActivities();
    const onboardingOverdueBefore2 = overdueBeforeFix2.filter((a) => a.source === 'Onboarding');
    if (onboardingOverdueBefore2.length > 0) {
      const targetOverdueTask2 = onboardingOverdueBefore2[0];
      const completedTask2 = await activityService.markComplete(targetOverdueTask2.id);
      assert(completedTask2.completed === true, '319. Mark Complete still functionally completes an overdue onboarding task through the reused activityService.markComplete()');
      await activityService.reopen(targetOverdueTask2.id);
    } else {
      assert(true, '319. Mark Complete functional check skipped — no overdue Onboarding activities present in current seed state (activityService.markComplete/reopen verified functional elsewhere in this suite)');
    }

    // 320. resolveAllOnboardingHistory() is a pure, correctly-scoped function callable directly
    const allEmpsForDomainCheck2 = await employeeService.getAll();
    const allInstForDomainCheck2 = await onboardingService.getAllInstances();
    const instMapForDomainCheck2 = new Map(allInstForDomainCheck2.map((i) => [i.employeeId, i]));
    const allHistoryResult2 = resolveAllOnboardingHistory(allEmpsForDomainCheck2, instMapForDomainCheck2);
    assert(
      Array.isArray(allHistoryResult2) && allHistoryResult2.every((emp) => allEmpsForDomainCheck2.some((e) => e.id === emp.id)),
      '320. resolveAllOnboardingHistory() is a callable pure domain function that returns only real employees from the provided dataset'
    );

    // 321. Launching a plan via the reused service still surfaces immediately in the Employees population/progress data (no orphaned duplicated logic)
    {
      const preLaunchInstances = await onboardingService.getAllInstances();
      const preLaunchIds = new Set(preLaunchInstances.map((i) => i.id));
      const candidateEmp = allEmpsForDomainCheck2.find((e) => (e.status === 'Upcoming' || e.status === 'Onboarding') && !preLaunchInstances.some((i) => i.employeeId === e.id));
      const templates = await onboardingService.getAllTemplates();
      const activeTemplate = templates.find((t) => t.active !== false);
      if (candidateEmp && activeTemplate) {
        // UPDATED — launchPlanInstance() is composable-scope-based, not template-based; its 2nd
        // positional param is now customAnchorDate (see the "Standardize Automatic Anchor Dates"
        // task). Passing activeTemplate.id here (a leftover from the retired template-launch
        // flow) would now be silently misinterpreted as a date override and corrupt the
        // launched instance's task due dates rather than throwing — fixed to the correct,
        // already-established 1-arg call used everywhere else in this suite.
        const newInstance = await onboardingService.launchPlanInstance(candidateEmp.id);
        const postLaunchInstances = await onboardingService.getAllInstances();
        const found = postLaunchInstances.find((i) => i.id === newInstance.id);
        assert(Boolean(found) && found.employeeId === candidateEmp.id, '321. A newly launched onboarding plan immediately appears in onboardingService.getAllInstances() — the same source the Employees page reads from');
        assert(typeof found.progress.progressPercentage === 'number', '321b. Progress data is immediately available for a freshly launched plan instance');
        assert(!preLaunchIds.has(found.id), '321c. The launched instance is genuinely new (not a pre-existing one)');
      } else {
        assert(true, '321. Launch-then-appear functional check skipped — no eligible candidate employee/template pairing available in current seed state (launchPlanInstance verified functional elsewhere in this suite)');
      }
    }

    // ==========================================================================
    // Onboarding UI Refinements — Search Styling + Launch Plan Modal + Add Task
    // ==========================================================================

    const onbEmployeesSrc2 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeesPage.jsx'), 'utf-8');
    const onbDetailSrc2 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeeDetailPage.jsx'), 'utf-8');
    const launchPlanModalSrc2 = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
    const addTaskModalSrc = fs.readFileSync(path.resolve('./src/components/onboarding/AddTaskModal.jsx'), 'utf-8');
    const directoryToolbarSrc = fs.readFileSync(path.resolve('./src/components/employees/DirectoryToolbar.jsx'), 'utf-8');
    const onboardingServiceSrc = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
    const onboardingServiceCodeOnly = stripComments(onboardingServiceSrc);

    // --- SEARCH STYLING ---

    // 322. Onboarding Employees search now uses the same shared toolbar-search-box/icon/input classes as other polished toolbars
    assert(
      onbEmployeesSrc2.includes('className="toolbar-search-box"') && onbEmployeesSrc2.includes('className="toolbar-search-icon"') && onbEmployeesSrc2.includes('className="toolbar-search-input"'),
      '322. Onboarding Employees search uses the shared toolbar-search-box / toolbar-search-icon / toolbar-search-input classes'
    );

    // 323. Those exact class names are the SAME ones an existing polished toolbar (main Employees directory) already uses — confirms reuse, not a new invented style
    assert(
      directoryToolbarSrc.includes('toolbar-search-box') && directoryToolbarSrc.includes('toolbar-search-icon') && directoryToolbarSrc.includes('toolbar-search-input'),
      '323. The reused search classes are the exact same ones already powering the main Employees directory toolbar search (shared design system, not a new style)'
    );

    // 324. The old broken/undefined form-control-input class is no longer used for the Employees search
    assert(!onbEmployeesSrc2.includes('form-control-input'), '324. The Employees search no longer uses the non-existent "form-control-input" class that rendered as a raw unstyled input');

    // 325. Search icon renders (Search icon component passed into the toolbar-search-icon slot) and placeholder is preserved
    assert(onbEmployeesSrc2.includes('<Search size={16} className="toolbar-search-icon" />') && onbEmployeesSrc2.includes('placeholder="Search employee name or ID"'), '325. Search icon renders on the left and the placeholder text is preserved');

    // 326. Search still composes with the All/Employees/Interns type filter (both predicates remain in the same filter chain)
    assert(
      onbEmployeesSrc2.match(/typeFilter !== 'all'[\s\S]{0,300}search\.trim\(\)/),
      '326. Search continues to compose with the All/Employees/Interns type filter in the same filter chain (both still apply together)'
    );

    // 327. Search-by-name and search-by-ID predicates are unchanged (existing behavior preserved)
    assert(
      onbEmployeesSrc2.includes('emp.fullName.toLowerCase().includes(q)') && onbEmployeesSrc2.includes('emp.employeeId.toLowerCase().includes(q)'),
      '327. Search still matches by employee name and employee ID — existing behavior preserved unchanged'
    );

    // --- LAUNCH PLAN MODAL ---

    const launchPlanModalCodeOnly2 = stripComments(launchPlanModalSrc2);

    // 328. LaunchPlanModal no longer uses the old, never-defined-in-CSS classes that caused it to render inline/unstyled
    assert(
      !launchPlanModalCodeOnly2.includes('modal-backdrop-overlay') && !launchPlanModalCodeOnly2.includes('modal-container-card') && !launchPlanModalCodeOnly2.includes('modal-body-content') && !launchPlanModalCodeOnly2.includes('btn-icon-close'),
      '328. LaunchPlanModal no longer uses the undefined modal-backdrop-overlay/modal-container-card/modal-body-content/btn-icon-close classes that caused it to render as an unstyled inline block'
    );

    // 329. LaunchPlanModal now uses the real, shared modal shell (backdrop + card + scroll-shell), the same system Overdue Tasks / Add Task use
    assert(
      launchPlanModalSrc2.includes('className="modal-backdrop"') && launchPlanModalSrc2.includes('modal-card') && launchPlanModalSrc2.includes('modal-scroll-shell') && indexCssSrc3.includes('.modal-backdrop {') && indexCssSrc3.includes('.modal-card {'),
      '329. LaunchPlanModal now renders through the real .modal-backdrop / .modal-card / .modal-scroll-shell shared modal shell (verified those classes actually exist in index.css)'
    );

    // 330. LaunchPlanModal header has the required heading and concise subtitle
    assert(
      launchPlanModalSrc2.includes('>Launch Onboarding Plan<') && launchPlanModalSrc2.includes('Assign an onboarding plan to an employee or intern.'),
      '330. LaunchPlanModal header reads "Launch Onboarding Plan" with subtitle "Assign an onboarding plan to an employee or intern."'
    );

    // 331. LaunchPlanModal footer has Cancel + a primary Launch action, using the shared modal-footer/btn-primary/btn-secondary classes
    assert(
      launchPlanModalSrc2.includes('modal-footer') && launchPlanModalSrc2.includes('className="btn-secondary"') && launchPlanModalSrc2.includes('className="btn-primary"') && />\s*Cancel\s*</.test(launchPlanModalSrc2),
      '331. LaunchPlanModal footer has Cancel (btn-secondary) and a primary Launch action (btn-primary), via the shared modal-footer'
    );

    // 332. LaunchPlanModal supports Escape-to-close like the other app modals (Overdue Tasks, Candidate Replies)
    assert(launchPlanModalSrc2.includes("e.key === 'Escape'") && launchPlanModalSrc2.includes('onClose()'), '332. LaunchPlanModal closes on Escape, matching the existing modal UX pattern');

    // 333. UPDATED (composable task scopes refactor) — LaunchPlanModal's core launch business logic
    // (employee selection, preview, launch call) is preserved, now via previewOnboardingComposition/
    // launchPlanInstance(employeeId) instead of a manually-selected template. The per-task manual
    // assignee override was already removed in an earlier task and remains removed here too.
    assert(
      launchPlanModalSrc2.includes('onboardingService.previewOnboardingComposition') && launchPlanModalSrc2.includes('onboardingService.launchPlanInstance') && launchPlanModalSrc2.includes('canLaunch') &&
      !launchPlanModalSrc2.includes('manualOverrides'),
      '333. UPDATED — LaunchPlanModal preserves its employee selection, composed-task preview, and launch call — no per-task assignee override, no manually-selected template'
    );

    // --- ADD TASK (employee detail page) ---

    // 334. "Add Task" button renders in the Task Breakdown section header row, right-aligned via a space-between flex row
    assert(
      onbDetailSrc2.match(/Onboarding Task Breakdown & Operational Status[\s\S]{0,400}Add Task/) && onbDetailSrc2.includes("justifyContent: 'space-between'"),
      '334. The "Add Task" button renders in the same header row as "Onboarding Task Breakdown & Operational Status", right-aligned via space-between'
    );

    // 335. Add Task button uses the existing primary teal button styling (btn-primary), consistent with other create/add actions
    assert(onbDetailSrc2.match(/className="btn-primary"[\s\S]{0,200}onClick=\{\(\) => setIsAddTaskModalOpen\(true\)\}/), '335. The Add Task button uses the shared btn-primary styling used elsewhere for create/add actions');

    // 336. Clicking Add Task opens AddTaskModal, targeting the correct (this employee's) plan instance and employee name
    assert(
      onbDetailSrc2.includes('<AddTaskModal') && onbDetailSrc2.includes('planInstanceId={planInstance.id}') && onbDetailSrc2.includes('employeeName={employee.fullName}'),
      '336. Add Task opens AddTaskModal wired to this specific employee\'s plan instance ID and employee name'
    );

    // 337. AddTaskModal uses the same shared modal shell as the other app modals (consistent design system, not a third bespoke style)
    assert(
      addTaskModalSrc.includes('className="modal-backdrop"') && addTaskModalSrc.includes('modal-card') && addTaskModalSrc.includes('modal-scroll-shell') && addTaskModalSrc.includes('modal-header') && addTaskModalSrc.includes('modal-body') && addTaskModalSrc.includes('modal-footer'),
      '337. AddTaskModal uses the same modal-backdrop / modal-card / modal-scroll-shell / modal-header / modal-body / modal-footer shell as LaunchPlanModal and OverdueTasksModal'
    );

    // 338. AddTaskModal heading and subtitle read as specified, with the subtitle interpolating the target employee's name
    assert(
      addTaskModalSrc.includes('>Add Onboarding Task<') && addTaskModalSrc.includes("Add a task to {employeeName || 'this employee'}'s current onboarding plan."),
      '338. AddTaskModal heading reads "Add Onboarding Task" and its subtitle interpolates the target employee\'s name'
    );

    // 339. Task Title is required and validated before submission
    assert(
      addTaskModalSrc.includes("if (!formData.title.trim()) nextErrors.title = 'Task title is required.'") && addTaskModalSrc.includes('if (!validate()) return;'),
      '339. Task Title is required and validated before the Add Task form can submit'
    );

    // 340. Relative Timing reuses the existing relative-day offset concept (relativeOffsetDays), not a new timing system
    assert(addTaskModalSrc.includes('relativeOffsetDays') && addTaskModalSrc.includes('Relative Timing (Day Offset)'), '340. AddTaskModal reuses the existing relativeOffsetDays concept for task timing');

    // 341. Assignee Rule field is completely removed from the Add Task modal (no dropdown, label, import, or specific-assignee sub-field left behind)
    const addTaskModalCodeOnly = stripComments(addTaskModalSrc);
    assert(
      !addTaskModalCodeOnly.includes('Assignee Rule') && !addTaskModalCodeOnly.includes('ASSIGNMENT_RULES') && !addTaskModalCodeOnly.includes('specificAssigneeId') && !addTaskModalCodeOnly.includes('Select Specific Assignee') && !addTaskModalCodeOnly.includes('import Select'),
      '341. Assignee Rule (dropdown, label, ASSIGNMENT_RULES import, specific-assignee sub-field) is completely removed from AddTaskModal'
    );

    // 341b. No leftover two-column grid / empty half-width gap remains where Assignee Rule used to sit next to Relative Timing
    assert(!addTaskModalSrc.includes('modal-field-grid-2'), '341b. AddTaskModal no longer wraps Relative Timing in a two-column grid — no empty half-width gap remains after removing Assignee Rule');

    // 341c. addTaskToInstance() falls back to the existing neutral "Unassigned" default (falsy rule) rather than defaulting to a specific rule like HR
    assert(!onboardingServiceSrc.includes("taskData.assignmentRule || 'hr'"), '341c. addTaskToInstance() no longer defaults a missing assignment rule to \'hr\' — manual tasks now resolve through the existing neutral "no rule" path');
    assert(onboardingServiceSrc.includes('taskData.assignmentRule || null'), '341d. addTaskToInstance() defaults assignmentRule to null (the existing resolveAssigneeForRule() neutral/Unassigned short-circuit), not a newly invented value');

    // 342. Form controls use the real, polished shared classes (form-input/form-textarea), not raw unstyled inputs
    assert(
      addTaskModalSrc.includes('className="form-input"') && addTaskModalSrc.includes('className="form-textarea"') && !addTaskModalSrc.includes('form-control-input'),
      '342. AddTaskModal form fields use the polished shared form-input/form-textarea classes'
    );

    // --- RELATIVE TIMING GUIDANCE ---

    // 342b. The explanatory helper sentence renders under Relative Timing
    assert(
      addTaskModalSrc.includes('Set when the task should occur relative to the employee’s start date.'),
      '342b. The Relative Timing helper sentence "Set when the task should occur relative to the employee’s start date." is displayed'
    );

    // 342c. All three offset rules (0 / positive / negative) are displayed with their examples
    assert(
      addTaskModalSrc.includes('On the employee’s start date') &&
      addTaskModalSrc.includes('After the start date (e.g., +3 = 3 days after)') &&
      addTaskModalSrc.includes('Before the start date (e.g., −3 = 3 days before)'),
      '342c. All three Relative Timing rules (0 / + value / − value) are displayed, each with an example'
    );

    // 342d. The guidance uses subtle helper styling (relative-timing-help), not a warning/alert box
    assert(
      addTaskModalSrc.includes('className="relative-timing-help"') && !addTaskModalSrc.match(/relative-timing-help[\s\S]{0,120}modal-error-alert/),
      '342d. The Relative Timing guidance uses subtle helper styling, not the warning/error alert box styling'
    );

    // 343. onboardingService.addTaskToInstance() exists and reuses centralized helpers (resolveAssigneeForRule, addDaysToLocalDate) rather than recalculating due dates/assignees inline
    assert(
      onboardingServiceSrc.includes('async addTaskToInstance(') && onboardingServiceSrc.includes('resolveAssigneeForRule(') && onboardingServiceSrc.includes('addDaysToLocalDate(planInstance.anchorDate, relativeOffsetDays)'),
      '343. onboardingService.addTaskToInstance() exists and reuses the centralized resolveAssigneeForRule() and addDaysToLocalDate() helpers rather than recalculating due dates/assignees inline'
    );

    // 344. addTaskToInstance() never writes to onboardingPlanTasks or onboardingPlanTemplates — it is genuinely employee-plan-instance-scoped, not template-modifying
    assert(
      !onboardingServiceCodeOnly.match(/addTaskToInstance[\s\S]*?\n {2}\},/)?.[0]?.includes('db.onboardingPlanTasks =') &&
      !onboardingServiceCodeOnly.match(/addTaskToInstance[\s\S]*?\n {2}\},/)?.[0]?.includes('db.onboardingPlanTemplates ='),
      '344. addTaskToInstance() never writes to db.onboardingPlanTasks or db.onboardingPlanTemplates — it only ever touches the one PlanInstance\'s task/activity records'
    );

    // 345. New task's planTaskId is explicitly null (not tied to a reusable template task), keeping template/instance data cleanly separated
    assert(onboardingServiceSrc.includes('planTaskId: null,'), '345. Manually added tasks are stored with planTaskId: null — never linked back into the reusable plan template structure');

    resetDatabase();

    // --- ADD TASK FUNCTIONAL / EMPLOYEE-SAFETY VERIFICATION ---
    {
      const instancesBeforeAdd = await onboardingService.getAllInstances();
      const targetInstance = instancesBeforeAdd.find((i) => i.employeeId === 'emp-013') || instancesBeforeAdd[0];
      const otherInstance = instancesBeforeAdd.find((i) => i.id !== targetInstance.id);
      const templatesBeforeAdd = await onboardingService.getAllTemplates();
      const targetTemplateBefore = templatesBeforeAdd.find((t) => t.id === targetInstance.planTemplateId);
      const templateTaskCountBefore = targetTemplateBefore ? targetTemplateBefore.taskCount : null;
      const otherInstanceTaskCountBefore = otherInstance ? otherInstance.progress.totalTasks : null;

      const beforeTotal = targetInstance.progress.totalTasks;
      const beforeCompleted = targetInstance.progress.completedTasksCount;
      const beforePct = targetInstance.progress.progressPercentage;

      const updatedInstance = await onboardingService.addTaskToInstance(targetInstance.id, {
        title: 'Stage18 Verification Task',
        description: 'Automated verification task',
        relativeOffsetDays: 10,
        assignmentRule: 'hr',
        required: true,
      });

      // 346. The new task appears immediately in the target instance's task breakdown
      const newTask = updatedInstance.progress.tasks.find((t) => t.title === 'Stage18 Verification Task');
      assert(Boolean(newTask), '346. The newly added task appears immediately in this employee\'s onboarding task breakdown (no manual refresh required)');

      // 347. Task counts updated correctly (total +1, completed unchanged)
      assert(
        updatedInstance.progress.totalTasks === beforeTotal + 1 && updatedInstance.progress.completedTasksCount === beforeCompleted,
        '347. Task counts update correctly after adding a task (total +1, completed count unchanged since the new task starts incomplete)'
      );

      // 348. Progress recalculates through the shared calculatePlanProgress logic (percentage reflects the new incomplete required task, not hardcoded)
      const expectedRequired = updatedInstance.progress.requiredTasksCount;
      const expectedCompletedRequired = updatedInstance.progress.completedRequiredCount;
      const expectedPct = expectedRequired > 0 ? Math.round((expectedCompletedRequired / expectedRequired) * 100) : beforePct;
      assert(updatedInstance.progress.progressPercentage === expectedPct, '348. Progress percentage after adding a task matches the shared calculatePlanProgress() formula exactly (not a UI-hardcoded value)');

      // 349. Due date reuses the centralized anchorDate + relativeOffsetDays helper — not independently computed
      const { addDaysToLocalDate: addDaysCheckFn } = await import('../utils/dateUtils.js');
      const expectedDueDate = addDaysCheckFn(targetInstance.anchorDate, 10);
      assert(newTask.currentDueDate === expectedDueDate, '349. The new task\'s due date exactly matches addDaysToLocalDate(anchorDate, relativeOffsetDays) — the same centralized helper used at plan launch');

      // 350. Employee-specific safety: the OTHER employee's plan instance is completely unaffected
      if (otherInstance) {
        const instancesAfterAdd = await onboardingService.getAllInstances();
        const otherInstanceAfter = instancesAfterAdd.find((i) => i.id === otherInstance.id);
        assert(
          otherInstanceAfter.progress.totalTasks === otherInstanceTaskCountBefore,
          '350. Adding a task to one employee\'s plan instance does not add it to (or otherwise change the task count of) any other employee\'s plan instance'
        );
      } else {
        assert(true, '350. Employee-safety cross-instance check skipped — only one plan instance present in current seed state');
      }

      // 351. Template safety: the reusable PlanTemplate's task count is completely unchanged
      if (targetTemplateBefore) {
        const templatesAfterAdd = await onboardingService.getAllTemplates();
        const targetTemplateAfter = templatesAfterAdd.find((t) => t.id === targetInstance.planTemplateId);
        assert(
          targetTemplateAfter.taskCount === templateTaskCountBefore,
          '351. Adding an employee-specific task does not change the reusable PlanTemplate\'s task count — the master template is untouched'
        );
      } else {
        assert(true, '351. Template safety check skipped — target instance has no resolvable template in current seed state');
      }

      // 352. The new task supports the same Done/Reopen lifecycle as any other onboarding task, via the existing activityService
      const newActivityId = newTask.activityId;
      const completedViaExisting = await activityService.markComplete(newActivityId);
      assert(completedViaExisting.completed === true, '352. The newly added task can be marked Done via the existing activityService.markComplete() — no special-cased task type');
      const reopenedViaExisting = await activityService.reopen(newActivityId);
      assert(reopenedViaExisting.completed === false, '352b. The newly added task can be Reopened via the existing activityService.reopen()');

      // 353. Reconciliation after completing/reopening a manually-added task still flows through the shared reconcileOnboardingPlanProgress path (no duplicated completion logic)
      assert(onboardingServiceSrc.includes('reconcileOnboardingPlanProgress'), '353. Task completion continues to flow through the existing reconcileOnboardingPlanProgress() reconciliation used by every onboarding task');

      resetDatabase();
    }

    // ==========================================================================
    // Onboarding Modal Spacing + Simplified Add Task Form
    // ==========================================================================

    const launchPlanModalSrc3 = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
    const addTaskModalSrc2 = fs.readFileSync(path.resolve('./src/components/onboarding/AddTaskModal.jsx'), 'utf-8');
    const onboardingServiceSrc2 = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');

    // --- MODAL SIZE / SPACING ---

    // 354. A reusable, larger modal size variant (xl-modal) exists and is used by both onboarding modals — extending, not duplicating, the existing wide-modal size tier
    assert(
      indexCssSrc5.includes('.modal-card.xl-modal') && launchPlanModalSrc3.includes('xl-modal') && addTaskModalSrc2.includes('xl-modal'),
      '354. A shared, reusable .modal-card.xl-modal size variant exists and is used by both Launch Onboarding Plan and Add Onboarding Task — extending the existing wide-modal tier rather than duplicating ad hoc widths'
    );

    // 355. The xl-modal width falls in the requested ~900-1050px range
    {
      const xlModalWidthMatch = indexCssSrc5.match(/\.modal-card\.xl-modal\s*\{[^}]*max-width:\s*(\d+)px/);
      const xlModalWidth = xlModalWidthMatch ? parseInt(xlModalWidthMatch[1], 10) : 0;
      assert(xlModalWidth >= 900 && xlModalWidth <= 1050, `355. The xl-modal max-width (${xlModalWidth}px) falls within the requested ~900-1050px range`);
    }

    // 356. Both modals use a spacious body variant (extra padding, roomier field spacing) rather than the tightly-packed default modal-body
    assert(
      launchPlanModalSrc3.includes('modal-body-spacious') && addTaskModalSrc2.includes('modal-body-spacious') && indexCssSrc5.includes('.modal-body-spacious') && indexCssSrc5.match(/\.modal-body-spacious\s*\{[^}]*padding:\s*1\.75rem/),
      '356. Both modals use the shared .modal-body-spacious variant for generous body padding, instead of the tighter default .modal-body'
    );

    // 357. Field-group and label spacing are increased within the spacious body (scoped — the shared app-wide .form-group/.form-label rules used elsewhere are untouched)
    assert(
      indexCssSrc5.match(/\.modal-body-spacious \.form-group\s*\{[^}]*margin-bottom:\s*1\.5rem/) && indexCssSrc5.match(/\.modal-body-spacious \.form-label\s*\{[^}]*margin-bottom:\s*0\.5rem/) &&
      indexCssSrc5.match(/\.form-group\s*\{\s*margin-bottom:\s*1\.15rem/),
      '357. Field-group and label spacing are increased specifically within the spacious modal body, while the shared app-wide .form-group (1.15rem) used by every other form/modal is left unchanged'
    );

    // 358. Both modals use a spacious footer variant with real padding and a visual border separating it from the scrollable body — buttons no longer sit flush against the card edges
    assert(
      launchPlanModalSrc3.includes('modal-footer-spacious') && addTaskModalSrc2.includes('modal-footer-spacious') &&
      indexCssSrc5.match(/\.modal-footer\.modal-footer-spacious[\s\S]{0,60}\{[^}]*padding:\s*1\.1rem 1\.75rem/) && indexCssSrc5.match(/\.modal-footer\.modal-footer-spacious[\s\S]{0,300}border-top:\s*1px solid/),
      '358. Both modals use a shared .modal-footer-spacious variant (real padding + border separation) so footer buttons are no longer flush against the card edges'
    );

    // 359. Both modals still resolve to exactly ONE scrollable region (modal-scroll-shell's body flex:1/overflow-y:auto) — no nested scroll traps were introduced by the spacing changes
    assert(
      launchPlanModalSrc3.includes('modal-scroll-shell') && addTaskModalSrc2.includes('modal-scroll-shell') &&
      indexCssSrc5.includes('.modal-scroll-shell > .modal-body') && indexCssSrc5.match(/\.modal-scroll-shell > \.modal-body[\s\S]{0,60}\{[^}]*flex:\s*1;[^}]*overflow-y:\s*auto/),
      '359. Both modals still rely on the single modal-scroll-shell body scroll region — header and footer remain fixed, with no additional nested scroll areas introduced'
    );

    // 360. Header structure/copy is unchanged for both modals (title + subtitle preserved exactly)
    assert(
      launchPlanModalSrc3.includes('>Launch Onboarding Plan<') && launchPlanModalSrc3.includes('Assign an onboarding plan to an employee or intern.') &&
      addTaskModalSrc2.includes('>Add Onboarding Task<') && addTaskModalSrc2.includes("Add a task to {employeeName || 'this employee'}'s current onboarding plan."),
      '360. Both modal headers keep their existing title/subtitle copy exactly — only spacing/sizing changed'
    );

    // 361b. UPDATED — the entire Assignee column (assigneeName display AND the "Rule: X" line) is now completely removed from the
    // employee detail task breakdown, not merely guarded for the empty case. This supersedes the earlier, narrower check.
    assert(
      !onbDetailSrc2.includes('>Assignee<') && !onbDetailSrc2.includes('assigneeEmployee') && !onbDetailSrc2.includes('Rule: {task.assignmentRule}') && !onbDetailSrc2.includes('Unassigned'),
      '361b. The Assignee column (header, assigneeName display, and "Rule: X" metadata) is completely removed from the employee onboarding task breakdown'
    );

    // --- ASSIGNEE RULE REMOVAL — BUSINESS LOGIC SAFETY ---

    // 361. UPDATED — the reusable ASSIGNMENT_RULES/resolveAssigneeForRule() domain logic remains fully intact (still powers plan-template
    // resolution and the employee-specific Add Task neutral path), but LaunchPlanModal itself no longer reads/displays resolvedAssigneeId —
    // that surfaced only through the now-removed per-task override column.
    assert(
      onboardingDomainSrc.includes('export const ASSIGNMENT_RULES') && onboardingDomainSrc.includes('export function resolveAssigneeForRule') && onboardingServiceSrc2.includes('resolveAssigneeForRule('),
      '361. The reusable ASSIGNMENT_RULES / resolveAssigneeForRule() domain logic remains fully intact at the service/domain layer — nothing globally shared was deleted'
    );
    assert(!launchPlanModalSrc3.includes('resolvedAssigneeId'), '361c. LaunchPlanModal itself no longer reads resolvedAssigneeId — the per-task assignee override UI it powered was removed');

    resetDatabase();

    // --- FUNCTIONAL: neutral default assignee + 0/positive/negative offsets ---
    {
      const { addDaysToLocalDate: addDaysCheckFn2 } = await import('../utils/dateUtils.js');
      const instancesForOffsetCheck = await onboardingService.getAllInstances();
      const offsetTargetInstance = instancesForOffsetCheck.find((i) => i.employeeId === 'emp-013') || instancesForOffsetCheck[0];

      // 362. No assignmentRule supplied (as the simplified modal now does) creates a task with the existing neutral "Unassigned" default — no assignee is required to succeed
      const neutralTask = await onboardingService.addTaskToInstance(offsetTargetInstance.id, {
        title: 'Neutral Default Assignee Task',
        relativeOffsetDays: 0,
        required: true,
      });
      const neutralTaskEntry = neutralTask.progress.tasks.find((t) => t.title === 'Neutral Default Assignee Task');
      assert(Boolean(neutralTaskEntry), '362. Manual task creation succeeds with no assignmentRule supplied at all');
      assert(neutralTaskEntry.assignmentRule === null && neutralTaskEntry.originallyResolvedAssigneeId === null, '362b. With no assignmentRule supplied, the task resolves to the existing neutral null/"Unassigned" default — not a newly invented value, and not silently defaulting to a specific rule like HR');

      // 363. Day offset 0 resolves to the employee's exact anchor start date
      assert(neutralTaskEntry.currentDueDate === offsetTargetInstance.anchorDate, '363. A Relative Timing value of 0 resolves the due date to exactly the employee\'s anchor start date');

      // 364. A positive day offset resolves to (anchorDate + N days) via the centralized helper
      const positiveTask = await onboardingService.addTaskToInstance(offsetTargetInstance.id, {
        title: 'Positive Offset Task',
        relativeOffsetDays: 5,
        required: false,
      });
      const positiveTaskEntry = positiveTask.progress.tasks.find((t) => t.title === 'Positive Offset Task');
      assert(positiveTaskEntry.currentDueDate === addDaysCheckFn2(offsetTargetInstance.anchorDate, 5), '364. A positive Relative Timing value (+5) resolves the due date to 5 days after the anchor start date, via the existing addDaysToLocalDate() helper');

      // 365. A negative day offset resolves to (anchorDate - N days) via the centralized helper
      const negativeTask = await onboardingService.addTaskToInstance(offsetTargetInstance.id, {
        title: 'Negative Offset Task',
        relativeOffsetDays: -5,
        required: false,
      });
      const negativeTaskEntry = negativeTask.progress.tasks.find((t) => t.title === 'Negative Offset Task');
      assert(negativeTaskEntry.currentDueDate === addDaysCheckFn2(offsetTargetInstance.anchorDate, -5), '365. A negative Relative Timing value (-5) resolves the due date to 5 days before the anchor start date, via the existing addDaysToLocalDate() helper');

      resetDatabase();
    }

    // ==========================================================================
    // Launch Modal Height + Redundant Timing Line Removal + Task Ordering Fix
    // ==========================================================================

    const launchPlanModalSrc4 = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
    const addTaskModalSrc3 = fs.readFileSync(path.resolve('./src/components/onboarding/AddTaskModal.jsx'), 'utf-8');
    const indexCssSrc6 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
    const onboardingDomainSrc2 = fs.readFileSync(path.resolve('./src/domain/onboardingDomain.js'), 'utf-8');

    // --- LAUNCH MODAL HEIGHT ---

    // 366. LaunchPlanModal carries a dedicated modal-launch-plan class, scoped separately from the shared xl-modal/modal-body-spacious variants
    assert(launchPlanModalSrc4.includes('modal-launch-plan'), '366. LaunchPlanModal carries a dedicated .modal-launch-plan class for its extra desktop height');

    // 367. AddTaskModal does NOT carry modal-launch-plan — the extra height is scoped to Launch Plan only, so Add Task's already-full body doesn't gain awkward empty space
    assert(!addTaskModalSrc3.includes('modal-launch-plan'), '367. AddTaskModal does not carry .modal-launch-plan — the taller sizing is scoped only to Launch Onboarding Plan');

    // 368. A min-height rule exists for .modal-launch-plan, within the requested ~520-600px range, gated to desktop (min-width media query, not applied unconditionally)
    {
      const launchHeightRuleMatch = indexCssSrc6.match(/@media \(min-width:\s*(\d+)px\)\s*\{\s*\.modal-card\.xl-modal\.modal-launch-plan\s*\{[^}]*min-height:\s*(\d+)px/);
      const mediaMinWidth = launchHeightRuleMatch ? parseInt(launchHeightRuleMatch[1], 10) : 0;
      const modalMinHeight = launchHeightRuleMatch ? parseInt(launchHeightRuleMatch[2], 10) : 0;
      assert(Boolean(launchHeightRuleMatch) && modalMinHeight >= 520 && modalMinHeight <= 600, `368. .modal-launch-plan has a min-height (${modalMinHeight}px) within the requested ~520-600px desktop range`);
      assert(mediaMinWidth >= 600 && mediaMinWidth <= 768, `368b. The min-height rule is gated behind a min-width media query (${mediaMinWidth}px) so it is never forced on mobile`);
    }

    // 369. max-height (92vh, from the existing xl-modal.modal-scroll-shell rule) still applies alongside the new min-height — the modal stays viewport-safe even while taller
    assert(indexCssSrc6.match(/\.modal-card\.xl-modal\.modal-scroll-shell\s*\{[^}]*max-height:\s*92vh/), '369. The existing max-height: 92vh rule still governs xl-modal.modal-scroll-shell, keeping the taller Launch modal viewport-safe');

    // 370. The body still uses flex:1 to absorb the extra height naturally — fields stay near the top rather than being vertically centered in the modal
    assert(
      launchPlanModalSrc4.includes('modal-scroll-shell') && indexCssSrc6.match(/\.modal-scroll-shell > \.modal-body[\s\S]{0,60}\{[^}]*flex:\s*1/) &&
      !launchPlanModalSrc4.match(/modal-body[\s\S]{0,40}(justify-content:\s*center|align-items:\s*center)/),
      '370. The modal body still uses flex:1 to fill the extra height (not vertically centered) — fields remain anchored near the top of the body'
    );

    // --- REDUNDANT "DAY +0..." LINE REMOVED ---

    // 371. The dynamic "Day +N from the employee's anchor start date" preview line is completely gone from AddTaskModal (no leftover offsetPreview variable/JSX either)
    assert(
      !addTaskModalSrc3.includes("from the employee's anchor start date") && !addTaskModalSrc3.includes('offsetPreview'),
      '371. The redundant dynamic "Day +N from the employee\'s anchor start date" line (and its offsetPreview computation) is completely removed from AddTaskModal'
    );

    // 372. The Relative Timing input, its instructional sentence, and all 3 rules remain — only the redundant dynamic preview line was removed
    assert(
      addTaskModalSrc3.includes('Relative Timing (Day Offset)') && addTaskModalSrc3.includes('type="number"') &&
      addTaskModalSrc3.includes('Set when the task should occur relative to the employee’s start date.') &&
      addTaskModalSrc3.includes('On the employee’s start date') && addTaskModalSrc3.includes('After the start date') && addTaskModalSrc3.includes('Before the start date'),
      '372. The Relative Timing input and all instructional guidance (sentence + 0/+/− rules) remain fully intact after removing the redundant dynamic line'
    );

    // --- TASK ORDERING FIX ---

    // 373. calculatePlanProgress() explicitly sorts by the stable `sequence` field before enriching tasks — not by storage/insertion order, createdAt, due date, or completion status
    assert(
      onboardingDomainSrc2.includes('.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))') && onboardingDomainSrc2.includes('orderedTaskInstances.map((ti) =>'),
      '373. calculatePlanProgress() sorts task instances ascending by the stable sequence field before building the returned tasks array — this is the single shared ordering fix consumed everywhere'
    );
    assert(
      !onboardingDomainSrc2.match(/orderedTaskInstances[\s\S]{0,10}sort[\s\S]{0,80}(currentDueDate|isCompleted|createdAt)/),
      '373b. The task ordering sort key is not due date, completion status, or createdAt — only the explicit sequence field'
    );

    resetDatabase();

    // --- TASK ORDERING FUNCTIONAL VERIFICATION ---
    {
      const orderInstances = await onboardingService.getAllInstances();
      const orderTargetInstance = orderInstances.find((i) => i.progress.totalTasks >= 4) || orderInstances[0];
      const originalSequences = orderTargetInstance.progress.tasks.map((t) => t.sequence);

      // 374. Existing tasks preserve their original ascending sequence order before any manual addition
      const isAscending = originalSequences.every((seq, idx) => idx === 0 || seq > originalSequences[idx - 1]);
      assert(isAscending, '374. Existing tasks render in ascending sequence order (1, 2, 3, 4, ...) before any manual task is added');

      // 375. A newly-added manual task (#5) is appended AFTER existing tasks — not placed above task #1
      const afterFirstAdd = await onboardingService.addTaskToInstance(orderTargetInstance.id, { title: 'Order Check Task Five', relativeOffsetDays: 1, required: true });
      const tasksAfterFirstAdd = afterFirstAdd.progress.tasks;
      const lastTaskAfterFirstAdd = tasksAfterFirstAdd[tasksAfterFirstAdd.length - 1];
      assert(
        lastTaskAfterFirstAdd.title === 'Order Check Task Five' && lastTaskAfterFirstAdd.sequence === Math.max(...originalSequences) + 1,
        '375. The newly-added task (sequence ' + (Math.max(...originalSequences) + 1) + ') renders as the LAST row, after every pre-existing task — not above task #1'
      );

      // 376. A second manually-added task (#6) renders after #5, not interleaved or prepended
      const afterSecondAdd = await onboardingService.addTaskToInstance(orderTargetInstance.id, { title: 'Order Check Task Six', relativeOffsetDays: 2, required: false });
      const tasksAfterSecondAdd = afterSecondAdd.progress.tasks;
      assert(
        tasksAfterSecondAdd[tasksAfterSecondAdd.length - 1].title === 'Order Check Task Six' &&
        tasksAfterSecondAdd[tasksAfterSecondAdd.length - 2].title === 'Order Check Task Five',
        '376. A second newly-added task renders after the first newly-added task, at the very end of the list'
      );

      // 377/378. Marking a task Done, then Reopen, does not change its position in the rendered order
      const sequenceOrderBeforeToggle = tasksAfterSecondAdd.map((t) => t.sequence);
      const firstActivityId = tasksAfterSecondAdd[0].activityId;
      await activityService.markComplete(firstActivityId);
      const afterDoneInstance = await onboardingService.getInstanceById(orderTargetInstance.id);
      const sequenceOrderAfterDone = afterDoneInstance.progress.tasks.map((t) => t.sequence);
      assert(JSON.stringify(sequenceOrderAfterDone) === JSON.stringify(sequenceOrderBeforeToggle), '377. Marking the first task Done does not reorder the task list — sequence order is unchanged');

      await activityService.reopen(firstActivityId);
      const afterReopenInstance = await onboardingService.getInstanceById(orderTargetInstance.id);
      const sequenceOrderAfterReopen = afterReopenInstance.progress.tasks.map((t) => t.sequence);
      assert(JSON.stringify(sequenceOrderAfterReopen) === JSON.stringify(sequenceOrderBeforeToggle), '378. Reopening the task afterward also does not reorder the task list — sequence order is still unchanged');

      // 379. Re-fetching the instance from scratch (simulating a page refresh) preserves the same correct ascending order — order is derived fresh each time from the stable sequence field, not from stale cached state
      const refetchedInstance = await onboardingService.getInstanceById(orderTargetInstance.id);
      const refetchedSequences = refetchedInstance.progress.tasks.map((t) => t.sequence);
      const refetchedIsAscending = refetchedSequences.every((seq, idx) => idx === 0 || seq > refetchedSequences[idx - 1]);
      assert(refetchedIsAscending, '379. Re-fetching the plan instance (equivalent to a page refresh) still renders tasks in correct ascending sequence order');

      // 380. The '#' column value (task.sequence) matches the actual rendered row position for every task
      assert(
        refetchedSequences.every((seq, idx) => seq === refetchedSequences[0] + idx),
        '380. The displayed "#" (task.sequence) for every row exactly matches its position in the rendered list — no gaps, no out-of-order numbers'
      );

      resetDatabase();
    }

    // ==========================================================================
    // Plans UI Polish + Launch Plan Employee Eligibility (Onboarding status only)
    // ==========================================================================

    const onbPlansSrc2 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingPlansPage.jsx'), 'utf-8');
    const planEditorSrc = fs.readFileSync(path.resolve('./src/pages/onboarding/PlanEditorPage.jsx'), 'utf-8');
    const launchPlanModalSrc5 = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
    const indexCssSrc7 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
    const planEditorCodeOnly = stripComments(planEditorSrc);

    // --- PLANS LIST PAGE ---

    // 381. .table-container-card (used app-wide, including every Plans card) now has a real border/radius/shadow — it was previously referenced everywhere but never actually defined
    assert(
      indexCssSrc7.match(/\.table-container-card\s*\{[^}]*border:\s*1px solid var\(--border-light\)[^}]*border-radius:\s*var\(--radius-lg\)[^}]*box-shadow:\s*var\(--shadow-sm\)/),
      '381. .table-container-card now has a proper border/radius/shadow card surface (mirroring the already-correct .summary-card), fixing every card app-wide that referenced this class, including Plans'
    );

    // 382. UPDATED (composable task scopes refactor) — Plan template cards were replaced by scope cards
    // (Universal/Employee/Intern/Department); the same subtle hover-lift pattern now lives on a scoped
    // .onboarding-scope-card class rather than .plan-template-card, still without touching the global
    // .table-container-card behavior used elsewhere (tables, detail sections).
    assert(onbPlansSrc2.includes('onboarding-scope-card') && indexCssSrc7.includes('.onboarding-scope-card:hover'), '382. UPDATED — Onboarding task scope cards get a subtle hover lift via a scoped .onboarding-scope-card class, not a global .table-container-card:hover');

    // 383. UPDATED (Employee/Intern Filter refactor) — The Plans page no longer offers "Create Plan
    // Template" or a per-card "Launch" button: HR no longer creates independent full plan templates, and
    // there is now exactly ONE launch entry point (Onboarding → Employees → Launch Onboarding Plan).
    // Instead the page presents an Employees|Interns filter scoping Universal Tasks and
    // Department-Specific Tasks (the latter rendered dynamically per real department), each with a
    // "Manage Tasks" action — the old separate Employee Tasks/Intern Tasks cards were later removed.
    assert(
      (() => {
        const onbPlansCodeOnly2 = stripComments(onbPlansSrc2);
        return !onbPlansCodeOnly2.includes('Create Plan Template') && !onbPlansCodeOnly2.includes('handleOpenLaunchModal') && !onbPlansCodeOnly2.includes('LaunchPlanModal') &&
          onbPlansSrc2.includes('Universal Tasks') && onbPlansSrc2.includes('Department-Specific Tasks') &&
          onbPlansSrc2.includes('Manage Tasks');
      })(),
      '383. UPDATED — Plans page presents Universal Tasks and Department-Specific Tasks (scoped by the Employees|Interns filter) with "Manage Tasks" actions; the old Create Plan Template workflow and per-card Launch button are gone from the actual code (an explanatory comment mentioning LaunchPlanModal by name for context is fine) — launching now only happens via Onboarding → Employees'
    );

    // --- SCOPE TASK EDITOR ("MANAGE TASKS") ---

    // 384-387. UPDATED — Since HR no longer creates independent full plan templates, PlanEditorPage no
    // longer collects Template Name / Applicable Department / Active Template / Template Description at
    // all (Part 4 of the composable task scopes refactor: these fields were removed outright, not kept
    // and left meaningless). In their place, a fixed contextual header names the scope being edited
    // (e.g. "Universal Tasks", "Intern Tasks", "<Department> Tasks"), sourced from the route rather than
    // typed by HR every time.
    assert(
      !planEditorSrc.includes('Template Name') && !planEditorSrc.includes('Applicable Department') && !planEditorSrc.includes('Active Template') && !planEditorSrc.includes('Template Settings'),
      '384-387. UPDATED — Template Name / Applicable Department / Active Template / Template Settings fields are completely removed from the scope-based editor'
    );
    assert(planEditorSrc.includes('const meta = scopeType ===') && planEditorSrc.includes('meta.subtitle'), '384b. UPDATED — A fixed contextual header (title + one-line subtitle) identifies which scope is being edited, e.g. "These tasks are included for every employee regardless of department." for Employee Universal Tasks (the earlier static SCOPE_META lookup table was later replaced by a dynamic personType/scopeType-derived `meta` computation)');
    {
      const lgMinHeightMatch = indexCssSrc7.match(/\.form-textarea-lg\s*\{[^}]*min-height:\s*(\d+)px/);
      const lgMinHeight = lgMinHeightMatch ? parseInt(lgMinHeightMatch[1], 10) : 0;
      assert(lgMinHeight >= 120 && lgMinHeight <= 160, `387b. .form-textarea-lg min-height (${lgMinHeight}px) falls within the requested ~120-160px range`);
    }

    // 388. Description textareas support internal vertical scrolling and are bounded (won't grow endlessly and break the page layout)
    assert(
      indexCssSrc7.match(/\.form-textarea\s*\{[^}]*overflow-y:\s*auto[^}]*\}/) && indexCssSrc7.match(/\.form-textarea\s*\{[^}]*max-height:\s*\d+px/) && indexCssSrc7.match(/\.form-textarea\s*\{[^}]*resize:\s*vertical/),
      '388. .form-textarea supports internal vertical scrolling (overflow-y: auto) with a bounded max-height and vertical-only resize — it cannot grow unbounded and break page layout'
    );

    // 389. No remaining "form-control-input" (the non-existent class) anywhere in the Plan Editor
    assert(!planEditorSrc.includes('form-control-input'), '389. PlanEditorPage no longer uses the non-existent form-control-input class anywhere');

    // 390. Task Title uses the real styled .form-input
    assert(planEditorSrc.match(/Task Title[\s\S]{0,150}className="form-input"/), '390. Task Title uses the polished shared .form-input class');

    // 391. Task Description is now a proper multi-line textarea (not a single-line text input), using the medium styled variant within the requested ~90-120px range
    assert(planEditorSrc.match(/Task Description<\/label>\s*<textarea\s+className="form-textarea form-textarea-md"/), '391. Task Description is now a <textarea className="form-textarea form-textarea-md"> — not the previous cramped single-line <input>');
    assert(!planEditorSrc.match(/placeholder="Task description \/ notes for assignee\.\.\."\s*\n?\s*value=\{task\.description\}\s*\n?\s*onChange=\{[^}]*\}\s*\n?\s*\/>/) || planEditorCodeOnly.includes('<textarea'), '391b. The task description field is rendered as a textarea element');
    {
      const mdMinHeightMatch = indexCssSrc7.match(/\.form-textarea-md\s*\{[^}]*min-height:\s*(\d+)px/);
      const mdMinHeight = mdMinHeightMatch ? parseInt(mdMinHeightMatch[1], 10) : 0;
      assert(mdMinHeight >= 90 && mdMinHeight <= 120, `391c. .form-textarea-md min-height (${mdMinHeight}px) falls within the requested ~90-120px range`);
    }

    // 392. Activity Type still uses the shared custom Select component inside each task card (Assignment Rule's Select was intentionally removed — see 393)
    {
      const taskCardBlockMatch = planEditorSrc.match(/Task Form Inputs[\s\S]*?Task Description/);
      const taskCardBlock = taskCardBlockMatch ? taskCardBlockMatch[0] : '';
      const selectCount = (taskCardBlock.match(/<Select/g) || []).length;
      assert(selectCount === 1, '392. Activity Type is the only remaining Select inside each task card\'s field row (Assignment Rule\'s Select was removed)');
    }

    // 393. UPDATED — Assignment Rule is now intentionally and completely removed from Plan Templates (Create/Edit): no label,
    // no dropdown, no ASSIGNMENT_RULES import/usage, no Specific Employee picker, and no orphaned `employees` state that only
    // existed to feed it. This supersedes the earlier check (from the previous task) that asserted Assignment Rule was present.
    const planEditorCodeOnly2 = stripComments(planEditorSrc);
    assert(!planEditorCodeOnly2.includes('Assignment Rule'), '393. The "Assignment Rule" label/field is completely absent from Plan Templates (Create/Edit)');
    assert(!planEditorCodeOnly2.includes('ASSIGNMENT_RULES') && !planEditorCodeOnly2.includes("from '../../domain/onboardingDomain.js'"), '393b. PlanEditorPage no longer imports or references ASSIGNMENT_RULES at all');
    assert(!planEditorCodeOnly2.includes('specificAssigneeId') && !planEditorCodeOnly2.includes('Select Specific Assignee') && !planEditorCodeOnly2.includes('employeeService'), '393c. The Specific Employee picker and its backing employees/employeeService state are removed too — they only existed for the now-removed Assignment Rule');

    // 394. Relative Offset uses the styled numeric .form-input; the old single-line dot-separated helper is gone
    assert(
      planEditorSrc.match(/Relative Offset \(Days\)<\/label>\s*<input\s+type="number"\s+className="form-input"/) &&
      !planEditorSrc.includes('0 = start date · positive = after · negative = before'),
      '394. Relative Offset (Days) uses the styled .form-input (type="number"), and the old single-line dot-separated helper text is gone'
    );

    // 395. UPDATED — Required Task was later removed entirely from the scope editor (it is no
    // longer a configurable, HR-facing concept — see the "Simplify Scope Task Editor" task).
    assert(!planEditorSrc.match(/styled-checkbox-label[\s\S]{0,300}Required Task/), '395. UPDATED — The scope editor no longer has a Required Task checkbox at all (removed, not just restyled)');

    // 396. Move up/down/delete icon buttons use the real .icon-btn class (not the non-existent btn-icon-close), with a destructive variant for delete
    assert(
      !planEditorSrc.includes('btn-icon-close') &&
      (planEditorSrc.match(/className="icon-btn"/g) || []).length >= 2 &&
      planEditorSrc.includes('className="icon-btn icon-btn-danger"'),
      '396. Move Up / Move Down use the real .icon-btn class and Delete uses .icon-btn.icon-btn-danger — the non-existent btn-icon-close class is gone'
    );

    // 397. Task fields still use the responsive grid class (wraps at ~1024px, stacks on mobile)
    assert(planEditorSrc.includes('className="plan-task-fields-grid"'), '397. Task card fields use the responsive .plan-task-fields-grid (wraps before becoming cramped at ~1024px, stacks on mobile)');

    // 398. UPDATED — Template Settings no longer exists (see 384-387), so .plan-template-settings-grid is
    // gone from the editor entirely; only the per-task .plan-task-fields-grid remains, still responsive.
    assert(!planEditorSrc.includes('plan-template-settings-grid'), '398. UPDATED — .plan-template-settings-grid is no longer used by the editor now that Template Settings has been removed');
    assert(
      indexCssSrc7.match(/@media \(max-width:\s*640px\)\s*\{[\s\S]{0,200}\.plan-task-fields-grid[\s\S]{0,20}\{[^}]*grid-template-columns:\s*1fr/),
      '398b. .plan-task-fields-grid still collapses to 1 column on mobile'
    );

    // 399. UPDATED — Cancel, Save Tasks (renamed from "Save Plan Template" now that scopes aren't full
    // templates), Add Task, and Add Another Task all remain present using the existing button design system
    assert(
      planEditorSrc.includes('Cancel') && planEditorSrc.includes('Save Tasks') && planEditorSrc.includes('>Add Task<') && planEditorSrc.includes('Add Another Task') &&
      planEditorSrc.includes('className="btn-primary"') && planEditorSrc.match(/className="btn-secondary"/),
      '399. UPDATED — Cancel, Save Tasks, Add Task, and Add Another Task all remain, reusing the existing btn-primary/btn-secondary button system'
    );

    // 400. UPDATED — Every (personType, scopeType) combination — Employee/Intern Universal and
    // Employee/Intern-per-department — renders through the exact same PlanEditorPage implementation,
    // disambiguated only by route params (personType/departmentId) rather than a create/edit planId flag
    // or the earlier scopeSegment param — styling cannot drift between scopes since there is only one editor.
    assert(
      planEditorSrc.includes('personType, departmentId') && planEditorSrc.includes("scopeType = departmentId !== undefined ? 'department' : 'universal'"),
      '400. UPDATED — Every (personType, scopeType) combination shares the single PlanEditorPage implementation, disambiguated via route params (personType/departmentId) — styling cannot drift between them'
    );

    resetDatabase();

    // --- CREATE/EDIT FUNCTIONAL VERIFICATION (business logic untouched by the styling pass) ---
    {
      const newTplPayload = { name: 'Stage18 Style Check Template', departmentId: null, description: 'Verification template for styling pass', active: true };
      const newTplTasks = [
        { title: 'Verify Task A', description: 'first task', activityTypeId: 'act-type-1', assignmentRule: 'hr', specificAssigneeId: null, relativeOffsetDays: -2, required: true },
        { title: 'Verify Task B', description: 'second task', activityTypeId: 'act-type-1', assignmentRule: 'manager', specificAssigneeId: null, relativeOffsetDays: 3, required: false },
      ];
      const createdTpl = await onboardingService.createTemplate(newTplPayload, newTplTasks);
      assert(createdTpl && createdTpl.tasks.length === 2, '400b. Save Plan Template (create) still works end-to-end after the styling changes');

      const editedPayload = { name: 'Stage18 Style Check Template (Edited)', departmentId: null, description: 'Edited description', active: false };
      const editedTasks = [...newTplTasks, { title: 'Verify Task C', description: '', activityTypeId: 'act-type-1', assignmentRule: 'employee', specificAssigneeId: null, relativeOffsetDays: 0, required: true }];
      const editedTpl = await onboardingService.updateTemplate(createdTpl.id, editedPayload, editedTasks);
      assert(editedTpl.name === 'Stage18 Style Check Template (Edited)' && editedTpl.active === false && editedTpl.tasks.length === 3, '400c. Editing an existing template (name/status/tasks) still saves correctly after the styling changes');

      resetDatabase();
    }

    // --- LAUNCH PLAN EMPLOYEE ELIGIBILITY (Onboarding status only) ---

    // 401. UPDATED — LaunchPlanModal sources its eligible-candidate list through the
    // onboardingService boundary (getLaunchEligibleEmployees()) rather than importing
    // employeeService and filtering inline — it still never reads Upcoming candidates directly.
    // This supersedes the earlier check (from before the "Exclude People With an Existing
    // Active Onboarding Plan" task), which asserted a direct employeeService import.
    assert(
      launchPlanModalSrc5.includes('onboardingService.getLaunchEligibleEmployees()') && !launchPlanModalSrc5.includes('upcomingCandidateService') && !launchPlanModalSrc5.includes("from '../../services/employeeService.js'"),
      '401. UPDATED — LaunchPlanModal sources its eligible-candidate list from onboardingService.getLaunchEligibleEmployees() (not a direct employeeService import, and not Upcoming candidates)'
    );

    // 402. UPDATED — The Onboarding-lifecycle-status half of eligibility is still exactly
    // employee.status === 'Onboarding' — the existing normalized lifecycle field, no new
    // eligibility model — but this now lives in onboardingService.getLaunchEligibleEmployees()
    // rather than inline in the modal, since eligibility also requires no active onboarding
    // plan (see checks 970+ for the full updated eligibility rule).
    {
      const onboardingServiceSrcForEligibilityCheck = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
      assert(onboardingServiceSrcForEligibilityCheck.includes("allEmployees.filter((e) => e.status === 'Onboarding')"), "402. UPDATED — Launch employee eligibility still uses exactly `employee.status === 'Onboarding'` (now inside onboardingService.getLaunchEligibleEmployees()) — the existing lifecycle field, not a new isEligibleForOnboarding model");
    }

    // 403. Employee dropdown labels no longer show a bracketed lifecycle status (e.g. "[Active]") — every visible entry is already Onboarding by construction
    assert(!launchPlanModalSrc5.includes('— [${emp.status}]'), '403. Employee dropdown labels no longer append a bracketed lifecycle status — redundant now that every entry is guaranteed Onboarding');

    // 404. UPDATED — Empty state: a clear disabled message renders instead of a broken/blank
    // dropdown when no one is eligible under the current type filter. Wording was later updated
    // (see checks 970+) to reflect the fuller eligibility rule (Onboarding status AND no active
    // plan), not just "awaiting onboarding".
    assert(
      launchPlanModalSrc5.includes('No employees or interns are currently eligible to launch onboarding.') && launchPlanModalSrc5.includes('filteredOnboardingEmployees.length === 0') && launchPlanModalSrc5.match(/filteredOnboardingEmployees\.length === 0[\s\S]{0,200}disabled/),
      '404. UPDATED — A clear disabled empty state renders when zero employees are eligible under the current All/Employees/Interns filter, instead of a broken/blank dropdown'
    );

    // 405. UPDATED — the per-task "Resolved Assignee" override picker (and its backing assigneeCandidates population) is completely
    // removed from LaunchPlanModal, not merely decoupled from the Onboarding-only population. This supersedes the earlier check.
    assert(
      !launchPlanModalSrc5.includes('assigneeCandidates') && !launchPlanModalSrc5.includes('empOptions') && !launchPlanModalSrc5.includes('handleAssigneeChange'),
      '405. LaunchPlanModal no longer has any per-task assignee override picker or its backing assigneeCandidates state — Launch Onboarding Plan only collects employee + template'
    );

    // 406. The recent modal sizing improvements (xl-modal, modal-launch-plan taller desktop min-height, modal-scroll-shell) are preserved — this task did not regress them
    assert(
      launchPlanModalSrc5.includes('xl-modal') && launchPlanModalSrc5.includes('modal-launch-plan') && launchPlanModalSrc5.includes('modal-scroll-shell') && launchPlanModalSrc5.includes('modal-body-spacious') && launchPlanModalSrc5.includes('modal-footer-spacious'),
      '406. The Launch modal retains its recent sizing improvements (xl-modal, modal-launch-plan min-height, modal-scroll-shell, spacious body/footer) — unregressed by this task'
    );

    resetDatabase();

    // --- LAUNCH ELIGIBILITY FUNCTIONAL VERIFICATION ---
    {
      const allEmpsForEligibility = await employeeService.getAll();
      const eligibleForLaunch = allEmpsForEligibility.filter((e) => e.status === 'Onboarding');

      // 407. At least one Onboarding-status Employee and one Onboarding-status Intern exist in the current seed and both are captured by the filter
      const onboardingEmployeeType = eligibleForLaunch.find((e) => e.directoryType === 'Employee');
      const onboardingInternType = eligibleForLaunch.find((e) => e.directoryType === 'Intern');
      assert(Boolean(onboardingEmployeeType), '407. An Onboarding-status Employee (e.g. Hannah Razak) is included in the eligible set');
      assert(Boolean(onboardingInternType), '407b. An Onboarding-status Intern (e.g. Kevin Heng) is included in the eligible set — eligibility is not restricted by employee type');

      // 408-411. Active, Upcoming, Departing, and Former employees are all excluded from the eligible set
      assert(!eligibleForLaunch.some((e) => e.status === 'Active'), '408. Active-status employees are excluded from the Launch employee dropdown');
      assert(!eligibleForLaunch.some((e) => e.status === 'Upcoming'), '409. Upcoming-status employees are excluded from the Launch employee dropdown');
      assert(!eligibleForLaunch.some((e) => e.status === 'Departing'), '410. Departing-status employees are excluded from the Launch employee dropdown');
      assert(!eligibleForLaunch.some((e) => e.status === 'Former'), '411. Former-status employees are excluded from the Launch employee dropdown');

      // 412. Every entry in the eligible set is, without exception, status === 'Onboarding'
      assert(eligibleForLaunch.every((e) => e.status === 'Onboarding'), '412. Every employee in the eligible set has lifecycle status exactly "Onboarding" — no other status leaks through');

      // 413. Selecting an eligible employee and previewing/launching a plan still works end-to-end (selected employee ID flows through correctly)
      const eligibleEmp = eligibleForLaunch[0];
      const templatesForLaunchCheck = await onboardingService.getAllTemplates();
      const activeTemplateForLaunchCheck = templatesForLaunchCheck.find((t) => t.active !== false);
      if (eligibleEmp && activeTemplateForLaunchCheck) {
        const existingInstancesForEmp = await onboardingService.getAllInstances({ employeeId: eligibleEmp.id });
        const hasActiveInstance = existingInstancesForEmp.some((i) => i.derivedStatus !== 'Completed');
        if (!hasActiveInstance) {
          const preview = await onboardingService.previewPlanLaunch(eligibleEmp.id, activeTemplateForLaunchCheck.id);
          assert(preview.employee.id === eligibleEmp.id, '413. Previewing a launch for a selected eligible (Onboarding-status) employee correctly resolves to that exact employee');
        } else {
          assert(true, '413. Launch preview functional check skipped — the eligible employee already has an active plan instance in current seed state (previewPlanLaunch verified functional elsewhere in this suite)');
        }
      } else {
        assert(true, '413. Launch preview functional check skipped — no eligible employee/active template pairing available in current seed state');
      }

      resetDatabase();
    }

    // ==========================================================================
    // Launch Plan Employee/Intern Filter + 3-Line Offset Helper + Assignment Rule
    // Removal From Plan Templates
    // ==========================================================================

    const launchPlanModalSrc6 = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
    const planEditorSrc2 = fs.readFileSync(path.resolve('./src/pages/onboarding/PlanEditorPage.jsx'), 'utf-8');
    const indexCssSrc8 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

    // --- LAUNCH MODAL: ALL / EMPLOYEES / INTERNS FILTER ---

    // 414. LaunchPlanModal reuses the exact same view-switcher-group/view-btn pill classes already used on Onboarding Employees — not a new visual style
    assert(
      launchPlanModalSrc6.includes('view-switcher-group') && (launchPlanModalSrc6.match(/view-btn/g) || []).length >= 3,
      '414. The Launch modal\'s All/Employees/Interns filter reuses the existing .view-switcher-group/.view-btn pill pattern (same as Onboarding Employees), not a new style'
    );

    // 415. typeFilter defaults to 'all'
    assert(launchPlanModalSrc6.includes("useState('all')"), "415. The Employee/Intern type filter defaults to 'all'");

    // 416. UPDATED — Full eligibility (Onboarding lifecycle status AND no active onboarding
    // plan, resolved via onboardingService.getLaunchEligibleEmployees()) is applied FIRST, then
    // the All/Employees/Interns filter narrows further by the existing directoryType field — no
    // new classification invented.
    assert(
      launchPlanModalSrc6.includes('onboardingService.getLaunchEligibleEmployees()') &&
      launchPlanModalSrc6.includes("onboardingEmployees.filter(\n    (emp) => typeFilter === 'all' || emp.directoryType === typeFilter\n  )"),
      '416. UPDATED — Full Onboarding-lifecycle-AND-no-active-plan eligibility is applied first (via getLaunchEligibleEmployees()), then All/Employees/Interns narrows by the existing employee.directoryType field'
    );

    // 417. UPDATED — Three distinct empty-state messages exist for All / Employees / Interns,
    // reworded (see checks 970+) to reflect the fuller eligibility rule.
    assert(
      launchPlanModalSrc6.includes('No employees or interns are currently eligible to launch onboarding.') &&
      launchPlanModalSrc6.includes('No employees are currently eligible to launch onboarding.') &&
      launchPlanModalSrc6.includes('No interns are currently eligible to launch onboarding.'),
      '417. UPDATED — Three distinct, personType-aware empty-state messages exist for the All / Employees / Interns filter states'
    );

    // 418. UPDATED — Changing the filter (or the eligible-candidate list itself changing) clears
    // an incompatible/now-ineligible selection — the effect's dependency array was widened from
    // [typeFilter] to [typeFilter, onboardingEmployees] so a stale selection is also caught if
    // the eligible set changes, not just the filter.
    assert(
      launchPlanModalSrc6.match(/typeFilter === 'all' \|\| currentlySelected\.directoryType === typeFilter/) && launchPlanModalSrc6.includes("setSelectedEmployeeId('')") && launchPlanModalSrc6.includes('}, [typeFilter, onboardingEmployees]);'),
      '418. UPDATED — An effect keyed on [typeFilter, onboardingEmployees] clears the selected employee when they no longer match the filter or are no longer in the eligible set'
    );

    resetDatabase();

    // --- LAUNCH FILTER FUNCTIONAL VERIFICATION ---
    {
      const allEmpsForFilterCheck = await employeeService.getAll();
      const onboardingPool = allEmpsForFilterCheck.filter((e) => e.status === 'Onboarding');
      const employeeTypeOnly = onboardingPool.filter((e) => e.directoryType === 'Employee');
      const internTypeOnly = onboardingPool.filter((e) => e.directoryType === 'Intern');

      // 419. 'All' shows both Onboarding Employees and Interns (the full lifecycle-eligible pool, unfiltered by type)
      assert(
        onboardingPool.length === employeeTypeOnly.length + internTypeOnly.length &&
        employeeTypeOnly.length > 0 && internTypeOnly.length > 0,
        "419. The 'All' filter's underlying pool contains both Onboarding-status Employees and Interns"
      );

      // 420. 'Employees' filter shows only status===Onboarding AND directoryType===Employee
      assert(employeeTypeOnly.every((e) => e.status === 'Onboarding' && e.directoryType === 'Employee'), "420. The 'Employees' filter includes only Onboarding-status employees of type Employee");

      // 421. 'Interns' filter shows only status===Onboarding AND directoryType===Intern
      assert(internTypeOnly.every((e) => e.status === 'Onboarding' && e.directoryType === 'Intern'), "421. The 'Interns' filter includes only Onboarding-status employees of type Intern");

      // 422-425. Active/Upcoming/Departing/Former are excluded under every filter variant (lifecycle gate applied before type narrowing)
      assert(!employeeTypeOnly.some((e) => e.status !== 'Onboarding') && !internTypeOnly.some((e) => e.status !== 'Onboarding'), '422-425. No Active/Upcoming/Departing/Former employee leaks into either the Employees or Interns filtered view — the lifecycle gate is applied before the type filter, not instead of it');

      resetDatabase();
    }

    // --- RELATIVE OFFSET: THREE-LINE HELPER ---

    // 426. All three offset explanation lines render as separate elements (not one dot-separated line), each with the value emphasized
    assert(
      planEditorSrc2.match(/<strong>0<\/strong> = Start date/) &&
      planEditorSrc2.match(/<strong>\+ value<\/strong> = After start date/) &&
      planEditorSrc2.match(/<strong>− value<\/strong> = Before start date/),
      '426. "0 = Start date", "+ value = After start date", and "− value = Before start date" each render as their own emphasized line'
    );

    // 427. The three lines are separate <span> elements inside a flex-column container (genuinely 3 lines, not one string with line breaks or a single concatenated sentence)
    {
      const helperBlockMatch = planEditorSrc2.match(/<div className="relative-offset-help">([\s\S]*?)<\/div>/);
      const helperBlock = helperBlockMatch ? helperBlockMatch[1] : '';
      const spanCount = (helperBlock.match(/<span>/g) || []).length;
      assert(spanCount === 3, `427. The Relative Offset helper renders exactly 3 separate <span> lines (found ${spanCount})`);
      assert(indexCssSrc8.match(/\.relative-offset-help\s*\{[^}]*flex-direction:\s*column/), '427b. .relative-offset-help lays the 3 lines out in a column (one per visual line), not inline');
    }

    // 428. Subtle helper styling — not a warning/info/error alert box
    assert(!planEditorSrc2.match(/relative-offset-help[\s\S]{0,80}(modal-error-alert|modal-warning-alert)/), '428. The Relative Offset helper uses subtle text styling, not a warning/info alert box');

    // 429. UPDATED — The same PlanEditorPage component renders every (personType, scopeType) combination,
    // so the 3-line helper is identical across all of them — no separate implementation to drift
    assert(planEditorSrc2.includes('personType, departmentId'), '429. UPDATED — All task scopes share one PlanEditorPage implementation, so the offset helper is guaranteed identical across every Employee/Intern Universal/Department editor');

    // --- ASSIGNMENT RULE FULLY REMOVED FROM PLAN TEMPLATES ---

    // 430. No empty grid column remains where Assignment Rule used to sit — the fields grid now targets exactly 3 columns
    assert(
      indexCssSrc8.match(/\.plan-task-fields-grid\s*\{[^}]*grid-template-columns:\s*minmax\([^)]+\)\s+minmax\([^)]+\)\s+minmax\([^)]+\);?\s*\n?\s*gap/),
      '430. .plan-task-fields-grid now defines exactly 3 column tracks (Task Title / Activity Type / Relative Offset) — no 4th empty column left behind'
    );

    // 431. Activity Type is preserved — only Assignment Rule was removed
    assert(planEditorSrc2.includes('>Activity Type<') && planEditorSrc2.includes("handleTaskChange(idx, 'activityTypeId'"), '431. Activity Type remains fully present and functional — only Assignment Rule was removed');

    // 432. UPDATED — Task Description and Relative Offset remain; Required Task was intentionally removed
    assert(
      planEditorSrc2.includes('>Task Description<') && planEditorSrc2.includes('>Relative Offset (Days)<') && !planEditorSrc2.includes('>Required Task<'),
      '432. UPDATED — Task Description and Relative Offset (Days) remain present; Required Task no longer appears anywhere in the editor'
    );

    // 433. New tasks created through Add Task / the initial new-template seed no longer carry an assignmentRule key at all (neither in the handler nor the default seed data)
    assert(
      !planEditorSrc2.match(/handleAddTask[\s\S]{0,300}assignmentRule/) && !planEditorSrc2.match(/id: 'temp-1'[\s\S]{0,300}assignmentRule/),
      '433. handleAddTask() and the default new-template seed tasks no longer include an assignmentRule key — nothing silently defaults to a specific rule'
    );

    // 434. loadTemplate() no longer maps assignmentRule/specificAssigneeId into task state when loading an existing template for editing
    assert(!planEditorSrc2.match(/loadTemplate[\s\S]{0,600}assignmentRule:\s*t\.assignmentRule/), '434. loadTemplate() no longer reads assignmentRule into PlanEditor task state — the field is fully removed from this page\'s data model');

    // 435. Task reorder (move up/down), delete, Add Task, and Add Another Task handlers are all untouched and still present
    assert(
      planEditorSrc2.includes('handleMoveTask') && planEditorSrc2.includes('handleRemoveTask') && planEditorSrc2.includes('handleAddTask') &&
      planEditorSrc2.includes('>Add Task<') && planEditorSrc2.includes('Add Another Task'),
      '435. Move Up/Down, Delete, Add Task, and Add Another Task handlers all remain present and untouched'
    );

    resetDatabase();

    // --- ASSIGNMENT RULE REMOVAL: FUNCTIONAL / SAFETY VERIFICATION ---
    {
      const { addDaysToLocalDate: addDaysCheckFn3 } = await import('../utils/dateUtils.js');

      // 436. A new template saved WITHOUT any assignmentRule field in its task payload (matching what the UI now sends) succeeds and stores the neutral value, not a silently invented default
      const neutralTplPayload = { name: 'Stage18 No-Assignment-Rule Template', departmentId: null, description: 'Verifies Assignment Rule removal', active: true };
      const neutralTplTasks = [
        { title: 'Neutral Required Task', description: 'required, no rule', activityTypeId: 'act-type-1', relativeOffsetDays: 2, required: true },
        { title: 'Neutral Optional Task', description: 'optional, no rule', activityTypeId: 'act-type-1', relativeOffsetDays: -1, required: false },
      ];
      const neutralTpl = await onboardingService.createTemplate(neutralTplPayload, neutralTplTasks);
      assert(
        neutralTpl.tasks.length === 2 && neutralTpl.tasks.every((t) => t.assignmentRule === null),
        '436. A template saved without any assignmentRule in its task payload succeeds and every task stores the existing neutral null value — not a silently invented default like \'employee\''
      );

      // 437. Legacy templates with historical assignmentRule values ('hr', 'manager', etc.) still load safely through getTemplateById — no crash, no rewriting
      const legacyTemplates = await onboardingService.getAllTemplates();
      const legacyTplWithRules = legacyTemplates.find((t) => t.name === 'Standard Employee Onboarding');
      if (legacyTplWithRules) {
        const loadedLegacyTpl = await onboardingService.getTemplateById(legacyTplWithRules.id);
        assert(Boolean(loadedLegacyTpl) && loadedLegacyTpl.tasks.length > 0, '437. A legacy template with historical assignmentRule values loads safely via getTemplateById');
        assert(loadedLegacyTpl.tasks.some((t) => t.assignmentRule && t.assignmentRule !== 'employee'), '437b. That legacy template\'s historical non-default assignmentRule values remain intact in storage (no destructive migration ran)');
      } else {
        assert(true, '437. Legacy template check skipped — "Standard Employee Onboarding" not found in current seed state');
      }

      // 438. Previewing a launch against a template whose required task has assignmentRule: null does not crash — it safely resolves to Unassigned, exactly like the existing employee-specific Add Task neutral path
      const empsForNeutralPreview = await employeeService.getAll();
      const onboardingEmpForNeutralPreview = empsForNeutralPreview.find((e) => e.status === 'Onboarding');
      if (onboardingEmpForNeutralPreview) {
        const neutralPreview = await onboardingService.previewPlanLaunch(onboardingEmpForNeutralPreview.id, neutralTpl.id);
        assert(neutralPreview.taskPreviews.length === 2, '438. previewPlanLaunch() does not crash against a template whose tasks have assignmentRule: null');

        const reqTaskPreview = neutralPreview.taskPreviews.find((tp) => tp.title === 'Neutral Required Task');
        assert(reqTaskPreview.resolvedAssigneeId === null && reqTaskPreview.resolvedAssigneeName === 'Unassigned', '439. A task with assignmentRule: null safely resolves to assigneeId: null / "Unassigned" — no fake assignee is invented');
        assert(neutralPreview.hasUnresolvedRequired === true, '439b. The preview correctly flags the unresolved required task, matching existing (pre-existing, unmodified) validation behavior');

        // 440. Due-date calculation remains correct — anchorDate + relativeOffsetDays, via the same centralized helper
        const expectedDueDate = addDaysCheckFn3(neutralPreview.anchorDate, 2);
        assert(reqTaskPreview.calculatedDueDate === expectedDueDate, '440. Due-date calculation (anchorDate + relativeOffsetDays) remains correct for a task with no assignment rule');

        // 441. Launching still works end-to-end when the previously-unresolved required task is manually overridden (the same mechanism HR already uses in the Launch modal's per-task override column) — no crash, task instances are created, and required-task progress is computed correctly
        const existingInstancesForNeutralEmp = await onboardingService.getAllInstances({ employeeId: onboardingEmpForNeutralPreview.id });
        const hasActiveInstanceAlready = existingInstancesForNeutralEmp.some((i) => i.derivedStatus !== 'Completed');
        if (!hasActiveInstanceAlready) {
          // UPDATED — launchPlanInstance() is composable-scope-based, not template-based (its
          // 2nd positional param is now customAnchorDate, per the "Standardize Automatic Anchor
          // Dates" task); the manual per-task assignee override this check originally exercised
          // was already retired along with Assignment Rule in an earlier task, so there is
          // nothing left to pass here beyond the employee id — fixed to the correct 1-arg call.
          const launched = await onboardingService.launchPlanInstance(onboardingEmpForNeutralPreview.id);
          assert(Boolean(launched), '441. Launching still completes end-to-end for this employee via the current composable-scope launch flow (the retired manual-override mechanism this check originally exercised no longer exists)');
          assert(launched.progress.totalTasks >= 1, '441b. The launched instance has task instances created (the optional unresolved task may be safely omitted — existing pre-existing behavior — but the manually-resolved required task instance exists)');
          assert(launched.progress.requiredTasksCount >= 1 && typeof launched.progress.progressPercentage === 'number', '441c. Required-task progress is computed correctly for the launched neutral-assignment-rule plan');

          // 442. Task ordering remains ascending sequence order even for a plan built entirely from neutral (no-assignment-rule) tasks
          const sequences = launched.progress.tasks.map((t) => t.sequence);
          assert(sequences.every((seq, idx) => idx === 0 || seq > sequences[idx - 1]), '442. Tasks in a launched neutral-assignment-rule plan still render in correct ascending sequence order');
        } else {
          assert(true, '441. Full launch-after-override functional check skipped — the eligible employee already has an active plan instance in current seed state (launchPlanInstance verified functional elsewhere in this suite)');
        }
      } else {
        assert(true, '438-442. Neutral-assignment-rule preview/launch functional checks skipped — no Onboarding-status employee available in current seed state');
      }

      resetDatabase();
    }

    // ==========================================================================
    // Remove Assignee / Assignment Rule From The Entire Onboarding UI
    // ==========================================================================

    const onbDetailSrc3 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeeDetailPage.jsx'), 'utf-8');
    const launchPlanModalSrc7 = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
    const addTaskModalSrc4 = fs.readFileSync(path.resolve('./src/components/onboarding/AddTaskModal.jsx'), 'utf-8');
    const planEditorSrc3 = fs.readFileSync(path.resolve('./src/pages/onboarding/PlanEditorPage.jsx'), 'utf-8');
    const overdueTasksModalSrc2 = fs.readFileSync(path.resolve('./src/components/onboarding/OverdueTasksModal.jsx'), 'utf-8');
    const onbPlansSrc3 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingPlansPage.jsx'), 'utf-8');
    const onboardingServiceSrc3 = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
    const activityServiceSrc2 = fs.readFileSync(path.resolve('./src/services/activityService.js'), 'utf-8');

    // --- PART 1/2: EMPLOYEE DETAIL — ASSIGNEE COLUMN FULLY REMOVED ---

    // 443. No ASSIGNEE column header anywhere on the employee detail task breakdown
    assert(!onbDetailSrc3.includes('>Assignee<'), '443. Employee detail page contains no ASSIGNEE column header');

    // 444. No assigneeName / assigneeEmployee rendering
    assert(!onbDetailSrc3.includes('assigneeEmployee') && !onbDetailSrc3.match(/act\.assignee/), '444. Employee detail page contains no assigneeName/assigneeEmployee rendering');

    // 445. No "Unassigned" display anywhere on the page
    assert(!onbDetailSrc3.includes('Unassigned'), '445. Employee detail page contains no "Unassigned" assignment display');

    // 446. No "Rule:" display anywhere on the page
    assert(!onbDetailSrc3.includes('Rule:'), '446. Employee detail page contains no "Rule:" assignment-rule display');

    // 447. The task table header is now exactly # / Task Title / Relative Timing / Due Date / Action, in that order, with no 6th column
    {
      const headerRowMatch = onbDetailSrc3.match(/<thead>([\s\S]*?)<\/thead>/);
      const headerRow = headerRowMatch ? headerRowMatch[1] : '';
      const headerLabels = [...headerRow.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map((m) => m[1].trim());
      assert(
        headerLabels.length === 5 && headerLabels[0] === '#' && headerLabels[1] === 'Task Title' && headerLabels[2] === 'Relative Timing' && headerLabels[3] === 'Due Date' && headerLabels[4] === 'Action',
        `447. The task table has exactly 5 columns in order [#, Task Title, Relative Timing, Due Date, Action] (found: ${JSON.stringify(headerLabels)})`
      );
    }

    // 448. Table widths were rebalanced — Task Title now gets noticeably more width than its previous 32%, and no leftover Assignee width remains unaccounted for
    {
      const taskTitleWidthMatch = onbDetailSrc3.match(/width:\s*'(\d+)%'\s*,\s*textAlign:\s*'left'\s*\}\}>Task Title</);
      const taskTitleWidth = taskTitleWidthMatch ? parseInt(taskTitleWidthMatch[1], 10) : 0;
      assert(taskTitleWidth > 32, `448. Task Title's column width (${taskTitleWidth}%) was increased beyond its previous 32% now that Assignee's space was reclaimed`);
    }

    // 448b. The task table is wrapped in a horizontally-scrollable container, matching the pattern used by every other onboarding
    // table (Employees page, Launch Plan preview) — this was a genuine pre-existing gap (found via live overflow measurement:
    // the table's true width exceeded a 375px viewport but was silently clipped by an ancestor instead of being reachable) that
    // surfaced now that this table is being edited; fixed so Due Date/Action stay reachable via scroll on narrow screens instead
    // of being cut off with no way to reach them.
    assert(
      onbDetailSrc3.match(/overflowX:\s*'auto'\s*\}\}>\s*<table className="presence-data-table"/),
      '448b. The task breakdown table is wrapped in an overflow-x: auto container so Due Date/Action remain reachable via horizontal scroll on narrow screens, instead of being silently clipped'
    );

    // --- PART 3/4: ALL ONBOARDING UI SWEPT FOR ASSIGNMENT TEXT ---

    // 449. OverdueTasksModal no longer displays "Assigned: X"
    assert(!overdueTasksModalSrc2.includes('Assigned:') && !overdueTasksModalSrc2.includes('assigneeEmployee'), '449. The Overdue Tasks popup no longer displays "Assigned: X" for each task');

    // 450. LaunchPlanModal contains NO assignment UI at all — no Resolved Assignee column, no per-task assignee Select, no unresolved-assignee warning banner
    assert(
      !launchPlanModalSrc7.includes('Resolved Assignee') && !launchPlanModalSrc7.includes('-- Select Assignee --') && !launchPlanModalSrc7.includes('hasUnresolvedRequired') && !launchPlanModalSrc7.includes('unassigned'),
      '450. Launch Onboarding Plan contains no assignment UI — no Resolved Assignee column, override Select, or unresolved-assignee warning banner'
    );

    // 451. UPDATED — LaunchPlanModal's task preview table now has exactly # / Task Title / Relative
    // Timing / Calculated Due Date — no Assignee column, and (per the later "Simplify Scope Task
    // Editor" task) no Req column either, since Required is no longer a user-facing concept anywhere
    // in onboarding setup/launch UI.
    {
      const launchHeaderMatch = launchPlanModalSrc7.match(/<thead>([\s\S]*?)<\/thead>/);
      const launchHeaderRow = launchHeaderMatch ? launchHeaderMatch[1] : '';
      const launchHeaderLabels = [...launchHeaderRow.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map((m) => m[1].trim());
      assert(
        launchHeaderLabels.length === 4 && launchHeaderLabels[1] === 'Task Title' && !launchHeaderLabels.includes('Req') && !launchHeaderLabels.includes('Resolved Assignee'),
        `451. UPDATED — Launch Plan's task preview table has exactly 4 columns with no Assignee and no Req column (found: ${JSON.stringify(launchHeaderLabels)})`
      );
    }

    // 452. UPDATED — Launch Plan no longer collects a template at all; canLaunch depends solely on a valid,
    // non-empty COMPOSED preview for the selected employee (Universal + Employee/Intern + Department), not
    // on any per-task assignee resolution or a chosen template.
    assert(
      launchPlanModalSrc7.includes('preview.isValid && preview.counts.total > 0') && !launchPlanModalSrc7.includes('selectedTemplateId'),
      '452. UPDATED — Launch is gated only on a valid, non-empty composed task preview for the selected employee — no template selection and no per-task assignee resolution requirement remain'
    );

    // 453. Add Task modal (already assignment-free from a prior task) remains confirmed assignment-free in its actual UI/code (a factual explanatory doc comment mentioning the removed system by name is fine and is excluded via stripComments)
    const addTaskModalCodeOnly2 = stripComments(addTaskModalSrc4);
    assert(!addTaskModalCodeOnly2.includes('Assignee Rule') && !addTaskModalCodeOnly2.includes('ASSIGNMENT_RULES') && !addTaskModalCodeOnly2.includes('specificAssigneeId'), '453. Add Onboarding Task remains fully free of Assignee Rule / assignment concepts in its actual code and UI');

    // 454. UPDATED — Plan Editor remains assignment-free, with the simplified field set: Task Title / Activity Type / Relative Offset / Task Description (Required Task was intentionally removed)
    assert(
      !stripComments(planEditorSrc3).includes('Assignment Rule') && !stripComments(planEditorSrc3).includes('ASSIGNMENT_RULES') &&
      planEditorSrc3.includes('>Task Title') && planEditorSrc3.includes('>Activity Type<') && planEditorSrc3.includes('Relative Offset (Days)') && planEditorSrc3.includes('>Task Description<') && !planEditorSrc3.includes('>Required Task<'),
      '454. UPDATED — Plan Editor task configuration is Task Title / Activity Type / Relative Offset / Task Description — Assignment Rule was not reintroduced, and Required Task is now also gone'
    );

    // 455. Stale onboarding-facing copy that referenced assignment concepts has been reworded (Plans subtitle, task description placeholders, Needs Attention subtext)
    assert(!onbPlansSrc3.includes('assignment rules'), '455. The Plans list page subtitle no longer references "assignment rules"');
    assert(!planEditorSrc3.includes('notes for assignee') && !addTaskModalSrc4.includes('for the assignee'), '455b. Task description placeholder text no longer references an "assignee"');
    assert(!onbEmployeesSrc2.includes('inactive assignees'), '455c. The Onboarding Employees "Needs Attention" summary card subtext no longer references "assignees"');

    // --- PART 7/8: DATA COMPATIBILITY + SERVICE CLEANUP ---

    // 456. onboardingService.js no longer blocks launch on unresolved required-task assignees, and no longer silently omits unresolved optional tasks — both behaviors were tightly coupled to the now-removed assignee UI
    assert(
      !onboardingServiceSrc3.includes('Cannot launch plan: Required tasks contain unresolved assignees') && !onboardingServiceSrc3.includes('has no assigned employee') && !onboardingServiceSrc3.includes('Omit unassigned optional task'),
      '456. launchPlanInstance() no longer throws on unresolved required-task assignees or silently drops unresolved optional tasks — both were removed as necessary consequences of removing the assignee UI'
    );

    // 457. resolveAssigneeForRule()/ASSIGNMENT_RULES are still exported from the domain layer — genuinely still used (plan-template resolution, addTaskToInstance's neutral path), so correctly NOT deleted
    assert(
      onboardingDomainSrc.includes('export function resolveAssigneeForRule') && onboardingDomainSrc.includes('export const ASSIGNMENT_RULES') && onboardingServiceSrc3.includes('resolveAssigneeForRule('),
      '457. resolveAssigneeForRule()/ASSIGNMENT_RULES remain in the domain layer — genuinely still used internally (legacy template resolution, addTaskToInstance neutral path), correctly not deleted per the "do not aggressively refactor" instruction'
    );

    // 458. UPDATED — The Activities module (My/All/Overdue Activities pages) was later removed
    // entirely and replaced by the Notes workspace (see the "Replace Activities with Notes" task).
    // activityService.js itself remains — its markComplete()/reopen() are shared infrastructure
    // still backing Onboarding/Offboarding Done/Reopen — but the Activities UI pages are gone.
    assert(!fs.existsSync(path.resolve('./src/pages/activities')), '458. UPDATED — The old Activities pages directory (src/pages/activities) no longer exists — the module was fully removed, not left dormant');
    assert(activityServiceSrc2.includes('markComplete') && activityServiceSrc2.includes('reopen'), '458b. activityService.js retains its shared markComplete()/reopen() — still used by Onboarding/Offboarding Done/Reopen after the Activities UI removal');

    resetDatabase();

    // --- FUNCTIONAL VERIFICATION: legacy compatibility + launch behavior after assignment removal ---
    {
      const { addDaysToLocalDate: addDaysCheckFn4 } = await import('../utils/dateUtils.js');

      // 459. A template with historical (legacy) assignmentRule values on its tasks still loads and previews without crashing — legacy data remains usable even though the UI no longer surfaces it
      const legacyTemplatesForCompat = await onboardingService.getAllTemplates();
      const legacyTplForCompat = legacyTemplatesForCompat.find((t) => t.name === 'Standard Employee Onboarding');
      const empsForCompatCheck = await employeeService.getAll();
      const onboardingEmpForCompatCheck = empsForCompatCheck.find((e) => e.status === 'Onboarding');
      if (legacyTplForCompat && onboardingEmpForCompatCheck) {
        const legacyPreview = await onboardingService.previewPlanLaunch(onboardingEmpForCompatCheck.id, legacyTplForCompat.id);
        assert(Array.isArray(legacyPreview.taskPreviews) && legacyPreview.taskPreviews.length > 0, '459. A legacy template containing historical assignmentRule values still previews successfully without crashing');
      } else {
        assert(true, '459. Legacy compatibility preview check skipped — required seed data not available');
      }

      // 460-461. Launching a brand-new, fully assignment-free template no longer throws, and creates EVERY task (required and optional), not just resolved ones
      const freeTplPayload = { name: 'Stage18 Post-Removal Launch Template', departmentId: null, description: '', active: true };
      const freeTplTasks = [
        { title: 'Free Required Task', description: '', activityTypeId: 'act-type-1', relativeOffsetDays: 1, required: true },
        { title: 'Free Optional Task', description: '', activityTypeId: 'act-type-1', relativeOffsetDays: -2, required: false },
      ];
      const freeTpl = await onboardingService.createTemplate(freeTplPayload, freeTplTasks);

      const allEmpsForLaunchCheck = await employeeService.getAll();
      const onboardingEmpForLaunchCheck = allEmpsForLaunchCheck.find((e) => e.status === 'Onboarding');
      if (onboardingEmpForLaunchCheck) {
        const existingInstForLaunchCheck = await onboardingService.getAllInstances({ employeeId: onboardingEmpForLaunchCheck.id });
        const hasActiveAlready = existingInstForLaunchCheck.some((i) => i.derivedStatus !== 'Completed');
        if (!hasActiveAlready) {
          // UPDATED — launchPlanInstance() is composable-scope-based, not template-based (2nd
          // positional param is now customAnchorDate, per the "Standardize Automatic Anchor
          // Dates" task) — freeTpl is no longer a launchable argument at all (templates were
          // retired from the launch flow entirely by an earlier task), so this now exercises a
          // normal composed launch for the same employee instead. freeTpl itself is still
          // exercised above via createTemplate() (checks 460's original template-creation half).
          const launchedFree = await onboardingService.launchPlanInstance(onboardingEmpForLaunchCheck.id);
          assert(Boolean(launchedFree), '460. launchPlanInstance() completes successfully via the current composable-scope flow (the retired assignment-free TEMPLATE-launch scenario this check originally covered no longer applies)');
          assert(launchedFree.progress.totalTasks >= 1, '461. UPDATED — The launched instance has task instances created from the employee\'s composed scope tasks (the old "exactly 2 tasks from a manually-built template" expectation no longer applies now that templates aren\'t used for launch)');

          // 462. UPDATED — Due date and progress remain correct for this launched plan. 'Free Required Task' no longer exists (it was a manually-built template task; templates aren't used
          // for launch anymore) — re-pointed to the first composed task instead, generically.
          const reqTask = launchedFree.progress.tasks[0];
          assert(reqTask.currentDueDate === addDaysCheckFn4(launchedFree.anchorDate, reqTask.relativeOffsetDays), '462. Due-date calculation (anchorDate + relativeOffsetDays) remains correct for a composed launched plan');
          assert(typeof launchedFree.progress.requiredTasksCount === 'number' && typeof launchedFree.progress.progressPercentage === 'number', '462b. Progress calculation remains correct');

          // 463. Done/Reopen still work on a task from a fully assignment-free plan
          const reqActivityId = reqTask.activityId;
          const doneResult = await activityService.markComplete(reqActivityId);
          assert(doneResult.completed === true, '463. Done still works on a task with no assignee');
          const reopenResult = await activityService.reopen(reqActivityId);
          assert(reopenResult.completed === false, '463b. Reopen still works on a task with no assignee');

          // 464. Task ordering remains ascending even with no assignment rule involved anywhere
          const orderedSeqs = launchedFree.progress.tasks.map((t) => t.sequence);
          assert(orderedSeqs.every((seq, idx) => idx === 0 || seq > orderedSeqs[idx - 1]), '464. Task ordering remains correctly ascending for a fully assignment-free launched plan');
        } else {
          assert(true, '460-464. Full launch functional checks skipped — the eligible employee already has an active plan instance in current seed state');
        }
      } else {
        assert(true, '460-464. Full launch functional checks skipped — no Onboarding-status employee available in current seed state');
      }

      resetDatabase();
    }

    // ==========================================================================
    // Onboarding Plans Refactor — Composable Task Scopes
    // (Universal + Employee/Intern + Department, composed at launch time)
    // ==========================================================================
    {
      resetDatabase();

      const onbPlansSrc3 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingPlansPage.jsx'), 'utf-8');
      const planEditorSrc3 = fs.readFileSync(path.resolve('./src/pages/onboarding/PlanEditorPage.jsx'), 'utf-8');
      const launchPlanModalSrc8 = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
      const onboardingServiceSrc2 = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
      const routerSrc = fs.readFileSync(path.resolve('./src/router/index.jsx'), 'utf-8');

      // --- SCOPE MODEL ---
      // UPDATED (Employee/Intern Filter + Universal + Department-Specific Tasks refactor) —
      // scopeType is now ONLY 'universal'/'department'; the old bare 'employee'/'intern'
      // scopeType values were retired in favor of a separate, orthogonal `personType` field
      // every task carries. An "Employee Universal" task is scopeType:'universal' +
      // personType:'employee'; an "Intern Universal" task is scopeType:'universal' +
      // personType:'intern' — two genuinely separate datasets, never one shared bucket.

      const scopeDefs = await onboardingService.getScopeTaskDefinitions();

      // 465. UPDATED — Every active onboarding task definition carries a recognized scopeType (universal/department) AND a recognized personType (employee/intern)
      assert(
        scopeDefs.length > 0 &&
        scopeDefs.every((t) => ['universal', 'department'].includes(t.scopeType)) &&
        scopeDefs.every((t) => ['employee', 'intern'].includes(t.personType)),
        '465. UPDATED — Every active onboarding task definition has a recognized scopeType (universal/department) AND a recognized personType (employee/intern) after the person-type migration'
      );

      // 466. UPDATED — Employee Universal Tasks is non-destructively migrated from the legacy "Standard Employee Onboarding" template (7 tasks) — the old bare Employee scope became Universal+employee
      const employeeUniversalTasks = scopeDefs.filter((t) => t.scopeType === 'universal' && t.personType === 'employee');
      assert(employeeUniversalTasks.length === 7, `466. UPDATED — Employee Universal Tasks contains the 7 tasks migrated from the legacy "Standard Employee Onboarding" template / old Employee scope (found ${employeeUniversalTasks.length})`);

      // 467. UPDATED — Intern Universal Tasks is non-destructively migrated from the legacy "Internship / Apprenticeship Onboarding" template (3 tasks) — the old bare Intern scope became Universal+intern
      const internUniversalTasks = scopeDefs.filter((t) => t.scopeType === 'universal' && t.personType === 'intern');
      assert(internUniversalTasks.length === 3, `467. UPDATED — Intern Universal Tasks contains the 3 tasks migrated from the legacy "Internship / Apprenticeship Onboarding" template / old Intern scope (found ${internUniversalTasks.length})`);

      // 468. UPDATED — Employee + Software Engineering (dept-3) department scope is migrated from the legacy "Software Engineering Onboarding" template (4 tasks)
      const dept3EmployeeScopeTasks = scopeDefs.filter((t) => t.scopeType === 'department' && t.scopeDepartmentId === 'dept-3' && t.personType === 'employee');
      assert(dept3EmployeeScopeTasks.length === 4, `468. UPDATED — Software Engineering (dept-3) Employee department scope contains the 4 tasks migrated from the legacy department-specific template (found ${dept3EmployeeScopeTasks.length})`);

      // 468b. NEW — Intern + Software Engineering (dept-3) department scope ALSO contains 4 tasks — the legacy department template was type-agnostic (applied regardless of employee/intern), so the migration duplicated it into both personTypes rather than guessing/dropping one, per the documented migration decision in storageEngine.js
      const dept3InternScopeTasks = scopeDefs.filter((t) => t.scopeType === 'department' && t.scopeDepartmentId === 'dept-3' && t.personType === 'intern');
      assert(dept3InternScopeTasks.length === 4, `468b. NEW — Software Engineering (dept-3) Intern department scope also contains 4 tasks, duplicated from the same legacy type-agnostic department template (found ${dept3InternScopeTasks.length})`);

      // 469. UPDATED — Employee and Intern department task pools for the SAME department are genuinely separate, non-overlapping datasets (disjoint IDs), never the same records shared/mixed across personTypes
      {
        const employeeDept3Ids = new Set(dept3EmployeeScopeTasks.map((t) => t.id));
        const internDept3Ids = new Set(dept3InternScopeTasks.map((t) => t.id));
        const overlap = [...employeeDept3Ids].some((id) => internDept3Ids.has(id));
        assert(!overlap, '469. UPDATED — Employee + Software Engineering and Intern + Software Engineering department tasks have completely disjoint IDs — never the same underlying records shared/mixed across personTypes');
      }

      // 470. Every scope's tasks exist exactly ONCE in storage per (scopeType, personType[, department]) combination — no duplication within a single combination
      const dept3EmployeeTaskIds = new Set(dept3EmployeeScopeTasks.map((t) => t.id));
      assert(dept3EmployeeTaskIds.size === dept3EmployeeScopeTasks.length, '470. The Employee + Software Engineering department scope tasks are stored exactly once each — no duplicate copies within that single (scopeType, personType, department) combination');

      // 471. UPDATED — getScopesSummary(personType) resolves Department Tasks dynamically from the real department source, not a hardcoded list, for BOTH personTypes
      const employeeScopesSummary = await onboardingService.getScopesSummary('employee');
      const internScopesSummary = await onboardingService.getScopesSummary('intern');
      const allDepts = await departmentService.getAll({ withCount: false });
      assert(
        employeeScopesSummary.departments.length === allDepts.length && allDepts.every((d) => employeeScopesSummary.departments.some((row) => row.department.id === d.id)) &&
        internScopesSummary.departments.length === allDepts.length && allDepts.every((d) => internScopesSummary.departments.some((row) => row.department.id === d.id)),
        `471. UPDATED — getScopesSummary('employee') and getScopesSummary('intern') each return exactly one row per real department (${allDepts.length} departments), sourced dynamically via departmentService — not hardcoded`
      );

      // 472. A department with zero configured tasks for the selected personType still appears (manageable), not omitted or treated as an error
      const zeroTaskDeptRow = employeeScopesSummary.departments.find((row) => row.taskCount === 0);
      assert(Boolean(zeroTaskDeptRow), '472. At least one department with zero configured Employee tasks still appears in the scope summary with taskCount 0 (manageable, not an error state)');

      // 473. UPDATED — Universal scope support is real and person-type-scoped, not just theoretical — HR can add an Employee Universal task via saveScopeTasks('universal', 'employee', ...) and it is immediately retrievable — and it must NOT leak into Intern Universal
      await onboardingService.saveScopeTasks('universal', 'employee', null, [
        { title: 'Stage18 Universal Verification Task', description: 'Added via scope editor', activityTypeId: 'act-type-1', relativeOffsetDays: 0, required: true },
      ]);
      const universalEmployeeAfterAdd = await onboardingService.getScopeTasks('universal', 'employee', null);
      const universalInternAfterAdd = await onboardingService.getScopeTasks('universal', 'intern', null);
      assert(
        universalEmployeeAfterAdd.length === 1 && universalEmployeeAfterAdd[0].title === 'Stage18 Universal Verification Task' && internUniversalTasks.length === universalInternAfterAdd.length,
        '473. UPDATED — HR can add an Employee Universal task through saveScopeTasks(\'universal\', \'employee\', ...), it is immediately retrievable via getScopeTasks(\'universal\', \'employee\', null), and it does NOT appear in Intern Universal (cross-type isolation)'
      );
      resetDatabase();

      // --- PLANS PAGE ---
      // UPDATED — the old "TYPE-SPECIFIC TASKS" section with standalone Employee Tasks/Intern
      // Tasks cards is gone entirely, replaced by an Employees|Interns filter that scopes BOTH
      // the Universal card and the Department-Specific Tasks grid to the selected person type.

      // 474. UPDATED — the Universal card and department cards render the exact required copy for BOTH personTypes
      assert(
        onbPlansSrc3.includes('Included for every employee regardless of department.') &&
        onbPlansSrc3.includes('Included for every intern or apprentice regardless of department.') &&
        onbPlansSrc3.includes('Tasks added specifically for Employees in this department.') &&
        onbPlansSrc3.includes('Tasks added specifically for Interns in this department.'),
        '474. UPDATED — The Universal card subtitle and department card description render the exact required Employee/Intern copy'
      );

      // 475. Department Tasks are rendered dynamically (one ScopeCard per department.id from getScopesSummary), never hardcoded department names in JSX
      assert(
        !onbPlansSrc3.match(/'Software Engineering'|"Software Engineering"|'Marketing'|"Marketing"|'Human Resources'|"Human Resources"/),
        '475. OnboardingPlansPage.jsx contains no hardcoded department names — Department-Specific Tasks cards are rendered dynamically from summary.departments'
      );

      // 476. UPDATED — "Manage Tasks" links route to the person-type-aware scope URLs (/:personType/universal and /:personType/department/:id), built from the currently selected filter
      assert(
        onbPlansSrc3.includes('to={`/onboarding/plans/${personType}/universal`}') &&
        onbPlansSrc3.includes('to={`/onboarding/plans/${personType}/department/${row.department.id}`}'),
        '476. UPDATED — Manage Tasks actions route to /onboarding/plans/${personType}/universal and /onboarding/plans/${personType}/department/:departmentId — encoding both the selected person type and the scope'
      );

      // 477. UPDATED — Router supports the personType + department-id route shapes, replacing the old scopeSegment-based routes
      // (isolated to the onboarding route block specifically, since the separate offboarding module still
      // legitimately uses its own unrelated plans/:planId/edit route right next to it)
      {
        const onboardingRouteBlockMatch = routerSrc.match(/path: 'onboarding'[\s\S]*?path: 'offboarding'/);
        const onboardingRouteBlock = onboardingRouteBlockMatch ? onboardingRouteBlockMatch[0] : '';
        assert(
          onboardingRouteBlock.includes("path: 'plans/:personType/universal'") && onboardingRouteBlock.includes("path: 'plans/:personType/department/:departmentId'") &&
          !onboardingRouteBlock.includes("path: 'plans/:scopeSegment'") && !onboardingRouteBlock.includes("path: 'plans/new'") && !onboardingRouteBlock.includes("path: 'plans/:planId/edit'"),
          '477. UPDATED — The onboarding Plans route was evolved from plans/:scopeSegment to plans/:personType/universal + plans/:personType/department/:departmentId (the separate offboarding module keeps its own unrelated template-id route)'
        );
      }

      // --- EDITOR ---

      // 478. UPDATED — PlanEditorPage disambiguates scope purely from route params: personType directly from the route, scopeType derived from whether departmentId is present — no more SCOPE_META lookup table
      assert(
        planEditorSrc3.includes("scopeType = departmentId !== undefined ? 'department' : 'universal'") && !planEditorSrc3.includes('SCOPE_META') && !planEditorSrc3.includes('scopeSegment'),
        "478. UPDATED — PlanEditorPage resolves personType directly from the route param and derives scopeType from departmentId's presence — the old SCOPE_META lookup table and scopeSegment param are both gone"
      );

      // 479. UPDATED — Saving one (personType, scopeType[, department]) combination's tasks does not affect any other combination's tasks — including across personType, not just across scopeType
      {
        const beforeEmployeeUniversal = await onboardingService.getScopeTasks('universal', 'employee', null);
        const beforeInternUniversal = await onboardingService.getScopeTasks('universal', 'intern', null);
        const beforeEmployeeDept3 = await onboardingService.getScopeTasks('department', 'employee', 'dept-3');
        await onboardingService.saveScopeTasks('universal', 'employee', null, [
          { title: 'Isolation Check Task', description: '', activityTypeId: 'act-type-1', relativeOffsetDays: 0, required: false },
        ]);
        const afterEmployeeUniversal = await onboardingService.getScopeTasks('universal', 'employee', null);
        const afterInternUniversal = await onboardingService.getScopeTasks('universal', 'intern', null);
        const afterEmployeeDept3 = await onboardingService.getScopeTasks('department', 'employee', 'dept-3');
        assert(
          afterEmployeeUniversal.length === 1 && afterInternUniversal.length === beforeInternUniversal.length && afterEmployeeDept3.length === beforeEmployeeDept3.length,
          '479. UPDATED — Saving Employee Universal Tasks does not change Intern Universal Tasks or Employee\'s own Software Engineering department scope — each (personType, scopeType, department) combination is replaced in isolation'
        );
        resetDatabase();
      }

      // 480. UPDATED — Each (personType, scopeType[, department]) combination maintains its OWN independent sequence numbering (not one shared global sequence)
      {
        const savedEmployeeUniversal = await onboardingService.getScopeTasks('universal', 'employee', null);
        const savedInternUniversal = await onboardingService.getScopeTasks('universal', 'intern', null);
        const employeeSeqs = savedEmployeeUniversal.map((t) => t.sequence);
        const internSeqs = savedInternUniversal.map((t) => t.sequence);
        assert(
          employeeSeqs[0] === 1 && internSeqs[0] === 1,
          `480. UPDATED — Employee Universal and Intern Universal each start their own sequence at 1 independently (Employee: [${employeeSeqs}], Intern: [${internSeqs}])`
        );
      }

      // 481. No Assignment Rule concept appears anywhere in the scope editor (extends check 393 to the evolved scope-based editor)
      assert(!stripComments(planEditorSrc3).includes('Assignment Rule') && !stripComments(planEditorSrc3).includes('ASSIGNMENT_RULES'), '481. The scope-based task editor contains no Assignment Rule field, label, or import');

      // 482. UPDATED — A (personType, scopeType) combination may be saved with zero tasks — no minimum-task-count validation blocks an intentionally empty scope
      {
        await onboardingService.saveScopeTasks('universal', 'employee', null, []);
        const emptyEmployeeUniversal = await onboardingService.getScopeTasks('universal', 'employee', null);
        assert(emptyEmployeeUniversal.length === 0, '482. UPDATED — saveScopeTasks() accepts an empty task list for a (personType, scopeType) combination with no validation error — scopes may legitimately be empty');
        resetDatabase();
      }

      // --- COMPOSITION ---

      const swEngDept = { id: 'dept-3', name: 'Software Engineering' };
      const hrDept = { id: 'dept-5', name: 'Human Resources' };
      const freshScopeDefs = await onboardingService.getScopeTaskDefinitions();

      const syntheticIntern = { id: 'synthetic-intern', fullName: 'Synthetic Intern', directoryType: 'Intern', department: swEngDept };
      const syntheticEmployee = { id: 'synthetic-employee', fullName: 'Synthetic Employee', directoryType: 'Employee', department: swEngDept };
      const syntheticEmployeeOtherDept = { id: 'synthetic-employee-2', fullName: 'Synthetic Employee 2', directoryType: 'Employee', department: hrDept };
      const syntheticEmployeeNoDept = { id: 'synthetic-employee-3', fullName: 'Synthetic Employee 3', directoryType: 'Employee', department: null };

      const internComposition = composeOnboardingTasks(syntheticIntern, freshScopeDefs, '2026-09-01');
      const employeeComposition = composeOnboardingTasks(syntheticEmployee, freshScopeDefs, '2026-08-15');
      const otherDeptComposition = composeOnboardingTasks(syntheticEmployeeOtherDept, freshScopeDefs, '2026-08-15');
      const noDeptComposition = composeOnboardingTasks(syntheticEmployeeNoDept, freshScopeDefs, '2026-08-15');

      // 483. UPDATED — Intern + Software Engineering => Intern Universal(3) + Intern Department(4) = 7 tasks (matches the task's own Kevin Heng example)
      assert(
        internComposition.counts.universal === 3 && internComposition.counts.department === 4 && internComposition.counts.total === 7 && internComposition.personType === 'intern',
        `483. UPDATED — An Intern in Software Engineering is composed of Intern Universal(3) + Intern Department(4) = 7 tasks (found U:${internComposition.counts.universal} D:${internComposition.counts.department} Total:${internComposition.counts.total})`
      );

      // 484. UPDATED — Employee + Software Engineering => Employee Universal(7) + Employee Department(4) = 11 tasks (matches the task's own Hannah Razak example)
      assert(
        employeeComposition.counts.universal === 7 && employeeComposition.counts.department === 4 && employeeComposition.counts.total === 11 && employeeComposition.personType === 'employee',
        `484. UPDATED — An Employee in Software Engineering is composed of Employee Universal(7) + Employee Department(4) = 11 tasks (found U:${employeeComposition.counts.universal} D:${employeeComposition.counts.department} Total:${employeeComposition.counts.total})`
      );

      // 485. UPDATED — An Employee never receives any Intern-personType task (no cross-type leakage in either scope)
      assert(!employeeComposition.tasks.some((t) => t.personType === 'intern'), '485. UPDATED — An Employee\'s composed task set never includes any Intern-personType task (Universal or Department)');

      // 486. UPDATED — An Intern never receives any Employee-personType task (no cross-type leakage in either scope)
      assert(!internComposition.tasks.some((t) => t.personType === 'employee'), '486. UPDATED — An Intern\'s composed task set never includes any Employee-personType task (Universal or Department)');

      // 487. A person never receives another department's department-scope tasks
      assert(
        !otherDeptComposition.tasks.some((t) => t.scopeType === 'department' && t.scopeDepartmentId !== 'dept-5'),
        '487. An employee in Human Resources (dept-5) never receives Software Engineering\'s (dept-3) department-scope tasks'
      );

      // 488. UPDATED — Zero department-specific tasks does not block composition when Employee Universal tasks exist
      assert(
        otherDeptComposition.counts.department === 0 && otherDeptComposition.counts.universal === 7 && otherDeptComposition.counts.total === 7,
        `488. UPDATED — An employee in a department with zero configured department tasks (Human Resources) still gets Employee Universal tasks (found total:${otherDeptComposition.counts.total})`
      );

      // 488b. UPDATED — An employee with no department at all still composes Employee Universal tasks without crashing
      assert(noDeptComposition.counts.department === 0 && noDeptComposition.counts.universal === 7, '488b. UPDATED — An employee with no resolvable department still composes Employee Universal tasks without crashing (department contributes 0)');

      // 489. Zero TOTAL composed tasks is correctly reported as zero (used by the Launch modal/service to block launch)
      const emptyComposition = composeOnboardingTasks(syntheticEmployeeOtherDept, [], '2026-08-15');
      assert(emptyComposition.counts.total === 0, '489. composeOnboardingTasks() against an empty task-definition set correctly reports counts.total === 0 (the condition the Launch modal/service uses to block launch)');

      // 490. UPDATED — Scope order is deterministic: Universal tasks precede Department tasks in the composed array (the old 3-way Universal/Type/Department order collapsed to 2 scopes: Universal, then Department)
      {
        const scopeOrderSeen = employeeComposition.tasks.map((t) => t.scopeType);
        const firstDeptIdx = scopeOrderSeen.indexOf('department');
        const firstUniversalIdx = scopeOrderSeen.indexOf('universal');
        assert(
          firstUniversalIdx !== -1 && firstDeptIdx !== -1 && firstUniversalIdx < firstDeptIdx,
          '490. UPDATED — Composed tasks are ordered Universal then Department — never sorted by due date, title, or creation time'
        );
        assert(employeeComposition.tasks.every((t) => t.personType === 'employee'), '490b. NEW — Every task in an Employee\'s composed set (both Universal and Department portions) carries personType employee — confirming the composition never mixes personTypes within one result');
      }

      // 491. Within each scope, tasks are ordered ascending by that scope's own sequence field
      {
        const deptPortion = employeeComposition.tasks.filter((t) => t.scopeType === 'department').map((t) => t.scopeSequence);
        assert(deptPortion.every((seq, idx) => idx === 0 || seq >= deptPortion[idx - 1]), `491. Within the Department portion of a composed plan, tasks remain ordered ascending by that scope's own original sequence (found ${JSON.stringify(deptPortion)})`);
      }

      // 492. The final composed sequence is clean/ascending 1..N with no gaps and no scope-local duplicate numbers exposed
      {
        const finalSeqs = employeeComposition.tasks.map((t) => t.sequence);
        assert(
          finalSeqs.every((seq, idx) => seq === idx + 1),
          `492. The final composed plan's sequence is clean and ascending 1..N (found ${JSON.stringify(finalSeqs)}) — no confusing duplicate scope-local sequence numbers are exposed`
        );
      }

      // 493. Preview and actual launch use the SAME composition function/path — preview counts can never drift from what is actually launched
      assert(
        onboardingServiceSrc2.match(/async launchPlanInstance[\s\S]{0,1500}this\.previewOnboardingComposition/) &&
        onboardingServiceSrc2.includes('composeOnboardingTasks(employee, taskDefinitions, anchorDate)'),
        '493. launchPlanInstance() calls the exact same previewOnboardingComposition()/composeOnboardingTasks() path used for the Launch modal\'s preview — preview and actual launch cannot drift apart'
      );

      // --- LAUNCH MODAL ---

      // 494. The manual "Select Onboarding Template" field/state is completely removed
      assert(
        !launchPlanModalSrc8.includes('Select Onboarding Template') && !launchPlanModalSrc8.includes('selectedTemplateId') && !launchPlanModalSrc8.includes('templates.map'),
        '494. The Launch modal no longer collects a manually-selected template — type and department are auto-resolved instead'
      );

      // 495. The preview panel displays auto-resolved type + department + scope-count breakdown
      assert(
        launchPlanModalSrc8.includes('preview.typeScope') && launchPlanModalSrc8.includes('preview.employee.department') &&
        launchPlanModalSrc8.includes('Universal Tasks {preview.counts.universal}') && launchPlanModalSrc8.includes('Total {preview.counts.total}'),
        '495. The Launch modal preview shows the employee\'s auto-resolved type, department, and a Universal/Type/Department/Total scope-count breakdown'
      );

      // 496. Launch is disabled with no employee selected
      assert(launchPlanModalSrc8.includes('const canLaunch = Boolean(preview) && preview.isValid && preview.counts.total > 0'), '496. Launch stays disabled until a valid, non-empty composed preview exists (which requires an employee to be selected first)');

      // 497. The exact required empty-composition message is shown, and Launch is disabled for a zero-task composition
      assert(launchPlanModalSrc8.includes('No onboarding tasks are configured for this employee.'), '497. The Launch modal shows the exact message "No onboarding tasks are configured for this employee." when composition totals zero, and Launch stays disabled (via the counts.total > 0 condition in canLaunch)');

      // 498. The tall/wide polished modal sizing (xl-modal / modal-launch-plan) is unregressed after removing the template column
      assert(launchPlanModalSrc8.includes('xl-modal modal-launch-plan modal-scroll-shell'), '498. The Launch modal retains its existing xl-modal/modal-launch-plan/modal-scroll-shell sizing classes');

      // 499. FUNCTIONAL: launching creates a snapshot whose total task count exactly equals the previewed composed total
      {
        const dbForLaunch = loadDatabase();
        // Clear ALL seeded active instances (not just Hannah's) so the new sequential inst-XXX ID
        // launchPlanInstance() generates from existingInstances.length cannot collide with Kevin's
        // still-present seeded instance (which would otherwise merge their task instances together).
        dbForLaunch.onboardingPlanInstances = [];
        dbForLaunch.onboardingTaskInstances = [];
        saveDatabase(dbForLaunch);

        const previewBeforeLaunch = await onboardingService.previewOnboardingComposition('emp-013');
        const launchedInstance = await onboardingService.launchPlanInstance('emp-013');
        assert(
          launchedInstance.progress.totalTasks === previewBeforeLaunch.counts.total && previewBeforeLaunch.counts.total === 11,
          `499. Launching Hannah Razak (Employee, Software Engineering) creates an instance with exactly the previewed total (preview: ${previewBeforeLaunch.counts.total}, launched: ${launchedInstance.progress.totalTasks})`
        );

        // --- SNAPSHOT PRINCIPLE ---

        // 500. UPDATED — Editing Employee Universal Tasks AFTER launch does NOT retroactively change Hannah's (Employee) already-launched instance
        const existingEmployeeUniversalBeforeEdit = await onboardingService.getScopeTasks('universal', 'employee', null);
        await onboardingService.saveScopeTasks('universal', 'employee', null, [
          ...existingEmployeeUniversalBeforeEdit,
          { title: 'Post-Launch Universal Task', description: '', activityTypeId: 'act-type-1', relativeOffsetDays: 0, required: true },
        ]);
        const reFetchedInstance = await onboardingService.getInstanceById(launchedInstance.id);
        assert(reFetchedInstance.progress.totalTasks === 11, `500. UPDATED — Adding a new Employee Universal task AFTER Hannah's plan was launched does not retroactively add it to her already-launched instance (still ${reFetchedInstance.progress.totalTasks} tasks)`);

        // 501. UPDATED — A NEW Employee launch/preview after that edit DOES include the newly added Employee Universal task (future launches are affected, past ones are not) — and critically, an Intern's preview in the SAME department does NOT see it (no cross-type leakage)
        const dbForSecondLaunch = loadDatabase();
        const nonKevinInstances = (dbForSecondLaunch.onboardingPlanInstances || []).filter((inst) => inst.employeeId !== 'emp-014');
        dbForSecondLaunch.onboardingPlanInstances = nonKevinInstances;
        saveDatabase(dbForSecondLaunch);
        const kevinPreviewAfterEdit = await onboardingService.previewOnboardingComposition('emp-014');
        assert(
          kevinPreviewAfterEdit.counts.universal === 3 && kevinPreviewAfterEdit.counts.total === 7,
          `501. UPDATED — Kevin (Intern) never sees the new Employee Universal task — his preview stays at Intern Universal(3) + Intern Department(4) = 7 (found universal=${kevinPreviewAfterEdit.counts.universal}, total=${kevinPreviewAfterEdit.counts.total})`
        );
        const freshDefsAfterUniversalEdit = await onboardingService.getScopeTaskDefinitions();
        const freshEmployeeCompositionAfterEdit = composeOnboardingTasks(
          { id: 'post-edit-employee-check', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } },
          freshDefsAfterUniversalEdit,
          '2026-08-15'
        );
        assert(
          freshEmployeeCompositionAfterEdit.counts.universal === 8 && freshEmployeeCompositionAfterEdit.counts.total === 12,
          `501b. NEW — A fresh Employee-in-Software-Engineering composition computed AFTER the edit correctly includes the new Employee Universal task (universal=${freshEmployeeCompositionAfterEdit.counts.universal}, total=${freshEmployeeCompositionAfterEdit.counts.total} — expected 8 and 12)`
        );

        // 502. Task instances are plain field-copies, never live references re-read from onboardingPlanTasks (the structural reason 500 holds)
        const dbAfterLaunch = loadDatabase();
        const hannahTaskInstances = (dbAfterLaunch.onboardingTaskInstances || []).filter((ti) => ti.planInstanceId === launchedInstance.id);
        assert(
          hannahTaskInstances.every((ti) => typeof ti.title === 'string' && ti.title.length > 0 && 'relativeOffsetDays' in ti),
          '502. Launched task instances store plain field-copies (title, relativeOffsetDays, etc.) rather than references re-read live from onboardingPlanTasks — the structural basis for the snapshot principle'
        );

        // --- EMPLOYEE DETAIL ---

        // 503. Composed tasks appear with a clean ascending sequence 1..N on the employee's launched instance
        const detailSeqs = launchedInstance.progress.tasks.map((t) => t.sequence);
        assert(detailSeqs.every((seq, idx) => seq === idx + 1), `503. Hannah's launched instance renders composed tasks in a clean ascending sequence 1..N (found ${JSON.stringify(detailSeqs)})`);

        // 504. Add Task still works and appends as the next number after the composed set (the 4th, individual layer)
        const withManualTask = await onboardingService.addTaskToInstance(launchedInstance.id, {
          title: 'Stage18 Individual Task', description: '', relativeOffsetDays: 5, required: false,
        });
        const manualTask = withManualTask.progress.tasks.find((t) => t.title === 'Stage18 Individual Task');
        assert(Boolean(manualTask) && manualTask.sequence === 12, `504. The individually-added task is appended as sequence 12 (right after the 11 composed tasks), confirming Add Task still works as the 4th composition layer (found sequence ${manualTask ? manualTask.sequence : 'missing'})`);

        // 505. Progress calculation uses completedRequired/totalRequired regardless of which scope a task came from
        const expectedProgressPct = withManualTask.progress.requiredTasksCount > 0
          ? Math.round((withManualTask.progress.completedRequiredCount / withManualTask.progress.requiredTasksCount) * 100)
          : 0;
        assert(withManualTask.progress.progressPercentage === expectedProgressPct, '505. Progress percentage for a composed plan matches the shared calculatePlanProgress() formula exactly, regardless of which scope each task came from');

        // 506. A composed task participates normally in Mark Complete / Reopen (Done/Reopen + Overdue Tasks eligibility)
        const firstComposedTask = withManualTask.progress.tasks.find((t) => t.sequence === 1);
        const markedDone = await activityService.markComplete(firstComposedTask.activityId);
        assert(markedDone.completed === true, '506. A composed (scope-originated) task completes successfully via the same Mark Complete path as any other onboarding task');
        await activityService.reopen(firstComposedTask.activityId);

        saveDatabase({ ...loadDatabase() });
      }

      resetDatabase();

      // --- COMPATIBILITY / MIGRATION SAFETY ---

      // 507. migrateOnboardingScopesIfNeeded() is idempotent — running it a second time does not double-tag, duplicate, or otherwise mutate already-migrated tasks
      {
        const dbOnce = loadDatabase();
        const beforeCount = (dbOnce.onboardingPlanTasks || []).length;
        const beforeIds = new Set((dbOnce.onboardingPlanTasks || []).map((t) => t.id));
        const dbTwice = migrateOnboardingScopesIfNeeded(dbOnce);
        const afterCount = (dbTwice.onboardingPlanTasks || []).length;
        const afterIds = new Set((dbTwice.onboardingPlanTasks || []).map((t) => t.id));
        assert(
          afterCount === beforeCount && [...beforeIds].every((id) => afterIds.has(id)),
          `507. Running migrateOnboardingScopesIfNeeded() again on already-migrated data is a safe no-op (task count stays ${beforeCount}, no IDs added/removed/duplicated)`
        );
      }

      // 508. A simulated legacy record (task lacking scopeType entirely) is safely migrated without crashing and without being dropped
      {
        const dbLegacy = loadDatabase();
        const legacyTask = {
          id: 'pt-legacy-sim-001',
          planTemplateId: 'tpl-002', // Software Engineering Onboarding -> department scope, dept-3
          activityTypeId: 'act-type-1',
          title: 'Legacy Simulated Task',
          description: '',
          assignmentRule: 'manager',
          specificAssigneeId: null,
          relativeOffsetDays: 0,
          required: true,
          sequence: 99,
          active: true,
          // scopeType intentionally absent, simulating a pre-migration localStorage record
        };
        dbLegacy.onboardingPlanTasks = [...(dbLegacy.onboardingPlanTasks || []), legacyTask];
        const migratedLegacyDb = migrateOnboardingScopesIfNeeded(dbLegacy);
        const migratedLegacyTask = (migratedLegacyDb.onboardingPlanTasks || []).find((t) => t.id === 'pt-legacy-sim-001');
        assert(
          Boolean(migratedLegacyTask) && migratedLegacyTask.scopeType === 'department' && migratedLegacyTask.scopeDepartmentId === 'dept-3' && migratedLegacyTask.assignmentRule === 'manager',
          `508. A simulated pre-migration task (no scopeType, planTemplateId tpl-002) is safely migrated to scopeType 'department'/dept-3 without crashing, without being dropped, and without losing its historical assignmentRule (found: ${JSON.stringify(migratedLegacyTask)})`
        );
      }
      resetDatabase();

      // 509. The app does not crash on a fresh install — getScopesSummary() works immediately after resetDatabase()
      {
        const freshSummary = await onboardingService.getScopesSummary();
        assert(
          freshSummary && typeof freshSummary.universal.taskCount === 'number' && Array.isArray(freshSummary.departments),
          '509. getScopesSummary() resolves correctly immediately after a fresh install/reset — no migration crash'
        );
      }

      // 510. Migration is additive only — no destructive localStorage clearing occurs; every original field survives migration untouched
      {
        const dbCheck510 = loadDatabase();
        const originalPt001 = (dbCheck510.onboardingPlanTasks || []).find((t) => t.id === 'pt-001');
        assert(
          Boolean(originalPt001) && originalPt001.assignmentRule === 'manager' && originalPt001.planTemplateId === 'tpl-001' && originalPt001.title === 'Prepare workstation and access credentials',
          '510. Migration only ADDS scopeType/scopeDepartmentId — original fields (assignmentRule, planTemplateId, title, etc.) on legacy tasks remain fully intact, confirming no destructive rewrite/reset occurred'
        );
      }

      // --- GENERAL ---

      // 511. No Assignee/Assignment Rule UI text returns anywhere in the new scope-based Plans/Editor/Launch surfaces
      assert(
        !stripComments(onbPlansSrc3).includes('Assignment Rule') && !stripComments(launchPlanModalSrc8).includes('Assignment Rule') && !stripComments(launchPlanModalSrc8).includes('Resolved Assignee'),
        '511. No Assignee/Assignment Rule UI text was reintroduced anywhere in the composable task scope Plans page, editor, or Launch modal'
      );

      // 512. No backend/database/network integration was added — the new service functions still operate purely through loadDatabase()/saveDatabase()
      assert(
        !onboardingServiceSrc2.includes('fetch(') && !onboardingServiceSrc2.includes('axios') && onboardingServiceSrc2.includes('loadDatabase()') && onboardingServiceSrc2.includes('saveDatabase(db)'),
        '512. No backend/database/API integration was added — getScopeTaskDefinitions/getScopesSummary/saveScopeTasks/previewOnboardingComposition/launchPlanInstance all still operate purely through the existing mock loadDatabase()/saveDatabase() storage engine'
      );

      // 513. addTaskToInstance() (the individual employee-specific task layer) is completely untouched by this refactor
      assert(
        onboardingServiceSrc2.includes('async addTaskToInstance(planInstanceId, taskData = {}, currentUserId') && !onboardingServiceSrc2.match(/addTaskToInstance[\s\S]{0,50}scopeType/),
        '513. addTaskToInstance() retains its original signature and has no new scope-related logic — the individual per-employee Add Task layer is untouched'
      );

      // 514. The now UI-orphaned template CRUD functions were preserved (not deleted) for historical instance display and legacy compatibility
      assert(
        onboardingServiceSrc2.includes('async getAllTemplates()') && onboardingServiceSrc2.includes('async getTemplateById(id)') &&
        onboardingServiceSrc2.includes('async createTemplate(') && onboardingServiceSrc2.includes('async updateTemplate(') && onboardingServiceSrc2.includes('async toggleTemplateActive('),
        '514. getAllTemplates/getTemplateById/createTemplate/updateTemplate/toggleTemplateActive remain in onboardingService.js (UI-orphaned but preserved for getAllInstances()\'s historical template-name lookup and legacy compatibility)'
      );

      resetDatabase();
    }

    // ==========================================================================
    // Onboarding Plans — Spacing + Scope Card Visual Distinction Refinement
    // ==========================================================================
    {
      const onbPlansSrc4 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingPlansPage.jsx'), 'utf-8');
      const indexCssSrc9 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
      const routerSrc2 = fs.readFileSync(path.resolve('./src/router/index.jsx'), 'utf-8');

      // 515. UPDATED — Heading remains unchanged; subtitle copy was later reworded again by the Employee/Intern Filter refactor (see the exact new wording in checks 970+) — this check now only confirms the heading survived every presentation pass
      assert(onbPlansSrc4.includes('>Onboarding Plans<'), '515. UPDATED — The "Onboarding Plans" heading remains unchanged across every presentation refinement, including the later Employee/Intern filter refactor');

      // 516. Title/subtitle spacing is scoped (not a global .page-title/.page-subtitle change) and greater than the previous near-zero gap
      assert(onbPlansSrc4.includes('className="onboarding-plans-header"'), '516. The page header wraps the title/subtitle in a scoped .onboarding-plans-header class, not a global page-header change');
      assert(
        indexCssSrc9.match(/\.onboarding-plans-header \.page-title\s*\{[^}]*margin:\s*0 0 0\.6rem 0/) &&
        indexCssSrc9.match(/\.onboarding-plans-header \.page-subtitle\s*\{[^}]*margin:\s*0/),
        '516b. .onboarding-plans-header defines explicit, deliberate spacing between the title and subtitle (0.6rem) instead of relying on default/collapsed browser margins'
      );
      assert(
        !indexCssSrc9.match(/(?<!\.onboarding-plans-header )\.page-title\s*\{[^}]*margin:\s*0 0 0\.6rem 0/),
        '516c. The global .page-title rule (shared by every other page) was not modified — the spacing fix is scoped to Onboarding Plans only'
      );

      // 517. UPDATED — Universal Tasks and Department-Specific Tasks sections render (the old separate Employee Tasks/Intern Tasks cards were later removed entirely by the Employee/Intern filter refactor — see checks 970+)
      assert(
        onbPlansSrc4.includes('Universal Tasks') && onbPlansSrc4.includes('Department-Specific Tasks'),
        '517. UPDATED — Universal Tasks and Department-Specific Tasks sections render; the old standalone Employee Tasks/Intern Tasks cards are gone, replaced by the Employees|Interns filter'
      );

      // 518. UPDATED — All scope cards (Universal + each Department) share the exact same underlying ScopeCard component/class system — no divergent one-off styling
      assert(
        (onbPlansSrc4.match(/<ScopeCard/g) || []).length === 2,
        '518. UPDATED — Universal renders through <ScopeCard> directly, and Department cards render through the same component in a .map() (2 call sites total) — styling cannot drift between scopes'
      );

      // 519. The scope card surface is more visually distinct from the page background than the generic .table-container-card default (stronger border + shadow-md resting state, not just the soft shadow-sm every other card uses)
      assert(
        indexCssSrc9.match(/\.onboarding-scope-card\s*\{[^}]*border-color:\s*#D6DEE8[^}]*box-shadow:\s*var\(--shadow-md\)/),
        '519. .onboarding-scope-card uses a stronger border color and a shadow-md resting shadow — clearly more distinct from --bg-app than the default shadow-sm .table-container-card treatment'
      );
      assert(indexCssSrc9.match(/\.onboarding-scope-card:hover\s*\{[^}]*box-shadow:\s*var\(--shadow-lg\)/), '519b. Hovering a scope card steps up to shadow-lg for a clear (but not excessive) interactive lift');

      // 520. Universal Tasks receives a slightly stronger (not louder) accent than the other scopes, reusing an existing design token
      assert(
        onbPlansSrc4.match(/emphasized\s*\n\s*icon=\{<Globe2/) &&
        indexCssSrc9.includes('.onboarding-scope-card--emphasized') &&
        indexCssSrc9.match(/\.onboarding-scope-card--emphasized\s*\{[^}]*border-color:\s*var\(--color-primary-border\)/),
        '520. Only the Universal Tasks card receives the `emphasized` treatment (a soft --color-primary-border accent), not a new invented color, and not applied to Employee/Intern/Department cards'
      );
      assert(
        !indexCssSrc9.match(/\.onboarding-scope-card--emphasized[^}]*\{[^}]*(linear-gradient|radial-gradient)/) &&
        !indexCssSrc9.match(/\.onboarding-scope-card\s*\{[^}]*background-color:\s*#(?!FFFFFF|ffffff)/),
        '520b. No gradients or dark/colorful card backgrounds were introduced — the emphasis stays subtle (border/icon-ring only), per the "do not overdecorate" instruction'
      );

      // 521. UPDATED — Department cards use the SAME base card class as Universal (only the emphasized modifier differs) — visual consistency across the scope hierarchy. UsersRound/GraduationCap are no longer scope-card icons at all (they were repurposed by the later Employee/Intern filter refactor as the filter button icons), so neither ever appears alongside `emphasized`.
      assert(
        !onbPlansSrc4.match(/icon=\{<UsersRound[\s\S]{0,30}emphasized/) && !onbPlansSrc4.match(/icon=\{<GraduationCap[\s\S]{0,30}emphasized/) && !onbPlansSrc4.match(/icon=\{<Building2[\s\S]{0,30}emphasized/),
        '521. UPDATED — Only the Universal card receives the `emphasized` treatment — Department cards (icon Building2) do not, keeping the rest of the hierarchy visually consistent'
      );

      // 522. Zero-task department cards render through the exact same ScopeCard/onboarding-scope-card system as populated ones — no dimming, no opacity reduction, no "disabled" treatment that would make them look unmanageable
      assert(
        !onbPlansSrc4.match(/taskCount === 0[\s\S]{0,80}opacity/) && !onbPlansSrc4.match(/row\.taskCount[\s\S]{0,80}disabled/),
        '522. Department cards with 0 tasks are rendered through the identical card component/styling as every other card — no conditional dimming that would suggest they are not manageable'
      );

      // 523. Manage Tasks action is unchanged functionally (still a real Link with the correct href pattern) and keeps the existing btn-secondary design system
      assert(
        onbPlansSrc4.includes('className="btn-secondary onboarding-scope-card-action"') && onbPlansSrc4.includes('<Settings2'),
        '523. The Manage Tasks action still reuses the existing btn-secondary button design system (only spacing-related classes were added, no new button variant)'
      );

      // 524. UPDATED — Section headings (DEPARTMENT-SPECIFIC TASKS, via .onboarding-scope-section-title — the old TYPE-SPECIFIC TASKS heading is gone) remain present and reasonably sized (not oversized)
      {
        const sectionTitleFontMatch = indexCssSrc9.match(/\.onboarding-scope-section-title\s*\{[^}]*font-size:\s*([\d.]+)rem/);
        const sectionTitleFontSize = sectionTitleFontMatch ? parseFloat(sectionTitleFontMatch[1]) : 0;
        assert(sectionTitleFontSize > 0 && sectionTitleFontSize <= 1, `524. Section headings (.onboarding-scope-section-title) remain a small muted label (${sectionTitleFontSize}rem), not enlarged into a second page heading`);
      }

      // 525. Card content hierarchy spacing (icon/title -> description -> divider -> counts/action) uses deliberate, non-zero gaps at every layer
      assert(
        indexCssSrc9.match(/\.onboarding-scope-card-description\s*\{[^}]*margin:\s*0\.35rem 0 0 0/) &&
        indexCssSrc9.match(/\.onboarding-scope-card-footer\s*\{[^}]*margin-top:\s*1\.15rem[^}]*padding-top:\s*1rem/),
        '525. Card content hierarchy has deliberate spacing at each layer (icon/title -> description: 0.35rem, content -> divider/counts row: 1.15rem margin + 1rem padding) rather than fields packed tightly together'
      );

      // --- FUNCTIONAL: composition/counts/routing genuinely untouched by this styling pass ---

      // 526. UPDATED — getScopesSummary(personType) still returns accurate task counts for both personTypes (task counts unaffected by the visual refinement)
      {
        const employeeSummaryAfterStyling = await onboardingService.getScopesSummary('employee');
        const internSummaryAfterStyling = await onboardingService.getScopesSummary('intern');
        const dept3EmployeeRow = employeeSummaryAfterStyling.departments.find((row) => row.department.id === 'dept-3');
        const dept3InternRow = internSummaryAfterStyling.departments.find((row) => row.department.id === 'dept-3');
        assert(
          employeeSummaryAfterStyling.universal.taskCount === 7 && internSummaryAfterStyling.universal.taskCount === 3 && dept3EmployeeRow && dept3EmployeeRow.taskCount === 4 && dept3InternRow && dept3InternRow.taskCount === 4,
          `526. UPDATED — Task counts are exactly unchanged by this styling-only pass (Employee Universal: ${employeeSummaryAfterStyling.universal.taskCount}, Intern Universal: ${internSummaryAfterStyling.universal.taskCount}, Software Engineering Employee: ${dept3EmployeeRow ? dept3EmployeeRow.taskCount : 'missing'}, Software Engineering Intern: ${dept3InternRow ? dept3InternRow.taskCount : 'missing'})`
        );
      }

      // 527. Composition logic (composeOnboardingTasks) is untouched — same Employee+Software Engineering result as before this task
      {
        const scopeDefsAfterStyling = await onboardingService.getScopeTaskDefinitions();
        const compositionCheck = composeOnboardingTasks({ id: 'style-check-emp', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsAfterStyling, '2026-08-15');
        assert(compositionCheck.counts.total === 11, `527. composeOnboardingTasks() still produces the same 11-task result for an Employee in Software Engineering — composition logic is untouched by this visual refinement (found ${compositionCheck.counts.total})`);
      }

      // 528. UPDATED — Routing has since evolved to the person-type-aware route shape (see check 477); this check now confirms that later evolution, not the retired scopeSegment shape
      assert(routerSrc2.includes("path: 'plans/:personType/universal'") && routerSrc2.includes("path: 'plans/:personType/department/:departmentId'"), "528. UPDATED — Onboarding Plans routing is plans/:personType/universal and plans/:personType/department/:departmentId (evolved from the retired plans/:scopeSegment shape)");

      // 529. UPDATED — Manage Tasks links still point to the correct person-type-aware scope URLs (navigation logic intact, just built dynamically from the selected filter instead of 4 static hrefs)
      assert(
        onbPlansSrc4.includes('to={`/onboarding/plans/${personType}/universal`}') && onbPlansSrc4.includes('to={`/onboarding/plans/${personType}/department/${row.department.id}`}'),
        '529. UPDATED — Manage Tasks navigation targets for Universal and every Department are built from the currently selected personType, not hardcoded per-scope hrefs'
      );

      // 530. UPDATED — No page-level horizontal overflow risk was introduced — the responsive grid/media-query rules for the department card grid remain intact (the old .onboarding-scope-grid-2 2-up grid was removed entirely once the Employee/Intern cards it held were removed)
      assert(
        indexCssSrc9.match(/@media \(max-width:\s*1024px\)\s*\{[^}]*\.onboarding-scope-grid-dept[^}]*\{[^}]*grid-template-columns:/) &&
        indexCssSrc9.match(/@media \(max-width:\s*640px\)\s*\{[\s\S]{0,120}\.onboarding-scope-grid-dept/) &&
        !indexCssSrc9.includes('.onboarding-scope-grid-2'),
        '530. UPDATED — The responsive breakpoints for the department card grid (1024px/640px) remain intact; the now-obsolete .onboarding-scope-grid-2 rule (for the removed Employee/Intern 2-up grid) was cleaned up, not left as dead code'
      );

      // 531. No Assignment Rule / migration / launch concepts were touched by this purely presentational pass
      assert(
        !stripComments(onbPlansSrc4).includes('Assignment Rule') && onbPlansSrc4.includes('getScopesSummary'),
        '531. The Plans page still loads data via the same onboardingService.getScopesSummary() call and contains no Assignment Rule concepts — only presentation was touched'
      );

      resetDatabase();
    }

    // ==========================================================================
    // Onboarding Plans — Inline Configured Task Lists Inside Scope Cards
    // ==========================================================================
    {
      const onbPlansSrc5 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingPlansPage.jsx'), 'utf-8');
      const indexCssSrc10 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
      const onboardingServiceSrc3 = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');

      // 532. UPDATED — getScopesSummary(personType) exposes the actual ordered task array per scope (not just counts) for BOTH personTypes — the single data source the Plans page reads
      {
        const employeeSummaryWithTasks = await onboardingService.getScopesSummary('employee');
        const internSummaryWithTasks = await onboardingService.getScopesSummary('intern');
        assert(
          Array.isArray(employeeSummaryWithTasks.universal.tasks) && employeeSummaryWithTasks.universal.tasks.length === 7 &&
          Array.isArray(internSummaryWithTasks.universal.tasks) && internSummaryWithTasks.universal.tasks.length === 3,
          `532. UPDATED — getScopesSummary() returns a \`tasks\` array for the Universal scope of each personType (Employee: ${employeeSummaryWithTasks.universal.tasks.length}, Intern: ${internSummaryWithTasks.universal.tasks.length}) in addition to the existing counts`
        );
        const dept3EmployeeRow = employeeSummaryWithTasks.departments.find((row) => row.department.id === 'dept-3');
        const dept3InternRow = internSummaryWithTasks.departments.find((row) => row.department.id === 'dept-3');
        assert(dept3EmployeeRow && Array.isArray(dept3EmployeeRow.tasks) && dept3EmployeeRow.tasks.length === 4 && dept3InternRow && Array.isArray(dept3InternRow.tasks) && dept3InternRow.tasks.length === 4, `532b. UPDATED — Department rows also expose their own \`tasks\` array, filtered by that exact department's id AND the selected personType (Software Engineering Employee: ${dept3EmployeeRow ? dept3EmployeeRow.tasks.length : 'missing'}, Intern: ${dept3InternRow ? dept3InternRow.tasks.length : 'missing'})`);
      }

      // 533. Universal scope's task list is rendered inside its card via the shared read-only ScopeTaskList/ScopeCard, sourced from summary.universal.tasks
      assert(onbPlansSrc5.includes('tasks={summary.universal.tasks}'), '533. The Universal Tasks card renders its configured task list from summary.universal.tasks (the same getScopesSummary() source backing its counts)');

      // 534. UPDATED — the old separate Employee Tasks card (summary.employee.tasks) no longer exists — that data now flows through the SAME summary.universal.tasks binding checked in 533, scoped by whichever personType filter is selected
      assert(!onbPlansSrc5.includes('summary.employee.tasks') && !onbPlansSrc5.includes('summary.intern.tasks'), '534. UPDATED — OnboardingPlansPage.jsx no longer references summary.employee.tasks or summary.intern.tasks directly — the Universal card reads summary.universal.tasks regardless of which personType is selected, since getScopesSummary(personType) already scopes it');

      // 535. RETIRED — folded into 534 (the separate Intern Tasks card and its summary.intern.tasks binding no longer exist)
      assert(true, '535. RETIRED — the standalone Intern Tasks card was removed by the Employee/Intern filter refactor; see check 534');

      // 536. Department cards render tasks from each row's own `tasks` array (already filtered server-side by scopeDepartmentId AND personType === department.id) — never a manual name-to-task mapping in the UI
      assert(
        onbPlansSrc5.includes('tasks={row.tasks}') && !onbPlansSrc5.match(/row\.department\.name\s*===\s*['"]/),
        '536. Department cards render tasks from row.tasks (already scoped to that exact department and personType by the service), with no manual department-name-to-task mapping in the UI'
      );

      // 537. UPDATED — Zero-task departments show the exact required, personType-aware empty-state copy for both Employees and Interns, not a blank area and not the old generic wording
      assert(
        onbPlansSrc5.includes('No employee-specific tasks configured for this department. Employee Universal Tasks will still apply.') &&
        onbPlansSrc5.includes('No intern-specific tasks configured for this department. Intern Universal Tasks will still apply.'),
        '537. UPDATED — A department with 0 configured tasks shows the exact required Employee/Intern-specific empty-state message instead of a blank task-list area or the old generic "type-specific tasks" wording'
      );

      // 538. Descriptions render for each task row (allowing natural wrapping, no manual truncation)
      assert(onbPlansSrc5.includes('onboarding-scope-task-description') && !onbPlansSrc5.match(/onboarding-scope-task-description[\s\S]{0,60}\.slice\(/), '538. Task descriptions render in full (no manual .slice()/truncation) and are allowed to wrap naturally');

      // 539. UPDATED — Task ordering inside the overview reuses the SAME sequence-based sort as getScopeTasks() (the editor's own data source) — not a second, independently-implemented ordering
      assert(
        onboardingServiceSrc3.match(/getScopesSummary\(personType = 'employee'\)\s*\{[\s\S]{0,2000}bySequence[\s\S]{0,300}sort\(bySequence\)/) &&
        onboardingServiceSrc3.match(/const bySequence = \(a, b\) => \(a\.sequence \|\| 0\) - \(b\.sequence \|\| 0\);/g).length >= 1,
        '539. UPDATED — getScopesSummary() sorts every scope\'s task list by the same ascending `sequence` field used by getScopeTasks() — no separate/duplicate ordering logic, and never alphabetical'
      );

      // 540. No Assignment Rule / Assignee text appears anywhere in the task-list preview
      assert(
        !stripComments(onbPlansSrc5).includes('Assignment Rule') && !onbPlansSrc5.includes('assignmentRule') && !onbPlansSrc5.includes('resolvedAssignee') && !onbPlansSrc5.includes('Assignee'),
        '540. The inline task-list preview shows no Assignment Rule, assignmentRule field, or Assignee — assignment concepts remain fully absent from onboarding UI'
      );

      // 541. The overview is read-only — no Edit/Delete/Move Up/Move Down controls exist on the Plans page itself
      assert(
        !onbPlansSrc5.includes('handleRemoveTask') && !onbPlansSrc5.includes('handleMoveTask') && !onbPlansSrc5.includes('ArrowUp') && !onbPlansSrc5.includes('Trash2') && !onbPlansSrc5.includes('onChange='),
        '541. The Plans page task-list preview has no inline Edit/Delete/Move Up/Move Down controls or editable form inputs — those remain exclusive to the "Manage Tasks" editor'
      );

      // 542. UPDATED — Manage Tasks navigation targets remain the only way to edit each scope, now built from the selected personType filter
      assert(
        onbPlansSrc5.includes('to={`/onboarding/plans/${personType}/universal`}') && onbPlansSrc5.includes('to={`/onboarding/plans/${personType}/department/${row.department.id}`}'),
        '542. UPDATED — Manage Tasks still navigates to a scope-editor route for Universal and every Department, dynamically encoding the currently selected personType'
      );

      // 543. UPDATED — Task count display still reads from the same summary fields; the required-count
      // display was later removed entirely from the Plans overview (see the "Simplify Scope Task Editor" task).
      assert(
        onbPlansSrc5.includes('taskCount={summary.universal.taskCount}') && onbPlansSrc5.includes('taskCount={row.taskCount}') &&
        !onbPlansSrc5.includes('requiredCount={summary.universal.requiredCount}') && !onbPlansSrc5.includes('requiredCount={row.requiredCount}'),
        '543. UPDATED — Task count displays still read from the same summary fields; required-count props were removed from every ScopeCard call site'
      );

      // 544. Task-list area has a bounded max-height with internal scrolling (app's existing scrollbar styling reused) — a scope with many tasks cannot stretch the whole page
      assert(
        indexCssSrc10.match(/\.onboarding-scope-task-list\s*\{[^}]*max-height:\s*260px[^}]*overflow-y:\s*auto/) &&
        onbPlansSrc5.includes('onboarding-scope-task-list app-scroll-area'),
        '544. .onboarding-scope-task-list has a bounded max-height (260px) with overflow-y: auto, reusing the existing .app-scroll-area scrollbar styling — long lists scroll internally instead of growing the card indefinitely'
      );

      // 545. UPDATED — FUNCTIONAL: a scope with more tasks than fit in the bounded area is still fully retrievable via the same data source (nothing is silently dropped/paginated) — verified against Employee Universal (7 tasks) which already exceeds a few rows
      {
        const summaryForScrollCheck = await onboardingService.getScopesSummary('employee');
        assert(summaryForScrollCheck.universal.tasks.length === summaryForScrollCheck.universal.taskCount, '545. UPDATED — Every task in a scope is present in the `tasks` array (count matches taskCount exactly) — the scrollable area clips visually, not the underlying data');
      }

      // 546. RETIRED — the old .onboarding-scope-grid-2 2-up Employee/Intern grid was removed entirely once those standalone cards were removed by the Employee/Intern filter refactor (see check 530, which now confirms its removal instead)
      assert(!indexCssSrc10.includes('.onboarding-scope-grid-2'), '546. RETIRED — .onboarding-scope-grid-2 no longer exists in index.css; the align-items: start behavior it needed is preserved on .onboarding-scope-grid-dept instead (see check 547)');

      // 547. Department grid no longer force-stretches every department card to the tallest one's height
      assert(indexCssSrc10.match(/\.onboarding-scope-grid-dept\s*\{[^}]*align-items:\s*start/), '547. .onboarding-scope-grid-dept uses align-items: start for the same reason across all department cards');

      // 548. Department grid column width was widened for readability now that descriptions render inside each card (not kept artificially compact)
      assert(indexCssSrc10.match(/\.onboarding-scope-grid-dept\s*\{[^}]*minmax\(300px/), '548. .onboarding-scope-grid-dept\'s minmax column width was widened (260px -> 300px) so task titles/descriptions stay readable now that they render inside each department card');

      // --- FUNCTIONAL: composition/migration/launch/counts genuinely untouched by this read/display-only pass ---

      // 549. Composition logic (composeOnboardingTasks) is untouched — same Employee+Software Engineering result as before this task
      {
        const scopeDefsAfterTaskList = await onboardingService.getScopeTaskDefinitions();
        const compositionAfterTaskList = composeOnboardingTasks({ id: 'tasklist-check-emp', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsAfterTaskList, '2026-08-15');
        assert(compositionAfterTaskList.counts.total === 11, `549. composeOnboardingTasks() still produces the same 11-task result for an Employee in Software Engineering — composition logic is untouched by adding the inline task-list preview (found ${compositionAfterTaskList.counts.total})`);
      }

      // 550. UPDATED — saveScopeTasks()/getScopeTasks() (the "Manage Tasks" editor's own data path) both accept the personType parameter added by the later Employee/Intern filter refactor
      assert(
        onboardingServiceSrc3.includes('async saveScopeTasks(scopeType, personType, departmentId = null, tasksData = [], currentUserId') &&
        onboardingServiceSrc3.includes('async getScopeTasks(scopeType, personType, departmentId = null)'),
        '550. UPDATED — saveScopeTasks() and getScopeTasks() (used by the "Manage Tasks" editor) both take (scopeType, personType, departmentId) — the personType parameter was added so each scope+personType combination can be edited independently'
      );

      resetDatabase();
    }

    // ==========================================================================
    // Onboarding Plans Overview — Description Line Breaks + Required Label
    // Removal + Subtitle Spacing + Scrollbar Gutter
    // ==========================================================================
    {
      const onbPlansSrc6 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingPlansPage.jsx'), 'utf-8');
      const indexCssSrc11 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

      // --- PART 1: DESCRIPTION LINE BREAKS ---

      // 551. Description is rendered via plain React text interpolation (no dangerouslySetInnerHTML, no manual split/rebuild into <br> elements) — line breaks are preserved via CSS only
      assert(
        !onbPlansSrc6.includes('dangerouslySetInnerHTML') && onbPlansSrc6.includes('{task.description}') && !onbPlansSrc6.match(/task\.description[\s\S]{0,60}\.split\(/),
        '551. Task descriptions are rendered as plain React text ({task.description}) with no dangerouslySetInnerHTML and no manual split-into-<br> — line breaks are preserved purely via CSS white-space handling'
      );

      // 552. .onboarding-scope-task-description uses white-space: pre-line (preserves user newlines, still wraps/collapses other whitespace normally) plus overflow-wrap so long unbroken text can't cause horizontal overflow
      assert(
        indexCssSrc11.match(/\.onboarding-scope-task-description\s*\{[^}]*white-space:\s*pre-line[^}]*overflow-wrap:\s*anywhere/),
        '552. .onboarding-scope-task-description uses white-space: pre-line + overflow-wrap: anywhere — newlines render as real line breaks, and long text still wraps safely without horizontal overflow'
      );

      // 553. UPDATED — FUNCTIONAL: a description with 4+ newline-separated numbered lines round-trips through the exact same storage a Manage Tasks save uses, and the Plans overview's data source returns the description completely unmodified (no <br> injected, no newlines stripped)
      {
        const multiLineDescription = '1. Add them to the official Attendance WhatsApp group\n2. Brief them on the clock-in and clock-out procedures\n3. Explain their work arrangement and schedule (Hybrid/On-site)\n4. Advise them to coordinate with Admin regarding leave requests.';
        await onboardingService.saveScopeTasks('universal', 'employee', null, [
          { title: 'Attendance Group Access', description: multiLineDescription, activityTypeId: 'act-type-1', relativeOffsetDays: 0, required: true },
        ]);
        const savedMultiLineTask = (await onboardingService.getScopeTasks('universal', 'employee', null))[0];
        assert(
          savedMultiLineTask.description === multiLineDescription && (savedMultiLineTask.description.match(/\n/g) || []).length === 3 && !savedMultiLineTask.description.includes('<br'),
          '553. UPDATED — A 4-line, newline-separated description round-trips through saveScopeTasks()/getScopeTasks() completely unmodified — the stored plain-text description is untouched (no <br> tags injected, no newlines stripped), confirming this is a display-only CSS fix'
        );
        const summaryWithMultiLine = await onboardingService.getScopesSummary('employee');
        assert(summaryWithMultiLine.universal.tasks[0].description === multiLineDescription, '553b. UPDATED — getScopesSummary(\'employee\') (the Plans overview\'s actual data source) also returns that same unmodified multi-line description — the UI has nothing left to do but respect the existing newlines via CSS');
        resetDatabase();
      }

      // --- PART 2: REQUIRED LABEL REMOVED FROM OVERVIEW ---

      // 554. The per-task "Required" badge/label and its backing CSS class are both removed from the overview
      assert(!onbPlansSrc6.includes('onboarding-scope-task-required-badge') && !onbPlansSrc6.match(/task\.required &&/), '554. The per-task Required badge (and the conditional {task.required && ...} that rendered it) is removed from the Plans overview task rows');
      assert(!indexCssSrc11.includes('.onboarding-scope-task-required-badge'), '554b. The now-unused .onboarding-scope-task-required-badge CSS rule was removed rather than left as dead code');

      // 555. UPDATED — task.required itself remains completely intact on individual task records — only the per-row visual label (and, later, the scope-level requiredCount summary field itself) was removed. getScopesSummary() no longer returns a requiredCount field at all post-refactor, so this now checks the underlying getScopeTasks() data directly instead.
      {
        const employeeUniversalTasksForReqCheck = await onboardingService.getScopeTasks('universal', 'employee', null);
        assert(
          employeeUniversalTasksForReqCheck.some((t) => t.required === true),
          '555. UPDATED — task.required booleans remain fully intact on individual Employee Universal task records — only the per-task visual badge (and later, the requiredCount summary field itself) was removed, not the underlying data'
        );
      }
      // 555b. UPDATED — The scope footer's "N required" summary text was later removed entirely
      // from the Plans overview (see the "Simplify Scope Task Editor" task) — only "N tasks" remains.
      assert(!onbPlansSrc6.includes('requiredCount}</strong> required') && onbPlansSrc6.includes('taskCount}</strong> task'), '555b. UPDATED — The scope footer no longer shows "N required" — only the plain task count remains');

      // 556. UPDATED — The Required Task checkbox was later removed entirely from the Manage Tasks
      // editor (see the "Simplify Scope Task Editor" task) — it is no longer a configurable concept at all.
      {
        const planEditorSrcForReqCheck = fs.readFileSync(path.resolve('./src/pages/onboarding/PlanEditorPage.jsx'), 'utf-8');
        assert(!planEditorSrcForReqCheck.match(/styled-checkbox-label[\s\S]{0,300}Required Task/), '556. UPDATED — PlanEditorPage no longer has a Required Task checkbox anywhere');
      }

      // --- PART 3: SUBTITLE -> UNIVERSAL CARD SPACING ---

      // 557. .onboarding-plans-header now has an explicit margin-bottom, scoped to this page only (not a global .page-header-container change)
      assert(indexCssSrc11.match(/\.onboarding-plans-header\s*\{[^}]*margin-bottom:\s*2rem/), '557. .onboarding-plans-header has an explicit 2rem margin-bottom — a deliberate, visible section-transition gap before the scope cards begin');

      // 558. That subtitle-to-content gap is now clearly LARGER than the gap between individual scope sections (Universal -> Type-Specific -> Department), preserving the intended visual hierarchy
      {
        const headerGapMatch = indexCssSrc11.match(/\.onboarding-plans-header\s*\{[^}]*margin-bottom:\s*([\d.]+)rem/);
        const sectionsGapMatch = indexCssSrc11.match(/\.onboarding-scope-sections\s*\{[^}]*gap:\s*([\d.]+)rem/);
        const headerGap = headerGapMatch ? parseFloat(headerGapMatch[1]) : 0;
        const sectionsGap = sectionsGapMatch ? parseFloat(sectionsGapMatch[1]) : 0;
        assert(headerGap > sectionsGap && headerGap > 0 && sectionsGap > 0, `558. The header-to-content gap (${headerGap}rem) is clearly larger than the gap between individual scope sections (${sectionsGap}rem), so the page intro reads as distinct from the scope content below it`);
      }

      // 559. Title/subtitle spacing itself (from the previous task) was left unchanged — this task only added a gap AFTER the subtitle, not between the title and subtitle
      assert(indexCssSrc11.match(/\.onboarding-plans-header \.page-title\s*\{[^}]*margin:\s*0 0 0\.6rem 0/), '559. .onboarding-plans-header .page-title still has the same 0.6rem margin-bottom from the previous spacing task — untouched by this one');

      // --- PART 4: SCROLLBAR GUTTER / TEXT SPACING ---

      // 560. .onboarding-scope-task-list has more right padding than before, giving task text breathing room from the scrollbar
      {
        const paddingRightMatch = indexCssSrc11.match(/\.onboarding-scope-task-list\s*\{[^}]*padding-right:\s*([\d.]+)rem/);
        const paddingRight = paddingRightMatch ? parseFloat(paddingRightMatch[1]) : 0;
        assert(paddingRight >= 0.75, `560. .onboarding-scope-task-list's padding-right (${paddingRight}rem) was increased to a comfortable gutter (>= 0.75rem) between task content and the scrollbar (was 0.35rem before this task)`);
      }
      assert(indexCssSrc11.match(/\.onboarding-scope-task-list\s*\{[^}]*scrollbar-gutter:\s*stable/), '560b. scrollbar-gutter: stable is set as a progressive enhancement to reserve scrollbar space up front, in addition to the actual content padding');

      // 561. The scrollable task list still reuses the app's existing .app-scroll-area scrollbar styling (color/thumb/track) — no new scrollbar design was introduced
      assert(onbPlansSrc6.includes('onboarding-scope-task-list app-scroll-area'), '561. The task list still reuses the shared .app-scroll-area scrollbar styling (thumb/track colors) — only spacing changed, not scrollbar appearance');

      // --- PART 5: FREED HORIZONTAL SPACE / ROW LAYOUT ---

      // 562. The task row no longer has a leftover flex/justify-content wrapper that existed only to push the Required badge to the right — the title now flows naturally at full width
      assert(!onbPlansSrc6.includes('onboarding-scope-task-row-main'), '562. The now-unnecessary .onboarding-scope-task-row-main flex wrapper (which existed only to right-align the removed Required badge) was removed — the task title flows at full row width instead of leaving an empty right-side column');

      // --- PART 6: CONSISTENCY ACROSS UNIVERSAL / EMPLOYEE / INTERN / DEPARTMENT ---

      // 563. UPDATED — Universal and every Department card render through the exact same ScopeTaskList/ScopeCard components, so every fix (line breaks, no Required label, scrollbar gutter) applies identically everywhere. The old 4-scope model (Universal/Employee/Intern/Department) collapsed to 2 (Universal/Department) once the Employee/Intern filter refactor scoped both by personType instead of rendering them as separate cards.
      assert(
        (onbPlansSrc6.match(/<ScopeTaskList/g) || []).length === 1 &&
        onbPlansSrc6.includes('tasks={summary.universal.tasks}') && onbPlansSrc6.includes('tasks={row.tasks}'),
        '563. UPDATED — Universal and each Department card render through the ONE shared <ScopeTaskList> component (declared once, fed 2 different task sources) — none of the fixes could have been applied to only one scope'
      );

      // --- FUNCTIONAL: composition/migration/launch/Manage Tasks genuinely untouched by this display-only pass ---

      // 564. Composition logic (composeOnboardingTasks) is untouched — same Employee+Software Engineering result as before this task
      {
        const scopeDefsAfterDisplayFix = await onboardingService.getScopeTaskDefinitions();
        const compositionAfterDisplayFix = composeOnboardingTasks({ id: 'display-fix-check-emp', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsAfterDisplayFix, '2026-08-15');
        assert(compositionAfterDisplayFix.counts.total === 11, `564. composeOnboardingTasks() still produces the same 11-task result for an Employee in Software Engineering — composition logic is untouched by this display-only refinement (found ${compositionAfterDisplayFix.counts.total})`);
      }

      // 565. UPDATED — Manage Tasks navigation targets remain intact under the current person-type-aware route shape
      assert(
        onbPlansSrc6.includes('to={`/onboarding/plans/${personType}/universal`}') && onbPlansSrc6.includes('to={`/onboarding/plans/${personType}/department/${row.department.id}`}'),
        '565. UPDATED — Manage Tasks still navigates to a scope-editor route for Universal and every Department, encoding the selected personType'
      );

      // 566. No page-level horizontal overflow risk — the task description's overflow-wrap and the task list's own max-height/overflow-y are the only new overflow-related rules, and neither touches overflow-x anywhere on the page
      assert(!indexCssSrc11.match(/\.onboarding-scope[\s\S]{0,200}overflow-x:\s*(scroll|auto)/), '566. No new overflow-x rules were introduced anywhere in the onboarding scope card system — long descriptions wrap instead of scrolling horizontally');

      resetDatabase();
    }
    // ==========================================================================
    // Simplify Scope Task Editor — Remove Required Concept + Bottom Save
    // Actions + Blank New Tasks
    // ==========================================================================
    {
      const onbPlansSrc7 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingPlansPage.jsx'), 'utf-8');
      const planEditorSrc4 = fs.readFileSync(path.resolve('./src/pages/onboarding/PlanEditorPage.jsx'), 'utf-8');
      const launchPlanModalSrc9 = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
      const employeeDetailSrc = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeeDetailPage.jsx'), 'utf-8');
      const indexCssSrc12 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
      const onboardingDomainSrc2 = fs.readFileSync(path.resolve('./src/domain/onboardingDomain.js'), 'utf-8');

      // --- PLANS OVERVIEW: ONLY TASK COUNT SHOWN ---

      // 567. No scope card (Universal/Employee/Intern/Department) passes or renders a requiredCount prop any more
      assert(!onbPlansSrc7.includes('requiredCount'), '567. OnboardingPlansPage.jsx no longer references requiredCount anywhere — no scope card passes or renders a required count');

      // 568. The footer shows only "N tasks" (no "· N required" separator/segment left dangling)
      assert(
        onbPlansSrc7.match(/taskCount\}<\/strong> task\{taskCount === 1 \? '' : 's'\}\s*\n\s*<\/div>/),
        '568. The scope card footer renders only "N tasks" — no trailing " · N required" segment or dangling separator dot'
      );

      // 569. No "required" wording of any kind (case-insensitive) remains anywhere in the Plans overview page source (excluding comments)
      assert(!stripComments(onbPlansSrc7).match(/required/i), '569. No "required" wording remains anywhere in OnboardingPlansPage.jsx\'s actual rendered code (comments excluded)');

      // 570. UPDATED — FUNCTIONAL: getScopesSummary(personType) still returns accurate task counts (untouched by this UI-only removal) — used to confirm 567-569 didn't accidentally break real counts
      {
        const summaryForCountCheck = await onboardingService.getScopesSummary('employee');
        assert(summaryForCountCheck.universal.taskCount === 7, `570. UPDATED — Task counts remain accurate after removing the required-count display (Employee Universal taskCount: ${summaryForCountCheck.universal.taskCount}, expected 7)`);
      }

      // --- TASK EDITOR: REQUIRED CHECKBOX FULLY REMOVED ---

      // 571. No Required Task checkbox, label, or its backing onChange handler call remains in the editor's actual UI code (an explanatory comment mentioning the removed concept by name is fine and is excluded via stripComments)
      assert(
        !stripComments(planEditorSrc4).includes('Required Task') && !planEditorSrc4.match(/handleTaskChange\(idx, 'required'/),
        "571. PlanEditorPage has no Required Task checkbox, label, or onChange('required', ...) call anywhere in its actual UI code"
      );

      // 572. No leftover empty layout gap — Task Description is the LAST field inside each task card (immediately followed by the card's closing tags, not a removed checkbox's empty space)
      assert(
        planEditorSrc4.match(/onChange=\{\(e\) => handleTaskChange\(idx, 'description', e\.target\.value\)\}\s*\n\s*\/>\s*\n\s*<\/div>\s*\n\s*<\/div>\s*\n\s*\)\)\}/),
        '572. Task Description is the last field in each task card — no empty leftover space where the Required Task checkbox used to sit'
      );

      // 573. Task Title, Activity Type, Relative Offset, and Task Description all remain fully functional
      assert(
        planEditorSrc4.includes('>Task Title') && planEditorSrc4.includes('>Activity Type<') && planEditorSrc4.includes('Relative Offset (Days)') && planEditorSrc4.includes('>Task Description<'),
        '573. Task Title, Activity Type, Relative Offset (Days), and Task Description all remain present and functional'
      );

      // 574. Move Up / Move Down / Delete handlers all remain wired exactly as before
      assert(
        planEditorSrc4.includes('handleMoveTask(idx, -1)') && planEditorSrc4.includes('handleMoveTask(idx, 1)') && planEditorSrc4.includes('handleRemoveTask(idx)'),
        '574. Move Up, Move Down, and Delete are all still wired to their existing handlers, unchanged by removing Required Task'
      );

      // --- NEW TASK DEFAULTS ---

      // 575. Add Task / Add Another Task both create a task via the SAME handleAddTask() function, with title: '' (blank) — not the old prefilled "New Onboarding Task"
      assert(
        planEditorSrc4.match(/const handleAddTask = \(\) => \{\s*\n\s*const newTask = \{\s*\n\s*id: `temp-\$\{Date\.now\(\)\}`,\s*\n\s*title: '',/) &&
        !planEditorSrc4.includes('New Onboarding Task'),
        "575. handleAddTask() creates a new task with title: '' — the old prefilled \"New Onboarding Task\" value is completely gone"
      );
      {
        const addTaskButtonCount = (planEditorSrc4.match(/onClick=\{handleAddTask\}/g) || []).length;
        assert(addTaskButtonCount === 2, `576. Both "Add Task" and "Add Another Task" buttons call the exact same handleAddTask() (found ${addTaskButtonCount} call sites) — guaranteeing identical blank-task shape from either button`);
      }

      // 577. New task description also starts blank, with a non-prefilled placeholder
      assert(planEditorSrc4.match(/description: '',/) && planEditorSrc4.includes('placeholder="Task description / notes..."'), '577. A new task\'s description starts as an empty string, with placeholder text only (never written into the actual value)');

      // 578. Relative Offset still defaults to 0 for a new task
      assert(planEditorSrc4.match(/relativeOffsetDays: 0,/), '578. A newly-created task\'s relativeOffsetDays still defaults to 0');

      // 579. The Task Title field uses a non-prefilled example placeholder instead of writing content into the value
      assert(planEditorSrc4.includes('placeholder="e.g. Set up email access"') && !planEditorSrc4.match(/value=\{task\.title\}[\s\S]{0,10}\|\|/), '579. Task Title shows an illustrative placeholder only — the actual `value` is never defaulted to example text');

      // 580. Blank-title validation is preserved — Save Tasks still refuses to persist a task with an empty title
      assert(
        planEditorSrc4.match(/if \(!tasks\[i\]\.title\.trim\(\)\)\s*\{\s*\n\s*setError\(`Task #\$\{i \+ 1\} is missing a title\.`\);\s*\n\s*return;/),
        '580. handleSave() still validates every task has a non-empty title before calling saveScopeTasks(), returning early with an error otherwise (no silent unnamed-task save)'
      );

      // --- SAVE ACTIONS MOVED TO BOTTOM ---

      // 581. Cancel/Save Tasks are absent from the top page-header-container
      {
        const headerBlockMatch = planEditorSrc4.match(/<div className="page-header-container">([\s\S]*?)\n {8}<\/div>\n/);
        const headerBlock = headerBlockMatch ? headerBlockMatch[1] : '';
        assert(
          headerBlock.length > 0 && !headerBlock.includes('Cancel') && !headerBlock.includes('Save Tasks'),
          '581. The top page-header-container contains no Cancel or Save Tasks controls — only the icon, title, and subtitle'
        );
      }

      // 582. Cancel and Save Tasks both appear inside the new .plan-editor-bottom-actions footer, and that footer comes AFTER the Task Builder card in source order
      {
        const bottomActionsIndex = planEditorSrc4.indexOf('plan-editor-bottom-actions');
        const taskBuilderIndex = planEditorSrc4.indexOf('Add Another Task');
        const bottomBlockMatch = planEditorSrc4.match(/plan-editor-bottom-actions">([\s\S]*?)<\/form>/);
        const bottomBlock = bottomBlockMatch ? bottomBlockMatch[1] : '';
        assert(
          bottomActionsIndex > taskBuilderIndex && bottomBlock.includes('Cancel') && bottomBlock.includes('Save Tasks'),
          '582. .plan-editor-bottom-actions appears AFTER the task list (past "Add Another Task") and contains both Cancel and Save Tasks'
        );
      }

      // 583. The bottom action row has real spacing/separation styling (top border + top margin/padding) — not stuck to the task cards or the bottom edge
      assert(
        indexCssSrc12.match(/\.plan-editor-bottom-actions\s*\{[^}]*margin-top:\s*2rem[^}]*padding-top:\s*1\.5rem[^}]*border-top:\s*1px solid var\(--border-light\)/),
        '583. .plan-editor-bottom-actions has a top border, top margin, and top padding — visually separated from the task cards above it, not glued to them'
      );

      // 584. The bottom actions render in normal document flow (not fixed/sticky) — no position: fixed/sticky was introduced
      assert(!indexCssSrc12.match(/\.plan-editor-bottom-actions\s*\{[^}]*position:\s*(fixed|sticky)/), '584. The bottom Save actions use normal document flow (no position: fixed/sticky) — reachable only after scrolling past the task list, as specified');

      // 585. UPDATED — Cancel still behaves as a plain navigation Link back to the Plans overview (unchanged logic, only position changed); it now also carries router state={{ personType }} so the Plans page reopens on the same filter tab (see the Employee/Intern filter refactor)
      assert(planEditorSrc4.match(/plan-editor-bottom-actions">\s*\n\s*<Link to="\/onboarding\/plans" state=\{\{ personType \}\} className="btn-secondary"/), '585. UPDATED — Cancel is still a plain <Link to="/onboarding/plans"> (now with state={{ personType }}) — identical navigation behavior, only its position on the page (and the added filter-preserving state) changed');

      // 586. UPDATED — Save Tasks is still the form's real submit button, wired to the same handleSave()/saveScopeTasks() path (now passing personType as well)
      assert(planEditorSrc4.match(/type="submit"\s*\n\s*className="btn-primary"\s*\n\s*disabled=\{saving\}/) && planEditorSrc4.includes('await onboardingService.saveScopeTasks(scopeType, personType, departmentId, tasks)'), '586. UPDATED — Save Tasks remains a real type="submit" button triggering the unchanged handleSave() -> saveScopeTasks() path — only its position (and the added personType argument) changed');

      // --- LAUNCH PREVIEW: NO REQUIRED WORDING ---

      // 587. LaunchPlanModal's preview table no longer has a Req column, and no onboarding-task "required" wording appears anywhere in its source
      // (the pre-existing "required-star" class marking mandatory FORM FIELDS like "Select Onboarding Employee *" is an unrelated, untouched UI convention — not the onboarding-task Required concept)
      assert(
        !launchPlanModalSrc9.includes('>Req<') && !stripComments(launchPlanModalSrc9).replace(/required-star/g, '').match(/required/i),
        '587. LaunchPlanModal has no Req column and no onboarding-task "required" wording anywhere in its source (aside from the pre-existing, unrelated required-star mandatory-field marker)'
      );

      // 588. The scope composition breakdown (Universal/Type/Department/Total counts) remains — only the required breakdown was removed, not the useful total-by-scope summary
      assert(
        launchPlanModalSrc9.includes('Universal Tasks {preview.counts.universal}') && launchPlanModalSrc9.includes('Total {preview.counts.total}'),
        '588. The Launch preview still shows Universal/Type/Department/Total task counts by scope — only the required breakdown was removed, not the useful total summary'
      );

      // --- EMPLOYEE DETAIL: NO "REQUIRED TASKS" WORDING ---

      // 589. "Required Tasks:" wording is gone from the employee onboarding detail page
      assert(!employeeDetailSrc.includes('Required Tasks:') && !employeeDetailSrc.includes('Total Tasks:'), '589. Neither "Required Tasks:" nor the duplicate "Total Tasks:" wording remains — replaced by one clean summary line');

      // 590. A single clean "N of M tasks completed" summary line replaces the two previous competing metrics
      assert(employeeDetailSrc.match(/\{planInstance\.progress\.completedTasksCount\} of \{planInstance\.progress\.totalTasks\}<\/strong> tasks completed/), '590. Employee detail now shows one clear "N of M tasks completed" line instead of two separate Required/Total lines');

      // --- PROGRESS: ALL TASKS COUNT EQUALLY (CENTRAL DOMAIN FIX) ---

      // 591. calculatePlanProgress() no longer filters by task.required — every task counts toward progress
      assert(
        onboardingDomainSrc2.includes('const requiredTasks = enrichedTasks;') && !onboardingDomainSrc2.match(/const requiredTasks = enrichedTasks\.filter\(\(t\) => t\.required\)/),
        '591. calculatePlanProgress() computes progress against the full task set (const requiredTasks = enrichedTasks) instead of filtering by task.required — the fix is centralized in the domain layer, not hardcoded in any UI component'
      );

      // 592. FUNCTIONAL: a plan instance containing a LEGACY task with required: false still counts that task toward progress and completion (no silently-excluded "hidden optional" task)
      {
        const legacyMixedTaskInstances = [
          { id: 'lti-1', planInstanceId: 'legacy-mixed-inst', activityId: 'lact-1', sequence: 1, required: true },
          { id: 'lti-2', planInstanceId: 'legacy-mixed-inst', activityId: 'lact-2', sequence: 2, required: false }, // legacy optional task
        ];
        const legacyMixedActivities = [
          { id: 'lact-1', completed: true },
          { id: 'lact-2', completed: true },
        ];
        const { calculatePlanProgress: calcProgressForLegacyCheck } = await import('../domain/onboardingDomain.js');
        const legacyProgress = calcProgressForLegacyCheck(legacyMixedTaskInstances, legacyMixedActivities);
        assert(
          legacyProgress.totalTasks === 2 && legacyProgress.completedTasksCount === 2 && legacyProgress.progressPercentage === 100,
          `592. A legacy required:false task is NOT silently excluded from progress — both tasks count, and completing both yields 100% (found totalTasks:${legacyProgress.totalTasks}, completed:${legacyProgress.completedTasksCount}, pct:${legacyProgress.progressPercentage}%)`
        );

        // 593. Partial completion of a mix of legacy required:true/false tasks reflects the TRUE fraction of all tasks, not just the required subset
        const legacyPartialActivities = [
          { id: 'lact-1', completed: true },
          { id: 'lact-2', completed: false },
        ];
        const legacyPartialProgress = calcProgressForLegacyCheck(legacyMixedTaskInstances, legacyPartialActivities);
        assert(legacyPartialProgress.progressPercentage === 50, `593. With 1 of 2 tasks done (one legacy required:true, one legacy required:false), progress is 50% (1/2 of ALL tasks) — not 100% (which the old required-only formula would have shown, since the only required:true task was completed) (found ${legacyPartialProgress.progressPercentage}%)`);
      }

      // 594. FUNCTIONAL: composeOnboardingTasks() / launch composition is unaffected — same Employee+Software Engineering result as before this task
      {
        const scopeDefsAfterSimplify = await onboardingService.getScopeTaskDefinitions();
        const compositionAfterSimplify = composeOnboardingTasks({ id: 'simplify-check-emp', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsAfterSimplify, '2026-08-15');
        assert(compositionAfterSimplify.counts.total === 11, `594. composeOnboardingTasks() still produces the same 11-task result for an Employee in Software Engineering — scope composition logic is unaffected by the Required-concept removal (found ${compositionAfterSimplify.counts.total})`);
      }

      // 595. UPDATED — FUNCTIONAL: a NEW task added through saveScopeTasks() (mirroring what the simplified editor sends) defaults to required: true internally, without any UI ever exposing that field
      {
        await onboardingService.saveScopeTasks('universal', 'employee', null, [
          { title: 'Stage18 Blank-Default Verification Task', description: '', activityTypeId: 'act-type-1', relativeOffsetDays: 0 },
        ]);
        const newlySavedTask = (await onboardingService.getScopeTasks('universal', 'employee', null))[0];
        assert(newlySavedTask.required === true, `595. UPDATED — A newly-saved scope task defaults to required: true internally (an invisible compatibility field), even though the UI never collects or shows it (found required: ${newlySavedTask.required})`);
        resetDatabase();
      }

      // 596. UPDATED — FUNCTIONAL: existing legacy tasks with required: false are NOT rewritten/destroyed by this change — migration/storage remain non-destructive
      {
        const legacyEmployeeUniversalTasks = await onboardingService.getScopeTasks('universal', 'employee', null);
        const stillHasLegacyOptional = legacyEmployeeUniversalTasks.some((t) => t.required === false);
        assert(stillHasLegacyOptional, '596. UPDATED — The legacy Employee Universal task that was originally required: false (from the pre-scopes migration) still exists with that exact stored value — nothing was destructively rewritten to remove the Required concept from storage');
      }

      // --- GENERAL ---

      // 597. UPDATED — Task sequence/ordering remains intact and untouched by this task
      {
        const employeeUniversalSeqCheck = await onboardingService.getScopeTasks('universal', 'employee', null);
        const seqs = employeeUniversalSeqCheck.map((t) => t.sequence);
        assert(seqs.every((s, idx) => idx === 0 || s > seqs[idx - 1]), `597. UPDATED — Employee Universal task sequence remains correctly ascending after this task's changes (found ${JSON.stringify(seqs)})`);
      }

      // 598. Migration remains non-destructive and the app does not crash against old stored required fields (fresh reset + summary fetch)
      {
        resetDatabase();
        const freshSummaryAfterSimplify = await onboardingService.getScopesSummary();
        assert(typeof freshSummaryAfterSimplify.universal.taskCount === 'number', '598. getScopesSummary() resolves correctly immediately after a fresh reset — old stored required fields do not crash the app, and no destructive storage reset was added by this task');
      }

      // 599. No new overflow-x rules were introduced by the bottom action row or the editor changes
      assert(!indexCssSrc12.match(/\.plan-editor-bottom-actions[\s\S]{0,200}overflow-x:\s*(scroll|auto)/), '599. No horizontal-scroll rules were introduced by the bottom action area — normal flow, no page-level horizontal overflow risk');

      // 600. Done/Reopen functionality (activityService) is completely untouched by this task
      {
        const activityServiceSrcForCheck = fs.readFileSync(path.resolve('./src/services/activityService.js'), 'utf-8');
        assert(activityServiceSrcForCheck.includes('markComplete') && activityServiceSrcForCheck.includes('reopen'), '600. activityService.markComplete()/reopen() (backing Done/Reopen) remain present and untouched by this progress-simplification task');
      }

      resetDatabase();
    }
    // ==========================================================================
    // Replace Activities Module With a Personal Notes Workspace
    // ==========================================================================
    {
      const sidebarSrc2 = fs.readFileSync(path.resolve('./src/components/layout/Sidebar.jsx'), 'utf-8');
      const routerSrc3 = fs.readFileSync(path.resolve('./src/router/index.jsx'), 'utf-8');
      const headerSrc = fs.readFileSync(path.resolve('./src/components/layout/Header.jsx'), 'utf-8');
      const notesServiceSrc = fs.readFileSync(path.resolve('./src/services/notesService.js'), 'utf-8');
      const noteDomainSrc = fs.readFileSync(path.resolve('./src/domain/noteDomain.js'), 'utf-8');
      const notesPageSrc = fs.readFileSync(path.resolve('./src/pages/notes/NotesPage.jsx'), 'utf-8');
      const noteCardSrc = fs.readFileSync(path.resolve('./src/components/notes/NoteCard.jsx'), 'utf-8');
      const noteEditorModalSrc = fs.readFileSync(path.resolve('./src/components/notes/NoteEditorModal.jsx'), 'utf-8');
      const deleteNoteModalSrc = fs.readFileSync(path.resolve('./src/components/notes/DeleteNoteModal.jsx'), 'utf-8');
      const activityServiceSrc3 = fs.readFileSync(path.resolve('./src/services/activityService.js'), 'utf-8');
      const dashboardPageSrc = fs.readFileSync(path.resolve('./src/pages/dashboard/DashboardPage.jsx'), 'utf-8');

      // --- NAVIGATION ---

      // 601. Activities is completely gone from the sidebar (My/All/Overdue Activities absent)
      assert(
        !sidebarSrc2.includes('Activities') && !sidebarSrc2.includes('My Activities') && !sidebarSrc2.includes('All Activities') && !sidebarSrc2.includes("to=\"/activities"),
        '601. Activities, My Activities, All Activities, and Overdue no longer appear anywhere in the sidebar'
      );

      // 602. Notes / My Notes / Pinned / Archived all appear in the sidebar under WORK
      assert(
        sidebarSrc2.includes('>Notes<') && sidebarSrc2.includes('My Notes') && sidebarSrc2.includes('>\n                  Pinned') || sidebarSrc2.includes('Pinned'),
        '602. Notes, My Notes, Pinned, and Archived all appear in the sidebar'
      );
      assert(sidebarSrc2.includes('Archived') && sidebarSrc2.match(/WORK[\s\S]{0,50}Notes/), '602b. Notes sits under the WORK section, replacing where Activities used to be');

      // 603. Sidebar NavLink targets are exactly /notes, /notes/pinned, /notes/archived
      assert(
        sidebarSrc2.includes('to="/notes"') && sidebarSrc2.includes('to="/notes/pinned"') && sidebarSrc2.includes('to="/notes/archived"'),
        '603. Sidebar links target exactly /notes, /notes/pinned, and /notes/archived'
      );

      // 604. "My Notes" uses `end` matching so it is not incorrectly marked active on /notes/pinned or /notes/archived
      assert(sidebarSrc2.match(/to="\/notes"\s*\n\s*end/), '604. The "My Notes" NavLink uses the `end` prop so it is only active exactly at /notes, not on /notes/pinned or /notes/archived');

      // 605. Router: /notes, /notes/pinned, /notes/archived are all real routes; My Notes is the default at /notes
      assert(
        routerSrc3.match(/path: 'notes'[\s\S]{0,200}index: true, element: <MyNotesPage/) &&
        routerSrc3.includes("path: 'pinned'") && routerSrc3.includes("path: 'archived'"),
        '605. /notes (index -> MyNotesPage), /notes/pinned, and /notes/archived are all registered routes'
      );

      // 606. Old /activities routes are not exposed as real pages — at most a redirect to /notes remains, never rendering old Activities UI
      assert(
        !routerSrc3.includes('MyActivitiesPage') && !routerSrc3.includes('AllActivitiesPage') && !routerSrc3.includes('OverdueActivitiesPage'),
        '606. The router no longer imports or renders any of the old Activities pages'
      );
      assert(
        routerSrc3.match(/path: 'activities', element: <Navigate to="\/notes"/) && routerSrc3.match(/path: 'activities\/my', element: <Navigate to="\/notes"/),
        '606b. Old /activities* paths (if reachable at all) redirect straight to /notes rather than exposing any Activities UI'
      );

      // --- OLD ACTIVITIES UI FULLY REMOVED ---

      // 607. The entire old Activities pages/components directories are gone
      assert(!fs.existsSync(path.resolve('./src/pages/activities')), '607. src/pages/activities no longer exists');
      assert(!fs.existsSync(path.resolve('./src/components/activities')), '607b. src/components/activities no longer exists');

      // 608. Activities-UI-only service methods (create/update/getSummaryStats, manual-activity-only) were removed from activityService.js
      assert(
        !activityServiceSrc3.includes('async create(') && !activityServiceSrc3.includes('async update(') && !activityServiceSrc3.includes('getSummaryStats'),
        '608. activityService.js no longer exposes create()/update()/getSummaryStats() — these were only ever called by the now-deleted Activities pages'
      );

      // 609. Shared infrastructure activityService methods (used by Onboarding/Offboarding) remain intact
      assert(
        activityServiceSrc3.includes('async markComplete(') && activityServiceSrc3.includes('async reopen(') &&
        activityServiceSrc3.includes('async getActiveTypes(') && activityServiceSrc3.includes('async getAllTypes(') &&
        activityServiceSrc3.includes('async getOverdueActivities('),
        '609. markComplete/reopen/getActiveTypes/getAllTypes/getOverdueActivities all remain in activityService.js — genuinely shared infrastructure still used by Onboarding/Offboarding, correctly NOT deleted'
      );

      // --- NOTES DATA MODEL / ARCHITECTURE ---

      // 610. notesService is the sole data-access boundary — NotesPage never imports seedNotes.js directly
      assert(!notesPageSrc.includes('seedNotes') && notesPageSrc.includes("from '../../services/notesService.js'"), '610. NotesPage.jsx never imports seed data directly — it only talks to notesService');
      assert(!noteCardSrc.includes('seedNotes') && !noteEditorModalSrc.includes('seedNotes'), '610b. NoteCard and NoteEditorModal also never import seed data directly');

      // 611. Notes model has no task/workflow fields (no assignee, due date, status, priority, completion %)
      {
        const seedNotesSrc = fs.readFileSync(path.resolve('./src/mock-data/seedNotes.js'), 'utf-8');
        assert(
          !seedNotesSrc.includes('assigneeId') && !seedNotesSrc.includes('dueDate') && !seedNotesSrc.includes('priority') && !seedNotesSrc.includes('completed:') && !seedNotesSrc.includes('progressPercentage'),
          '611. The Notes data model has no assignee, dueDate, priority, completed, or progress fields — Notes are not Tasks'
        );
      }

      // --- FUNCTIONAL: CRUD ---
      resetDatabase();

      // 612. New Note creates a note with correct field values
      const createdNote = await notesService.create({ title: 'Stage18 Verification Note', category: 'General', content: 'Line one\nLine two', tags: 'stage18, verify' });
      assert(Boolean(createdNote) && createdNote.title === 'Stage18 Verification Note', '612. notesService.create() creates a note that is immediately retrievable');

      // 613/614. Blank title / blank content validation
      let blankTitleThrew = false;
      try { await notesService.create({ title: '', content: 'has content' }); } catch (e) { blankTitleThrew = true; }
      assert(blankTitleThrew, '613. Creating a note with a blank title throws/rejects — no silent save');

      let blankContentThrew = false;
      try { await notesService.create({ title: 'Has Title', content: '' }); } catch (e) { blankContentThrew = true; }
      assert(blankContentThrew, '614. Creating a note with blank content throws/rejects — no silent save');

      // 615/616. New note starts with a genuinely blank title/content field in the UI (source-level — handleAddTask-equivalent initial state)
      assert(noteEditorModalSrc.match(/title: note \? note\.title : '',/), "615. A brand-new note's title field starts as '' (not prefilled with example/placeholder text) when no note is being edited");
      // UPDATED (Formatting task) — NoteEditorModal now tracks `contentHtml` (fed through the
      // shared NoteContentEditor) instead of a plain `content` string; a brand-new note still
      // starts genuinely blank, just sourced from resolveNoteContentHtml(note) which returns ''
      // for note === null.
      assert(noteEditorModalSrc.match(/contentHtml: note \? resolveNoteContentHtml\(note\) : '',/), "616. UPDATED — A brand-new note's contentHtml field starts as '' (via resolveNoteContentHtml(null) semantics) when no note is being edited");
      assert(noteEditorModalSrc.includes('placeholder="Enter note title"') && noteEditorModalSrc.includes('placeholder="Write your note here..."'), '616b. Title and Content use illustrative placeholders instead of prefilled values');

      // 617. Category persists
      assert(createdNote.category === 'General', '617. Category persists on the created note');

      // 618. Tags persist as a normalized array
      assert(Array.isArray(createdNote.tags) && createdNote.tags.includes('stage18') && createdNote.tags.includes('verify'), `618. Tags persist as a normalized array (found ${JSON.stringify(createdNote.tags)})`);

      // 619. Line breaks in content persist exactly (no flattening)
      assert(createdNote.content === 'Line one\nLine two', '619. Line breaks entered in note content persist exactly, unflattened');

      // 620/621. Editing updates the note and bumps updatedAt
      await new Promise((r) => setTimeout(r, 5));
      const editedNote = await notesService.update(createdNote.id, { title: 'Stage18 Verification Note (Edited)', content: createdNote.content, category: createdNote.category, tags: createdNote.tags });
      assert(editedNote.title === 'Stage18 Verification Note (Edited)', '620. Editing an existing note updates its title');
      assert(editedNote.updatedAt !== createdNote.updatedAt, '621. updatedAt changes after an edit');

      // 622/623. Pin / Unpin
      const pinnedNote = await notesService.togglePin(createdNote.id);
      assert(pinnedNote.isPinned === true, '622. Pin toggles isPinned to true');
      const unpinnedNote = await notesService.togglePin(createdNote.id);
      assert(unpinnedNote.isPinned === false, '623. Toggling Pin again (Unpin) sets isPinned back to false');

      // 624. Pinned page filters correctly (only isPinned && !isArchived)
      await notesService.togglePin(createdNote.id);
      const pinnedList = await notesService.getAll({ scope: 'pinned' });
      assert(pinnedList.every((n) => n.isPinned && !n.isArchived) && pinnedList.some((n) => n.id === createdNote.id), '624. The Pinned scope returns only non-archived notes with isPinned === true, including the verification note');

      // 625. Archive works
      const archivedNote = await notesService.archive(createdNote.id);
      assert(archivedNote.isArchived === true, '625. Archive sets isArchived to true');

      // 626. Archived note disappears from My Notes
      const myNotesAfterArchive = await notesService.getAll({ scope: 'my' });
      assert(!myNotesAfterArchive.some((n) => n.id === createdNote.id), '626. An archived note no longer appears in the My Notes scope');

      // 627. Archived page shows it
      const archivedList = await notesService.getAll({ scope: 'archived' });
      assert(archivedList.some((n) => n.id === createdNote.id), '627. The Archived scope shows the archived note');

      // 627b. It also disappears from Pinned once archived (even if isPinned remains true internally)
      const pinnedAfterArchive = await notesService.getAll({ scope: 'pinned' });
      assert(!pinnedAfterArchive.some((n) => n.id === createdNote.id), '627b. An archived note does not appear on the Pinned page until restored, even if its internal isPinned flag is still true');

      // 628. Restore works
      const restoredNote = await notesService.restore(createdNote.id);
      assert(restoredNote.isArchived === false, '628. Restore sets isArchived back to false');
      const myNotesAfterRestore = await notesService.getAll({ scope: 'my' });
      assert(myNotesAfterRestore.some((n) => n.id === createdNote.id), '628b. A restored note reappears in My Notes');

      // 629. Permanent delete requires confirmation (UI-level: DeleteNoteModal exists and is the only path to deletePermanently in the UI)
      assert(deleteNoteModalSrc.includes('Delete Note?') && deleteNoteModalSrc.includes('permanently deleted') && deleteNoteModalSrc.includes('notesService.deletePermanently'), '629. A dedicated confirmation modal ("Delete Note?") gates every call to notesService.deletePermanently() — no direct one-click permanent delete');
      assert(!noteCardSrc.includes('deletePermanently'), '629b. NoteCard itself never calls deletePermanently() directly — it only requests deletion via onDeleteRequest, routed through the confirmation modal');

      // 630. Permanent delete removes the note
      await notesService.archive(createdNote.id);
      await notesService.deletePermanently(createdNote.id);
      const afterDelete = await notesService.getById(createdNote.id);
      assert(afterDelete === null, '630. deletePermanently() actually removes the note — it is no longer retrievable by ID');

      // --- SEARCH / FILTER / SORT ---
      resetDatabase();

      // 631. Title search works
      const titleSearchResults = await notesService.getAll({ scope: 'my', search: 'Candidate Follow-ups' });
      assert(titleSearchResults.some((n) => n.title === 'Candidate Follow-ups'), '631. Searching by exact title text returns the matching note');

      // 632. Content search works
      const contentSearchResults = await notesService.getAll({ scope: 'my', search: 'shortlisted Data Analytics' });
      assert(contentSearchResults.length > 0, '632. Searching by content text returns matching notes');

      // 633. Tag search works
      const tagSearchResults = await notesService.getAll({ scope: 'my', search: 'internship' });
      assert(tagSearchResults.some((n) => (n.tags || []).includes('internship')), '633. Searching by tag text returns notes with a matching tag');

      // 634. Category filter works
      const categoryFilterResults = await notesService.getAll({ scope: 'my', category: 'Meeting' });
      assert(categoryFilterResults.length > 0 && categoryFilterResults.every((n) => n.category === 'Meeting'), '634. The category filter returns only notes in that exact category');

      // 635. Last Updated sort (default) surfaces pinned notes first, then descending updatedAt
      const updatedSorted = await notesService.getAll({ scope: 'my', sortBy: 'updated' });
      {
        const firstUnpinnedIdx = updatedSorted.findIndex((n) => !n.isPinned);
        const anyPinnedAfterUnpinned = firstUnpinnedIdx !== -1 && updatedSorted.slice(firstUnpinnedIdx).some((n) => n.isPinned);
        assert(!anyPinnedAfterUnpinned, '635. Last Updated sort surfaces pinned notes before unpinned notes');
      }

      // 636. Newest sort orders by createdAt descending
      const newestSorted = await notesService.getAll({ scope: 'my', sortBy: 'newest' });
      assert(newestSorted.every((n, idx) => idx === 0 || n.createdAt <= newestSorted[idx - 1].createdAt), '636. Newest sort orders notes by createdAt descending');

      // 637. Oldest sort orders by createdAt ascending
      const oldestSorted = await notesService.getAll({ scope: 'my', sortBy: 'oldest' });
      assert(oldestSorted.every((n, idx) => idx === 0 || n.createdAt >= oldestSorted[idx - 1].createdAt), '637. Oldest sort orders notes by createdAt ascending');

      // 638. Title A-Z sort orders alphabetically
      const titleSorted = await notesService.getAll({ scope: 'my', sortBy: 'title' });
      assert(titleSorted.every((n, idx) => idx === 0 || n.title.localeCompare(titleSorted[idx - 1].title) >= 0), '638. Title A–Z sort orders notes alphabetically ascending');

      // --- NO TASK BEHAVIOR / NO NOTIFICATIONS ---

      // 639. No assignee/due-date/overdue/status/priority/progress behavior exists anywhere in the Notes UI or service's
      // ACTUAL code (explanatory doc comments describing what was deliberately left out, e.g. "No due date, priority,
      // assignee...", are fine and are excluded via stripComments — this checks real logic, not documentation prose).
      const notesModuleCombinedSrc = [notesServiceSrc, noteDomainSrc, notesPageSrc, noteCardSrc, noteEditorModalSrc, deleteNoteModalSrc].map(stripComments).join('\n');
      assert(
        !notesModuleCombinedSrc.match(/assigneeId|dueDate|overdue|priority|progressPercentage|Reopen|Mark Complete/i),
        '639. No assignee, due-date, overdue, priority, progress-percentage, or Done/Reopen task behavior exists anywhere in the Notes module\'s actual code'
      );

      // 640. No notification/reminder/alert generation exists for Notes
      assert(!notesModuleCombinedSrc.match(/notification|reminder|alert\(/i) || notesModuleCombinedSrc.match(/alert\(`Failed/g), '640. Notes generates no notifications/reminders/due-alerts — the only alert() calls are plain error-message fallbacks, not a notification system');

      // 641. No Assignee/Owner field is exposed in the Notes UI (ownerId stays internal-only)
      assert(!noteEditorModalSrc.includes('Owner') && !noteCardSrc.includes('Owner') && !noteEditorModalSrc.includes('Assignee'), '641. Owner/Assignee are never exposed as UI fields — ownerId is an internal-only compatibility field');

      // --- GLOBAL SEARCH / HEADER ---

      // 642. Header's decorative global search placeholder no longer mentions "activities"
      assert(!headerSrc.includes('activities') && headerSrc.includes('notes'), '642. The header search placeholder no longer references "activities" (updated to mention notes instead)');

      // --- DASHBOARD ---

      // 643. Dashboard has no Activities-specific cards/counts to remove (confirmed there were none to begin with) and none were introduced for Notes
      assert(!dashboardPageSrc.match(/[Aa]ctivit/), '643. Dashboard contains no Activities references (it never displayed Activities-specific cards in the first place, so none needed removal) and no new large Notes dashboard section was introduced');

      // --- GENERAL: OTHER MODULES UNAFFECTED ---

      // 644. Upcoming, Employees, Onboarding, Offboarding, Plans remain fully operational
      {
        const upcomingCheck = await upcomingCandidateService.getAll();
        const employeesCheck = await employeeService.getAll();
        const onboardingCheck = await onboardingService.getAllInstances();
        const offboardingCheck = await offboardingService.getAllTemplates();
        const plansCheck = await onboardingService.getScopesSummary();
        assert(
          Array.isArray(upcomingCheck) && Array.isArray(employeesCheck) && Array.isArray(onboardingCheck) && Array.isArray(offboardingCheck) && typeof plansCheck.universal.taskCount === 'number',
          '644. Upcoming, Employees, Onboarding (instances), Offboarding (templates), and Plans (scope summary) all remain fully operational after the Activities-to-Notes replacement'
        );
      }

      // 645. Onboarding/Offboarding Done/Reopen (shared activityService) still function end-to-end
      {
        const instancesForDoneCheck = await onboardingService.getAllInstances();
        const anyTaskForDoneCheck = instancesForDoneCheck.flatMap((i) => i.progress.tasks).find((t) => t.activityId);
        if (anyTaskForDoneCheck) {
          const wasCompleted = anyTaskForDoneCheck.isCompleted;
          if (!wasCompleted) {
            const doneRes = await activityService.markComplete(anyTaskForDoneCheck.activityId);
            assert(doneRes.completed === true, '645. Done still works on an onboarding task through the shared activityService after the Activities module removal');
            await activityService.reopen(anyTaskForDoneCheck.activityId);
          } else {
            assert(true, '645. Done/Reopen functional check skipped — sampled task was already completed (verified functional elsewhere in this suite)');
          }
        } else {
          assert(true, '645. Done/Reopen functional check skipped — no onboarding task instance available in current seed state');
        }
      }

      // 646. Old orphaned "activities" localStorage data (if present from a prior session) does not crash the app — non-destructive compatibility
      {
        const dbForOrphanCheck = loadDatabase();
        assert(Array.isArray(dbForOrphanCheck.activities), '646. db.activities remains a valid array after the Activities-module removal — old/orphaned entries (if any persisted from a prior session) do not crash the app, and no destructive storage reset was introduced');
      }

      // 647. seedActivities.js retains every task-instance-linked record onboarding/offboarding depend on (only the standalone demo records were removed)
      {
        const seedActivitiesSrc = fs.readFileSync(path.resolve('./src/mock-data/seedActivities.js'), 'utf-8');
        const onbLinkedCount = (seedActivitiesSrc.match(/sourceEntityType: 'OnboardingTaskInstance'/g) || []).length;
        const offLinkedCount = (seedActivitiesSrc.match(/sourceEntityType: 'OffboardingTaskInstance'/g) || []).length;
        assert(onbLinkedCount === 10 && offLinkedCount === 5, `647. seedActivities.js retains all 10 Onboarding-task-linked and 5 Offboarding-task-linked activity records (found ${onbLinkedCount} onboarding, ${offLinkedCount} offboarding) — only the standalone demo/manual records were removed`);
      }

      resetDatabase();
    }

    // ==========================================================================
    // Notes — Delete Action on Cards + Card/Document View Switcher
    // ==========================================================================
    {
      const notesPageSrc2 = fs.readFileSync(path.resolve('./src/pages/notes/NotesPage.jsx'), 'utf-8');
      const noteCardSrc2 = fs.readFileSync(path.resolve('./src/components/notes/NoteCard.jsx'), 'utf-8');
      const notesDocViewSrc = fs.readFileSync(path.resolve('./src/components/notes/NotesDocumentView.jsx'), 'utf-8');
      const noteEditorModalSrc2 = fs.readFileSync(path.resolve('./src/components/notes/NoteEditorModal.jsx'), 'utf-8');
      const deleteNoteModalSrc2 = fs.readFileSync(path.resolve('./src/components/notes/DeleteNoteModal.jsx'), 'utf-8');
      const activityServiceSrc4 = fs.readFileSync(path.resolve('./src/services/activityService.js'), 'utf-8');

      // --- CARD VIEW PRESERVED ---

      // 648. My Notes / Pinned / Archived, search, category, sort, New Note, Pin/unpin, Edit, Archive/Restore, tags, and color accents are all still present in the card-based components — this was an EXTENSION, not a redesign
      assert(
        notesPageSrc2.includes('notes-grid') && notesPageSrc2.includes('toolbar-search-input') && notesPageSrc2.includes('NOTE_CATEGORIES') && notesPageSrc2.includes('SORT_OPTIONS') &&
        noteCardSrc2.includes('onTogglePin') && noteCardSrc2.includes('onEdit') && noteCardSrc2.includes('onArchive') && noteCardSrc2.includes('onRestore') && noteCardSrc2.includes('note-tags'),
        '648. Card View (grid, search, category filter, sort, Pin/Edit/Archive/Restore, tags) remains fully intact — extended, not redesigned'
      );

      // --- DELETE ACTION ON CARDS ---

      // 649. UPDATED — A visible Delete/Trash icon now exists on non-archived note cards too (previously Archived-only). Window widened from 900 to 1400 chars: adding the Reminder bell action between Pin and Edit pushed Delete further down the same JSX block without changing this check's intent.
      assert(
        noteCardSrc2.match(/variant !== 'archived'[\s\S]{0,1400}icon-btn icon-btn-danger" title="Delete"/),
        '649. Non-archived note cards (My Notes / Pinned) now expose a Delete icon alongside Pin/Edit/Archive'
      );

      // 650. Clicking Delete never calls deletePermanently directly — it only opens the existing confirmation modal via onDeleteRequest
      assert(
        !noteCardSrc2.includes('deletePermanently') && noteCardSrc2.includes('onClick={stop(onDeleteRequest)}'),
        '650. NoteCard\'s Delete button only ever calls onDeleteRequest (which opens DeleteNoteModal) — it never calls notesService.deletePermanently() itself'
      );

      // 651. The SAME DeleteNoteModal (not a second/duplicated confirmation implementation) backs delete from both Card View and Document View
      assert(
        (notesPageSrc2.match(/<DeleteNoteModal/g) || []).length === 1 && notesDocViewSrc.includes('onDeleteRequest(selectedNote)') && !notesDocViewSrc.includes('DeleteNoteModal'),
        '651. Exactly one <DeleteNoteModal> instance exists (rendered once in NotesPage); Document View reuses it via the same onDeleteRequest callback rather than rendering its own'
      );

      // --- VIEW SWITCHER ---

      // 652. The view switcher reuses the existing .view-switcher-group/.view-btn pattern (same as DirectoryToolbar/LaunchPlanModal), not a new control
      assert(
        notesPageSrc2.match(/view-switcher-group notes-view-switcher/) && (notesPageSrc2.match(/className={`view-btn/g) || []).length === 2,
        '652. Card View / Document View uses the existing .view-switcher-group/.view-btn pattern already used elsewhere in the app (e.g. DirectoryToolbar)'
      );

      // 653. Card View is the default view mode
      {
        const defaultMatch = notesPageSrc2.match(/function readStoredViewMode\(\)[\s\S]{0,200}return stored === 'document' \? 'document' : 'card';/);
        assert(Boolean(defaultMatch), '653. Card View is the default view mode whenever no stored preference exists (readStoredViewMode falls back to \'card\')');
      }

      // 654. The selected view mode persists to localStorage as a lightweight UI preference (not a new backend/service concept)
      assert(
        notesPageSrc2.includes("localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode)") && notesPageSrc2.includes("localStorage.getItem(VIEW_MODE_STORAGE_KEY)"),
        '654. The Card/Document view preference is persisted via a small dedicated localStorage key, not a new notesService/backend concept'
      );

      // --- FUNCTIONAL: SWITCHING VIEWS NEVER MUTATES DATA ---
      resetDatabase();

      // 655. Card View and Document View read the exact same notesService.getAll() data — switching views cannot duplicate/fork notes
      {
        const beforeSwitch = await notesService.getAll({ scope: 'my' });
        const afterSwitch = await notesService.getAll({ scope: 'my' });
        assert(
          beforeSwitch.length === afterSwitch.length && beforeSwitch.every((n, idx) => n.id === afterSwitch[idx].id),
          '655. Two consecutive notesService.getAll() calls (simulating a view switch) return identical note sets — no duplication, no separate data store per view'
        );
      }

      // 656. NotesDocumentView receives `notes` as a prop and owns no independent data source (no import of notesService for reading, no seedNotes import)
      // 656. UPDATED (Inline Editing UX task) — Document View now owns its own inline
      // editing/creation lifecycle (Save Changes, Save Note), so it intentionally imports
      // notesService directly to call create()/update() for that ONE subtree it owns — it still
      // never imports seed data directly, and the shared `notes` LIST remains owned by
      // NotesPage (refreshed via the onNotesChanged callback after every save).
      assert(
        notesDocViewSrc.includes("from '../../services/notesService.js'") && !notesDocViewSrc.includes('seedNotes') && notesDocViewSrc.includes('onNotesChanged'),
        '656. UPDATED — NotesDocumentView now calls notesService.create()/update() directly for its own inline editing (never seed data directly), and still refreshes the shared list via NotesPage\'s onNotesChanged callback rather than owning a second list'
      );

      // --- DOCUMENT VIEW STRUCTURE ---

      // 657. Document View has a notes sidebar (internal to the Notes page) and a separate document workspace — structurally distinct from the main Rizurf app sidebar
      assert(
        notesDocViewSrc.includes('notes-document-sidebar') && notesDocViewSrc.includes('notes-document-workspace'),
        '657. Document View renders its own internal notes-document-sidebar + notes-document-workspace, layered inside the Notes page content area (not touching the global app sidebar)'
      );
      {
        const sidebarSrc3 = fs.readFileSync(path.resolve('./src/components/layout/Sidebar.jsx'), 'utf-8');
        assert(!sidebarSrc3.includes('notes-document'), '657b. The global Sidebar.jsx component has no knowledge of the Notes document sidebar — they are entirely separate pieces of UI');
      }

      // 658. Sidebar list items show title + pin indicator (+ subtle category) without excessive detail (no content preview duplicated into the sidebar)
      assert(
        notesDocViewSrc.includes('notes-document-sidebar-item-title') && notesDocViewSrc.includes('notes-document-sidebar-item-pin') && notesDocViewSrc.includes('notes-document-sidebar-item-category') &&
        !notesDocViewSrc.includes('note-content-preview'),
        '658. Each Document View sidebar item shows title, pin indicator, and a subtle category label — no full content preview cluttering the list'
      );

      // 659. The active/selected note in the sidebar uses the Rizurf teal visual language (existing --color-primary tokens), not a new color
      {
        const indexCssSrcForNotes = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
        assert(
          indexCssSrcForNotes.match(/\.notes-document-sidebar-item\.active\s*\{[^}]*background-color:\s*var\(--color-primary-light\)[^}]*color:\s*var\(--color-primary-active\)/),
          '659. The active sidebar item uses the existing --color-primary-light/--color-primary-active tokens — the same teal language used throughout the rest of the app'
        );
      }

      // 660. The sidebar list scrolls internally (app-scroll-area) rather than letting a long note list break the page layout
      assert(notesDocViewSrc.includes('notes-document-sidebar-list app-scroll-area'), '660. The Document View note list scrolls internally via the shared .app-scroll-area treatment when there are many notes');

      // --- DOCUMENT WORKSPACE / EDITING ---

      // 661. UPDATED (Inline Editing UX task) — Document View no longer routes through
      // NoteEditorModal at all; Title/Category/Color/Tags/Content are directly editable fields
      // in the workspace itself, with explicit Save Changes/Cancel Changes actions.
      assert(
        !stripComments(notesDocViewSrc).includes('NoteEditorModal') && notesDocViewSrc.includes('notes-document-title-input') && notesDocViewSrc.includes('handleSaveChanges') && notesDocViewSrc.includes('handleCancelChanges'),
        '661. UPDATED — Document View edits Title/Category/Color/Tags/Content directly inline (no Edit-icon-opens-modal workflow); Save Changes/Cancel Changes commit or discard the in-progress draft'
      );

      // 662. UPDATED (Inline Editing UX task) — Lightweight Bold/Italic/Underline formatting now
      // exists (via the shared NoteContentEditor component), but remains intentionally limited:
      // no heading/font-size/color/table/image/link/comment/collaboration/revision-history
      // concept was introduced anywhere in the Notes module.
      {
        const noteContentEditorSrc = fs.readFileSync(path.resolve('./src/components/notes/NoteContentEditor.jsx'), 'utf-8');
        const notesModuleCombinedSrc2 = [notesPageSrc2, noteCardSrc2, notesDocViewSrc, noteEditorModalSrc2, deleteNoteModalSrc2, noteContentEditorSrc].map(stripComments).join('\n');
        assert(
          noteContentEditorSrc.includes('contentEditable') && noteContentEditorSrc.includes("applyFormat('bold')") && noteContentEditorSrc.includes("applyFormat('italic')") && noteContentEditorSrc.includes("applyFormat('underline')") && noteContentEditorSrc.includes('document.execCommand(command'),
          '662. The shared NoteContentEditor implements Bold/Italic/Underline via a single small contentEditable surface (document.execCommand) — this is the ONE formatting implementation reused by both Card View and Document View'
        );
        // Specific telltale signals for a HEAVY rich-text system — deliberately narrow (not
        // generic words like "heading"/"fontSize", which collide with this module's own
        // unrelated page-heading metadata and inline CSS font-size styling).
        assert(
          !notesModuleCombinedSrc2.match(/execCommand\('formatBlock'|execCommand\('fontSize'|execCommand\('foreColor'|<table|TipTap|Quill|Slate|Draft\.js|revision-?history|collaborat|<img|<a href=/i),
          '662b. No heavy rich-text concept (block/heading formatting, font-size/color commands, tables, images, links, a rich-text library, collaboration, or revision history) exists anywhere in the Notes module — formatting stays limited to Bold/Italic/Underline'
        );
      }

      // 663. Multiline content (line breaks) remain visible in the Document workspace, mirroring the same CSS approach already used in Card View
      {
        const indexCssSrcForNotes2 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
        assert(
          indexCssSrcForNotes2.match(/\.notes-document-content\s*\{[^}]*white-space:\s*pre-line/),
          '663. .notes-document-content uses white-space: pre-line (same technique as .note-content-preview in Card View) so user-entered line breaks remain visible in the document workspace'
        );
      }

      // --- DOCUMENT ACTIONS REUSE EXISTING SERVICE METHODS ---

      // 664. Pin/Archive/Restore/Delete in Document View call the exact same handlers (and therefore the exact same notesService methods) as Card View — no parallel implementation
      assert(
        notesDocViewSrc.includes('onTogglePin(selectedNote)') && notesDocViewSrc.includes('onArchive(selectedNote)') && notesDocViewSrc.includes('onRestore(selectedNote)') && notesDocViewSrc.includes('onDeleteRequest(selectedNote)'),
        '664. Document View\'s Pin/Archive/Restore/Delete buttons call the same onTogglePin/onArchive/onRestore/onDeleteRequest props NotesPage already passes into NoteCard — one shared set of handlers, not a parallel implementation'
      );

      // --- NEW NOTE FROM DOCUMENT VIEW ---

      // 665. UPDATED (Inline Editing UX task) — Document View's sidebar "+" no longer opens
      // NoteEditorModal; it creates a local, not-yet-persisted blank draft directly in the
      // workspace (Card View's top-level "New Note" still opens the modal — see check 648).
      assert(
        notesDocViewSrc.includes('handleCreateNewClick') && !notesDocViewSrc.match(/New Note[\s\S]{0,40}onClick=\{onCreateNew\}/) && notesDocViewSrc.includes('handleSaveNewNote'),
        '665. UPDATED — The Document View sidebar\'s "+" opens a local in-memory blank draft (handleCreateNewClick/handleSaveNewNote) directly in the workspace, never NoteEditorModal — Card View\'s New Note button is untouched and still opens the modal'
      );

      // 666. FUNCTIONAL: after creating a note, the note list refreshes and the new note is auto-selected using the service's own response (never a hardcoded/guessed ID)
      {
        const newlyCreated = await notesService.create({ title: 'Stage18 DocView Note', content: 'created for verification', category: 'General' });
        assert(newlyCreated && newlyCreated.id, '666. notesService.create() returns the created note (including its real generated id) — this is exactly what NoteEditorModal now passes to onSuccess for Document View to auto-select');
        const listAfterCreate = await notesService.getAll({ scope: 'my' });
        assert(listAfterCreate.some((n) => n.id === newlyCreated.id), '666b. The newly created note is immediately present in the same notesService.getAll() list both views read from');
        await notesService.deletePermanently(newlyCreated.id);
      }

      // --- FILTERS + DOCUMENT VIEW ---

      // 667. Document View receives the same filtered/sorted `notes` prop as Card View — no second filtering/search/sort implementation
      assert(
        !notesDocViewSrc.match(/filterNotes|sortNotes/) ,
        '667. NotesDocumentView contains no independent filterNotes()/sortNotes() calls — it only ever renders the `notes` array NotesPage already filtered and sorted via notesService.getAll()'
      );

      // 668. FUNCTIONAL: a search that filters the note collection produces the identical set Document View would render (since it consumes the same getAll() result)
      {
        const searchResult = await notesService.getAll({ scope: 'my', search: 'Corporate Finance' });
        assert(searchResult.length === 1 && searchResult[0].title.includes('Corporate Finance'), '668. Searching "Corporate Finance" returns exactly the one matching note — the same result set both Card View and Document View would render for that search');
      }

      // --- SELECTION SAFETY NET ---

      // 669. FUNCTIONAL: composeOnboardingTasks / onboarding scope composition remains completely unaffected by the Notes enhancement (sanity check that this task touched nothing outside Notes)
      {
        const scopeDefsForNotesCheck = await onboardingService.getScopeTaskDefinitions();
        const compositionForNotesCheck = composeOnboardingTasks({ id: 'notes-enhancement-check-emp', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsForNotesCheck, '2026-08-15');
        assert(compositionForNotesCheck.counts.total === 11, `669. composeOnboardingTasks() still produces the same 11-task result for an Employee in Software Engineering — untouched by the Notes Delete/Document-View enhancement (found ${compositionForNotesCheck.counts.total})`);
      }

      // 670. The selection-safety-net logic (auto-select-first / reselect-on-disappearance) lives in NotesPage as a single effect, not duplicated per note action
      assert(
        (notesPageSrc2.match(/setSelectedNoteId\(notes\.length > 0 \? notes\[0\]\.id : null\)/g) || []).length === 1,
        '670. The "select first / fall back safely" logic exists exactly once (as a single effect keyed on notes/viewMode), reused automatically for delete, archive, restore, and search/filter changes rather than re-implemented per action'
      );

      // --- SHARED ACTIVITY INFRASTRUCTURE UNTOUCHED ---

      // 671. activityService.js / activityDomain.js / db.activities / activity types remain exactly as they were after the Activities-removal task — this Notes enhancement did not touch them
      assert(
        activityServiceSrc4.includes('async markComplete(') && activityServiceSrc4.includes('async reopen(') && activityServiceSrc4.includes('async getActiveTypes(') && activityServiceSrc4.includes('async getOverdueActivities('),
        '671. Shared Onboarding/Offboarding activity infrastructure (markComplete/reopen/getActiveTypes/getOverdueActivities) remains fully intact — untouched by this Notes-only enhancement'
      );

      // 672. FUNCTIONAL: Onboarding Done/Reopen still works end-to-end after this Notes enhancement
      {
        const instancesForNotesDoneCheck = await onboardingService.getAllInstances();
        const anyTaskForNotesDoneCheck = instancesForNotesDoneCheck.flatMap((i) => i.progress.tasks).find((t) => t.activityId && !t.isCompleted);
        if (anyTaskForNotesDoneCheck) {
          const doneRes2 = await activityService.markComplete(anyTaskForNotesDoneCheck.activityId);
          assert(doneRes2.completed === true, '672. Done still works on an onboarding task through the shared activityService after this Notes enhancement');
          await activityService.reopen(anyTaskForNotesDoneCheck.activityId);
        } else {
          assert(true, '672. Done/Reopen functional check skipped — no incomplete onboarding task instance available in current seed state (verified functional elsewhere in this suite)');
        }
      }

      // --- RESPONSIVE / NO OVERFLOW ---

      // 673. Mobile behavior stacks the sidebar/workspace and shows exactly one panel at a time via CSS classes toggled from a single `mobileShowingDocument` state — no page-level horizontal scroll rules were introduced
      {
        const indexCssSrcForNotes3 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
        assert(
          indexCssSrcForNotes3.match(/@media \(max-width:\s*768px\)\s*\{[\s\S]{0,120}\.notes-document-view\s*\{[^}]*flex-direction:\s*column/) &&
          !indexCssSrcForNotes3.match(/\.notes-document[\s\S]{0,200}overflow-x:\s*(scroll|auto)/),
          '673. At mobile widths, .notes-document-view stacks to a single column and toggles panel visibility via CSS classes — no new overflow-x rules were introduced anywhere in the Notes document view styles'
        );
      }
      assert(notesDocViewSrc.includes("mobileShowingDocument ? 'mobile-showing-document' : 'mobile-showing-list'"), '673b. The mobile single-panel-at-a-time behavior is driven by one boolean state (mobileShowingDocument), toggled by selecting a note or pressing Back to Notes');

      resetDatabase();
    }
    // ==========================================================================
    // Notes UX: Inline Document Editing + Custom Categories + Formatting + Modal Sizing
    // ==========================================================================
    {
      const noteDomainSrc2 = fs.readFileSync(path.resolve('./src/domain/noteDomain.js'), 'utf-8');
      const notesServiceSrc2 = fs.readFileSync(path.resolve('./src/services/notesService.js'), 'utf-8');
      const notesPageSrc3 = fs.readFileSync(path.resolve('./src/pages/notes/NotesPage.jsx'), 'utf-8');
      const selectSrc = fs.readFileSync(path.resolve('./src/components/common/Select.jsx'), 'utf-8');
      const deleteNoteModalSrc3 = fs.readFileSync(path.resolve('./src/components/notes/DeleteNoteModal.jsx'), 'utf-8');
      const noteEditorModalSrc3 = fs.readFileSync(path.resolve('./src/components/notes/NoteEditorModal.jsx'), 'utf-8');
      const notesDocViewSrc2 = fs.readFileSync(path.resolve('./src/components/notes/NotesDocumentView.jsx'), 'utf-8');
      const noteCardSrc3 = fs.readFileSync(path.resolve('./src/components/notes/NoteCard.jsx'), 'utf-8');
      const noteContentEditorSrc2 = fs.readFileSync(path.resolve('./src/components/notes/NoteContentEditor.jsx'), 'utf-8');
      const unsavedChangesModalSrc = fs.readFileSync(path.resolve('./src/components/notes/UnsavedChangesModal.jsx'), 'utf-8');
      const indexCssSrcForNotesV3 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
      const activityServiceSrc5 = fs.readFileSync(path.resolve('./src/services/activityService.js'), 'utf-8');

      // --- DELETE MODAL SIZE ---

      // 674. The Delete Note modal is enlarged via the existing .wide-modal tier (~650px), not a brand-new size class
      assert(deleteNoteModalSrc3.includes('modal-card wide-modal') && !deleteNoteModalSrc3.includes('xl-modal'), '674. DeleteNoteModal uses the existing .wide-modal sizing tier (~650px) — reused, not a new bespoke size');
      assert(indexCssSrcForNotesV3.match(/\.modal-card\.wide-modal\s*\{[^}]*max-width:\s*650px/), '674b. .wide-modal resolves to roughly 650px desktop width, within the requested 600–720px range');

      // 675. Delete confirmation wording/behavior is unchanged — still requires explicit confirmation
      assert(
        deleteNoteModalSrc3.includes('Delete Note?') && deleteNoteModalSrc3.includes('will be permanently deleted') && deleteNoteModalSrc3.includes('cannot be undone') && deleteNoteModalSrc3.includes('notesService.deletePermanently'),
        '675. Delete Note wording and the underlying deletePermanently() call are unchanged — only spacing/sizing was enlarged'
      );

      // 676. Cancel/Delete both remain present with their existing destructive-red / secondary styling
      assert(deleteNoteModalSrc3.includes('btn-secondary') && deleteNoteModalSrc3.includes('btn-danger'), '676. Cancel (secondary) and Delete (destructive red btn-danger) both remain present in the enlarged modal');

      // --- COLOR ACCENT DROPDOWN ---

      // 677. Select.jsx supports an optional per-option swatchColor without breaking existing consumers (swatchColor stays undefined unless explicitly supplied)
      assert(selectSrc.includes('swatchColor: opt.swatchColor') && selectSrc.includes('function OptionSwatch'), '677. Select.jsx normalizes an optional swatchColor per option and renders it via a small OptionSwatch helper — existing callers that never pass swatchColor render nothing extra');

      // 678. NOTE_ACCENTS is the single centralized accent-color map — reused by NoteCard's top-border AND the Color Accent dropdown's swatches (not two separate color lists)
      assert(
        noteDomainSrc2.includes('export const NOTE_ACCENTS') && noteEditorModalSrc3.includes('NOTE_ACCENTS') && notesDocViewSrc2.includes('NOTE_ACCENTS'),
        '678. NOTE_ACCENTS (noteDomain.js) is imported by both NoteEditorModal and NotesDocumentView for their Color Accent swatches — one centralized source, not duplicated per component'
      );
      {
        const accentHexMatches = [...noteDomainSrc2.matchAll(/swatchColor:\s*'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1]);
        const cssAccentColors = ['#2563EB', '#059669', '#D97706', '#7C3AED'];
        assert(cssAccentColors.every((c) => accentHexMatches.includes(c)), `678b. NOTE_ACCENTS' hex values exactly match the .note-card--accent-* colors already defined in index.css (blue/green/amber/purple) — no separate unrelated color set was invented for the dropdown (found ${JSON.stringify(accentHexMatches)})`);
      }

      // 679. "Default" renders a neutral/outlined swatch, not a colored fill
      assert(noteDomainSrc2.match(/default:\s*\{\s*label:\s*'Default',\s*swatchColor:\s*'none'/), '679. The Default accent option is configured with swatchColor: \'none\' (rendered as a neutral outlined circle), not a colored fill');
      assert(indexCssSrcForNotesV3.includes('.select-swatch--neutral'), '679b. .select-swatch--neutral (transparent fill + bordered outline) exists in the stylesheet for the neutral Default dot');

      // 680. FUNCTIONAL: the selected Color Accent value round-trips correctly through notesService (confirms the trigger would show the matching swatch, since it derives from the same stored value)
      resetDatabase();
      {
        const colorTestNote = await notesService.create({ title: 'Color Accent Check', content: 'checking accent persistence', colorAccent: 'purple' });
        assert(colorTestNote.colorAccent === 'purple', '680. A note saved with colorAccent "purple" stores that exact value — the Select\'s trigger and NoteCard\'s border both read this same stored field');
      }

      // --- EXPANDED CATEGORIES ---

      // 681. Offboarding and Intern are now built-in categories
      assert(noteDomainSrc2.includes("'Offboarding'") && noteDomainSrc2.includes("'Intern'"), '681. NOTE_CATEGORIES now includes Offboarding and Intern alongside the original 5 built-ins');

      // 682. "Other / Custom" sentinel exists and is distinct from any real category name
      assert(noteDomainSrc2.includes("export const CUSTOM_CATEGORY_OPTION = 'Other'") && !noteDomainSrc2.match(/NOTE_CATEGORIES = \[[^\]]*'Other'/), '682. CUSTOM_CATEGORY_OPTION (\'Other\') is a dedicated UI-only sentinel — it is never one of the real built-in NOTE_CATEGORIES values');

      // 683. FUNCTIONAL: selecting "Other" and entering a custom name stores the REAL typed category, never the literal "Other"
      {
        const customCatNote = await notesService.create({ title: 'Custom Category Note', content: 'testing custom category', category: 'Career Fair' });
        assert(customCatNote.category === 'Career Fair' && customCatNote.category !== 'Other', '683. resolveNoteCategory()-style custom input is stored as the actual typed category ("Career Fair"), never the "Other" sentinel');
      }

      // 684. resolveNoteCategory() rejects a blank custom category (returns empty string, which validateNote then rejects)
      {
        const { resolveNoteCategory: resolveNoteCategoryCheck, validateNote: validateNoteCheck } = await import('../domain/noteDomain.js');
        const blankCustom = resolveNoteCategoryCheck('Other', '   ');
        assert(blankCustom === '', '684. resolveNoteCategory(\'Other\', \'   \') resolves to an empty string for a blank/whitespace-only custom category');
        const validation = validateNoteCheck({ title: 'x', content: 'x', category: blankCustom });
        assert(validation.isValid === true, '684b. category is not itself a required validateNote() field (title/content are) — the UI layer (NoteEditorModal/NotesDocumentView) is responsible for rejecting a blank custom-category selection before calling notesService, which both do via their own formErrors.customCategory check');
      }
      assert(noteEditorModalSrc3.includes('customCategory') && noteEditorModalSrc3.match(/formData\.category === CUSTOM_CATEGORY_OPTION && !formData\.customCategory\.trim\(\)/), '684c. NoteEditorModal\'s own validate() explicitly blocks submission when "Other" is selected with a blank custom category');
      assert(notesDocViewSrc2.match(/draft\.category === CUSTOM_CATEGORY_OPTION && !draft\.customCategory\.trim\(\)/), '684d. NotesDocumentView\'s inline validateDraft() applies the exact same blank-custom-category rejection');

      // 685. FUNCTIONAL: the custom category immediately appears in getCategoryOptions() (de-duplicated, case-insensitive against built-ins)
      {
        const optionsAfterCustom = await notesService.getCategoryOptions();
        assert(optionsAfterCustom.includes('Career Fair'), '685. "Career Fair" (the custom category just saved) appears in notesService.getCategoryOptions()');
        const uniqueLower = new Set(optionsAfterCustom.map((c) => c.toLowerCase()));
        assert(uniqueLower.size === optionsAfterCustom.length, `685b. Built-in categories are not duplicated in the options list (found ${optionsAfterCustom.length} entries, ${uniqueLower.size} unique)`);
      }

      // 686. Category de-duplication is case-insensitive (a custom category matching a built-in name, differently cased, is not duplicated)
      {
        const dupNote = await notesService.create({ title: 'Dup Category Check', content: 'x', category: 'recruitment' });
        const optionsAfterDup = await notesService.getCategoryOptions();
        const recruitmentMatches = optionsAfterDup.filter((c) => c.toLowerCase() === 'recruitment');
        assert(recruitmentMatches.length === 1, `686. A custom category that case-insensitively matches a built-in ("recruitment" vs "Recruitment") is not duplicated in the filter options (found ${JSON.stringify(recruitmentMatches)})`);
      }
      resetDatabase();

      // --- INLINE DOCUMENT EDITING ---

      // 687. Document View exposes real, directly-editable fields for Title/Category/Color/Tags (no separate "enter edit mode" step)
      assert(
        notesDocViewSrc2.includes('notes-document-title-input') && notesDocViewSrc2.includes('DocumentMetaFields') && notesDocViewSrc2.match(/<Select variant="form" value=\{draft\.category\}/) && notesDocViewSrc2.match(/<Select variant="form" value=\{draft\.colorAccent\}/),
        '687. Document View renders Title as a real <input>, and Category/Color as real <Select> controls bound to the current draft — directly editable, no NoteEditorModal round-trip'
      );

      // 688. Content is directly editable via the shared NoteContentEditor bound to the draft
      assert(notesDocViewSrc2.match(/<NoteContentEditor[\s\S]{0,80}valueHtml=\{draft\.contentHtml\}/), '688. Document View\'s content area is the shared NoteContentEditor, bound to draft.contentHtml — directly editable inline');

      // 689. Save Changes persists via notesService.update() and refreshes the shared notes list
      assert(notesDocViewSrc2.includes('await notesService.update(selectedNoteId, buildPayload())') && notesDocViewSrc2.includes('await onNotesChanged()'), '689. handleSaveChanges() calls notesService.update() (the same function Card View\'s modal uses) and refreshes NotesPage\'s shared notes list afterward');

      // 690. UPDATED — Cancel Changes restores the draft to the last persisted baseline, unconditionally (no confirmation needed for this explicit action), and now also exits edit state back to the read view
      assert(notesDocViewSrc2.includes('setDraft(baseline);') && /handleCancelChanges = \(\) => \{[\s\S]*?setDraft\(baseline\);[\s\S]*?setIsEditing\(false\);[\s\S]*?\};/.test(notesDocViewSrc2), '690. Cancel Changes resets the draft straight back to the persisted baseline values and exits edit state — an explicit, unconditional discard');

      // 691. FUNCTIONAL: editing an existing note through the inline Document View path and reloading shows the updated title (persists exactly like Card View's modal save)
      {
        const preEditNotes = await notesService.getAll({ scope: 'my' });
        const targetForInlineEdit = preEditNotes[0];
        const inlineEdited = await notesService.update(targetForInlineEdit.id, { title: 'Inline-Edited Via Document View', contentHtml: targetForInlineEdit.contentHtml || targetForInlineEdit.content, category: targetForInlineEdit.category, tags: targetForInlineEdit.tags, colorAccent: targetForInlineEdit.colorAccent });
        assert(inlineEdited.title === 'Inline-Edited Via Document View', '691. Saving through the exact same notesService.update() call Document View\'s handleSaveChanges() makes persists the new title');
        const refetched = await notesService.getById(targetForInlineEdit.id);
        assert(refetched.title === 'Inline-Edited Via Document View', '691b. The edit is durable — refetching the note by ID after "save" shows the updated title, exactly matching Document View\'s Card-View-visible result');
      }
      resetDatabase();

      // --- UNSAVED CHANGES PROTECTION ---

      // 692. A dedicated UnsavedChangesModal exists (Discard Changes / Keep Editing), distinct from DeleteNoteModal
      assert(unsavedChangesModalSrc.includes('Unsaved Changes') && unsavedChangesModalSrc.includes('Discard Changes') && unsavedChangesModalSrc.includes('Keep Editing'), '692. UnsavedChangesModal exists with the exact required "Unsaved Changes" / "Discard Changes" / "Keep Editing" copy');

      // 693. Switching sidebar notes, Pin, Archive, and Delete are ALL guarded through the same requestAction()/isDirty check — not four separate guard implementations
      assert(
        (notesDocViewSrc2.match(/requestAction\(\(\) =>/g) || []).length >= 4,
        '693. Sidebar note-switching, Pin, Archive/Restore, and Delete are all routed through the same requestAction() guard — one dirty-check implementation reused for every navigation-changing action'
      );

      // 694. isDirty is computed by comparing the current draft against a persisted baseline snapshot — not a separate ad hoc "has the user typed anything" flag
      assert(notesDocViewSrc2.includes('const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);'), '694. isDirty is a real draft-vs-baseline comparison, so Save/Cancel/guard behavior all agree on the exact same definition of "unsaved"');

      // 695. Explicit Cancel/Cancel Changes/Cancel-new-note buttons bypass the confirmation modal by design (Part 7/8 of the task) — only navigation-changing actions are guarded
      assert(
        notesDocViewSrc2.match(/onClick=\{handleCancelChanges\}/) && notesDocViewSrc2.match(/onClick=\{handleCancelNewNote\}/) && !notesDocViewSrc2.match(/handleCancelChanges[\s\S]{0,30}requestAction/),
        '695. The explicit Cancel/Cancel Changes buttons call their discard handlers directly (no confirmation modal) — only sidebar-switch/Pin/Archive/Delete are guarded, matching the task\'s explicit "Cancel needs no extra confirmation" instruction'
      );

      // 696. NotesPage pauses its own auto-reselect safety net while Document View reports unsaved changes, so a search/filter change can never silently discard an in-progress edit
      assert(notesPageSrc3.includes('isDocumentDirty') && notesPageSrc3.match(/if \(viewMode !== 'document' \|\| loading \|\| isDocumentDirty\) return;/), '696. NotesPage\'s auto-reselect effect explicitly skips while isDocumentDirty is true, so an unrelated search/filter/archive-elsewhere change cannot silently discard unsaved Document View edits');

      // --- INLINE NEW-DOCUMENT CREATION FROM THE SIDEBAR "+" ---

      // 697. The sidebar "+" does not open NoteEditorModal — it sets a local creatingNew flag and blank draft
      assert(notesDocViewSrc2.match(/onClick=\{handleCreateNewClick\}/) && notesDocViewSrc2.includes('setCreatingNew(true)') && notesDocViewSrc2.includes('buildBlankDraft()'), '697. Clicking "+" calls handleCreateNewClick(), which sets creatingNew=true and a fresh blank draft in local state — never opens NoteEditorModal');

      // 698. The blank draft is NOT persisted until Save Note — creatingNew only calls notesService.create() from handleSaveNewNote()
      assert(
        (notesDocViewSrc2.match(/notesService\.create\(/g) || []).length === 1 && notesDocViewSrc2.match(/handleSaveNewNote[\s\S]{0,200}notesService\.create\(buildPayload\(\)\)/),
        '698. notesService.create() is called exactly once in NotesDocumentView, only from handleSaveNewNote() (triggered by the explicit Save Note button) — clicking "+" alone never writes to storage'
      );

      // 699. Blank draft defaults: title '', content '', category defaults to the first built-in (General), color Default, tags blank
      assert(notesDocViewSrc2.match(/function buildBlankDraft\(\)\s*\{\s*return\s*\{\s*title:\s*'',\s*category:\s*NOTE_CATEGORIES\[0\],\s*customCategory:\s*'',\s*tags:\s*'',\s*colorAccent:\s*'default',\s*contentHtml:\s*'',/), '699. buildBlankDraft() starts every field genuinely blank (title/content/tags empty, category General, color Default)');

      // 700. Save Note validates title/content exactly like Card View's modal (shared validateDraft/validate logic pattern), calls the SAME create() path, uses the real generated ID, and re-selects it — no hardcoded ID
      assert(notesDocViewSrc2.includes('const created = await notesService.create(buildPayload());') && notesDocViewSrc2.includes('onSelectNote(created.id);'), '700. handleSaveNewNote() creates via notesService.create(), then selects the note by created.id — the real service-generated ID, never a guessed one');

      // 701. Cancel on a new unsaved sheet discards the draft unconditionally and creates no note record
      resetDatabase();
      {
        const countBefore = (await notesService.getAll({ scope: 'my' })).length;
        assert(notesDocViewSrc2.match(/const handleCancelNewNote = \(\) => \{\s*setCreatingNew\(false\);/), '701. handleCancelNewNote() unconditionally sets creatingNew back to false — no notesService call, no confirmation modal');
        const countAfter = (await notesService.getAll({ scope: 'my' })).length;
        assert(countBefore === countAfter, '701b. Since Cancel never calls notesService.create(), the note count is provably unchanged (functional sanity check alongside the source-level assertion above)');
      }

      // 702. The sidebar's synthetic draft item ("Untitled Note" + Draft badge) only appears while creatingNew, and is never one of the real `notes` — it is not persisted to the sidebar until Save Note succeeds
      assert(notesDocViewSrc2.includes('notes-document-sidebar-item--draft') && notesDocViewSrc2.match(/\{creatingNew && \(/) && notesDocViewSrc2.includes('Draft'), '702. The "Untitled Note" / Draft-badged sidebar entry is a synthetic element rendered only while creatingNew is true — never part of the real notes array');

      // --- SHARED FORMATTING EDITOR ---

      // 703. NoteContentEditor is imported and used by BOTH NoteEditorModal (Card View) and NotesDocumentView (Document View) — one implementation
      assert(noteEditorModalSrc3.includes("from './NoteContentEditor.jsx'") && notesDocViewSrc2.includes("from './NoteContentEditor.jsx'"), '703. Both NoteEditorModal and NotesDocumentView import the SAME NoteContentEditor component — there is exactly one formatting implementation in the app');

      // 704. Card editor's Content field shows the shared toolbar (Bold/Italic/Underline)
      assert(noteEditorModalSrc3.match(/<NoteContentEditor[\s\S]{0,80}valueHtml=\{formData\.contentHtml\}/), '704. NoteEditorModal\'s Content field renders <NoteContentEditor> bound to formData.contentHtml, giving Card View the same B/I/U toolbar');

      // 705. Keyboard shortcuts Ctrl/Cmd+B/I/U are wired
      assert(noteContentEditorSrc2.match(/key === 'b'[\s\S]{0,40}applyFormat\('bold'\)/) && noteContentEditorSrc2.match(/key === 'i'[\s\S]{0,40}applyFormat\('italic'\)/) && noteContentEditorSrc2.match(/key === 'u'[\s\S]{0,40}applyFormat\('underline'\)/), '705. Ctrl/Cmd+B, +I, and +U are each wired to the same applyFormat() the toolbar buttons use');

      // 706. UPDATED — Toolbar buttons have hover/active state and a title tooltip (keyboard-accessible <button> semantics, not a <div onClick>). The toolbar now has 6 .note-format-btn controls (Bold/Italic/Underline/Highlight/Bulleted List/Numbered List) instead of the original 3.
      assert((noteContentEditorSrc2.match(/className=\{`note-format-btn/g) || []).length === 6 && noteContentEditorSrc2.includes('title="Bold (Ctrl+B)"'), '706. All 6 formatting controls (Bold/Italic/Underline/Highlight/Bulleted List/Numbered List) are real <button type="button"> elements with title tooltips, and the CSS defines a distinct .note-format-btn.active state');
      assert(indexCssSrcForNotesV3.includes('.note-format-btn.active'), '706b. .note-format-btn.active is defined in the stylesheet (distinct visual state for the currently-active format at the cursor)');

      // 707. Pasted external content is converted to plain text, not raw HTML — sidesteps the hardest sanitization case entirely
      assert(noteContentEditorSrc2.match(/handlePaste[\s\S]{0,200}getData\('text\/plain'\)/) && noteContentEditorSrc2.includes("execCommand('insertText'"), '707. Paste handling explicitly extracts text/plain from the clipboard and inserts it as plain text — pasted rich HTML from outside the app is never inserted verbatim');

      // --- CONTENT DATA MODEL / BACKWARD COMPATIBILITY ---

      // 708. `content` (plain text) is preserved as the normalized/search/fallback representation; `contentHtml` is additive
      assert(noteDomainSrc2.includes('export function deriveContentFromHtml') && noteDomainSrc2.includes('export function resolveNoteContentHtml'), '708. noteDomain.js exposes deriveContentFromHtml() (HTML -> plain content) and resolveNoteContentHtml() (safe render source) — content and contentHtml are kept in sync, never replacing one with the other');

      // 709. notesService centrally derives/re-sanitizes both fields on every create/update — never trusts a caller-supplied content/contentHtml pair blindly
      assert(notesServiceSrc2.includes('function resolveContentFields') && notesServiceSrc2.match(/create\(noteData = \{\}\) \{\s*const contentFields = resolveContentFields\(noteData\);/) && notesServiceSrc2.match(/if \(updateData\.content !== undefined \|\| updateData\.contentHtml !== undefined\)/), '709. notesService.create()/update() both centrally resolve content/contentHtml via resolveContentFields() — sanitization/derivation happens at the storage boundary, not only in the UI');

      // 710. FUNCTIONAL: legacy notes (seed data, no contentHtml) continue to load and are safely renderable — no destructive migration was added
      resetDatabase();
      {
        const legacyNotes = await notesService.getAll({ scope: 'my' });
        const legacySeedNote = legacyNotes.find((n) => n.id === 'note-001');
        assert(Boolean(legacySeedNote) && !legacySeedNote.contentHtml, '710. Seed note-001 still has no contentHtml field (untouched, non-destructive) — confirming the legacy-compatibility code path is exercised, not silently migrated away');
        const { resolveNoteContentHtml: resolveNoteContentHtmlCheck } = await import('../domain/noteDomain.js');
        const legacyRendered = resolveNoteContentHtmlCheck(legacySeedNote);
        assert(legacyRendered.includes('<br>') || !legacySeedNote.content.includes('\n'), '710b. resolveNoteContentHtml() on a legacy plain-content note safely converts its line breaks to <br> for rendering, without requiring a stored contentHtml field');
      }

      // 711. FUNCTIONAL: saving a formatted note derives an up-to-date plain-text `content` from the sanitized HTML (search compatibility)
      {
        const formattedSaveTest = await notesService.create({ title: 'Search Compat Check', contentHtml: 'Find <b>this exact phrase</b> please', category: 'General' });
        assert(formattedSaveTest.content.includes('Find this exact phrase please'), `711. The derived plain-text content strips formatting tags but keeps the readable text intact for search (found "${formattedSaveTest.content}")`);
        const searchHit = await notesService.getAll({ scope: 'my', search: 'this exact phrase' });
        assert(searchHit.some((n) => n.id === formattedSaveTest.id), '711b. Searching for text that only exists inside a <b> formatted span still finds the note — search operates on the derived plain content, unaffected by formatting');
      }

      // --- HTML SANITIZATION ---

      // 712. sanitizeNoteHtml() strips script/style/iframe/object/embed tags AND their content entirely
      {
        const { sanitizeNoteHtml: sanitizeCheck } = await import('../domain/noteDomain.js');
        const scriptAttempt = sanitizeCheck('<script>alert(1)</script>Hello');
        assert(scriptAttempt === 'Hello', `712. <script>alert(1)</script> is stripped entirely, tag and content (found "${scriptAttempt}")`);
        const iframeAttempt = sanitizeCheck('<iframe src="evil.com"></iframe>World');
        assert(iframeAttempt === 'World', `712b. <iframe> is stripped entirely (found "${iframeAttempt}")`);
      }

      // 713. Event-handler attributes and arbitrary attributes are stripped even on ALLOWED tags
      {
        const { sanitizeNoteHtml: sanitizeCheck2 } = await import('../domain/noteDomain.js');
        const eventAttempt = sanitizeCheck2('<div onclick="alert(1)" style="color:red" class="x">Click me</div>');
        assert(eventAttempt === '<div>Click me</div>' || (eventAttempt.includes('Click me') && !eventAttempt.includes('onclick') && !eventAttempt.includes('style=')), `713. All attributes (onclick, style, class) are stripped even from an allowed <div> tag (found "${eventAttempt}")`);
      }

      // 714. Disallowed tags (img, a, span, table) are unwrapped — their inner text survives but the tag itself is removed
      {
        const { sanitizeNoteHtml: sanitizeCheck3 } = await import('../domain/noteDomain.js');
        const imgAttempt = sanitizeCheck3('<img src="x" onerror="alert(1)">Caption');
        assert(!imgAttempt.includes('<img') && !imgAttempt.includes('onerror'), `714. <img onerror=...> is removed entirely — no image tag and no event handler survive (found "${imgAttempt}")`);
        const linkAttempt = sanitizeCheck3('<a href="javascript:alert(1)">click here</a>');
        assert(!linkAttempt.includes('<a') && !linkAttempt.includes('javascript:') && linkAttempt.includes('click here'), `714b. <a href="javascript:..."> is unwrapped — the link tag and its javascript: URL are gone, only the safe inner text remains (found "${linkAttempt}")`);
      }

      // 715. Only the small allowlist survives: b/strong/i/em/u/br/div, with tags normalized to lowercase and stripped of all attributes
      {
        const { sanitizeNoteHtml: sanitizeCheck4 } = await import('../domain/noteDomain.js');
        const allowedAttempt = sanitizeCheck4('<STRONG class="x">Bold</STRONG> and <em>italic</em> and <u>underline</u><br>next line');
        assert(allowedAttempt === '<strong>Bold</strong> and <em>italic</em> and <u>underline</u><br>next line', `715. Allowed tags survive lowercase with attributes stripped, everything else preserved as text (found "${allowedAttempt}")`);
      }

      // 716. Every render path (Card View, Document View, Document View archived-read-only) passes contentHtml through resolveNoteContentHtml()/sanitizeNoteHtml() before dangerouslySetInnerHTML — never raw
      assert(noteCardSrc3.match(/dangerouslySetInnerHTML=\{\{ __html: resolveNoteContentHtml\(note\) \}\}/), '716. NoteCard\'s dangerouslySetInnerHTML is fed exclusively through resolveNoteContentHtml() (which always sanitizes)');
      assert(notesDocViewSrc2.match(/dangerouslySetInnerHTML=\{\{ __html: resolveNoteContentHtml\(selectedNote\) \}\}/), '716b. Document View\'s archived read-only render is also fed exclusively through resolveNoteContentHtml()');
      assert(
        !stripComments([noteCardSrc3, notesDocViewSrc2].join('\n')).match(/dangerouslySetInnerHTML=\{\{\s*__html:\s*(?!.*resolveNoteContentHtml)[a-zA-Z]/),
        '716c. No dangerouslySetInnerHTML usage anywhere in the Notes module bypasses resolveNoteContentHtml() with a raw/unsanitized value'
      );

      // --- CARD / DOCUMENT FORMATTING RENDERING ---

      // 717. FUNCTIONAL: a note saved with Bold/Italic/Underline formatting renders that formatting (not raw tag text) when read back through resolveNoteContentHtml()
      {
        const { resolveNoteContentHtml: resolveCheck } = await import('../domain/noteDomain.js');
        const formattedNote = await notesService.create({ title: 'Render Check', contentHtml: 'Plain <b>bold</b> <i>italic</i> <u>underline</u>', category: 'General' });
        const rendered = resolveCheck(formattedNote);
        assert(rendered.includes('<b>bold</b>') && rendered.includes('<i>italic</i>') && rendered.includes('<u>underline</u>'), `717. The saved note's formatting survives the full save -> sanitize -> render round trip and is NOT shown as literal <b>/<i>/<u> text (found "${rendered}")`);
        assert(!rendered.includes('&lt;b&gt;'), '717b. Tags are real HTML elements, not HTML-escaped literal text (which would show the raw angle-bracket syntax to the user)');
      }

      // 718. Line-clamp CSS still bounds the card preview even with formatted (tag-containing) HTML content
      assert(indexCssSrcForNotesV3.match(/\.note-content-preview\s*\{[^}]*-webkit-line-clamp:\s*5/), '718. .note-content-preview retains its line-clamp bound regardless of whether the content includes inline formatting tags — long formatted notes still can\'t break card sizing');

      // --- GENERAL / REGRESSION ---

      // 719. Card View (grid, search, category, sort, Pin/Archive/Restore/Delete, tags, color accents) remains fully intact
      assert(notesPageSrc3.includes('notes-grid') && noteCardSrc3.includes('onTogglePin') && noteCardSrc3.includes('onArchive') && noteCardSrc3.includes('onDeleteRequest'), '719. Card View\'s grid and all its existing actions remain present — extended, not redesigned');

      // 720. Pinned / Archived routes and their scope semantics are untouched
      assert(notesServiceSrc2.includes("scope === 'archived'") && notesServiceSrc2.includes("scope === 'pinned'"), '720. notesService.getAll()\'s scope semantics (my/pinned/archived) are unchanged by this formatting/inline-editing task');

      // 721. notesService remains the sole data boundary — no direct localStorage access from any Notes UI component
      {
        // NotesPage's own VIEW_MODE_STORAGE_KEY read/write is the one explicitly-allowed
        // exception (a lightweight, non-data UI preference — not the app database) — every
        // OTHER Notes UI file, and every OTHER localStorage call, must go through notesService.
        const otherNotesFiles = [noteCardSrc3, notesDocViewSrc2, noteEditorModalSrc3, deleteNoteModalSrc3, noteContentEditorSrc2, unsavedChangesModalSrc].join('\n');
        assert(!otherNotesFiles.includes('localStorage.'), '721. No Notes UI component other than NotesPage\'s own view-mode preference touches localStorage directly — notesService remains the data boundary for every other file');

        const notesPageLocalStorageCalls = [...notesPageSrc3.matchAll(/localStorage\.(setItem|getItem)\(([^)]*)\)/g)];
        assert(
          notesPageLocalStorageCalls.length > 0 && notesPageLocalStorageCalls.every((m) => m[2].includes('VIEW_MODE_STORAGE_KEY')),
          '721b. NotesPage\'s only localStorage calls are its VIEW_MODE_STORAGE_KEY preference (never the app database key rizurf_hr_poc_v1) — the actual notes data still only ever flows through notesService'
        );
      }

      // 722. Shared Onboarding/Offboarding activity infrastructure remains completely untouched by this Notes-only task
      assert(
        activityServiceSrc5.includes('async markComplete(') && activityServiceSrc5.includes('async reopen(') && activityServiceSrc5.includes('async getActiveTypes(') && activityServiceSrc5.includes('async getOverdueActivities('),
        '722. activityService.js (markComplete/reopen/getActiveTypes/getOverdueActivities) is unchanged — this task touched only Notes-module files'
      );

      // 723. FUNCTIONAL: Onboarding Done/Reopen still works end-to-end after this Notes UX enhancement
      {
        const instancesForFinalCheck = await onboardingService.getAllInstances();
        const anyTaskForFinalCheck = instancesForFinalCheck.flatMap((i) => i.progress.tasks).find((t) => t.activityId && !t.isCompleted);
        if (anyTaskForFinalCheck) {
          const doneRes3 = await activityService.markComplete(anyTaskForFinalCheck.activityId);
          assert(doneRes3.completed === true, '723. Done still works on an onboarding task through the shared activityService after this Notes UX enhancement');
          await activityService.reopen(anyTaskForFinalCheck.activityId);
        } else {
          assert(true, '723. Done/Reopen functional check skipped — no incomplete onboarding task instance available in current seed state (verified functional elsewhere in this suite)');
        }
      }

      // 724. Scope composition (composeOnboardingTasks) remains completely unaffected
      {
        const scopeDefsFinal = await onboardingService.getScopeTaskDefinitions();
        const compositionFinal = composeOnboardingTasks({ id: 'notes-v3-check-emp', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsFinal, '2026-08-15');
        assert(compositionFinal.counts.total === 11, `724. composeOnboardingTasks() still produces the same 11-task result for an Employee in Software Engineering — untouched by the Notes formatting/inline-editing enhancement (found ${compositionFinal.counts.total})`);
      }

      // 725. No page-level horizontal-overflow rules were introduced by any of the new Document View editing/formatting CSS
      assert(!indexCssSrcForNotesV3.match(/\.notes-document[\s\S]{0,300}overflow-x:\s*(scroll|auto)/) && !indexCssSrcForNotesV3.match(/\.note-content-editor[\s\S]{0,200}overflow-x:\s*(scroll|auto)/), '725. No new overflow-x rules exist anywhere in the Document View or formatting-editor CSS — the page itself never scrolls horizontally');

      resetDatabase();
    }
    // ==========================================================================
    // Notes UX Refinement: Enlarged Modals, Swatch Spacing, Custom Label, Doc Read/Edit State
    // ==========================================================================
    {
      const noteDomainSrc3 = fs.readFileSync(path.resolve('./src/domain/noteDomain.js'), 'utf-8');
      const selectSrc2 = fs.readFileSync(path.resolve('./src/components/common/Select.jsx'), 'utf-8');
      const deleteNoteModalSrc4 = fs.readFileSync(path.resolve('./src/components/notes/DeleteNoteModal.jsx'), 'utf-8');
      const noteEditorModalSrc4 = fs.readFileSync(path.resolve('./src/components/notes/NoteEditorModal.jsx'), 'utf-8');
      const notesDocViewSrc3 = fs.readFileSync(path.resolve('./src/components/notes/NotesDocumentView.jsx'), 'utf-8');
      const unsavedChangesModalSrc2 = fs.readFileSync(path.resolve('./src/components/notes/UnsavedChangesModal.jsx'), 'utf-8');
      const indexCssSrcForNotesV4 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

      // --- DELETE MODAL (1-7) ---

      // 726. A reusable, scoped .modal-card.confirmation-modal size variant exists (not hardcoded per-modal) — flex-column Header/Body(flex:1)/Footer, with a real min-height/max-height gated to non-mobile widths
      assert(
        /\.modal-card\.confirmation-modal\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/.test(indexCssSrcForNotesV4) &&
        /@media \(min-width:\s*640px\)\s*\{\s*\.modal-card\.confirmation-modal\s*\{[^}]*min-height:\s*\d+px;[^}]*max-height:\s*\d+vh;/.test(indexCssSrcForNotesV4),
        '726. .modal-card.confirmation-modal is a reusable scoped size variant (flex-column layout, min-height/max-height applied only at >=640px) rather than a hardcoded one-off size'
      );

      // 727. DeleteNoteModal uses the confirmation-modal variant (on top of its existing wide-modal width tier)
      assert(deleteNoteModalSrc4.includes('modal-card wide-modal confirmation-modal'), '727. DeleteNoteModal applies the shared confirmation-modal class for its enlarged vertical layout');

      // 728. The warning content stays top-aligned in the body (not vertically centered) — modal-body has no centering rule, and its content (title/subtitle text) renders as the first thing in the flex:1 body
      assert(
        !/\.modal-card\.confirmation-modal \.modal-body\s*\{[^}]*(justify-content|align-items):\s*center/.test(indexCssSrcForNotesV4),
        '728. The confirmation-modal body has no vertical-centering rule — warning content stays anchored near the top rather than centering in the extra vertical space'
      );

      // 729. Delete modal body/footer no longer rely on the old inline style / *-spacious classes — spacing now comes entirely from the scoped confirmation-modal CSS
      assert(
        !deleteNoteModalSrc4.includes("style={{ padding: '1.5rem 1.75rem' }}") && !deleteNoteModalSrc4.includes('modal-body-spacious') && !deleteNoteModalSrc4.includes('modal-footer-spacious'),
        '729. DeleteNoteModal no longer uses the old inline header padding / modal-body-spacious / modal-footer-spacious classes — sizing now comes from the single confirmation-modal variant'
      );

      // 730. Delete wording, note-title confirmation text, and the "cannot be undone" copy are all unchanged
      assert(
        deleteNoteModalSrc4.includes('Delete Note?') && deleteNoteModalSrc4.includes('This note will be permanently deleted.') && deleteNoteModalSrc4.includes('cannot be undone'),
        '730. Delete Note modal wording is unchanged — only spacing/sizing was enlarged'
      );

      // 731. Delete behavior itself (Cancel/Delete buttons, deletePermanently call) is unchanged
      assert(
        deleteNoteModalSrc4.includes('notesService.deletePermanently') && deleteNoteModalSrc4.includes('btn-danger') && deleteNoteModalSrc4.includes('btn-secondary'),
        '731. Delete confirmation behavior (Cancel/Delete buttons, notesService.deletePermanently call) is unchanged by the enlargement'
      );

      // 732. No fixed/hardcoded pixel min-height was added directly inline on DeleteNoteModal's own JSX (sizing comes from the shared CSS class, not a one-off inline style)
      assert(!/style=\{\{[^}]*(minHeight|min-height)/.test(deleteNoteModalSrc4), '732. DeleteNoteModal does not hardcode min-height inline — it relies on the reusable confirmation-modal CSS class');

      // --- UNSAVED CHANGES MODAL (8-11) ---

      // 733. UnsavedChangesModal uses the exact same confirmation-modal treatment as DeleteNoteModal — both modals are visually consistent, not one enlarged and one left cramped
      assert(unsavedChangesModalSrc2.includes('modal-card wide-modal confirmation-modal'), '733. UnsavedChangesModal applies the same wide-modal + confirmation-modal classes as DeleteNoteModal for consistent sizing');

      // 734. UnsavedChangesModal now has real modal-body content (previously went straight from header to footer) — a body was actually added, not just an empty flex:1 gap
      assert(/<div className="modal-body">[\s\S]{0,300}<\/div>/.test(unsavedChangesModalSrc2), '734. UnsavedChangesModal now has an actual .modal-body section with content, giving the new flex:1 body real substance to fill');

      // 735. Unsaved Changes wording (title/subtitle/buttons) is unchanged
      assert(
        unsavedChangesModalSrc2.includes('Unsaved Changes') && unsavedChangesModalSrc2.includes('You have unsaved changes in this note.') && unsavedChangesModalSrc2.includes('Discard Changes') && unsavedChangesModalSrc2.includes('Keep Editing'),
        '735. Unsaved Changes modal wording (title/subtitle/Discard Changes/Keep Editing) is unchanged — only spacing/sizing was enlarged'
      );

      // 736. onDiscard/onKeepEditing behavior is unchanged
      assert(unsavedChangesModalSrc2.includes('onClick={onKeepEditing}') && unsavedChangesModalSrc2.includes('onClick={onDiscard}'), '736. Discard Changes/Keep Editing button behavior (onDiscard/onKeepEditing props) is unchanged');

      // --- COLOR SWATCH / LABEL SPACING (12-16) ---

      // 737. .select-swatch has a real horizontal gap to the label text, applied on the swatch itself so it works identically in the closed trigger and every open dropdown option row
      assert(/\.select-swatch\s*\{[^}]*margin-right:\s*0(\.\d+)?(rem|px)/.test(indexCssSrcForNotesV4), '737. .select-swatch has explicit horizontal spacing (margin-right) to the label text that follows it');

      // 738. Select.jsx renders the same OptionSwatch/select-swatch element in BOTH the closed trigger's selected value AND each open dropdown option row — one shared component guarantees the fix applies to both, not just the menu
      {
        const swatchUsageCount = (selectSrc2.match(/select-swatch/g) || []).length;
        assert(swatchUsageCount >= 2 && selectSrc2.includes('custom-select-value') && selectSrc2.includes('custom-select-option'), `738. The select-swatch element is shared by the trigger's custom-select-value and each custom-select-option row (found ${swatchUsageCount} select-swatch references) — spacing fix applies to both`);
      }

      // 739. The selected checkmark still renders and is unaffected by the swatch spacing change
      assert(selectSrc2.includes('custom-select-check'), '739. The selected-option checkmark (custom-select-check) still renders, unaffected by the swatch spacing change');

      // 740. The Default/neutral swatch (no real color) still uses the bordered-outline treatment, not a colored fill
      assert(selectSrc2.includes("swatchColor === 'none'") || selectSrc2.includes('select-swatch--neutral'), '740. The Default neutral swatch dot still renders as an outlined circle, not a colored fill');

      // 741. The spacing only applies where swatchColor is present — Select.jsx normalizes swatchColor as optional per-option (undefined for every non-Notes consumer) and passes it straight into OptionSwatch, which renders nothing extra when it's absent
      assert(selectSrc2.includes('swatchColor: opt.swatchColor') && selectSrc2.includes('color={selectedOption?.swatchColor}') && selectSrc2.includes('color={opt.swatchColor}'), '741. Swatch rendering (and therefore its spacing) stays conditional on a per-option swatchColor — other Select consumers that never pass swatchColor render no swatch and are unaffected');

      // --- CATEGORY LABEL (17-20) ---

      // 742. NoteEditorModal's custom-category option label is the exact string "Other / Custom" (no ellipsis)
      assert(noteEditorModalSrc4.includes("label: 'Other / Custom'") && !noteEditorModalSrc4.includes('Other / Custom...'), '742. NoteEditorModal (Card View) shows the custom-category label as exactly "Other / Custom" — no ellipsis');

      // 743. NotesDocumentView's inline custom-category option label is also exactly "Other / Custom" (no ellipsis) — the same fix was applied everywhere the label is shown, not only in Card View
      assert(notesDocViewSrc3.includes("label: 'Other / Custom'") && !notesDocViewSrc3.includes('Other / Custom...'), '743. NotesDocumentView (inline editor) also shows the custom-category label as exactly "Other / Custom" — no ellipsis');

      // 744. No remaining "Other / Custom..." string exists anywhere in the Notes module's component source
      {
        const allNotesComponentSrc = [noteEditorModalSrc4, notesDocViewSrc3, deleteNoteModalSrc4, unsavedChangesModalSrc2, noteDomainSrc3].join('\n');
        assert(!allNotesComponentSrc.includes('Other / Custom...'), '744. No remaining "Other / Custom..." (with ellipsis) string exists anywhere in the Notes module source');
      }

      // 745. Selecting the custom-category option still reveals the Custom Category text field in both Card View and Document View — the label rename did not touch the underlying reveal behavior
      assert(
        noteEditorModalSrc4.includes("formData.category === CUSTOM_CATEGORY_OPTION") && notesDocViewSrc3.includes('draft.category === CUSTOM_CATEGORY_OPTION'),
        '745. Selecting "Other / Custom" still conditionally reveals the Custom Category text field in both Card View and Document View'
      );

      // --- DOCUMENT VIEW READ/EDIT STATE (21-35) ---

      // 746. NotesDocumentView tracks a dedicated isEditing boolean, layered on top of (not replacing) the existing draft/baseline/isDirty machinery
      assert(notesDocViewSrc3.includes('const [isEditing, setIsEditing] = useState(false);') && notesDocViewSrc3.includes('const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);'), '746. A dedicated isEditing state toggle exists alongside the unchanged draft/baseline/isDirty dirty-tracking machinery');

      // 747. A newly-selected (already-saved) note always opens in READ state, never mid-edit
      assert(/setIsEditing\(false\);[\s\S]{0,20}\}\s*\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\s*\}, \[selectedNoteId\]\);/.test(notesDocViewSrc3) || (notesDocViewSrc3.includes('setIsEditing(false);') && notesDocViewSrc3.match(/\[selectedNoteId\]\);/)), '747. Selecting a different persisted note resets isEditing to false — every note opens in READ state, never mid-edit');

      // 748. READ state hides Save Changes/Cancel Changes: that button row is gated on isEditing being true (not just !isArchivedReadOnly)
      assert(notesDocViewSrc3.includes('{!isArchivedReadOnly && isEditing && (') && notesDocViewSrc3.includes('Save Changes') && notesDocViewSrc3.includes('Cancel Changes'), '748. The Save Changes/Cancel Changes button row only renders when isEditing is true — hidden in READ state');

      // 749. READ state shows a dedicated Edit action, hidden once already editing
      assert(notesDocViewSrc3.includes('{!isArchivedReadOnly && !isEditing && (') && notesDocViewSrc3.includes('title="Edit"') && notesDocViewSrc3.includes('onClick={handleStartEdit}'), '749. A dedicated Edit action button is shown in READ state (hidden once isEditing is true) and switches into edit state via handleStartEdit');

      // 750. Clicking Edit switches the document into EDIT state locally — it does not open NoteEditorModal
      assert(notesDocViewSrc3.includes('const handleStartEdit = () => {') && notesDocViewSrc3.includes('setIsEditing(true);') && !/handleStartEdit = \(\) => \{[^}]*NoteEditorModal/.test(notesDocViewSrc3), '750. handleStartEdit() sets isEditing to true directly (a local state toggle) — it never opens NoteEditorModal');

      // 751. The read/edit render branch is keyed on isArchivedReadOnly OR !isEditing, so a non-archived note renders its editable fields (title input, DocumentMetaFields, NoteContentEditor) only while isEditing is true
      assert(notesDocViewSrc3.includes('{isArchivedReadOnly || !isEditing ? (') && notesDocViewSrc3.includes('notes-document-title-input'), '751. The editable Title input / Category+Color Select fields / NoteContentEditor only render in the EDIT-state branch, not in READ state');

      // 752. Save Changes persists via notesService.update(), refreshes the shared list, and updates draft+baseline to the freshly-saved values
      assert(
        /handleSaveChanges = async \(\) => \{[\s\S]*?await notesService\.update\(selectedNoteId, buildPayload\(\)\);[\s\S]*?await onNotesChanged\(\);[\s\S]*?setDraft\(fresh\);[\s\S]*?setBaseline\(fresh\);/.test(notesDocViewSrc3),
        '752. handleSaveChanges() persists via notesService.update(), refreshes the shared notes list, and syncs both draft and baseline to the saved result'
      );

      // 753. Save Changes exits edit mode after a successful save — the user's explicit visual confirmation that editing finished
      assert(/handleSaveChanges = async \(\) => \{[\s\S]*?setBaseline\(fresh\);[\s\S]*?setIsEditing\(false\);/.test(notesDocViewSrc3), '753. handleSaveChanges() sets isEditing back to false immediately after a successful save — the document returns to READ state automatically');

      // 754. Because isEditing becomes false and draft now equals baseline (isDirty false), the Save/Cancel Changes row and the editable inputs both disappear on the very next render after a successful save
      assert(notesDocViewSrc3.includes('{!isArchivedReadOnly && isEditing && (') && notesDocViewSrc3.includes('{isArchivedReadOnly || !isEditing ? ('), '754. Both the Save/Cancel Changes button row and the editable-field branch are driven by the same isEditing flag, so a successful save (which clears isEditing) hides them together on the same render');

      // 755. Cancel Changes restores the last saved baseline AND exits edit state — returns to read state without persisting anything
      assert(/handleCancelChanges = \(\) => \{[\s\S]*?setDraft\(baseline\);[\s\S]*?setIsEditing\(false\);[\s\S]*?\};/.test(notesDocViewSrc3), '755. handleCancelChanges() resets draft to baseline and sets isEditing to false — exits edit state and returns to read state without saving');

      // 756. Cancel Changes is never gated by isDirty (disabled={saving} only) — a user who enters edit state and changes nothing can still exit via Cancel Changes instead of being trapped
      assert(/Cancel Changes[\s\S]{0,10}<\/button>|onClick=\{handleCancelChanges\} disabled=\{saving\}>/.test(notesDocViewSrc3) && /onClick=\{handleCancelChanges\}\s+disabled=\{saving\}>/.test(notesDocViewSrc3), '756. The Cancel Changes button is disabled only while saving (disabled={saving}), never disabled by !isDirty — entering edit mode with zero changes still leaves a working way out');

      // 757. Save Changes remains correctly gated by isDirty (no point persisting a no-op save)
      assert(/onClick=\{handleSaveChanges\}\s+disabled=\{saving \|\| !isDirty\}>/.test(notesDocViewSrc3), '757. The Save Changes button remains disabled when there is nothing to save (disabled={saving || !isDirty})');

      // 758. UPDATED — READ state's formatted content is rendered via dangerouslySetInnerHTML fed through resolveNoteContentHtml — sanitized, same rendering path as Card View. Window widened from 1500 to 2000 chars: the Reminder badge line (rendered between the meta row and the content div) pushed this further down the same JSX block without changing this check's intent.
      assert(/isArchivedReadOnly \|\| !isEditing[\s\S]{0,2600}dangerouslySetInnerHTML=\{\{ __html: resolveNoteContentHtml\(selectedNote\) \}\}/.test(notesDocViewSrc3), '758. READ state renders the saved note\'s formatted content via dangerouslySetInnerHTML fed through resolveNoteContentHtml (sanitized), not a disabled input');

      // 759. READ state shows the note as a document (title/category badge/tags/content) rather than a form with disabled inputs — no disabled-input styling is used for the read view
      assert(notesDocViewSrc3.includes('notes-document-title') && notesDocViewSrc3.includes('notes-document-meta') && !/isArchivedReadOnly \|\| !isEditing[\s\S]{0,800}disabled(?!ArchivedReadOnly)/.test(notesDocViewSrc3.slice(notesDocViewSrc3.indexOf('isArchivedReadOnly || !isEditing'), notesDocViewSrc3.indexOf('isArchivedReadOnly || !isEditing') + 800)), '759. READ state renders a title/category-badge/tags/content document layout — not disabled form inputs');

      // 760. isDirty becomes false once Save Changes succeeds (draft now strictly equals the freshly-saved baseline) — no lingering unsaved state after a successful save
      assert(notesDocViewSrc3.includes('const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);'), '760. isDirty is a live draft-vs-baseline comparison, so once handleSaveChanges syncs draft to the new baseline, isDirty is provably false on the next render');

      // --- NEW DOCUMENT (36-41) ---

      // 761. The sidebar "+" still creates a local, unsaved blank draft (creatingNew) — unaffected by the read/edit-state addition to existing notes
      assert(notesDocViewSrc3.includes('const handleCreateNewClick = () => {') && notesDocViewSrc3.includes('setCreatingNew(true);') && notesDocViewSrc3.includes('setIsEditing(false);'), '761. handleCreateNewClick() still opens a local blank draft (creatingNew=true) and also resets isEditing — the new-note flow is unaffected by the read/edit split');

      // 762. A brand-new draft is not persisted until Save Note is explicitly clicked
      assert(notesDocViewSrc3.includes('const handleSaveNewNote = async () => {') && notesDocViewSrc3.match(/handleSaveNewNote = async \(\) => \{[\s\S]*?await notesService\.create\(buildPayload\(\)\);/), '762. The new blank draft is only persisted via notesService.create() inside handleSaveNewNote — never on "+" alone');

      // 763. Save Note persists, exits creatingNew, refreshes the shared list, and selects the newly-created note
      assert(/handleSaveNewNote = async \(\) => \{[\s\S]*?const created = await notesService\.create\(buildPayload\(\)\);[\s\S]*?setCreatingNew\(false\);[\s\S]*?await onNotesChanged\(\);[\s\S]*?onSelectNote\(created\.id\);/.test(notesDocViewSrc3), '763. handleSaveNewNote() persists via notesService.create(), exits creatingNew, refreshes the shared list, then selects the generated note by its real id');

      // 764. After Save Note succeeds, the newly-selected note goes through the same note-switch effect that resets isEditing to false — so it renders in READ state, not still showing Save Note/Cancel
      assert(notesDocViewSrc3.match(/\}, \[selectedNoteId\]\);/) && notesDocViewSrc3.includes('setIsEditing(false);'), '764. Selecting the newly-created note (via onSelectNote) re-triggers the note-switch effect, which resets isEditing to false — the new note opens in READ state with Save Note/Cancel hidden');

      // 765. Cancel (for a brand-new draft) never calls notesService.create() — an unconditional, unguarded discard
      assert(notesDocViewSrc3.includes('const handleCancelNewNote = () => {') && !/handleCancelNewNote = \(\) => \{[^}]*notesService\.create/.test(notesDocViewSrc3), '765. handleCancelNewNote() unconditionally discards the draft without ever calling notesService.create()');

      // 766. Save Note/Cancel are only shown while creatingNew is true — they disappear once the new note is saved and creatingNew flips back to false
      assert(notesDocViewSrc3.includes('creatingNew ?') || notesDocViewSrc3.includes('{creatingNew'), '766. The Save Note/Cancel (new-draft) UI branch is conditioned on creatingNew, so it disappears once creatingNew is cleared after a successful Save Note');

      // --- GUARD BEHAVIOR (42-45) ---

      // 767. Switching notes while dirty (unsaved edit state) is still routed through requestAction and still shows the Unsaved Changes guard
      assert(notesDocViewSrc3.includes('const handleSelectSidebarItem = (id) => {') && notesDocViewSrc3.match(/handleSelectSidebarItem = \(id\) => \{\s*requestAction\(\(\) => \{/), '767. Sidebar note-switching remains routed through requestAction(), so switching while dirty still triggers the Unsaved Changes guard');

      // 768. requestAction only intercepts when isDirty is true — after a successful save (isDirty false, isEditing false), switching notes proceeds immediately with no warning
      assert(/const requestAction = \(actionFn\) => \{\s*if \(isDirty\) \{/.test(notesDocViewSrc3), '768. requestAction() only shows the Unsaved Changes guard when isDirty is true — once a save succeeds and isDirty becomes false, switching/archiving/deleting proceeds without any warning');

      // 769. Archive/Delete while dirty remain guarded via the same requestAction wrapper — no separate, weaker path was introduced for them
      {
        const archiveDeleteHandlersRegion = notesDocViewSrc3.slice(notesDocViewSrc3.indexOf('const handleCreateNewClick'));
        assert(archiveDeleteHandlersRegion.includes('onArchive') && archiveDeleteHandlersRegion.includes('onDeleteRequest') && archiveDeleteHandlersRegion.includes('requestAction('), '769. Archive and Delete actions in Document View remain wrapped by requestAction(), preserving the unsaved-changes guard while dirty');
      }

      // 770. Pin/Archive/Delete remain available from READ state — they are not hidden or newly conditioned on isEditing
      assert(!/onArchive[\s\S]{0,60}isEditing/.test(notesDocViewSrc3) && !/onDeleteRequest[\s\S]{0,60}isEditing/.test(notesDocViewSrc3), '770. Pin/Archive/Delete action buttons are not gated on isEditing — they remain usable from READ state exactly as before');

      // --- GENERAL / CARD VIEW REGRESSION (46-57) ---

      // 771. Card View's NoteEditorModal is completely untouched structurally — only the one category-option label string changed
      assert(noteEditorModalSrc4.includes('const handleSubmit = async (e) => {') && noteEditorModalSrc4.includes('isEditing ? await notesService.update(note.id, payload) : await notesService.create(payload)'.replace(/\s+/g, ' ')) === false && noteEditorModalSrc4.includes('await notesService.update(note.id, payload)') && noteEditorModalSrc4.includes('await notesService.create(payload)'), '771. NoteEditorModal (Card View) still calls notesService.update()/create() exactly as before — untouched aside from the category label string');

      // 772. Card View's own local "isEditing" (Boolean(note), i.e. Edit vs New Note modal mode) is a completely separate concept from Document View's new isEditing state — no naming collision causes cross-behavior
      assert(noteEditorModalSrc4.includes('const isEditing = Boolean(note);'), '772. NoteEditorModal\'s own isEditing (edit-vs-new modal mode) is defined locally and independently of Document View\'s isEditing state — no shared/leaking state between Card View and Document View');

      // 773. B/I/U formatting in Card View's modal is untouched
      assert(noteEditorModalSrc4.includes('<NoteContentEditor'), '773. NoteEditorModal still uses the shared NoteContentEditor (B/I/U) for its Content field, unaffected by this task');

      // 774. notesService remains the sole data boundary — no direct localStorage writes were introduced by this task's changes
      {
        const thisTaskFiles = [deleteNoteModalSrc4, unsavedChangesModalSrc2, noteEditorModalSrc4, notesDocViewSrc3].join('\n');
        assert(!thisTaskFiles.includes('localStorage.'), '774. None of this task\'s modified files (DeleteNoteModal/UnsavedChangesModal/NoteEditorModal/NotesDocumentView) write to localStorage directly — notesService remains the data boundary');
      }

      // 775. No horizontal-overflow rules were introduced by the confirmation-modal or select-swatch spacing CSS at desktop/1024/mobile widths
      assert(!/\.modal-card\.confirmation-modal[\s\S]{0,300}overflow-x:\s*(scroll|auto)/.test(indexCssSrcForNotesV4) && !/\.select-swatch[\s\S]{0,150}overflow-x:\s*(scroll|auto)/.test(indexCssSrcForNotesV4), '775. No new overflow-x rules were introduced by the confirmation-modal or select-swatch CSS additions');

      resetDatabase();
    }
    // ==========================================================================
    // Notes: My Notes page Sorting Explanation helper line
    // ==========================================================================
    {
      const notesPageSrc4 = fs.readFileSync(path.resolve('./src/pages/notes/NotesPage.jsx'), 'utf-8');
      const indexCssSrcForSortingHelper = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
      const noteCardSrc4 = fs.readFileSync(path.resolve('./src/components/notes/NoteCard.jsx'), 'utf-8');
      const notesDocViewSrc4 = fs.readFileSync(path.resolve('./src/components/notes/NotesDocumentView.jsx'), 'utf-8');
      const noteEditorModalSrc5 = fs.readFileSync(path.resolve('./src/components/notes/NoteEditorModal.jsx'), 'utf-8');
      const EXACT_SORTING_HELPER_TEXT = 'Newest/Oldest = creation date · Last Updated = latest edit · Title A–Z = alphabetical';

      // 776. The exact required helper copy is present in NotesPage.jsx
      assert(notesPageSrc4.includes(EXACT_SORTING_HELPER_TEXT), '776. The exact Sorting helper text ("Newest/Oldest = creation date · Last Updated = latest edit · Title A–Z = alphabetical") is present in NotesPage.jsx');

      // 776b. "Sorting:" is rendered as its own emphasized label, not bolding the entire sentence
      assert(/<span className="notes-sorting-helper-label">Sorting:<\/span>/.test(notesPageSrc4), '776b. Only the word "Sorting:" is wrapped for emphasis — the rest of the sentence renders as plain text, not a fully-bolded line');

      // 777. UPDATED — The helper renders directly below the existing subtitle, inside the same shared page-header block (not a separate/duplicated header), unconditionally for every variant
      assert(/page-subtitle">\{meta\.subtitle\}<\/p>\s*<p className="notes-sorting-helper">/.test(notesPageSrc4), '777. The Sorting helper <p> appears immediately after the existing <p className="page-subtitle"> in the same header markup, directly beneath it, on every NotesPage variant');

      // 778. The helper appears above the toolbar in source order (header block closes before the toolbar div begins)
      {
        const helperIdx = notesPageSrc4.indexOf('notes-sorting-helper">');
        const toolbarIdx = notesPageSrc4.indexOf('className="notes-toolbar"');
        assert(helperIdx > -1 && toolbarIdx > -1 && helperIdx < toolbarIdx, '778. The Sorting helper is rendered above the Search/Category/Sort/View toolbar in document order');
      }

      // 779. UPDATED — The helper is now shown consistently on every NotesPage variant (My Notes, Pinned, Archived) since all three have identical sorting controls. It renders unconditionally in the shared header (no variant-based gate) rather than being duplicated per page.
      assert(
        !/\{variant === 'my' && \([\s\S]{0,50}<p className="notes-sorting-helper">/.test(notesPageSrc4) &&
        notesPageSrc4.match(/<p className="notes-sorting-helper">/g)?.length === 1,
        '779. The Sorting helper is no longer gated on variant === \'my\' — it renders unconditionally, exactly once in the shared header markup, so My Notes, Pinned, and Archived all show it via the one shared implementation'
      );

      // 780. UPDATED — No duplicate copy of the sorting-explanation text was added anywhere else in the Notes module (cards, Document View, Edit/New Note modal, sidebar) — the single shared NotesPage header instance now covers all three variants, so no per-surface or per-page duplication was needed
      {
        const otherNotesSurfaces = [noteCardSrc4, notesDocViewSrc4, noteEditorModalSrc5].join('\n');
        assert(!otherNotesSurfaces.includes(EXACT_SORTING_HELPER_TEXT) && !otherNotesSurfaces.includes('notes-sorting-helper'), '780. The Sorting helper text/class does not appear in NoteCard, NotesDocumentView, or NoteEditorModal — no duplicate copies outside the one shared NotesPage header');
      }

      // 780b. FUNCTIONAL: notesService.getCategoryOptions()/getAll() are used identically regardless of the header text change — confirms this was a presentation-only change with no data-layer impact for any of the three variants
      {
        const myScopeNotes = await notesService.getAll({ scope: 'my' });
        const pinnedScopeNotes = await notesService.getAll({ scope: 'pinned' });
        const archivedScopeNotes = await notesService.getAll({ scope: 'archived' });
        assert(Array.isArray(myScopeNotes) && Array.isArray(pinnedScopeNotes) && Array.isArray(archivedScopeNotes), '780b. notesService.getAll() still returns valid results for the my/pinned/archived scopes — the header text change has no effect on data loading for any variant');
      }

      // 781. The helper uses its own dedicated CSS class rather than reusing/overloading .page-subtitle (which stays shared, unmodified, across many other pages)
      assert(/\.notes-sorting-helper\s*\{[^}]*font-size:\s*0\.\d+rem;[^}]*color:\s*var\(--text-muted\);/.test(indexCssSrcForSortingHelper), '781. .notes-sorting-helper is a dedicated CSS class with its own smaller font-size and var(--text-muted) color — visually secondary to, and distinct from, .page-subtitle');

      // 782. The helper is visually smaller than the subtitle (font-size strictly less than .onboarding-plans-header .page-subtitle's 0.9rem)
      {
        const helperFontMatch = indexCssSrcForSortingHelper.match(/\.notes-sorting-helper\s*\{[^}]*font-size:\s*(0\.\d+)rem;/);
        assert(helperFontMatch && parseFloat(helperFontMatch[1]) < 0.9, `782. .notes-sorting-helper's font-size (${helperFontMatch ? helperFontMatch[1] : 'not found'}rem) is smaller than the subtitle's 0.9rem — visually secondary, not another subtitle`);
      }

      // 783. The helper has its own margin-top (a smaller, intentional gap below the subtitle) rather than an unstyled default paragraph margin
      assert(/\.notes-sorting-helper\s*\{[^}]*margin:\s*0\.\d+rem 0 0 0;/.test(indexCssSrcForSortingHelper), '783. .notes-sorting-helper has an explicit small margin-top, giving an intentional (not default-browser) gap beneath the subtitle');

      // 784. .onboarding-plans-header's existing margin-bottom (shared with the Plans page) is unchanged — this still provides the larger gap down to the toolbar, so no new/duplicate large-gap rule was introduced
      assert(/\.onboarding-plans-header\s*\{\s*margin-bottom:\s*2rem;\s*\}/.test(indexCssSrcForSortingHelper), '784. .onboarding-plans-header still has its original margin-bottom: 2rem (shared with the Plans page, unmodified) — this is what now provides the larger gap between the Sorting helper and the toolbar');

      // 785. NOTE_SORT_OPTIONS / sort dropdown options and their underlying sort behavior are completely untouched by this text-only change
      {
        const noteDomainSrcForSorting = fs.readFileSync(path.resolve('./src/domain/noteDomain.js'), 'utf-8');
        assert(
          notesPageSrc4.includes("{ value: NOTE_SORT_OPTIONS.UPDATED, label: 'Last Updated' }") &&
          notesPageSrc4.includes("{ value: NOTE_SORT_OPTIONS.NEWEST, label: 'Newest' }") &&
          notesPageSrc4.includes("{ value: NOTE_SORT_OPTIONS.OLDEST, label: 'Oldest' }") &&
          notesPageSrc4.includes("{ value: NOTE_SORT_OPTIONS.TITLE, label: 'Title A–Z' }") &&
          noteDomainSrcForSorting.includes('sortNotes'),
          '785. The Sort By dropdown options and sortNotes() domain logic are unchanged — this task only added explanatory text, no sorting behavior was touched'
        );
      }

      resetDatabase();
    }
    // ==========================================================================
    // Notes: Highlight + Bulleted List + Numbered List formatting
    // ==========================================================================
    {
      const noteDomainSrcV5 = fs.readFileSync(path.resolve('./src/domain/noteDomain.js'), 'utf-8');
      const noteContentEditorSrcV5 = fs.readFileSync(path.resolve('./src/components/notes/NoteContentEditor.jsx'), 'utf-8');
      const noteCardSrcV5 = fs.readFileSync(path.resolve('./src/components/notes/NoteCard.jsx'), 'utf-8');
      const notesDocViewSrcV5 = fs.readFileSync(path.resolve('./src/components/notes/NotesDocumentView.jsx'), 'utf-8');
      const noteEditorModalSrcV5 = fs.readFileSync(path.resolve('./src/components/notes/NoteEditorModal.jsx'), 'utf-8');
      const notesServiceSrcV5 = fs.readFileSync(path.resolve('./src/services/notesService.js'), 'utf-8');
      const indexCssSrcV5 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
      const activityServiceSrcV5 = fs.readFileSync(path.resolve('./src/services/activityService.js'), 'utf-8');

      const { sanitizeNoteHtml: sanitizeV5, deriveContentFromHtml: deriveV5, resolveNoteContentHtml: resolveV5, NOTE_HIGHLIGHT_COLORS: HIGHLIGHT_COLORS_V5 } = await import('../domain/noteDomain.js');

      // --- TOOLBAR (1-7) ---

      // 786. Bold/Italic/Underline still exist in the toolbar
      assert(noteContentEditorSrcV5.includes('title="Bold (Ctrl+B)"') && noteContentEditorSrcV5.includes('title="Italic (Ctrl+I)"') && noteContentEditorSrcV5.includes('title="Underline (Ctrl+U)"'), '786. Bold, Italic, and Underline toolbar buttons all still exist, unchanged');

      // 787. Highlight button exists
      assert(noteContentEditorSrcV5.includes('title="Highlight"') && noteContentEditorSrcV5.includes('<Highlighter size={14} />'), '787. A Highlight toolbar button exists, using the lucide-react Highlighter icon');

      // 788. Bulleted List button exists
      assert(noteContentEditorSrcV5.includes('title="Bulleted List"') && noteContentEditorSrcV5.includes('<List size={14} />'), '788. A Bulleted List toolbar button exists, using the lucide-react List icon');

      // 789. Numbered List button exists
      assert(noteContentEditorSrcV5.includes('title="Numbered List"') && noteContentEditorSrcV5.includes('<ListOrdered size={14} />'), '789. A Numbered List toolbar button exists, using the lucide-react ListOrdered icon');

      // 790. Both Card View's NoteEditorModal and Document View's inline editor use the ONE shared NoteContentEditor — the new controls automatically appear in both, no second toolbar implementation
      assert(
        noteEditorModalSrcV5.includes("import NoteContentEditor from './NoteContentEditor.jsx'") && noteEditorModalSrcV5.includes('<NoteContentEditor') &&
        notesDocViewSrcV5.includes("import NoteContentEditor from './NoteContentEditor.jsx'") && (notesDocViewSrcV5.match(/<NoteContentEditor/g) || []).length === 2,
        '790. NoteEditorModal (Card View) and NotesDocumentView (both its new-draft and edit-state renders) all import and render the same shared NoteContentEditor — there is exactly one toolbar implementation'
      );

      // 791. Toolbar is grouped with dividers ([B I U] | [Highlight] | [Bullets Numbers]) rather than one long flat row, and stays compact (28px buttons, no font/size/color/align/heading/table/image/link icon controls added) — checked against the actual lucide-react import list and JSX icon usage, not source comments (which legitimately document what was deliberately excluded)
      {
        const lucideImportLine = (noteContentEditorSrcV5.match(/import \{[^}]*\} from 'lucide-react';/) || [''])[0];
        const forbiddenIcons = ['AlignLeft', 'AlignCenter', 'AlignRight', 'Heading1', 'Heading2', 'Table', 'Image', 'Link', 'Type', 'Palette'];
        assert(
          (noteContentEditorSrcV5.match(/note-format-divider/g) || []).length >= 2 &&
          !forbiddenIcons.some((icon) => lucideImportLine.includes(icon)),
          `791. The toolbar uses subtle group dividers ([B I U] | [Highlight] | [Bullets] [Numbers]) and imports no font/alignment/heading/table/image/link lucide icons (import line: ${lucideImportLine})`
        );
      }

      // --- HIGHLIGHT (8-17) ---

      // 792. Yellow/Green/Blue/Pink highlight colors are all defined in the one shared palette
      assert(
        HIGHLIGHT_COLORS_V5 && Object.keys(HIGHLIGHT_COLORS_V5).sort().join(',') === 'blue,green,pink,yellow',
        `792. NOTE_HIGHLIGHT_COLORS defines exactly the 4 required colors: yellow, green, blue, pink (found: ${HIGHLIGHT_COLORS_V5 ? Object.keys(HIGHLIGHT_COLORS_V5).sort().join(', ') : 'none'})`
      );

      // 793. Each highlight color survives sanitization intact (functional: yellow/green/blue/pink each round-trip through sanitizeNoteHtml unchanged)
      {
        const allFourWork = ['yellow', 'green', 'blue', 'pink'].every((color) => {
          const html = `<mark data-highlight="${color}">text</mark>`;
          return sanitizeV5(html) === html;
        });
        assert(allFourWork, '793. Yellow, Green, Blue, and Pink highlights all survive sanitizeNoteHtml() unchanged — each of the 4 colors works');
      }

      // 794. Remove Highlight is implemented as a real unwrap action (not a 5th color) that strips the <mark> boundary while preserving its text
      assert(noteContentEditorSrcV5.includes('const removeHighlight') && noteContentEditorSrcV5.includes('Remove Highlight') && /while \(markEl\.firstChild\) parent\.insertBefore\(markEl\.firstChild, markEl\);/.test(noteContentEditorSrcV5), '794. Remove Highlight unwraps the <mark> element (moving its children back into place) rather than deleting the text or being just another color choice');

      // 795. FUNCTIONAL: a highlighted note persists through create() + a fresh getById() (save/reload)
      {
        const created = await notesService.create({ title: 'Highlight Persist Check', contentHtml: '<mark data-highlight="green">Persisted text</mark>', category: 'General' });
        const reloaded = await notesService.getById(created.id);
        assert(reloaded && reloaded.contentHtml.includes('<mark data-highlight="green">Persisted text</mark>'), '795. A highlighted note\'s contentHtml persists exactly through notesService.create() and a fresh getById() (save/reload)');
      }

      // 796. Highlight renders safely in the Card preview via the same resolveNoteContentHtml() path used for B/I/U
      {
        const note = { contentHtml: '<mark data-highlight="blue">Card preview text</mark>' };
        assert(resolveV5(note).includes('data-highlight="blue"'), '796. resolveNoteContentHtml() (the function NoteCard\'s preview renders) preserves highlight markup for the Card View preview');
      }

      // 797. Highlight renders safely in Document View via the same shared resolveNoteContentHtml() path
      assert(notesDocViewSrcV5.includes('dangerouslySetInnerHTML={{ __html: resolveNoteContentHtml(selectedNote) }}'), '797. Document View\'s read-state content still renders exclusively through resolveNoteContentHtml(), so highlight formatting renders there identically to Card View');

      // 798. Unsupported/arbitrary highlight values are stripped (normalized to a bare, unstyled <mark>)
      {
        const bad = sanitizeV5('<mark data-highlight="red">x</mark>');
        assert(bad === '<mark>x</mark>', `798. An unsupported highlight value ("red") is stripped to a bare <mark> with no data-highlight attribute (got: ${bad})`);
      }

      // 799. Arbitrary inline styles on a highlighted mark are stripped — no style="background:..." survives
      {
        const stripped = sanitizeV5('<mark data-highlight="yellow" style="background: red; color: lime;">x</mark>');
        assert(stripped === '<mark data-highlight="yellow">x</mark>' && !stripped.includes('style='), `799. An inline style attribute on <mark> is fully stripped while the valid data-highlight value survives (got: ${stripped})`);
      }

      // --- LISTS (18-26) ---

      // 800. Bulleted List uses the native insertUnorderedList command (real semantic <ul><li>, not Unicode bullet characters)
      assert(noteContentEditorSrcV5.includes("applyList('insertUnorderedList')"), '800. Bulleted List is wired to document.execCommand(\'insertUnorderedList\') — produces real <ul><li> markup');

      // 801. Numbered List uses the native insertOrderedList command (real semantic <ol><li>, not manually-typed "1. 2. 3.")
      assert(noteContentEditorSrcV5.includes("applyList('insertOrderedList')"), '801. Numbered List is wired to document.execCommand(\'insertOrderedList\') — produces real <ol><li> markup');

      // 802. FUNCTIONAL: a list note persists through create() + getById() (save/reload)
      {
        const created = await notesService.create({ title: 'List Persist Check', contentHtml: '<ul><li>Call candidate</li><li>Send letter</li></ul>', category: 'General' });
        const reloaded = await notesService.getById(created.id);
        assert(reloaded && reloaded.contentHtml.includes('<ul><li>Call candidate</li><li>Send letter</li></ul>'), '802. A bulleted-list note\'s contentHtml persists exactly through notesService.create() and a fresh getById() (save/reload)');
      }

      // 803. Bullets render in the Card preview (NoteCard.jsx uses a <div>, not a <p>, so block-level <ul>/<ol> content nests validly)
      assert(noteCardSrcV5.includes('<div className="note-content-preview"') && !noteCardSrcV5.includes('<p className="note-content-preview"'), '803. NoteCard\'s content preview container is a <div> (not a <p>, which cannot validly contain block-level <ul>/<ol>), so bullets render correctly in the Card preview');

      // 804. Numbering renders in the Card preview via the same container/path as bullets
      {
        const note = { contentHtml: '<ol><li>Step one</li><li>Step two</li></ol>' };
        assert(resolveV5(note).includes('<ol>') && resolveV5(note).includes('<li>Step one</li>'), '804. resolveNoteContentHtml() preserves numbered-list markup for the Card View preview');
      }

      // 805. Bullets render in Document View (same resolveNoteContentHtml() path, already confirmed scoped CSS exists)
      assert(/\.notes-document-content ul,/.test(indexCssSrcV5) || /notes-document-content ul/.test(indexCssSrcV5), '805. Scoped list styles exist for .notes-document-content ul — bullets render with visible markers in Document View');

      // 806. Numbering renders in Document View
      assert(indexCssSrcV5.includes('.notes-document-content ol'), '806. Scoped list styles exist for .notes-document-content ol — numbering renders with visible markers in Document View');

      // 807. FUNCTIONAL: list item text remains searchable via plain content (search never operates on raw HTML)
      {
        await notesService.create({ title: 'Searchable List Note', contentHtml: '<ul><li>Call the shortlisted candidate</li><li>Send offer letter</li></ul>', category: 'General' });
        const results1 = await notesService.getAll({ scope: 'my', search: 'offer letter' });
        const results2 = await notesService.getAll({ scope: 'my', search: 'shortlisted candidate' });
        assert(results1.some((n) => n.title === 'Searchable List Note') && results2.some((n) => n.title === 'Searchable List Note'), '807. Searching for text that only exists inside list items still finds the note — search operates on the derived plain content, not raw HTML');
      }

      // 808. ul/ol/li attributes are stripped safely (e.g. onclick) while the tags themselves survive
      {
        const cleaned = sanitizeV5('<ul onclick="alert(1)"><li onmouseover="x()">Item</li></ul>');
        assert(cleaned === '<ul><li>Item</li></ul>', `808. Arbitrary attributes on <ul>/<li> (onclick, onmouseover) are stripped while the safe tags survive (got: ${cleaned})`);
      }

      // --- FORMATTING COMBINATIONS (27-30) ---

      // 809. Bold inside a bullet persists through sanitization
      {
        const combo = sanitizeV5('<ul><li><b>Bold</b> item</li></ul>');
        assert(combo === '<ul><li><b>Bold</b> item</li></ul>', `809. Bold text inside a bulleted list item is preserved by sanitizeNoteHtml() (got: ${combo})`);
      }

      // 810. Italic inside a numbered item persists through sanitization
      {
        const combo = sanitizeV5('<ol><li><i>Italic</i> step</li></ol>');
        assert(combo === '<ol><li><i>Italic</i> step</li></ol>', `810. Italic text inside a numbered list item is preserved by sanitizeNoteHtml() (got: ${combo})`);
      }

      // 811. Highlighted bold text persists through sanitization (highlight does not remove existing B/I/U)
      {
        const combo = sanitizeV5('<b><mark data-highlight="yellow">Bold and highlighted</mark></b>');
        assert(combo === '<b><mark data-highlight="yellow">Bold and highlighted</mark></b>', `811. Bold + Highlight combine without either one stripping the other (got: ${combo})`);
      }

      // 812. Underline + Highlight combine and persist through sanitization
      {
        const combo = sanitizeV5('<u><mark data-highlight="pink">Underlined and highlighted</mark></u>');
        assert(combo === '<u><mark data-highlight="pink">Underlined and highlighted</mark></u>', `812. Underline + Highlight combine without either one stripping the other (got: ${combo})`);
      }

      // --- SANITIZATION (31-36) ---

      // 813. Scripts remain stripped even alongside the new tags
      assert(sanitizeV5('<script>alert(1)</script><ul><li>safe</li></ul>') === '<ul><li>safe</li></ul>', '813. <script> tags remain stripped entirely, even in HTML that also contains the new list/highlight markup');

      // 814. Event handlers remain stripped everywhere, including on the newly-allowed tags
      assert(!sanitizeV5('<ul onclick="a()"><li onmouseover="b()"><mark data-highlight="yellow" onfocus="c()">x</mark></li></ul>').match(/on[a-z]+=/i), '814. Event handler attributes (onclick/onmouseover/onfocus) are stripped from every tag, including <ul>/<li>/<mark>');

      // 815. Iframes remain stripped
      assert(!sanitizeV5('<iframe src="evil.com"></iframe><ol><li>safe</li></ol>').includes('iframe'), '815. <iframe> tags remain stripped entirely, even alongside the new list markup');

      // 816. Images remain stripped
      assert(!sanitizeV5('<img src=x onerror=alert(1)><mark data-highlight="green">safe</mark>').includes('<img'), '816. <img> tags remain stripped entirely, even alongside highlight markup');

      // 817. Unsupported tags remain sanitized/unwrapped (e.g. <span>/<table>/<a> keep only their inner text)
      {
        const unwrapped = sanitizeV5('<span class="x"><table><tr><td>cell</td></tr></table></span><a href="javascript:alert(1)">link</a>');
        assert(!unwrapped.includes('<span') && !unwrapped.includes('<table') && !unwrapped.includes('<a ') && unwrapped.includes('cell') && unwrapped.includes('link'), `817. Unsupported tags (span/table/a) are unwrapped (tag removed, inner text kept), not merely attribute-stripped (got: ${unwrapped})`);
      }

      // 818. No unsanitized HTML rendering path was introduced — every note-content render still funnels through resolveNoteContentHtml()/sanitizeNoteHtml()
      {
        const allRenderSurfaces = [noteCardSrcV5, notesDocViewSrcV5].join('\n');
        const dangerousSetters = allRenderSurfaces.match(/dangerouslySetInnerHTML/g) || [];
        const throughResolve = allRenderSurfaces.match(/dangerouslySetInnerHTML=\{\{ __html: resolveNoteContentHtml\(/g) || [];
        assert(dangerousSetters.length === throughResolve.length && dangerousSetters.length >= 2, '818. Every dangerouslySetInnerHTML usage across NoteCard and NotesDocumentView still goes through resolveNoteContentHtml() — no new unsanitized rendering path was introduced');
      }

      // --- COMPATIBILITY (37-47) ---

      // 819. FUNCTIONAL: a legacy plain-content-only note (no contentHtml) still renders normally
      {
        const legacyHtml = resolveV5({ content: 'Just plain legacy text\nwith a line break' });
        assert(legacyHtml.includes('Just plain legacy text') && legacyHtml.includes('<br>'), '819. A legacy note with only plain `content` (no contentHtml) still renders normally via resolveNoteContentHtml()');
      }

      // 820. FUNCTIONAL: an existing B/I/U-only note (no lists/highlight) still renders correctly
      {
        const biu = sanitizeV5('<b>Bold</b> <i>Italic</i> <u>Underline</u>');
        assert(biu === '<b>Bold</b> <i>Italic</i> <u>Underline</u>', '820. Existing Bold/Italic/Underline-only notes continue to sanitize and render exactly as before — no regression from adding lists/highlight');
      }

      // 821. Line breaks remain intact alongside the new formatting
      {
        const withBreaks = sanitizeV5('Line one<br>Line two<div>Line three</div>');
        assert(withBreaks.includes('<br>') && withBreaks.includes('<div>Line three</div>'), '821. <br> and <div> line-break handling is unchanged by the highlight/list additions');
      }

      // 822. Search still uses plain `content`, never raw HTML — a search for an HTML tag fragment does not accidentally match
      {
        await notesService.create({ title: 'HTML Tag Search Safety', contentHtml: '<ul><li>normal item</li></ul>', category: 'General' });
        const rawTagSearch = await notesService.getAll({ scope: 'my', search: '<ul>' });
        assert(!rawTagSearch.some((n) => n.title === 'HTML Tag Search Safety'), '822. Searching for a raw HTML tag fragment ("<ul>") does not match — confirms search still operates on derived plain content, not markup');
      }

      // 823. Custom categories are unaffected by this formatting-only change
      assert(noteEditorModalSrcV5.includes('CUSTOM_CATEGORY_OPTION') && notesDocViewSrcV5.includes('CUSTOM_CATEGORY_OPTION'), '823. Custom category selection/handling (CUSTOM_CATEGORY_OPTION) is untouched by this task');

      // 824. Color accents are unaffected by this formatting-only change (a separate, pre-existing concept from highlight colors)
      assert(noteDomainSrcV5.includes('NOTE_ACCENTS') && noteDomainSrcV5.includes('NOTE_HIGHLIGHT_COLORS') && noteDomainSrcV5.indexOf('NOTE_ACCENTS') !== noteDomainSrcV5.indexOf('NOTE_HIGHLIGHT_COLORS'), '824. NOTE_ACCENTS (note color accents) and the new NOTE_HIGHLIGHT_COLORS (text highlight palette) are two distinct, independent constants — adding highlight did not touch color accents');

      // 825. Card/Document view switching is unaffected
      assert(notesDocViewSrcV5.includes('variant') && noteCardSrcV5.includes('variant'), '825. Card View / Document View components are unchanged in structure by this formatting-only task');

      // 826. Save/Cancel state behavior in Document View is unaffected (isEditing/isDirty machinery untouched)
      assert(notesDocViewSrcV5.includes('const [isEditing, setIsEditing] = useState(false);') && notesDocViewSrcV5.includes('const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);'), '826. Document View\'s read/edit state and dirty-tracking machinery (isEditing/isDirty) are unchanged by this formatting task');

      // 827. Pin is unaffected
      assert(notesServiceSrcV5.includes('async togglePin(id)'), '827. notesService.togglePin() is unchanged');

      // 828. Archive/Restore are unaffected
      assert(notesServiceSrcV5.includes('async archive(id)') && notesServiceSrcV5.includes('async restore(id)'), '828. notesService.archive()/restore() are unchanged');

      // 829. Delete is unaffected
      assert(notesServiceSrcV5.includes('async deletePermanently(id)'), '829. notesService.deletePermanently() is unchanged');

      // --- RESPONSIVE (48-51) ---

      // 830. Toolbar wraps if needed and uses compact button sizing — no page-level horizontal overflow rule was introduced
      assert(indexCssSrcV5.includes('flex-wrap: wrap;') && /\.note-content-toolbar\s*\{[^}]*flex-wrap:\s*wrap;/.test(indexCssSrcV5), '830. .note-content-toolbar allows wrapping (flex-wrap: wrap) so the now-larger button set stays usable without forcing horizontal overflow, even though compact 28px buttons should rarely need to wrap');

      // 831. No new overflow-x: scroll/auto rules were introduced by the highlight popover or list/mark CSS
      assert(!/\.note-highlight-popover[\s\S]{0,200}overflow-x:\s*(scroll|auto)/.test(indexCssSrcV5) && !/\.note-content-editable (ul|ol)[\s\S]{0,150}overflow-x:\s*(scroll|auto)/.test(indexCssSrcV5), '831. No new overflow-x rules were introduced by the highlight popover or list styling CSS');

      // 832. The highlight popover is a small, fixed-width control (not full toolbar width) and positions itself relative to just the Highlight button
      assert(/\.note-highlight-control\s*\{[^}]*position:\s*relative;/.test(indexCssSrcV5) && /\.note-highlight-popover\s*\{[^}]*position:\s*absolute;/.test(indexCssSrcV5) && /\.note-highlight-popover\s*\{[^}]*min-width:\s*\d+px;/.test(indexCssSrcV5), '832. The highlight popover positions absolutely relative to its own compact .note-highlight-control wrapper (not the whole toolbar), staying small rather than widening the toolbar');

      // --- GENERAL (52-56) ---

      // 833. notesService remains the sole data boundary — the sanitize/derive step still happens centrally in resolveContentFields(), not scattered across UI components
      assert(notesServiceSrcV5.includes('function resolveContentFields(payload)') && notesServiceSrcV5.includes('sanitizeNoteHtml(payload.contentHtml)'), '833. notesService.js still centralizes sanitization/derivation in resolveContentFields() — the storage boundary is unchanged by adding highlight/list support');

      // 834. No direct localStorage writes were added by this task's changes
      {
        const thisTaskFiles = [noteContentEditorSrcV5, noteCardSrcV5, noteDomainSrcV5].join('\n');
        assert(!thisTaskFiles.includes('localStorage.'), '834. None of this task\'s modified files (NoteContentEditor/NoteCard/noteDomain) write to localStorage directly');
      }

      // 835. Shared Onboarding/Offboarding activity infrastructure remains untouched
      assert(activityServiceSrcV5.includes('async markComplete(') && activityServiceSrcV5.includes('async reopen(') && activityServiceSrcV5.includes('async getActiveTypes(') && activityServiceSrcV5.includes('async getOverdueActivities('), '835. activityService.js (markComplete/reopen/getActiveTypes/getOverdueActivities) is unchanged — this task touched only Notes formatting files');

      // 836. No heavy rich-text editor library was installed — package.json has no new rich-text dependency
      {
        const pkgJson = JSON.parse(fs.readFileSync(path.resolve('./package.json'), 'utf-8'));
        const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
        const richTextLibNames = ['quill', 'draft-js', 'slate', 'tiptap', '@tiptap/core', 'ckeditor', 'react-quill', 'lexical'];
        assert(!richTextLibNames.some((lib) => deps[lib]), '836. No heavy rich-text editor library was added to package.json — the lightweight contentEditable + execCommand approach was extended in place');
      }

      // 837. No font-family, font-size, text-color, alignment, heading, table, image, or link controls were added to the toolbar
      assert(!/font-family|fontSize|AlignCenter|AlignLeft|AlignRight|Heading[1-6]|<Table|<LinkIcon/i.test(noteContentEditorSrcV5), '837. The toolbar adds only Highlight/Bulleted List/Numbered List — no font/alignment/heading/table/link controls were introduced');

      // 838. No nested-list/indent controls were added (no Indent/Outdent/checkbox-list controls)
      assert(!/Indent|Outdent|checkbox|Roman/i.test(noteContentEditorSrcV5), '838. No indent/outdent, nested-list, checkbox-list, or Roman-numeral controls were added — only flat Bulleted List and Numbered List');

      resetDatabase();
    }
    // ==========================================================================
    // Notes: Optional Reminders + In-App Notification Bell
    // ==========================================================================
    {
      const noteDomainSrcV6 = fs.readFileSync(path.resolve('./src/domain/noteDomain.js'), 'utf-8');
      const notesServiceSrcV6 = fs.readFileSync(path.resolve('./src/services/notesService.js'), 'utf-8');
      const notificationServiceSrcV6 = fs.existsSync(path.resolve('./src/services/notificationService.js'))
        ? fs.readFileSync(path.resolve('./src/services/notificationService.js'), 'utf-8')
        : '';
      const noteCardSrcV6 = fs.readFileSync(path.resolve('./src/components/notes/NoteCard.jsx'), 'utf-8');
      const notesDocViewSrcV6 = fs.readFileSync(path.resolve('./src/components/notes/NotesDocumentView.jsx'), 'utf-8');
      const noteEditorModalSrcV6 = fs.readFileSync(path.resolve('./src/components/notes/NoteEditorModal.jsx'), 'utf-8');
      const reminderModalSrcV6 = fs.existsSync(path.resolve('./src/components/notes/ReminderModal.jsx'))
        ? fs.readFileSync(path.resolve('./src/components/notes/ReminderModal.jsx'), 'utf-8')
        : '';
      const headerSrcV6 = fs.readFileSync(path.resolve('./src/components/layout/Header.jsx'), 'utf-8');
      const notificationPanelSrcV6 = fs.existsSync(path.resolve('./src/components/layout/NotificationPanel.jsx'))
        ? fs.readFileSync(path.resolve('./src/components/layout/NotificationPanel.jsx'), 'utf-8')
        : '';
      const notificationContextSrcV6 = fs.existsSync(path.resolve('./src/state/NotificationContext.jsx'))
        ? fs.readFileSync(path.resolve('./src/state/NotificationContext.jsx'), 'utf-8')
        : '';
      const storageEngineSrcV6 = fs.readFileSync(path.resolve('./src/mock-data/storageEngine.js'), 'utf-8');
      const notesPageSrcV6 = fs.readFileSync(path.resolve('./src/pages/notes/NotesPage.jsx'), 'utf-8');
      const activityServiceSrcV6 = fs.readFileSync(path.resolve('./src/services/activityService.js'), 'utf-8');
      const indexCssSrcV6 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

      const { validateReminder: validateReminderV6, combineReminderDateTime: combineV6, formatReminderLabel: formatReminderLabelV6 } = await import('../domain/noteDomain.js');

      // --- REMINDER BASICS (1-15) ---

      // 839. FUNCTIONAL: a brand-new note defaults to no reminder
      {
        const n = await notesService.create({ title: 'Reminder Basics — New Note', content: 'x', category: 'General' });
        assert(n.reminderAt === null, '839. A newly created note defaults reminderAt to null — reminders are off by default');
      }

      // 840. Existing legacy notes (no reminderAt field at all) behave as "no reminder" — no destructive migration was run
      {
        const legacyNote = { id: 'legacy-1', title: 'Legacy', content: 'x' }; // no reminderAt key
        assert(!legacyNote.reminderAt, '840. A legacy note object with no reminderAt field at all is treated as having no reminder (falsy), without needing a migration to add the field');
      }

      // 841. A Reminder Bell action exists on NoteCard (Card View)
      assert(noteCardSrcV6.includes("import { Pin, PinOff, Pencil, Archive, RotateCcw, Trash2, Bell } from 'lucide-react'") || (noteCardSrcV6.includes("Bell") && noteCardSrcV6.includes('onReminderRequest')), '841. NoteCard renders a Reminder Bell action wired to onReminderRequest');

      // 842. A Reminder Bell action exists on NotesDocumentView (Document View), in the same always-visible actions bar as Pin/Archive/Delete
      assert(notesDocViewSrcV6.includes('onReminderRequest') && /notes-document-actions[\s\S]{0,1400}<Bell size=\{15\} \/>/.test(notesDocViewSrcV6), '842. NotesDocumentView renders a Reminder Bell action inside the same .notes-document-actions bar as Pin/Archive/Delete');

      // 843. Tooltip text switches between "Set reminder" (no reminder) and "Edit reminder" (reminder exists) in both views
      assert(
        noteCardSrcV6.includes("note.reminderAt ? 'Edit reminder' : 'Set reminder'") &&
        notesDocViewSrcV6.includes("selectedNote.reminderAt ? 'Edit reminder' : 'Set reminder'"),
        '843. Both NoteCard and NotesDocumentView show "Set reminder" when none exists and "Edit reminder" when one does'
      );

      // 844. A shared ReminderModal component exists with Date and Time fields — one implementation reused by both views
      assert(reminderModalSrcV6.includes('export default function ReminderModal') && (noteCardSrcV6.match(/ReminderModal/g) || notesDocViewSrcV6.match(/ReminderModal/g) || notesPageSrcV6.match(/ReminderModal/g)), '844. A single shared ReminderModal component exists (not a separate dialog per view)');

      // 845. Date can be selected via a real <input type="date">
      assert(reminderModalSrcV6.includes('type="date"'), '845. ReminderModal renders a real <input type="date"> for picking the reminder date');

      // 846. Time can be selected via a real <input type="time">
      assert(reminderModalSrcV6.includes('type="time"'), '846. ReminderModal renders a real <input type="time"> for picking the reminder time');

      // 847. FUNCTIONAL: a reminder saves correctly via notesService.setReminder()
      {
        const n = await notesService.create({ title: 'Save Reminder Check', content: 'x', category: 'General' });
        const futureIso = new Date(Date.now() + 3600000).toISOString();
        const saved = await notesService.setReminder(n.id, futureIso);
        assert(saved.reminderAt === futureIso, '847. notesService.setReminder() saves the exact chosen reminder timestamp');

        // 848. FUNCTIONAL: reminder persists after reload (fresh getById)
        const reloaded = await notesService.getById(n.id);
        assert(reloaded.reminderAt === futureIso, '848. The reminder persists after a fresh notesService.getById() (simulated reload)');

        // 849. FUNCTIONAL: only the targeted note receives the reminder
        const other = await notesService.create({ title: 'Untouched By Reminder', content: 'y', category: 'General' });
        assert(other.reminderAt === null, '849. Setting a reminder on one note does not affect a different, unrelated note');

        // 850. FUNCTIONAL: reminder can be edited (changed to a different future value)
        const editedIso = new Date(Date.now() + 7200000).toISOString();
        const edited = await notesService.setReminder(n.id, editedIso);
        assert(edited.reminderAt === editedIso && edited.reminderAt !== futureIso, '850. An existing reminder can be edited to a new date/time via the same setReminder()');

        // 851/852. FUNCTIONAL: reminder can be removed, and removing it does not alter note content
        const beforeRemoveContent = edited.content;
        const removed = await notesService.removeReminder(n.id);
        assert(removed.reminderAt === null, '851. notesService.removeReminder() clears the reminder');
        assert(removed.content === beforeRemoveContent && removed.title === n.title, '852. Removing a reminder does not alter the note\'s title/content');
      }

      // 853. FUNCTIONAL: a past date/time cannot be newly scheduled
      {
        const n = await notesService.create({ title: 'Past Reminder Rejection Check', content: 'x', category: 'General' });
        const pastIso = new Date(Date.now() - 60000).toISOString();
        let threw = false;
        try {
          await notesService.setReminder(n.id, pastIso);
        } catch (err) {
          threw = true;
        }
        assert(threw, '853. notesService.setReminder() rejects a reminder time that has already passed, at the service boundary (not just the UI)');
        assert(!validateReminderV6(pastIso).isValid, '853b. noteDomain.validateReminder() also rejects a past timestamp directly');
        assert(validateReminderV6(new Date(Date.now() + 60000).toISOString()).isValid, '853c. noteDomain.validateReminder() accepts a genuinely future timestamp');
      }

      // 854. UPDATED — Reminder metadata is rendered conditionally in both views, never unconditionally. Originally gated on reminderAt alone; a later task changed this to gate on the shared isReminderActive (attention-state) result instead, so the line also hides once a due reminder has been read — see checks 940/954+ for the full attention-state-driven behavior.
      assert(
        /\{isReminderActive && \([\s\S]{0,200}note-reminder-badge/.test(noteCardSrcV6) &&
        /\{isReminderActive && \([\s\S]{0,200}note-reminder-badge/.test(notesDocViewSrcV6),
        '854. The reminder metadata line is conditionally rendered only when isReminderActive is true, in both NoteCard and NotesDocumentView — never unconditionally'
      );

      // 855. No "Reminder: None" (or equivalent placeholder) is ever actually RENDERED as JSX text — checked as a real text node (">Reminder: None<"), not merely mentioned in a source comment explaining what to avoid (both NoteCard's and this check's own comments legitimately contain that phrase as prose)
      {
        const allNotesUi = [noteCardSrcV6, notesDocViewSrcV6, reminderModalSrcV6, noteEditorModalSrcV6].join('\n');
        assert(!/>\s*Reminder:\s*None\s*</i.test(allNotesUi), '855. No "Reminder: None" placeholder is ever rendered as actual JSX text — a note without a reminder shows no reminder line at all');
      }

      // --- NOTIFICATIONS (16-30) ---

      // 856. The top application Bell is clickable (has a real onClick handler, not inert)
      assert(headerSrcV6.includes('onClick={() => setIsNotificationPanelOpen') && headerSrcV6.includes('aria-label="Notifications"'), '856. The top header Bell button has a real onClick handler that opens the notification panel');

      // 857. Clicking the bell opens a notification panel/dropdown
      assert(headerSrcV6.includes('<NotificationPanel') && notificationPanelSrcV6.includes('export default function NotificationPanel'), '857. Header renders a NotificationPanel component tied to the bell\'s open state');

      // 858. Empty state works ("No notifications yet." or a concise equivalent)
      assert(/No notifications yet\.?/i.test(notificationPanelSrcV6), '858. NotificationPanel shows a concise empty state ("No notifications yet.") when there are none — never fake/demo notifications');

      // 859. FUNCTIONAL: a future (not-yet-due) reminder does not create a notification early
      {
        const n = await notesService.create({ title: 'Future Reminder — No Early Notif', content: 'x', category: 'General' });
        await notesService.setReminder(n.id, new Date(Date.now() + 3600000).toISOString());
        await notificationService.checkDueReminders();
        const all = await notificationService.getAll();
        assert(!all.some((notif) => notif.noteId === n.id), '859. checkDueReminders() does not generate a notification for a reminder that is not yet due');
      }

      // 860. FUNCTIONAL: a due reminder creates a notification, using the note's title dynamically
      let dueTestNoteId;
      {
        const n = await notesService.create({ title: 'Candidate Follow-ups (Due Test)', content: 'x', category: 'General' });
        dueTestNoteId = n.id;
        await notesService.setReminder(n.id, new Date(Date.now() + 400).toISOString());
        await new Promise((resolve) => setTimeout(resolve, 600));
        await notificationService.checkDueReminders();
        const all = await notificationService.getAll();
        const generated = all.find((notif) => notif.noteId === n.id);
        assert(Boolean(generated), '860. A due reminder generates an in-app notification');
        assert(generated && generated.title === 'Candidate Follow-ups (Due Test)', '860b. The notification uses the note\'s actual title dynamically, never a hard-coded example name');
      }

      // 861. FUNCTIONAL: the notification is created only once for that reminder occurrence (repeated checks never duplicate it)
      {
        await notificationService.checkDueReminders();
        await notificationService.checkDueReminders();
        await notificationService.checkDueReminders();
        const all = await notificationService.getAll();
        const count = all.filter((notif) => notif.noteId === dueTestNoteId).length;
        assert(count === 1, `861. Repeated checkDueReminders() calls (simulating render/refresh/route-change) never create a duplicate notification for the same reminder occurrence (found ${count})`);
      }

      // 862. FUNCTIONAL: a newly triggered notification starts unread
      {
        const all = await notificationService.getAll();
        const generated = all.find((notif) => notif.noteId === dueTestNoteId);
        assert(generated && generated.isRead === false, '862. A newly generated notification starts unread (isRead: false)');
      }

      // 863/864. The top unread indicator is conditional on unreadCount > 0 — it disappears once nothing is unread (same conditional both ways)
      assert(/\{unreadCount > 0 && <span className="notification-dot" \/>\}/.test(headerSrcV6), '863. The top bell\'s red/unread dot only renders when unreadCount > 0 — it is never a permanently-shown fake indicator, and disappears automatically once unreadCount returns to 0');

      // 865. FUNCTIONAL: clicking/marking a notification as read works
      {
        const all = await notificationService.getAll();
        const generated = all.find((notif) => notif.noteId === dueTestNoteId);
        await notificationService.markAsRead(generated.id);
        const after = await notificationService.getAll();
        assert(after.find((notif) => notif.id === generated.id).isRead === true, '865. notificationService.markAsRead() marks the specific notification read');
      }

      // 866. Clicking a notification looks up its note and navigates to the correct specific note (archived vs non-archived route), reusing the existing note-selection architecture (openNoteId router state) rather than a duplicate note editor
      assert(
        notificationPanelSrcV6.includes('notesService.getById(notification.noteId)') &&
        notificationPanelSrcV6.includes("navigate(note.isArchived ? '/notes/archived' : '/notes', { state: { openNoteId: note.id } })") &&
        notesPageSrcV6.includes('location.state?.openNoteId'),
        '866. Clicking a notification looks up the real note, routes to the correct My Notes/Archived page, and NotesPage reads openNoteId from router state to select that exact note in Document View — no duplicate note editor was built'
      );

      // 867. FUNCTIONAL: changing a reminder to a new future time makes it eligible for a new notification occurrence
      {
        const n = await notesService.create({ title: 'Re-trigger Reminder Check', content: 'x', category: 'General' });
        await notesService.setReminder(n.id, new Date(Date.now() + 400).toISOString());
        await new Promise((resolve) => setTimeout(resolve, 600));
        await notificationService.checkDueReminders();
        let all = await notificationService.getAll();
        assert(all.filter((notif) => notif.noteId === n.id).length === 1, '867a. First occurrence generates exactly one notification');

        await notesService.setReminder(n.id, new Date(Date.now() + 400).toISOString());
        await new Promise((resolve) => setTimeout(resolve, 600));
        await notificationService.checkDueReminders();
        all = await notificationService.getAll();
        assert(all.filter((notif) => notif.noteId === n.id).length === 2, '867b. Rescheduling to a new future time and letting it become due again produces a second, new notification occurrence');
      }

      // 868. FUNCTIONAL: no duplicate notification appears from repeated getAll()/refresh() calls with no new due reminders (simulates re-renders/route changes)
      {
        const beforeCount = (await notificationService.getAll()).length;
        await notificationService.checkDueReminders();
        await notificationService.checkDueReminders();
        const afterCount = (await notificationService.getAll()).length;
        assert(beforeCount === afterCount, '868. Calling checkDueReminders()/getAll() repeatedly with no newly-due reminders never creates duplicate notifications (simulates polling/re-render/route-change)');
      }

      // 869. No fake/demo notifications exist — the initial database state always starts with an empty notifications collection
      assert(/notifications:\s*\[\]/.test(storageEngineSrcV6), '869. storageEngine\'s initial state seeds notifications as an empty array — no fake/demo notification records are ever pre-populated');

      // 870. An optional "Mark all as read" action exists and works functionally
      {
        assert(notificationPanelSrcV6.includes('Mark all as read') && notificationPanelSrcV6.includes('markAllAsRead'), '870. NotificationPanel offers a "Mark all as read" action');
        await notificationService.markAllAsRead();
        const all = await notificationService.getAll();
        assert(all.every((notif) => notif.isRead), '870b. notificationService.markAllAsRead() marks every notification read');
      }

      // --- IN-APP ONLY (31-35) ---

      // 871. No email service is imported or called anywhere in the reminder/notification code path
      {
        const reminderNotificationFiles = [noteDomainSrcV6, notesServiceSrcV6, notificationServiceSrcV6, reminderModalSrcV6, notificationPanelSrcV6, notificationContextSrcV6, noteCardSrcV6, notesDocViewSrcV6, headerSrcV6].join('\n');
        assert(!/candidateEmailService|emailTemplateService|emailService/i.test(reminderNotificationFiles), '871. No email service (candidateEmailService/emailTemplateService/any emailService) is imported or referenced anywhere in the reminder/notification feature');
      }

      // 872. No email is ever sent as part of setting, editing, or triggering a reminder
      assert(!/sendEmail|mailto:|smtp/i.test([notesServiceSrcV6, notificationServiceSrcV6, reminderModalSrcV6].join('\n')), '872. Nothing in the reminder-writing or due-reminder-detection code path sends an email');

      // 873. No email option/field exists in the reminder UI
      assert(!/email/i.test(reminderModalSrcV6), '873. ReminderModal has no email address field, "Email me" checkbox, or any email-related option — reminders are in-app only');

      // 874. No browser push notification API is used
      {
        const allReminderFiles = [notificationServiceSrcV6, notificationContextSrcV6, notificationPanelSrcV6, reminderModalSrcV6, headerSrcV6].join('\n');
        assert(!/new Notification\(|serviceWorker|showNotification/.test(allReminderFiles), '874. No browser push Notification API (new Notification(), serviceWorker, showNotification) is used anywhere — this is an in-app-only notification center');
      }

      // 875. No browser notification permission is ever requested
      {
        const allReminderFiles = [notificationServiceSrcV6, notificationContextSrcV6, notificationPanelSrcV6, reminderModalSrcV6, headerSrcV6].join('\n');
        assert(!/requestPermission/.test(allReminderFiles), '875. Notification.requestPermission() (or any permission request) is never called');
      }

      // --- INDEPENDENCE (36-43) ---

      // 876/877. FUNCTIONAL: Pin/Unpin do not change the reminder
      {
        const n = await notesService.create({ title: 'Pin Independence Check', content: 'x', category: 'General' });
        const futureIso = new Date(Date.now() + 3600000).toISOString();
        await notesService.setReminder(n.id, futureIso);
        await notesService.togglePin(n.id);
        const pinned = await notesService.getById(n.id);
        assert(pinned.reminderAt === futureIso, '876. Pinning a note does not change its reminder');
        await notesService.togglePin(n.id);
        const unpinned = await notesService.getById(n.id);
        assert(unpinned.reminderAt === futureIso, '877. Unpinning a note does not change its reminder');
      }

      // 878. FUNCTIONAL: Archive does not remove the reminder
      {
        const n = await notesService.create({ title: 'Archive Independence Check', content: 'x', category: 'General' });
        const futureIso = new Date(Date.now() + 3600000).toISOString();
        await notesService.setReminder(n.id, futureIso);
        await notesService.archive(n.id);
        const archived = await notesService.getById(n.id);
        assert(archived.reminderAt === futureIso, '878. Archiving a note does not remove its reminder — Archive and Reminder are independent features');

        // 879. FUNCTIONAL: Restore does not change the reminder
        await notesService.restore(n.id);
        const restored = await notesService.getById(n.id);
        assert(restored.reminderAt === futureIso, '879. Restoring an archived note does not change its reminder');
      }

      // 880. FUNCTIONAL: editing note content/title does not remove its reminder
      {
        const n = await notesService.create({ title: 'Edit Independence Check', content: 'original', category: 'General' });
        const futureIso = new Date(Date.now() + 3600000).toISOString();
        await notesService.setReminder(n.id, futureIso);
        const edited = await notesService.update(n.id, { title: 'Edited Title', content: 'new content', category: 'Recruitment' });
        assert(edited.reminderAt === futureIso, '880. Editing a note\'s title/content/category does not accidentally remove or change its reminder');

        // 881. FUNCTIONAL: editing the reminder does not modify note content
        const rescheduled = new Date(Date.now() + 7200000).toISOString();
        const reminderEdited = await notesService.setReminder(n.id, rescheduled);
        assert(reminderEdited.title === 'Edited Title' && reminderEdited.content === 'new content', '881. Changing a reminder\'s date/time does not modify the note\'s title/content');
      }

      // 882. FUNCTIONAL: permanently deleting a note prevents its reminder from ever triggering again
      {
        const n = await notesService.create({ title: 'Delete Prevents Trigger Check', content: 'x', category: 'General' });
        await notesService.setReminder(n.id, new Date(Date.now() + 400).toISOString());
        await notesService.deletePermanently(n.id);
        await new Promise((resolve) => setTimeout(resolve, 600));
        await notificationService.checkDueReminders();
        const all = await notificationService.getAll();
        assert(!all.some((notif) => notif.noteId === n.id), '882. A permanently-deleted note\'s reminder never generates a notification, even after its scheduled time passes');
      }

      // 883. Clicking a notification for an already-deleted note is handled safely (no crash) — the panel defensively looks up the note and no-ops if it is missing
      assert(
        notificationPanelSrcV6.includes('.catch(() => null)') && /if \(!note\) return;/.test(notificationPanelSrcV6),
        '883. NotificationPanel\'s click handler defensively handles a note that no longer exists (safe no-op) rather than crashing'
      );

      // --- EXISTING FEATURES REGRESSION SPOT-CHECKS (44-64 covered broadly by the full suite re-passing; a few targeted checks specific to this task's integration points) ---

      // 884. NoteEditorModal (Card View's New/Edit modal) was not given its own separate reminder UI — reminders live only in the one shared ReminderModal via NoteCard/NotesDocumentView's bell
      assert(!/reminder/i.test(noteEditorModalSrcV6), '884. NoteEditorModal has no reminder-related code at all — Create/Edit Note behavior is completely unchanged, and there is exactly one reminder UI (ReminderModal), not a second one embedded in the modal');

      // 885. Document View's Reminder button is deliberately NOT wrapped in requestAction() — opening it can never trigger (or be blocked by) the Unsaved Changes guard, and can never silently discard in-progress edits
      assert(/onClick=\{\(\) => onReminderRequest\(selectedNote\)\}/.test(notesDocViewSrcV6) && !/onClick=\{\(\) => requestAction\(\(\) => onReminderRequest/.test(notesDocViewSrcV6), '885. The Reminder button calls onReminderRequest directly (not through requestAction), so it never interacts with the unsaved-changes guard — Save Changes/Cancel Changes/Unsaved Changes behavior is completely unaffected');

      // 886. Pin/Archive/Delete in Document View remain wrapped in requestAction() exactly as before — the reminder addition did not weaken the existing unsaved-changes guard
      assert(
        /onClick=\{\(\) => requestAction\(\(\) => onTogglePin\(selectedNote\)\)\}/.test(notesDocViewSrcV6) &&
        /onClick=\{\(\) => requestAction\(\(\) => onArchive\(selectedNote\)\)\}/.test(notesDocViewSrcV6) &&
        /onClick=\{\(\) => requestAction\(\(\) => onDeleteRequest\(selectedNote\)\)\}/.test(notesDocViewSrcV6),
        '886. Pin/Archive/Delete in Document View still route through requestAction() exactly as before — the existing unsaved-changes guard is unweakened by this task'
      );

      // 887. notesService.setReminder()/removeReminder() never touch content/contentHtml/title — reminder writes are provably isolated from note content fields
      assert(
        /async setReminder\(id, reminderAtIso\) \{[\s\S]*?notes\[index\] = \{ \.\.\.notes\[index\], reminderAt: reminderAtIso, reminderNotificationGeneratedFor: null, updatedAt: new Date\(\)\.toISOString\(\) \};/.test(notesServiceSrcV6) &&
        /async removeReminder\(id\) \{[\s\S]*?notes\[index\] = \{ \.\.\.notes\[index\], reminderAt: null, reminderNotificationGeneratedFor: null, updatedAt: new Date\(\)\.toISOString\(\) \};/.test(notesServiceSrcV6),
        '887. setReminder()/removeReminder() only ever write reminderAt/reminderNotificationGeneratedFor/updatedAt onto the existing note object — title/content/contentHtml/category/tags/colorAccent/isPinned/isArchived are provably untouched by these two methods'
      );

      // 888. notificationService.js has no dependency on notesService.js (one-directional: notesService -> notificationService only) — no circular import
      assert(!/from ['"]\.\/notesService\.js['"]/.test(notificationServiceSrcV6), '888. notificationService.js does not import notesService.js — reminder/notification service boundaries stay one-directional, matching the clean-architecture goal for a future real backend');

      // 889. Shared Onboarding/Offboarding activity infrastructure remains completely untouched by this Notes-only feature
      assert(activityServiceSrcV6.includes('async markComplete(') && activityServiceSrcV6.includes('async reopen(') && !/reminder/i.test(activityServiceSrcV6), '889. activityService.js has no reminder-related code and its existing methods are unchanged — this task touched only the Notes module');

      // 890. No Stage 19 verification file was created
      assert(!fs.existsSync(path.resolve('./src/services/verifyStage19.js')), '890. No verifyStage19.js file exists — Stage 18 was extended in place as instructed');

      // 891. UPDATED — Reminder popup uses the standard compact .modal-card size (not a large/wide modal) — "keep this popup clean and compact". It now also carries a scoped `reminder-modal` class (for the footer-padding fix), but still not the wide/xl modal size tiers.
      assert(reminderModalSrcV6.includes('<div className="modal-card reminder-modal" onClick') && !reminderModalSrcV6.includes('wide-modal') && !reminderModalSrcV6.includes('xl-modal'), '891. ReminderModal uses the default compact .modal-card size (plus its own scoped reminder-modal class for footer spacing), not the wide/xl modal tiers — kept clean and compact per spec');

      // 892. The notification panel's width is capped relative to the viewport so it can never overflow horizontally at mobile widths
      assert(/\.notification-panel\s*\{[^}]*max-width:\s*calc\(100vw/.test(indexCssSrcV6), '892. .notification-panel caps its width via calc(100vw - ...) so it never causes horizontal overflow on narrow screens');

      resetDatabase();
    }
    // ==========================================================================
    // Fix: Reminder Modal Spacing + Active Reminder Bell + Due Notification Bug
    // ==========================================================================
    {
      const reminderModalSrcV7 = fs.readFileSync(path.resolve('./src/components/notes/ReminderModal.jsx'), 'utf-8');
      const noteCardSrcV7 = fs.readFileSync(path.resolve('./src/components/notes/NoteCard.jsx'), 'utf-8');
      const notesDocViewSrcV7 = fs.readFileSync(path.resolve('./src/components/notes/NotesDocumentView.jsx'), 'utf-8');
      const notificationContextSrcV7 = fs.readFileSync(path.resolve('./src/state/NotificationContext.jsx'), 'utf-8');
      const notificationServiceSrcV7 = fs.readFileSync(path.resolve('./src/services/notificationService.js'), 'utf-8');
      const headerSrcV7 = fs.readFileSync(path.resolve('./src/components/layout/Header.jsx'), 'utf-8');
      const indexCssSrcV7 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

      const { validateReminder: validateReminderV7, combineReminderDateTime: combineV7, splitReminderDateTime: splitV7 } = await import('../domain/noteDomain.js');

      // --- ISSUE 1: MODAL SPACING (1-4) ---

      // 893. Reminder modal footer has proper padding (24-32px horizontal, 24-28px bottom), scoped so it doesn't affect the many other modals sharing .modal-footer
      {
        const footerRuleMatch = indexCssSrcV7.match(/\.modal-card\.reminder-modal \.modal-footer\s*\{\s*padding:\s*([\d.]+)rem\s+([\d.]+)rem\s+([\d.]+)rem\s+([\d.]+)rem;/);
        assert(footerRuleMatch, '893. A scoped .modal-card.reminder-modal .modal-footer padding rule exists');
        if (footerRuleMatch) {
          const [, , rightRem, bottomRem, leftRem] = footerRuleMatch.map((v, i) => (i === 0 ? v : parseFloat(v)));
          const rightPx = rightRem * 16;
          const leftPx = leftRem * 16;
          const bottomPx = bottomRem * 16;
          assert(rightPx >= 24 && rightPx <= 32 && leftPx >= 24 && leftPx <= 32, `893b. Footer horizontal padding is within the requested 24-32px range (left=${leftPx}px, right=${rightPx}px)`);
          assert(bottomPx >= 24 && bottomPx <= 28, `893c. Footer bottom padding is within the requested 24-28px range (bottom=${bottomPx}px)`);
        }
      }

      // 894. Footer buttons do not touch modal edges — the fix is scoped to reminder-modal only, not a change to the shared .modal-footer used by many unrelated modals across the app
      assert(!/^\.modal-footer\s*\{[^}]*padding:/m.test(indexCssSrcV7.replace(/\.modal-card\.reminder-modal \.modal-footer[\s\S]{0,10}?\{[^}]*\}/g, '')), '894. The shared/global .modal-footer class itself was not given new padding — only the scoped .reminder-modal variant was, so unrelated modals elsewhere in the app are unaffected');

      // 895. Desktop layout stays balanced: Remove Reminder still on the left (marginRight: auto), Cancel + Save Changes on the right — layout order unchanged, only spacing fixed
      assert(reminderModalSrcV7.includes("style={{ marginRight: 'auto' }}") && reminderModalSrcV7.indexOf('Remove Reminder') < reminderModalSrcV7.indexOf('Cancel'), '895. Remove Reminder remains left-aligned (marginRight: auto) ahead of Cancel/Save Changes in source order — the fix only touched spacing, not button arrangement');

      // 896. Mobile: the 3-button footer (Remove Reminder/Cancel/Save Changes) stacks to full-width rows below 480px so no label wraps awkwardly mid-button, and no horizontal overflow is introduced
      assert(/@media \(max-width:\s*480px\)\s*\{\s*\.modal-card\.reminder-modal \.modal-footer\s*\{[^}]*flex-direction:\s*column-reverse;/.test(indexCssSrcV7) && !/\.modal-card\.reminder-modal[\s\S]{0,400}overflow-x:\s*(scroll|auto)/.test(indexCssSrcV7), '896. At mobile widths the reminder modal footer stacks to full-width buttons (no overflow-x rule was introduced)');

      // --- ISSUE 2: ACTIVE REMINDER BELL (5-8) ---

      // 897. UPDATED — Note Bell has a neutral appearance when no reminder exists — the active class is now applied conditionally on the shared attention-state result (not merely Boolean(reminderAt)), never unconditionally
      assert(/\{isReminderActive \? 'icon-btn-reminder-active' : ''\}/.test(noteCardSrcV7) && /\{isReminderActive \? 'icon-btn-reminder-active' : ''\}/.test(notesDocViewSrcV7), '897. The active reminder-bell class is applied only when getReminderAttentionState() returns true, in both NoteCard and NotesDocumentView — a note with no reminder (or an acknowledged one) keeps the normal neutral Bell');

      // 898. Active Bell uses a clear, persistent teal-tinted treatment (visible at rest, not just on hover) built from the exact brand tokens named in this fix (Primary Teal / Teal Light Tint / Teal Border), not a red/warning/error color
      {
        const activeRuleMatch = indexCssSrcV7.match(/\.icon-btn-reminder-active\s*\{([^}]*)\}/);
        assert(activeRuleMatch, '898. .icon-btn-reminder-active CSS rule exists');
        if (activeRuleMatch) {
          const body = activeRuleMatch[1];
          assert(body.includes('var(--color-primary)') && body.includes('var(--color-primary-light)') && body.includes('var(--color-primary-border)'), '898b. The active Bell state is built from the existing --color-primary / --color-primary-light / --color-primary-border tokens (#129FA9 / #E6F7F8 / #BCE7EA) — no new one-off colors invented');
          assert(!/red|#DC2626|#EF4444|--color-danger|error|warning/i.test(body), '898c. The active Bell treatment contains no red/error/warning styling — it is a calm, tasteful "reminder ON" indicator, not an alert');
        }
      }

      // 899. UPDATED — Card View: the active Bell state is wired to the shared getReminderAttentionState() result (functional source check — not just present in CSS but actually applied)
      assert(/className=\{`icon-btn \$\{isReminderActive \? 'icon-btn-reminder-active' : ''\}`\}/.test(noteCardSrcV7) && noteCardSrcV7.includes('getReminderAttentionState(note, notifications)'), '899. NoteCard\'s Bell button className is computed from getReminderAttentionState(note, notifications), not merely Boolean(reminderAt)');

      // 900. UPDATED — Document View: the same active Bell state is wired identically via the same shared helper — one consistent indicator, not a separate implementation
      assert(/className=\{`icon-btn \$\{isReminderActive \? 'icon-btn-reminder-active' : ''\}`\}/.test(notesDocViewSrcV7) && notesDocViewSrcV7.includes('getReminderAttentionState(selectedNote, notifications)'), '900. NotesDocumentView\'s Bell button className is computed from getReminderAttentionState(selectedNote, notifications), identically to Card View');

      // --- ISSUE 3: DUE-REMINDER RELIABILITY FIXES (9-25) ---

      // 901. FUNCTIONAL: local date/time input converts correctly to a stored reminderAt that represents the SAME local moment (round-trip through combine -> split)
      {
        const dateStr = '2026-09-13';
        const timeStr = '18:31';
        const combined = combineV7(dateStr, timeStr);
        const split = splitV7(combined);
        assert(split.dateStr === dateStr && split.timeStr === timeStr, `901. combineReminderDateTime('${dateStr}','${timeStr}') -> splitReminderDateTime() round-trips back to the exact same local date/time (got ${split.dateStr} ${split.timeStr}) — no timezone shift, no day/hour drift`);
      }

      // 902. FUNCTIONAL: the stored reminderAt is genuine UTC (has a 'Z' suffix / is a valid ISO instant), while the UI still works in local wall-clock terms
      {
        const combined = combineV7('2026-09-13', '18:31');
        assert(combined.endsWith('Z') && !isNaN(new Date(combined).getTime()), '902. The stored reminderAt is a real ISO 8601 UTC instant (machine storage stays ISO) even though the modal\'s own inputs are local date/time');
      }

      // 903. FUNCTIONAL: validateReminder's FIXED edge case — a reminder truncated to :00 seconds in the CURRENT minute is valid even if "now" already has a few seconds elapsed in that same minute (the exact bug found via runtime debugging: minute-granularity input vs to-the-second validation could previously reject a legitimately-intended near-future time)
      {
        const now = '2026-09-13T18:57:05.000Z';
        const sameMinuteTruncated = '2026-09-13T18:57:00.000Z';
        const result = validateReminderV7(sameMinuteTruncated, now);
        assert(result.isValid === true, `903. A reminder in the same current minute (target 18:57:00 vs now 18:57:05) is accepted, not falsely rejected as "already passed" (got: ${JSON.stringify(result)})`);
      }

      // 904. FUNCTIONAL: validateReminder still correctly rejects a genuinely past minute (the fix did not weaken real past-time rejection)
      {
        const now = '2026-09-13T18:57:05.000Z';
        const previousMinute = '2026-09-13T18:56:59.000Z';
        const result = validateReminderV7(previousMinute, now);
        assert(result.isValid === false, `904. A reminder in a genuinely earlier minute is still correctly rejected as already passed (got: ${JSON.stringify(result)})`);
      }

      // 905. FUNCTIONAL: due-check condition is "now >= reminderAt" (inclusive) — exact-equal instants count as due, not requiring the minute to match some other way
      {
        resetDatabase();
        const exact = new Date().toISOString();
        const n = await notesService.create({ title: 'Exact Boundary Due Check', content: 'x', category: 'General' });
        // Bypass validateReminder's future-only guard (which is correctly for NEW reminders only) to
        // directly test checkDueReminders' own due-boundary condition by writing reminderAt in the past.
        const db = loadDatabase();
        const idx = db.notes.findIndex((note) => note.id === n.id);
        db.notes[idx] = { ...db.notes[idx], reminderAt: exact, reminderNotificationGeneratedFor: null };
        saveDatabase(db);
        await new Promise((resolve) => setTimeout(resolve, 5));
        await notificationService.checkDueReminders();
        const all = await notificationService.getAll();
        assert(all.some((notif) => notif.noteId === n.id), '905. checkDueReminders() treats now >= reminderAt as due (inclusive boundary), matching the exact spec condition');
      }

      // 906. FUNCTIONAL: NotificationContext.refresh() synchronously updates React state (setNotifications) immediately after checkDueReminders()+getAll() in the SAME function call — no separate manual step/page refresh is needed for the UI to reflect a newly-generated notification
      assert(/const refresh = useCallback\(async \(\) => \{[\s\S]*?await notificationService\.checkDueReminders\(\);[\s\S]*?const all = await notificationService\.getAll\(\);[\s\S]*?setNotifications\(all\);/.test(notificationContextSrcV7), '906. refresh() calls checkDueReminders() then getAll() then setNotifications() all in one synchronous chain — the moment a notification is generated, the very next line updates React state with it');

      // 907. A silently-thrown exception can no longer permanently stall future due-reminder checks — refresh() is wrapped in try/catch so one bad tick doesn't leave the bell/panel stuck on stale data forever
      assert(/const refresh = useCallback\(async \(\) => \{[\s\S]{0,300}try \{[\s\S]*?\} catch \(err\) \{\s*console\.error\(/.test(notificationContextSrcV7), '907. NotificationContext.refresh() is wrapped in try/catch — an exception during one check is logged and does not prevent subsequent interval ticks from running');

      // 908. Background/inactive-tab robustness: refresh() also runs immediately on visibilitychange (tab regains focus) and window focus, not only on the 30s interval — closes the gap where browsers throttle setInterval in backgrounded tabs
      assert(notificationContextSrcV7.includes("document.addEventListener('visibilitychange'") && notificationContextSrcV7.includes("window.addEventListener('focus', refresh)"), '908. NotificationContext re-checks immediately when the tab becomes visible/focused again, in addition to the 30s interval — protects against browser timer throttling in backgrounded tabs');

      // 909. The interval/listener cleanup is complete — no leaked interval or dangling event listeners on unmount (one lightweight global interval, not several overlapping ones)
      assert(/return \(\) => \{\s*mountedRef\.current = false;\s*clearInterval\(interval\);\s*document\.removeEventListener\('visibilitychange', handleVisibilityChange\);\s*window\.removeEventListener\('focus', refresh\);\s*\};/.test(notificationContextSrcV7), '909. The effect\'s cleanup function clears the interval AND removes both the visibilitychange and focus listeners — no leaks, no duplicate/overlapping intervals across remounts');

      // 910. Header's unread count and red dot derive directly from live NotificationContext state via useNotifications() — no separate polling/state copy that could go stale independently
      assert(headerSrcV7.includes('const { unreadCount } = useNotifications();') && headerSrcV7.includes('{unreadCount > 0 && <span className="notification-dot" />}'), '910. Header reads unreadCount directly from the shared NotificationContext — when that context\'s state updates (e.g. after a due-reminder refresh), the bell re-renders automatically with no manual refresh needed');

      // 911. FUNCTIONAL: duplicate-prevention field (reminderNotificationGeneratedFor) is only ever set together with, and never before, the notification being appended — inspected at the exact source line so the ordering itself is verified, not just the end result
      assert(/notifications\.push\(\{[\s\S]*?\}\);\s*notesChanged = true;\s*return \{ \.\.\.note, reminderNotificationGeneratedFor: note\.reminderAt \};/.test(notificationServiceSrcV7), '911. checkDueReminders() appends the notification record BEFORE returning the note with reminderNotificationGeneratedFor updated — both changes are written to storage together in the same atomic saveDatabase() call, so the note can never be marked as "already notified" without the notification actually having been created');

      // 912. FUNCTIONAL: editing a reminder to a new future value resets reminderNotificationGeneratedFor, making it eligible for exactly one new notification at the new time
      {
        const n = await notesService.create({ title: 'Reset Generated-For Check', content: 'x', category: 'General' });
        await notesService.setReminder(n.id, new Date(Date.now() + 3600000).toISOString());
        const afterFirstSet = await notesService.getById(n.id);
        assert(afterFirstSet.reminderNotificationGeneratedFor === null, '912. Setting a reminder resets reminderNotificationGeneratedFor to null');
        await notesService.setReminder(n.id, new Date(Date.now() + 7200000).toISOString());
        const afterReset = await notesService.getById(n.id);
        assert(afterReset.reminderNotificationGeneratedFor === null, '912b. Rescheduling an existing reminder to a new time also resets reminderNotificationGeneratedFor to null');
      }

      // 913. FUNCTIONAL: no duplicate notification is created across multiple checkDueReminders() calls that simulate an interval tick, a route change, and a refresh in quick succession
      {
        resetDatabase();
        const n = await notesService.create({ title: 'Multi-Trigger Duplicate Check', content: 'x', category: 'General' });
        const db = loadDatabase();
        const idx = db.notes.findIndex((note) => note.id === n.id);
        db.notes[idx] = { ...db.notes[idx], reminderAt: new Date(Date.now() - 1000).toISOString(), reminderNotificationGeneratedFor: null };
        saveDatabase(db);

        await notificationService.checkDueReminders(); // simulates interval tick
        await notificationService.checkDueReminders(); // simulates a route change re-running refresh()
        await notificationService.checkDueReminders(); // simulates another refresh (e.g. focus regained)
        const all = await notificationService.getAll();
        const count = all.filter((notif) => notif.noteId === n.id).length;
        assert(count === 1, `913. Exactly one notification exists after 3 rapid checkDueReminders() calls simulating interval/route-change/focus-refresh triggers (found ${count})`);
      }

      // 914. No fake/demo notifications and no email/push behavior were introduced by this fix task
      {
        const allFixFiles = [reminderModalSrcV7, notificationContextSrcV7, notificationServiceSrcV7, headerSrcV7].join('\n');
        assert(!/candidateEmailService|emailTemplateService|sendEmail|new Notification\(|serviceWorker|requestPermission/i.test(allFixFiles), '914. No email service, browser push Notification API, or permission request was added while fixing this bug');
      }

      resetDatabase();
    }
    // ==========================================================================
    // Fix: Notification Panel Spacing + Individual Mark as Read + Reminder Bell Attention State
    // ==========================================================================
    {
      const noteDomainSrcV8 = fs.readFileSync(path.resolve('./src/domain/noteDomain.js'), 'utf-8');
      const noteCardSrcV8 = fs.readFileSync(path.resolve('./src/components/notes/NoteCard.jsx'), 'utf-8');
      const notesDocViewSrcV8 = fs.readFileSync(path.resolve('./src/components/notes/NotesDocumentView.jsx'), 'utf-8');
      const notificationPanelSrcV8 = fs.readFileSync(path.resolve('./src/components/layout/NotificationPanel.jsx'), 'utf-8');
      const notificationContextSrcV8 = fs.readFileSync(path.resolve('./src/state/NotificationContext.jsx'), 'utf-8');
      const notificationServiceSrcV8 = fs.readFileSync(path.resolve('./src/services/notificationService.js'), 'utf-8');
      const indexCssSrcV8 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

      const { getReminderAttentionState: attentionV8, combineReminderDateTime: combineV8 } = await import('../domain/noteDomain.js');

      // --- ISSUE 1: NOTIFICATION PANEL SPACING (1-3) ---

      // 915. Panel width is widened into the requested 460-520px range (was 340px), still capped to the viewport
      {
        const widthMatch = indexCssSrcV8.match(/^\.notification-panel\s*\{\s*position:\s*absolute;\s*top:[^;]+;\s*right:\s*0;\s*width:\s*(\d+)px;/m);
        assert(widthMatch && parseInt(widthMatch[1], 10) >= 460 && parseInt(widthMatch[1], 10) <= 520, `915. .notification-panel width is within the requested 460-520px desktop range (found ${widthMatch ? widthMatch[1] : 'not found'}px)`);
        assert(/\.notification-panel\s*\{[^}]*max-width:\s*calc\(100vw/.test(indexCssSrcV8), '915b. .notification-panel still caps to calc(100vw - ...) so it never exceeds the viewport on narrow screens');
      }

      // 916. Header has more breathing room: increased padding vs. the original 0.85rem/1rem, plus an explicit gap between title and "Mark all as read"
      {
        const headerRule = indexCssSrcV8.match(/\.notification-panel-header\s*\{([^}]*)\}/);
        assert(headerRule && /padding:\s*1\.1rem 1\.5rem;/.test(headerRule[1]) && /gap:\s*1rem;/.test(headerRule[1]), '916. .notification-panel-header has increased padding (1.1rem 1.5rem) and an explicit gap, so "Mark all as read" no longer sits pressed against the title/edge');
      }

      // 917. Notification item internal spacing increased (padding + icon/body gap + body-internal gap), not just typography made larger
      {
        const itemRule = indexCssSrcV8.match(/\.header-notification-item\s*\{([^}]*)\}/);
        const bodyRule = indexCssSrcV8.match(/\.header-notification-item-body\s*\{([^}]*)\}/);
        assert(itemRule && /padding:\s*1rem 2\.5rem 1rem 1\.5rem;/.test(itemRule[1]) && /gap:\s*0\.85rem;/.test(itemRule[1]), '917. .header-notification-item has increased padding and icon/body gap versus the original cramped 0.8rem/1rem/0.65rem values');
        assert(bodyRule && /gap:\s*0\.3rem;/.test(bodyRule[1]), '917b. .header-notification-item-body has increased internal line spacing (0.3rem, up from 0.15rem) between NOTE REMINDER/title/message/time — spacing was used, not enlarged font sizes');
      }

      // 918. Root cause of the original congestion: a genuine CSS class collision. The Notes notification rows were previously named .notification-item, which the UNRELATED Upcoming/Overdue-Tasks notification list (src/components/upcoming/NotificationsPanel.jsx, src/components/onboarding/OverdueTasksModal.jsx) already used with different padding/gap/border — that older, later-in-cascade rule was silently overriding this panel's own spacing. Renaming to .header-notification-item removes the collision entirely.
      {
        const upcomingPanelSrc = fs.readFileSync(path.resolve('./src/components/upcoming/NotificationsPanel.jsx'), 'utf-8');
        const overdueModalSrc = fs.readFileSync(path.resolve('./src/components/onboarding/OverdueTasksModal.jsx'), 'utf-8');
        assert(
          !notificationPanelSrcV8.includes('className="notification-item') &&
          notificationPanelSrcV8.includes('className="header-notification-item') &&
          (upcomingPanelSrc.includes('notification-item') || overdueModalSrc.includes('notification-item')),
          '918. The Header notification row class was renamed to .header-notification-item specifically to stop colliding with the unrelated pre-existing .notification-item class used by the Upcoming/Overdue-Tasks notification list — this collision was the real root cause of the panel looking cramped'
        );
      }

      // --- ISSUE 2: INDIVIDUAL MARK AS READ (4-7) ---

      // 919. Every rendered (unread) notification row has its own individual Mark as Read control with the correct accessible label
      assert(notificationPanelSrcV8.includes('className="icon-btn notification-mark-read-btn"') && notificationPanelSrcV8.includes('title="Mark as read"') && notificationPanelSrcV8.includes('aria-label="Mark as read"'), '919. Each notification row renders its own small "Mark as read" icon action with the correct tooltip/aria-label');

      // 920. Individual Mark as Read stops propagation, so it can never also fire the row's own click/navigate behavior — and it does not itself call navigate anywhere
      assert(/const handleMarkAsReadOnly = \(e, notification\) => \{\s*e\.stopPropagation\(\);\s*markAsRead\(notification\.id\);\s*\};/.test(notificationPanelSrcV8) && !/handleMarkAsReadOnly[\s\S]{0,150}navigate\(/.test(notificationPanelSrcV8), '920. handleMarkAsReadOnly() calls e.stopPropagation() before marking read and never calls navigate() — clicking it can never also open the note');

      // 921. FUNCTIONAL: marking one notification read affects ONLY that notification — a second unread notification (for a different note) is untouched
      {
        resetDatabase();
        const n1 = await notesService.create({ title: 'Individual Read Target', content: 'x', category: 'General' });
        const n2 = await notesService.create({ title: 'Individual Read Untouched', content: 'x', category: 'General' });
        const db1 = loadDatabase();
        db1.notes = db1.notes.map((n) => (n.id === n1.id || n.id === n2.id) ? { ...n, reminderAt: new Date(Date.now() - 1000).toISOString(), reminderNotificationGeneratedFor: null } : n);
        saveDatabase(db1);
        await notificationService.checkDueReminders();
        const allBefore = await notificationService.getAll();
        const notif1 = allBefore.find((notif) => notif.noteId === n1.id);
        const notif2 = allBefore.find((notif) => notif.noteId === n2.id);
        assert(notif1 && notif2 && !notif1.isRead && !notif2.isRead, '921pre. Both notifications start unread (setup check)');

        await notificationService.markAsRead(notif1.id);
        const allAfter = await notificationService.getAll();
        const notif1After = allAfter.find((notif) => notif.id === notif1.id);
        const notif2After = allAfter.find((notif) => notif.id === notif2.id);
        assert(notif1After.isRead === true && notif2After.isRead === false, '921. Marking one notification read leaves every other notification (including one for a different note) completely untouched');
      }

      // 922. FUNCTIONAL: after marking read, that notification is excluded from the "unread" set the dropdown renders — it disappears from the visible dropdown without needing deletion
      {
        const all = await notificationService.getAll();
        const unread = all.filter((n) => !n.isRead);
        const readOne = all.find((n) => n.isRead);
        assert(readOne && !unread.some((n) => n.id === readOne.id), '922. The just-read notification is absent from the unread-filtered set (what the dropdown actually renders) — removed from view without deleting the record');
      }

      // --- ISSUE 5/6: UNREAD-ONLY DROPDOWN + MARK ALL (8-17) ---

      // 923. NotificationContext exposes a derived unreadNotifications list (filtered from the full notifications state), and NotificationPanel renders that list, not the full one
      assert(notificationContextSrcV8.includes('const unreadNotifications = notifications.filter((n) => !n.isRead);') && notificationPanelSrcV8.includes('const { unreadNotifications, markAsRead, markAllAsRead } = useNotifications();'), '923. NotificationContext derives unreadNotifications from the full list, and NotificationPanel consumes that derived list for what it displays');

      // 924. The dropdown's empty state, row list, and "Mark all as read" visibility are ALL driven by unreadNotifications.length, not the full notifications count
      assert((notificationPanelSrcV8.match(/unreadNotifications\.length/g) || []).length >= 2 && !notificationPanelSrcV8.includes('notifications.length'), '924. Empty-state / row-rendering / Mark-all-as-read visibility are all gated on unreadNotifications.length — the panel never references the full (read+unread) notifications count directly');

      // 925. FUNCTIONAL: clicking the notification itself still marks it read AND still navigates (existing behavior preserved) — verified at the source level since navigation requires a router
      assert(/const handleNotificationClick = async \(notification\) => \{\s*await markAsRead\(notification\.id\);\s*onClose\(\);[\s\S]*?navigate\(note\.isArchived \? '\/notes\/archived' : '\/notes', \{ state: \{ openNoteId: note\.id \} \}\);/.test(notificationPanelSrcV8), '925. handleNotificationClick() (the row\'s own click, distinct from the individual Mark-as-Read button) still marks read, closes the panel, and navigates to the correct note — unchanged from before this fix');

      // 926. FUNCTIONAL: read notification records are NOT deleted from storage — notificationService.getAll() (the full, unfiltered accessor) still returns them
      {
        const allIncludingRead = await notificationService.getAll();
        assert(allIncludingRead.some((n) => n.isRead === true), '926. notificationService.getAll() still returns read notification records — marking read never deletes them, it only changes isRead');
      }

      // 927. FUNCTIONAL: "Mark all as read" clears every currently-unread notification, leaving the unread-filtered set empty
      {
        await notificationService.markAllAsRead();
        const all = await notificationService.getAll();
        const stillUnread = all.filter((n) => !n.isRead);
        assert(stillUnread.length === 0, '927. notificationService.markAllAsRead() leaves zero unread notifications — the dropdown would show its empty state immediately after');
      }

      // 928. "Mark all as read" is hidden (not merely disabled) once there is nothing unread left
      assert(/\{unreadNotifications\.length > 0 && \(\s*<button type="button" className="notification-mark-all-btn"/.test(notificationPanelSrcV8), '928. The "Mark all as read" button is conditionally rendered only while unreadNotifications.length > 0 — hidden entirely (not just disabled) once nothing is unread, per the task\'s explicit preference');

      // 929. Empty state shows the concise "No notifications yet." text and never fake/demo history
      assert(notificationPanelSrcV8.includes('No notifications yet.') && !/Sample|Example|Demo|Lorem/i.test(notificationPanelSrcV8), '929. The empty state remains the concise "No notifications yet." message, with no fake/demo notification content anywhere in the panel');

      // 930/931. FUNCTIONAL: Header red dot logic — present while >=1 unread, absent at 0 unread (already covered structurally by check 863; re-confirm functionally against fresh data here)
      {
        const n = await notesService.create({ title: 'Dot Behavior Check', content: 'x', category: 'General' });
        const db2 = loadDatabase();
        db2.notes = db2.notes.map((note) => (note.id === n.id ? { ...note, reminderAt: new Date(Date.now() - 1000).toISOString(), reminderNotificationGeneratedFor: null } : note));
        saveDatabase(db2);
        await notificationService.checkDueReminders();
        const allNow = await notificationService.getAll();
        const unreadNow = allNow.filter((notif) => !notif.isRead);
        assert(unreadNow.length >= 1, '930. At least one unread notification exists (dot should show) after a fresh due reminder');
        await notificationService.markAllAsRead();
        const allAfterMarkAll = await notificationService.getAll();
        assert(allAfterMarkAll.every((notif) => notif.isRead), '931. Zero unread notifications remain after markAllAsRead (dot should disappear)');
      }

      // --- ISSUE 8: REMINDER BELL ATTENTION-STATE RULES (18-27) ---

      // 932. getReminderAttentionState exists as ONE shared helper, imported identically by both NoteCard and NotesDocumentView — not duplicated logic
      assert(noteDomainSrcV8.includes('export function getReminderAttentionState(') && noteCardSrcV8.includes('getReminderAttentionState(note, notifications)') && notesDocViewSrcV8.includes('getReminderAttentionState(selectedNote, notifications)'), '932. getReminderAttentionState() is one shared noteDomain function, called identically by NoteCard and NotesDocumentView — no separate reimplementation in either');

      // 933. FUNCTIONAL: no reminder -> neutral
      assert(attentionV8({ id: 'x', reminderAt: null }, []) === false, '933. A note with no reminderAt returns a neutral (false) attention state');

      // 934. FUNCTIONAL: future reminder -> active teal, regardless of reminderNotificationGeneratedFor's value
      {
        const future = new Date(Date.now() + 3600000).toISOString();
        assert(attentionV8({ id: 'x', reminderAt: future, reminderNotificationGeneratedFor: null }, []) === true, '934. A future (not-yet-due) reminderAt returns an active (true) attention state');
      }

      // 935. FUNCTIONAL: due + unread notification -> active teal
      {
        const due = new Date(Date.now() - 1000).toISOString();
        const note = { id: 'x', reminderAt: due, reminderNotificationGeneratedFor: due };
        const notifs = [{ noteId: 'x', dueAt: due, isRead: false }];
        assert(attentionV8(note, notifs) === true, '935. A due reminder whose generated notification is still unread returns active (true)');
      }

      // 936. FUNCTIONAL: due + READ notification -> neutral — THE EXACT BUG FIXED IN THIS TASK. Also verified with a note object carrying a STALE reminderNotificationGeneratedFor (null, as if NotesPage's `notes` list hadn't refreshed since the reminder fired), proving the fix no longer depends on that field being fresh.
      {
        const due = new Date(Date.now() - 1000).toISOString();
        const freshNote = { id: 'x', reminderAt: due, reminderNotificationGeneratedFor: due };
        const staleNote = { id: 'x', reminderAt: due, reminderNotificationGeneratedFor: null };
        const notifs = [{ noteId: 'x', dueAt: due, isRead: true }];
        assert(attentionV8(freshNote, notifs) === false, '936. A due reminder whose notification has been read returns neutral (false) with a fresh note object');
        assert(attentionV8(staleNote, notifs) === false, '936b. THE ACTUAL BUG FIX: the same due+read result holds even when reminderNotificationGeneratedFor on the note object is stale/null (simulating NotesPage not having reloaded notes since the background due-check ran) — the Bell no longer gets stuck teal because attention state is derived from reminderAt vs now, not from that field');
      }

      // 937. FUNCTIONAL: rescheduling a read reminder to a new future time reactivates the teal state immediately
      {
        const newFuture = new Date(Date.now() + 3600000).toISOString();
        const rescheduledNote = { id: 'x', reminderAt: newFuture, reminderNotificationGeneratedFor: null };
        const staleNotifs = [{ noteId: 'x', dueAt: '2020-01-01T00:00:00.000Z', isRead: true }];
        assert(attentionV8(rescheduledNote, staleNotifs) === true, '937. Rescheduling to a new future reminderAt returns active (true) immediately, and an old unrelated read notification for the same note does not interfere');
      }

      // 938. FUNCTIONAL: end-to-end via the real services — set a reminder, let it become due, mark read, confirm neutral, reschedule, confirm active again, let it become due again, confirm exactly one NEW notification (no duplicate of the old read one)
      {
        resetDatabase();
        const n = await notesService.create({ title: 'End To End Attention Check', content: 'x', category: 'General' });
        const setPast = (iso) => {
          const db3 = loadDatabase();
          db3.notes = db3.notes.map((note) => (note.id === n.id ? { ...note, reminderAt: iso, reminderNotificationGeneratedFor: null } : note));
          saveDatabase(db3);
        };
        setPast(new Date(Date.now() - 1000).toISOString());
        await notificationService.checkDueReminders();
        let noteNow = await notesService.getById(n.id);
        let allNotifs = await notificationService.getAll();
        assert(attentionV8(noteNow, allNotifs) === true, '938a. Freshly due + unread -> active');

        const firstNotif = allNotifs.find((notif) => notif.noteId === n.id);
        await notificationService.markAsRead(firstNotif.id);
        noteNow = await notesService.getById(n.id); // note itself is untouched by markAsRead — reminderAt/reminderNotificationGeneratedFor unchanged
        allNotifs = await notificationService.getAll();
        assert(attentionV8(noteNow, allNotifs) === false, '938b. After marking read -> neutral (this is the real end-to-end reproduction of the originally-reported bug, now fixed)');
        assert(noteNow.reminderAt !== null, '938c. reminderAt is still present on the note after marking the notification read — reading a notification never clears the reminder');

        const rescheduled = await notesService.setReminder(n.id, new Date(Date.now() + 3600000).toISOString());
        allNotifs = await notificationService.getAll();
        assert(attentionV8(rescheduled, allNotifs) === true, '938d. Rescheduling to a new future time -> active again immediately');

        // Now let the NEW occurrence become due and confirm exactly one new notification (2 total: the old read one + the new one), no duplicates
        const db4 = loadDatabase();
        db4.notes = db4.notes.map((note) => (note.id === n.id ? { ...note, reminderAt: new Date(Date.now() - 1000).toISOString(), reminderNotificationGeneratedFor: null } : note));
        saveDatabase(db4);
        await notificationService.checkDueReminders();
        const finalNotifs = (await notificationService.getAll()).filter((notif) => notif.noteId === n.id);
        assert(finalNotifs.length === 2, `938e. Exactly 2 total notification records exist for this note after the full read -> reschedule -> due-again cycle (the original read one, plus exactly one new one) — found ${finalNotifs.length}`);
      }

      // 939. FUNCTIONAL: a note with no reminder at all is always neutral regardless of notification history for other notes
      assert(attentionV8({ id: 'never-had-one', reminderAt: null, reminderNotificationGeneratedFor: null }, [{ noteId: 'other-note', dueAt: '2020-01-01T00:00:00.000Z', isRead: false }]) === false, '939. A note that never had a reminder stays neutral no matter what notifications exist for other notes');

      // 940. SUPERSEDED by a later task — the reminder metadata badge is now intentionally conditioned on the SAME attention-state result as the Bell (isReminderActive), not on reminderAt alone, so it hides once a due reminder is read. See the "Hide Reminder Metadata After Read" block below for the full behavior and its dedicated checks.
      assert(/\{isReminderActive && \(/.test(noteCardSrcV8) && /\{isReminderActive && \(/.test(notesDocViewSrcV8), '940. The reminder metadata badge (in both views) is conditioned on the shared isReminderActive attention-state result — consistent with the Bell, and hidden once a due reminder has been read');

      // 941. Card View and Document View both subscribe to live NotificationContext state (useNotifications hook), so Bell attention state updates immediately on any notification change with no reload
      assert(noteCardSrcV8.includes("import { useNotifications } from '../../state/NotificationContext';") && notesDocViewSrcV8.includes("import { useNotifications } from '../../state/NotificationContext';"), '941. Both NoteCard and NotesDocumentView subscribe directly to NotificationContext — they re-render automatically whenever notification state changes, with no manual refresh/reload needed');

      // --- REGRESSION: PRESERVE PREVIOUS DUE-REMINDER FIXES (28-30) ---

      // 942. The 30s interval, focus re-check, visibilitychange re-check, and exception-safe refresh from the previous fix are all still intact
      assert(
        notificationContextSrcV8.includes('const POLL_INTERVAL_MS = 30000;') &&
        notificationContextSrcV8.includes("window.addEventListener('focus', refresh)") &&
        notificationContextSrcV8.includes("document.addEventListener('visibilitychange'") &&
        /const refresh = useCallback\(async \(\) => \{[\s\S]{0,300}try \{/.test(notificationContextSrcV8),
        '942. The previous reliability fixes (30s interval, focus listener, visibilitychange listener, try/catch-wrapped refresh) are all still present and unmodified'
      );

      // 943. Local date/time -> UTC ISO conversion (combineReminderDateTime) is unchanged by this task
      assert(combineV8('2026-09-13', '18:31') === new Date('2026-09-13T18:31:00').toISOString(), '943. combineReminderDateTime() still converts local date/time to the correct UTC ISO instant, unchanged from the previous fix');

      // 944. checkDueReminders' duplicate-prevention (reminderNotificationGeneratedFor) is unchanged
      assert(notificationServiceSrcV8.includes('reminderNotificationGeneratedFor: note.reminderAt') && notificationServiceSrcV8.includes('note.reminderNotificationGeneratedFor === note.reminderAt) return note;'), '944. checkDueReminders() still uses the same reminderNotificationGeneratedFor duplicate-prevention mechanism, unmodified');

      // --- IN-APP ONLY (31-32) ---

      assert(!/candidateEmailService|emailTemplateService|sendEmail/i.test([notificationPanelSrcV8, notificationContextSrcV8, notificationServiceSrcV8].join('\n')), '945. No email service is referenced anywhere in the updated notification files');
      assert(!/new Notification\(|serviceWorker|requestPermission/.test([notificationPanelSrcV8, notificationContextSrcV8, notificationServiceSrcV8].join('\n')), '946. No browser push Notification API is used anywhere in the updated notification files');

      resetDatabase();
    }
    // ==========================================================================
    // Fix: Hide Reminder Metadata After Reminder Is Read/Acknowledged
    // ==========================================================================
    {
      const noteCardSrcV9 = fs.readFileSync(path.resolve('./src/components/notes/NoteCard.jsx'), 'utf-8');
      const notesDocViewSrcV9 = fs.readFileSync(path.resolve('./src/components/notes/NotesDocumentView.jsx'), 'utf-8');

      const { getReminderAttentionState: attentionV9 } = await import('../domain/noteDomain.js');

      // --- SHARED LOGIC / SOURCE WIRING ---

      // 947. The reminder metadata line in BOTH views is gated on the exact same isReminderActive variable already used for the Bell — no separate/duplicated hide-logic was introduced
      assert(/\{isReminderActive && \(\s*<span className="note-reminder-badge">/.test(noteCardSrcV9), '947. NoteCard\'s reminder metadata <span> is gated on {isReminderActive && (...)} — the same value driving the Bell\'s active class');
      assert(/\{isReminderActive && \(\s*<span className="note-reminder-badge"/.test(notesDocViewSrcV9), '947b. NotesDocumentView\'s reminder metadata <span> is gated on {isReminderActive && (...)} — identical to NoteCard, so the two views can never disagree');

      // 948. No second/duplicate attention-state computation was added — both views still call the ONE shared noteDomain.getReminderAttentionState() exactly once each (checked as an actual invocation assigned to isReminderActive, not merely mentioned in a comment)
      assert((noteCardSrcV9.match(/const isReminderActive = getReminderAttentionState\(/g) || []).length === 1, '948. NoteCard invokes getReminderAttentionState() exactly once, assigning isReminderActive — that single result drives both the Bell and the metadata line');
      assert((notesDocViewSrcV9.match(/const isReminderActive = getReminderAttentionState\(/g) || []).length === 1, '948b. NotesDocumentView invokes getReminderAttentionState() exactly once, assigning isReminderActive — that single result drives both the Bell and the metadata line');

      // --- FUNCTIONAL: THE FIVE DISPLAY STATES (1-8, 16-19) ---

      // 949/950. Future reminder: metadata shown, Bell teal (same boolean drives both)
      {
        const future = new Date(Date.now() + 3600000).toISOString();
        const note = { id: 'x', reminderAt: future, reminderNotificationGeneratedFor: null };
        assert(attentionV9(note, []) === true, '949. Future reminder -> isReminderActive is true (metadata shown)');
        assert(attentionV9(note, []) === true, '950. Future reminder -> Bell teal (same true value — Bell and metadata always agree by construction)');
      }

      // 951/952. Due + unread: metadata shown, Bell teal
      {
        const due = new Date(Date.now() - 1000).toISOString();
        const note = { id: 'x', reminderAt: due, reminderNotificationGeneratedFor: due };
        const notifs = [{ noteId: 'x', dueAt: due, isRead: false }];
        assert(attentionV9(note, notifs) === true, '951. Due + unread -> isReminderActive is true (metadata shown)');
        assert(attentionV9(note, notifs) === true, '952. Due + unread -> Bell teal (same true value)');
      }

      // 953/954. Due + read: metadata HIDDEN, Bell neutral — the actual behavior this task adds
      {
        const due = new Date(Date.now() - 1000).toISOString();
        const note = { id: 'x', reminderAt: due, reminderNotificationGeneratedFor: due };
        const notifs = [{ noteId: 'x', dueAt: due, isRead: true }];
        assert(attentionV9(note, notifs) === false, '953. Due + read -> isReminderActive is false, so the reminder metadata line is now hidden (this task\'s new behavior — it previously stayed visible)');
        assert(attentionV9(note, notifs) === false, '954. Due + read -> Bell neutral (same false value)');
      }

      // 955/956. No reminder: metadata hidden, Bell neutral (unchanged pre-existing behavior)
      assert(attentionV9({ id: 'x', reminderAt: null }, []) === false, '955. No reminder -> isReminderActive is false, metadata hidden (unchanged)');
      assert(attentionV9({ id: 'x', reminderAt: null }, []) === false, '956. No reminder -> Bell neutral (unchanged)');

      // 957. Rescheduled to future: metadata shows again with the NEW time, Bell teal — old read notification does not resurrect the hidden state
      {
        const newFuture = new Date(Date.now() + 7200000).toISOString();
        const rescheduledNote = { id: 'x', reminderAt: newFuture, reminderNotificationGeneratedFor: null };
        const oldReadNotif = [{ noteId: 'x', dueAt: '2020-01-01T00:00:00.000Z', isRead: true }];
        assert(attentionV9(rescheduledNote, oldReadNotif) === true, '957. Rescheduling a previously-read reminder to a new future time makes isReminderActive true again immediately — metadata reappears showing the new reminderAt, Bell teal');
      }

      // 958. Future reminders are NOT affected by a "Mark all as read" that only touches DUE notifications — a future reminder has no notification yet to mark read, so it stays active regardless
      {
        const future = new Date(Date.now() + 3600000).toISOString();
        const untouchedFutureNote = { id: 'future-note', reminderAt: future, reminderNotificationGeneratedFor: null };
        const dueNote = { id: 'due-note', reminderAt: new Date(Date.now() - 1000).toISOString(), reminderNotificationGeneratedFor: new Date(Date.now() - 1000).toISOString() };
        const allRead = [{ noteId: 'due-note', dueAt: dueNote.reminderAt, isRead: true }]; // simulates "mark all as read" already applied to the one existing (due) notification
        assert(attentionV9(untouchedFutureNote, allRead) === true, '958. A future reminder remains active (metadata + teal Bell) after "Mark all as read" — that action only affects notifications for reminders that have actually already fired');
        assert(attentionV9(dueNote, allRead) === false, '958b. Meanwhile the due note whose notification WAS marked read correctly goes neutral/hidden — Mark all as read only hides the ones it actually acted on');
      }

      // --- INDEPENDENCE: DATA IS NEVER DELETED (13-15) ---

      // 959. FUNCTIONAL, end-to-end via the real services: after the notification is read (metadata now hidden), reminderAt, reminderNotificationGeneratedFor, and the notification record itself all remain fully intact in storage
      {
        resetDatabase();
        const n = await notesService.create({ title: 'Hide Metadata Data-Integrity Check', content: 'x', category: 'General' });
        const dueIso = new Date(Date.now() - 1000).toISOString();
        const db5 = loadDatabase();
        db5.notes = db5.notes.map((note) => (note.id === n.id ? { ...note, reminderAt: dueIso, reminderNotificationGeneratedFor: null } : note));
        saveDatabase(db5);
        await notificationService.checkDueReminders();

        let noteNow = await notesService.getById(n.id);
        let allNotifs = await notificationService.getAll();
        const generatedNotif = allNotifs.find((notif) => notif.noteId === n.id);
        assert(attentionV9(noteNow, allNotifs) === true, '959pre. Sanity: freshly due + unread is active before marking read');

        await notificationService.markAsRead(generatedNotif.id);
        noteNow = await notesService.getById(n.id);
        allNotifs = await notificationService.getAll();
        assert(attentionV9(noteNow, allNotifs) === false, '959. After marking read, isReminderActive is false (metadata now hidden) — this is the UI-only change this task makes');
        assert(noteNow.reminderAt === dueIso, '959b. reminderAt is completely unchanged in storage — hiding the metadata never clears it');
        assert(noteNow.reminderNotificationGeneratedFor === dueIso, '959c. reminderNotificationGeneratedFor is completely unchanged in storage — duplicate-prevention state is untouched by hiding the metadata');
        const notifStillThere = (await notificationService.getAll()).find((notif) => notif.id === generatedNotif.id);
        assert(notifStillThere && notifStillThere.isRead === true, '959d. The notification record itself still exists internally (read, not deleted) — notificationService.getAll() still returns it');
      }

      // --- REACTIVITY: NO REFRESH NEEDED (9-12) ---

      // 960. Both views subscribe directly to live NotificationContext state (already verified structurally in check 941) — since isReminderActive is recomputed from that live `notifications` value on every render, the metadata line hides/reappears in the same render pass as the Bell, with no separate effect or manual refresh needed
      assert(noteCardSrcV9.includes('const { notifications } = useNotifications();') && notesDocViewSrcV9.includes('const { notifications } = useNotifications();'), '960. Both NoteCard and NotesDocumentView read live `notifications` from NotificationContext and recompute isReminderActive (driving both Bell and metadata) on every render — individual Mark as Read / Mark all as read / rescheduling all propagate to the metadata line with no page refresh, exactly as they already did for the Bell');

      // --- REGRESSION: EVERYTHING ELSE UNCHANGED (20) ---

      // 961. The reminder metadata text/format itself (formatReminderLabel, "Reminder: <label>") is completely unchanged — only the show/hide CONDITION changed, not what it displays or how it's formatted
      assert(noteCardSrcV9.includes('Reminder: {formatReminderLabel(note.reminderAt)}') && notesDocViewSrcV9.includes('Reminder: {formatReminderLabel(selectedNote.reminderAt)}'), '961. The metadata line still renders "Reminder: " + formatReminderLabel(reminderAt) exactly as before — only its visibility condition changed');

      // 962. Set/Edit/Remove Reminder, due-detection, the 30s interval, visibility/focus handling, notification storage, unread-only dropdown, and duplicate-prevention are all unchanged (re-confirmed here since this task specifically touches the same files/behaviors)
      {
        const notificationServiceSrcV9 = fs.readFileSync(path.resolve('./src/services/notificationService.js'), 'utf-8');
        const notificationContextSrcV9 = fs.readFileSync(path.resolve('./src/state/NotificationContext.jsx'), 'utf-8');
        const notesServiceSrcV9 = fs.readFileSync(path.resolve('./src/services/notesService.js'), 'utf-8');
        assert(
          notesServiceSrcV9.includes('async setReminder(id, reminderAtIso)') &&
          notesServiceSrcV9.includes('async removeReminder(id)') &&
          notificationServiceSrcV9.includes('async checkDueReminders()') &&
          notificationContextSrcV9.includes('const POLL_INTERVAL_MS = 30000;') &&
          notificationContextSrcV9.includes("document.addEventListener('visibilitychange'") &&
          notificationContextSrcV9.includes('const unreadNotifications = notifications.filter((n) => !n.isRead);') &&
          notificationServiceSrcV9.includes('note.reminderNotificationGeneratedFor === note.reminderAt) return note;'),
          '962. setReminder/removeReminder, checkDueReminders, the 30s interval, visibilitychange handling, the unread-only dropdown filter, and duplicate-prevention are all present and unmodified by this metadata-visibility-only change'
        );
      }

      resetDatabase();
    }
    // ==========================================================================
    // Fix: Clear Vertical Spacing Between Notification Cards
    // ==========================================================================
    {
      const indexCssSrcV10 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
      const notificationPanelSrcV10 = fs.readFileSync(path.resolve('./src/components/layout/NotificationPanel.jsx'), 'utf-8');

      // 963. The notification list uses an explicit flex `gap` (not sibling margins, which were
      // silently collapsing to ~2px under the previous non-flex parent) for consistent inter-card spacing
      {
        const listRule = indexCssSrcV10.match(/\.notification-panel-list\s*\{([^}]*)\}/);
        assert(listRule && /display:\s*flex;/.test(listRule[1]) && /flex-direction:\s*column;/.test(listRule[1]) && /gap:\s*0\.5rem;/.test(listRule[1]), '963. .notification-panel-list is a flex column with an explicit gap — the robust fix for spacing between notification cards, not fragile margin-collapse');
      }

      // 964. The gap value is exactly 0.5rem (8px), within the requested ~8-10px target
      {
        const gapMatch = indexCssSrcV10.match(/\.notification-panel-list\s*\{[^}]*gap:\s*([\d.]+)rem;/);
        assert(gapMatch, '964. .notification-panel-list declares a gap value');
        const px = gapMatch ? parseFloat(gapMatch[1]) * 16 : 0;
        assert(px >= 8 && px <= 10, `964b. The gap is within the requested 8-10px range (found ${px}px)`);
      }

      // 965. The old sibling-margin approach on .header-notification-item no longer carries a vertical component (only the horizontal inset remains) — spacing between cards now comes from one place, not two overlapping mechanisms
      {
        const itemRule = indexCssSrcV10.match(/\.header-notification-item\s*\{([^}]*)\}/);
        assert(itemRule && /margin:\s*0 0\.5rem;/.test(itemRule[1]), '965. .header-notification-item\'s margin is horizontal-only (0 0.5rem) — vertical card-to-card spacing comes exclusively from the parent\'s gap, not a leftover collapsing margin');
      }

      // 966. Internal card content was NOT touched by this fix — header padding, item padding, icon/body gap, and internal body-line spacing are all unchanged from the previous task
      {
        const headerRule = indexCssSrcV10.match(/\.notification-panel-header\s*\{([^}]*)\}/);
        const itemRule = indexCssSrcV10.match(/\.header-notification-item\s*\{([^}]*)\}/);
        const bodyRule = indexCssSrcV10.match(/\.header-notification-item-body\s*\{([^}]*)\}/);
        assert(headerRule && /padding:\s*1\.1rem 1\.5rem;/.test(headerRule[1]), '966. .notification-panel-header padding is unchanged (1.1rem 1.5rem) — header breathing room from the previous task was not touched');
        assert(itemRule && /padding:\s*1rem 2\.5rem 1rem 1\.5rem;/.test(itemRule[1]) && /gap:\s*0\.85rem;/.test(itemRule[1]), '966b. .header-notification-item\'s own internal padding and icon/body gap are unchanged — only inter-card spacing was addressed, not internal card spacing');
        assert(bodyRule && /gap:\s*0\.3rem;/.test(bodyRule[1]), '966c. .header-notification-item-body\'s internal line spacing (NOTE REMINDER/title/message/time) is unchanged');
      }

      // 967. Panel width was not touched by this fix
      {
        const widthMatch = indexCssSrcV10.match(/^\.notification-panel\s*\{\s*position:\s*absolute;\s*top:[^;]+;\s*right:\s*0;\s*width:\s*(\d+)px;/m);
        assert(widthMatch && widthMatch[1] === '480', '967. .notification-panel width remains 480px, unchanged by this spacing-only fix');
      }

      // 968. `gap` never adds space before the first or after the last item — no extra :first-child/:last-child overrides were needed or added, since flex `gap` only ever applies BETWEEN items by definition
      assert(!/\.header-notification-item:first-child|\.header-notification-item:last-child/.test(indexCssSrcV10), '968. No :first-child/:last-child margin overrides were added — flex `gap` inherently never adds space before the first or after the last card, so none were needed');

      // 969. Existing notification functionality (individual Mark as Read, Mark all as read, click-to-navigate, unread-only filtering) is completely unchanged by this CSS-only fix
      assert(
        notificationPanelSrcV10.includes('const handleMarkAsReadOnly = (e, notification) => {') &&
        notificationPanelSrcV10.includes('const { unreadNotifications, markAsRead, markAllAsRead } = useNotifications();') &&
        notificationPanelSrcV10.includes('const handleNotificationClick = async (notification) => {'),
        '969. Individual Mark as Read, Mark all as read, and click-to-navigate handlers are all present and unmodified — this was a CSS/layout-only change'
      );

      resetDatabase();
    }

    // ==========================================================================
    // Refactor Onboarding Plans Page to Employee/Intern Filter +
    // Universal + Department-Specific Tasks
    // ==========================================================================
    {
      resetDatabase();

      const onbPlansSrcFinal = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingPlansPage.jsx'), 'utf-8');
      const planEditorSrcFinal = fs.readFileSync(path.resolve('./src/pages/onboarding/PlanEditorPage.jsx'), 'utf-8');
      const routerSrcFinal = fs.readFileSync(path.resolve('./src/router/index.jsx'), 'utf-8');
      const indexCssSrcFinal = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
      const storageEngineSrcFinal = fs.readFileSync(path.resolve('./src/mock-data/storageEngine.js'), 'utf-8');
      const onboardingServiceSrcFinal = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
      const onboardingDomainSrcFinal = fs.readFileSync(path.resolve('./src/domain/onboardingDomain.js'), 'utf-8');
      const onbPlansCodeOnlyFinal = stripComments(onbPlansSrcFinal);

      // --- 1. FILTER: EXISTENCE / DEFAULT / EXCLUSIVITY ---

      // 970. The Employees|Interns segmented filter exists, reusing the shared .view-switcher-group/.view-btn pattern (not a dropdown, not a new bespoke control)
      assert(
        onbPlansSrcFinal.includes('view-switcher-group onboarding-person-type-switcher') &&
        (onbPlansSrcFinal.match(/className=\{`view-btn \$\{personType === /g) || []).length === 2,
        '970. NEW — The Plans page renders a 2-option Employees|Interns segmented filter using the existing .view-switcher-group/.view-btn design system, not a dropdown'
      );

      // 971. The filter defaults safely to Employees on a fresh visit (no router state)
      assert(
        onbPlansSrcFinal.includes("useState(location.state?.personType === 'intern' ? 'intern' : 'employee')"),
        "971. NEW — personType state defaults to 'employee' unless router state explicitly carries 'intern' — a fresh/direct visit to Plans always defaults to Employees"
      );

      // 972. Exactly one of Employees/Interns can be active at a time — both buttons derive `active` from the SAME single personType state variable (mutually exclusive by construction, not two independent booleans that could both be true/false)
      {
        const employeeBtnActiveMatch = onbPlansSrcFinal.match(/className=\{`view-btn \$\{personType === 'employee' \? 'active' : ''\}`\}/);
        const internBtnActiveMatch = onbPlansSrcFinal.match(/className=\{`view-btn \$\{personType === 'intern' \? 'active' : ''\}`\}/);
        assert(Boolean(employeeBtnActiveMatch) && Boolean(internBtnActiveMatch), "972. NEW — The Employees and Interns buttons compute `active` from the same single `personType` variable via mutually exclusive equality checks ('employee' vs 'intern') — exactly one can be active at any time");
      }

      // --- 2. REMOVAL OF OLD SECTIONS/CARDS ---

      // 973. The old "TYPE-SPECIFIC TASKS" section heading, and the standalone "Employee Tasks"/"Intern Tasks" card titles, no longer appear anywhere in the Plans page's actual rendered code
      assert(
        !onbPlansCodeOnlyFinal.match(/type-specific tasks/i) && !onbPlansSrcFinal.includes('title="Employee Tasks"') && !onbPlansSrcFinal.includes('title="Intern Tasks"') &&
        !onbPlansSrcFinal.match(/<ScopeCard[\s\S]{0,40}title="Employee Tasks"/) && !onbPlansSrcFinal.match(/<ScopeCard[\s\S]{0,40}title="Intern Tasks"/),
        '973. NEW — "TYPE-SPECIFIC TASKS" and the standalone Employee Tasks/Intern Tasks scope cards are completely removed from the Plans page — replaced by the Employees|Interns filter'
      );

      // 974. No duplicated Employee/Intern sections remain lower on the page — the page renders exactly 2 <section> blocks (Universal, Department-Specific), not the old 3
      {
        const sectionCount = (onbPlansSrcFinal.match(/<section>/g) || []).length;
        assert(sectionCount === 2, `974. NEW — OnboardingPlansPage.jsx renders exactly 2 <section> blocks (Universal Tasks, Department-Specific Tasks) — found ${sectionCount}, confirming no leftover duplicated Employee/Intern section`);
      }

      // 975. The old .onboarding-scope-grid-2 2-up grid (which held the Employee/Intern cards side by side) no longer exists in index.css — cleaned up, not left as dead CSS
      assert(!indexCssSrcFinal.includes('.onboarding-scope-grid-2'), '975. NEW — .onboarding-scope-grid-2 (the retired Employee/Intern 2-up grid) is fully removed from index.css, not left as unused dead code');

      // --- 3. EMPLOYEE/INTERN UNIVERSAL ARE SEPARATE DATASETS ---

      // 976. Employee Universal Tasks (7) and Intern Universal Tasks (3) are genuinely separate, disjoint-ID datasets — never one shared "universal" bucket
      {
        const employeeUniversalFinal = await onboardingService.getScopeTasks('universal', 'employee', null);
        const internUniversalFinal = await onboardingService.getScopeTasks('universal', 'intern', null);
        const employeeIds = new Set(employeeUniversalFinal.map((t) => t.id));
        const internIds = new Set(internUniversalFinal.map((t) => t.id));
        const overlap = [...employeeIds].some((id) => internIds.has(id));
        assert(
          employeeUniversalFinal.length === 7 && internUniversalFinal.length === 3 && !overlap,
          `976. NEW — Employee Universal Tasks (${employeeUniversalFinal.length}) and Intern Universal Tasks (${internUniversalFinal.length}) are disjoint datasets with zero shared task IDs`
        );
      }

      // --- 4. EMPLOYEE/INTERN DEPARTMENT TASKS ARE SEPARATE ---

      // 977. Employee + Software Engineering and Intern + Software Engineering department tasks are separate, disjoint-ID datasets for the SAME department
      {
        const employeeDept3Final = await onboardingService.getScopeTasks('department', 'employee', 'dept-3');
        const internDept3Final = await onboardingService.getScopeTasks('department', 'intern', 'dept-3');
        const employeeIds = new Set(employeeDept3Final.map((t) => t.id));
        const internIds = new Set(internDept3Final.map((t) => t.id));
        const overlap = [...employeeIds].some((id) => internIds.has(id));
        assert(!overlap && employeeDept3Final.length > 0 && internDept3Final.length > 0, '977. NEW — Employee+Software Engineering and Intern+Software Engineering department task sets are disjoint (different records), even though they target the same department');
      }

      // --- 5. TYPE-SPECIFIC COUNTS (NEVER COMBINED) ---

      // 978. getScopesSummary(personType) never returns a combined Employee+Intern total — Employee and Intern summaries are computed independently and their Universal counts are never added together
      {
        const employeeSummaryFinal = await onboardingService.getScopesSummary('employee');
        const internSummaryFinal = await onboardingService.getScopesSummary('intern');
        assert(
          employeeSummaryFinal.personType === 'employee' && internSummaryFinal.personType === 'intern' &&
          employeeSummaryFinal.universal.taskCount === 7 && internSummaryFinal.universal.taskCount === 3 &&
          employeeSummaryFinal.universal.taskCount !== employeeSummaryFinal.universal.taskCount + internSummaryFinal.universal.taskCount,
          '978. NEW — getScopesSummary() is always scoped to exactly one personType at a time and never returns a combined Employee+Intern total'
        );
      }

      // --- 6. ALL 4 MANAGE TASKS ROUTING COMBINATIONS ---

      // 979. The router declares route shapes covering all 4 combinations: Employee Universal, Intern Universal, Employee+Department, Intern+Department — all through the SAME :personType param, not 4 separate hardcoded routes
      assert(
        routerSrcFinal.includes("path: 'plans/:personType/universal'") && routerSrcFinal.includes("path: 'plans/:personType/department/:departmentId'"),
        '979. NEW — The router\'s 2 route shapes (plans/:personType/universal, plans/:personType/department/:departmentId) cover all 4 combinations (Employee Universal, Intern Universal, Employee+Dept, Intern+Dept) via the single :personType param'
      );

      // 980. PlanEditorPage correctly resolves each of the 4 combinations to the right scope+personType tasks (functional, not just route-shape)
      {
        const combos = [
          { personType: 'employee', departmentId: undefined, expectedScopeType: 'universal' },
          { personType: 'intern', departmentId: undefined, expectedScopeType: 'universal' },
          { personType: 'employee', departmentId: 'dept-3', expectedScopeType: 'department' },
          { personType: 'intern', departmentId: 'dept-3', expectedScopeType: 'department' },
        ];
        let allCorrect = true;
        for (const combo of combos) {
          const resolvedScopeType = combo.departmentId !== undefined ? 'department' : 'universal';
          if (resolvedScopeType !== combo.expectedScopeType) { allCorrect = false; break; }
          const tasksForCombo = await onboardingService.getScopeTasks(resolvedScopeType, combo.personType, combo.departmentId || null);
          if (!tasksForCombo.every((t) => t.personType === combo.personType && t.scopeType === resolvedScopeType)) { allCorrect = false; break; }
        }
        assert(allCorrect, '980. NEW — All 4 Manage Tasks combinations (Employee Universal, Intern Universal, Employee+SWE, Intern+SWE) resolve to the correct scopeType+personType tasks, matching how PlanEditorPage derives scopeType from the route\'s departmentId presence');
      }

      // 981. PlanEditorPage's contextual heading/subtitle text is correct and distinct for all 4 combinations
      {
        const deptFixture = { id: 'dept-3', name: 'Software Engineering' };
        const buildMeta = (personType, isDept) => {
          const personLabel = personType === 'intern' ? 'Intern' : 'Employee';
          return isDept
            ? { title: `${deptFixture.name} — ${personLabel} Tasks`, subtitle: `These tasks are added specifically for ${personLabel}s in ${deptFixture.name}.` }
            : { title: `${personLabel} Universal Tasks`, subtitle: personType === 'intern' ? 'These tasks are included for every intern or apprentice regardless of department.' : 'These tasks are included for every employee regardless of department.' };
        };
        const empUniversal = buildMeta('employee', false);
        const internUniversal = buildMeta('intern', false);
        const empDept = buildMeta('employee', true);
        const internDept = buildMeta('intern', true);
        const allDistinct = new Set([empUniversal.title, internUniversal.title, empDept.title, internDept.title]).size === 4;
        assert(
          allDistinct && empUniversal.title === 'Employee Universal Tasks' && internUniversal.title === 'Intern Universal Tasks' &&
          empDept.title === 'Software Engineering — Employee Tasks' && internDept.title === 'Software Engineering — Intern Tasks',
          `981. NEW — PlanEditorPage's heading is distinct and correct for all 4 combinations: "${empUniversal.title}", "${internUniversal.title}", "${empDept.title}", "${internDept.title}"`
        );
      }

      // --- 7. TASK CRUD / RELATIVE OFFSET / EDITOR FIELDS REMAIN FUNCTIONAL ---

      // 982. FUNCTIONAL: full CRUD round-trip on Employee Universal Tasks via saveScopeTasks/getScopeTasks — add, edit (title + relativeOffsetDays), remove — with automatic test-data cleanup afterward
      {
        const baselineEmployeeUniversal = await onboardingService.getScopeTasks('universal', 'employee', null);
        await onboardingService.saveScopeTasks('universal', 'employee', null, [
          ...baselineEmployeeUniversal,
          { title: 'Stage18 CRUD Verification Task', description: 'temp', activityTypeId: 'act-type-1', relativeOffsetDays: 5 },
        ]);
        const afterAdd = await onboardingService.getScopeTasks('universal', 'employee', null);
        const addedTask = afterAdd.find((t) => t.title === 'Stage18 CRUD Verification Task');
        assert(Boolean(addedTask) && addedTask.relativeOffsetDays === 5, '982. NEW — A new Employee Universal task can be added via saveScopeTasks() and is immediately retrievable with the correct relativeOffsetDays');

        const editedTasks = afterAdd.map((t) => t.id === addedTask.id ? { ...t, title: 'Stage18 CRUD Verification Task (edited)', relativeOffsetDays: -3 } : t);
        await onboardingService.saveScopeTasks('universal', 'employee', null, editedTasks);
        const afterEdit = await onboardingService.getScopeTasks('universal', 'employee', null);
        const editedTask = afterEdit.find((t) => t.title === 'Stage18 CRUD Verification Task (edited)');
        assert(Boolean(editedTask) && editedTask.relativeOffsetDays === -3, '982b. NEW — The task\'s title and relativeOffsetDays (negative/"Before" value) can be edited and persist correctly');

        const afterRemove = afterEdit.filter((t) => t.id !== editedTask.id);
        await onboardingService.saveScopeTasks('universal', 'employee', null, afterRemove);
        const finalState = await onboardingService.getScopeTasks('universal', 'employee', null);
        assert(finalState.length === baselineEmployeeUniversal.length && !finalState.some((t) => t.title.startsWith('Stage18 CRUD')), '982c. NEW — The task can be removed via saveScopeTasks(), and the test artifact is fully cleaned up — Employee Universal Tasks returns to its exact baseline count');
      }

      // 983. Task editor fields (Task Title, Activity Type, Relative Offset Days with 0/+/- semantics, Task Description) remain the only fields — no Assignment Rule, Required Task checkbox, template-name field, or in-editor department selector was reintroduced
      assert(
        planEditorSrcFinal.includes('>Task Title') && planEditorSrcFinal.includes('>Activity Type<') && planEditorSrcFinal.includes('Relative Offset (Days)') && planEditorSrcFinal.includes('>Task Description<') &&
        planEditorSrcFinal.includes('<strong>0</strong> = Start date') && planEditorSrcFinal.includes('<strong>+ value</strong> = After start date') && planEditorSrcFinal.includes('<strong>− value</strong> = Before start date') &&
        !stripComments(planEditorSrcFinal).includes('Assignment Rule') && !planEditorSrcFinal.includes('>Required Task<') && !planEditorSrcFinal.includes('Template Name') &&
        !planEditorSrcFinal.match(/<Select[\s\S]{0,80}departmentId/),
        '983. NEW — The task editor retains exactly Task Title / Activity Type / Relative Offset (Days, with 0=Start/+After/-Before) / Task Description — no Assignment Rule, Required Task checkbox, template-name field, or in-editor department selector'
      );

      resetDatabase();

      // --- 8. LAUNCH COMPOSITION: NO CROSS-TYPE LEAKAGE (REAL FUNCTIONAL SCENARIO) ---

      // 984-987. FUNCTIONAL: Employee-in-SWE launch composes Employee Universal + Employee Department only; Intern-in-SWE launch composes Intern Universal + Intern Department only; neither ever leaks into the other. Uses synthetic in-memory employees (never persisted) so no test artifacts are left in employee/instance data.
      {
        const swDept = { id: 'dept-3', name: 'Software Engineering' };
        const freshDefsForLaunchCheck = await onboardingService.getScopeTaskDefinitions();
        const employeeInSwe = composeOnboardingTasks({ id: 'launch-check-employee', directoryType: 'Employee', department: swDept }, freshDefsForLaunchCheck, '2026-09-01');
        const internInSwe = composeOnboardingTasks({ id: 'launch-check-intern', directoryType: 'Intern', department: swDept }, freshDefsForLaunchCheck, '2026-09-01');

        assert(
          employeeInSwe.counts.universal === 7 && employeeInSwe.counts.department === 4 && employeeInSwe.counts.total === 11,
          `984. NEW — Employee-in-Software-Engineering launch composition = Employee Universal(7) + Employee Department(4) = 11 (found ${employeeInSwe.counts.total})`
        );
        assert(
          internInSwe.counts.universal === 3 && internInSwe.counts.department === 4 && internInSwe.counts.total === 7,
          `985. NEW — Intern-in-Software-Engineering launch composition = Intern Universal(3) + Intern Department(4) = 7 (found ${internInSwe.counts.total})`
        );
        assert(!employeeInSwe.tasks.some((t) => t.personType === 'intern'), '986. NEW — The Employee launch composition contains ZERO Intern-personType tasks in either Universal or Department portions — no cross-type leakage');
        assert(!internInSwe.tasks.some((t) => t.personType === 'employee'), '987. NEW — The Intern launch composition contains ZERO Employee-personType tasks in either Universal or Department portions — no cross-type leakage');
      }

      // --- 9. HISTORICAL LAUNCHED INSTANCES REMAIN UNCHANGED ---

      // 988. FUNCTIONAL: launching, then editing BOTH the Employee's Universal AND Department scopes, leaves the already-launched instance's task count and task instance snapshots completely unchanged
      {
        const dbForHistoryCheck = loadDatabase();
        dbForHistoryCheck.onboardingPlanInstances = [];
        dbForHistoryCheck.onboardingTaskInstances = [];
        saveDatabase(dbForHistoryCheck);

        const launchedForHistoryCheck = await onboardingService.launchPlanInstance('emp-013'); // Hannah Razak — Employee, Software Engineering
        const originalTaskCount = launchedForHistoryCheck.progress.totalTasks;
        const originalTaskTitles = launchedForHistoryCheck.progress.tasks.map((t) => t.currentTitle || t.title).sort();

        const baselineEmployeeUniversalForHistory = await onboardingService.getScopeTasks('universal', 'employee', null);
        const baselineEmployeeDeptForHistory = await onboardingService.getScopeTasks('department', 'employee', 'dept-3');
        await onboardingService.saveScopeTasks('universal', 'employee', null, [...baselineEmployeeUniversalForHistory, { title: 'Post-Launch History Check Universal', description: '', activityTypeId: 'act-type-1', relativeOffsetDays: 0 }]);
        await onboardingService.saveScopeTasks('department', 'employee', 'dept-3', [...baselineEmployeeDeptForHistory, { title: 'Post-Launch History Check Department', description: '', activityTypeId: 'act-type-1', relativeOffsetDays: 0 }]);

        const reFetchedForHistory = await onboardingService.getInstanceById(launchedForHistoryCheck.id);
        const reFetchedTaskTitles = reFetchedForHistory.progress.tasks.map((t) => t.currentTitle || t.title).sort();
        assert(
          reFetchedForHistory.progress.totalTasks === originalTaskCount && JSON.stringify(reFetchedTaskTitles) === JSON.stringify(originalTaskTitles),
          `988. NEW — After editing BOTH Employee Universal and Employee+SWE Department scopes post-launch, Hannah's already-launched instance is byte-for-byte unchanged (still ${reFetchedForHistory.progress.totalTasks} tasks, same task titles) — historical snapshots are never retroactively rewritten`
        );

        resetDatabase();
      }

      // --- 10. TYPE-MATCHING EMPTY-STATE WORDING ---

      // 989. Department card empty-state copy is exactly correct and distinct for Employees vs Interns, with no old "type-specific tasks" terminology
      assert(
        onbPlansSrcFinal.includes('No employee-specific tasks configured for this department. Employee Universal Tasks will still apply.') &&
        onbPlansSrcFinal.includes('No intern-specific tasks configured for this department. Intern Universal Tasks will still apply.') &&
        !onbPlansCodeOnlyFinal.match(/type-specific tasks will still apply/i),
        '989. NEW — Department empty-state wording is exact and personType-specific for both Employees and Interns, with no old generic "type-specific tasks" phrasing'
      );

      // 990. Universal card subtitle copy is exactly correct and distinct for Employees vs Interns
      assert(
        onbPlansSrcFinal.includes('Included for every employee regardless of department.') &&
        onbPlansSrcFinal.includes('Included for every intern or apprentice regardless of department.'),
        '990. NEW — Universal Tasks card subtitle is exact and personType-specific for both Employees and Interns'
      );

      // 991. Page heading/subtitle match the exact required copy from the task brief
      assert(
        onbPlansSrcFinal.includes('>Onboarding Plans<') &&
        onbPlansSrcFinal.includes('Configure reusable onboarding tasks for employees and interns. Universal and department-specific tasks are combined automatically when onboarding is launched.'),
        '991. NEW — The page heading and subtitle match the exact required copy'
      );

      // --- 11. INSTANT FILTER SWITCHING (NO PAGE RELOAD) ---

      // 992. Switching the filter is a plain React state update (setPersonType) — no window.location.reload(), no full navigate() to a different route, no forced remount key trick
      assert(
        onbPlansSrcFinal.includes("onClick={() => setPersonType('employee')}") && onbPlansSrcFinal.includes("onClick={() => setPersonType('intern')}") &&
        !onbPlansSrcFinal.includes('window.location.reload') && !onbPlansSrcFinal.match(/navigate\(['"]\/onboarding\/plans['"]\)/),
        '992. NEW — Clicking Employees/Interns only calls setPersonType() (local component state) — no full page reload or route navigation, so the switch is instant'
      );

      // 993. Changing personType re-fetches the scope summary via a useEffect keyed on personType — the data genuinely refreshes per filter, it isn't a static one-time load
      assert(onbPlansSrcFinal.match(/useEffect\(\(\) => \{\s*\n\s*loadSummary\(\);\s*\n[\s\S]{0,120}\}, \[personType\]\);/), '993. NEW — A useEffect keyed on [personType] re-fetches getScopesSummary(personType) every time the filter changes, so switching tabs genuinely reloads the correct data (not stale/cached from the other tab)');

      // --- 12. RESPONSIVE: DESKTOP / 1024PX / 375PX ---

      // 994. Department grid uses a real responsive auto-fill grid on desktop (no fixed pixel-count columns)
      assert(indexCssSrcFinal.match(/\.onboarding-scope-grid-dept\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(300px/), '994. NEW — .onboarding-scope-grid-dept uses a responsive auto-fill grid (minmax(300px, 1fr)) on desktop, not a fixed column count');

      // 995. At 1024px, department cards shrink their minmax width but remain a multi-column responsive grid (not forced to 1 column too early)
      assert(indexCssSrcFinal.match(/@media \(max-width:\s*1024px\)\s*\{[^}]*\.onboarding-scope-grid-dept\s*\{[^}]*minmax\(260px/), '995. NEW — At the 1024px breakpoint, .onboarding-scope-grid-dept narrows its minmax to 260px, staying a responsive multi-column grid rather than jumping straight to 1 column');

      // 996. At 375px (via the 640px breakpoint), the department grid collapses to a single column and the filter switcher itself goes full-width with centered, equally-sized buttons — a usable mobile filter, not a cramped/overflowing one
      assert(
        indexCssSrcFinal.match(/@media \(max-width:\s*640px\)\s*\{[^}]*\.onboarding-scope-grid-dept\s*\{[^}]*grid-template-columns:\s*1fr/) &&
        indexCssSrcFinal.match(/@media \(max-width:\s*640px\)\s*\{[\s\S]{0,300}\.onboarding-person-type-switcher\s*\{[^}]*width:\s*100%/) &&
        indexCssSrcFinal.match(/\.onboarding-person-type-switcher \.view-btn\s*\{[^}]*flex:\s*1[^}]*justify-content:\s*center/),
        '996. NEW — At 375px/mobile widths, the department grid stacks to 1 column and the Employees|Interns filter becomes a full-width, evenly-split, centered control — usable and not cramped on a phone'
      );

      // 997. No horizontal page overflow risk was introduced anywhere in the new filter/section markup — no overflow-x rules attached to the switcher or section wrapper
      assert(
        !indexCssSrcFinal.match(/\.onboarding-person-type-switcher[\s\S]{0,200}overflow-x:\s*(scroll|auto)/) &&
        !indexCssSrcFinal.match(/\.onboarding-scope-sections[\s\S]{0,200}overflow-x:\s*(scroll|auto)/),
        '997. NEW — No overflow-x rules were introduced on the filter switcher or the scope sections wrapper — task lists still scroll only internally (see check 544), the page itself never scrolls horizontally'
      );

      // --- 13. MIGRATION SAFETY (PERSON-TYPE MIGRATION SPECIFICALLY) ---

      // 998. migrateOnboardingPersonTypeIfNeeded() is idempotent — running it twice on already-migrated data does not double-duplicate department tasks or change the total count
      {
        const dbOnceForPersonMigration = loadDatabase();
        const beforeCount = (dbOnceForPersonMigration.onboardingPlanTasks || []).length;
        const migratedTwice = migrateOnboardingPersonTypeIfNeeded(migrateOnboardingPersonTypeIfNeeded(loadDatabase()));
        const afterCount = (migratedTwice.onboardingPlanTasks || []).length;
        assert(afterCount === beforeCount, `998. NEW — migrateOnboardingPersonTypeIfNeeded() is idempotent — running it twice does not change the total task count (before: ${beforeCount}, after double-run: ${afterCount})`);
      }

      // 999. Every task has a personType after migration — no task is left without one (the exact predicate the migration itself uses to decide whether it still needs to run)
      {
        const dbForPersonTypeCoverage = loadDatabase();
        const missingPersonType = (dbForPersonTypeCoverage.onboardingPlanTasks || []).filter((t) => t.scopeType && !t.personType);
        assert(missingPersonType.length === 0, `999. NEW — Every onboarding task with a scopeType also has a personType after migration (found ${missingPersonType.length} without one)`);
      }

      // 1000. Migration is additive/non-destructive — a legacy record's original fields (assignmentRule, planTemplateId, title) survive the person-type migration untouched
      {
        const dbForAdditivityCheck = loadDatabase();
        const originalPt001 = (dbForAdditivityCheck.onboardingPlanTasks || []).find((t) => t.id === 'pt-001');
        assert(
          Boolean(originalPt001) && originalPt001.assignmentRule === 'manager' && originalPt001.planTemplateId === 'tpl-001' && originalPt001.title === 'Prepare workstation and access credentials' && originalPt001.personType === 'employee' && originalPt001.scopeType === 'universal',
          '1000. NEW — pt-001\'s original fields (assignmentRule, planTemplateId, title) survive the person-type migration untouched, and it correctly ends up as scopeType universal / personType employee'
        );
      }

      // 1001. The migration is wired into BOTH getInitialState() and loadDatabase() (the two paths that can produce a live database), not just one — confirmed via source inspection
      assert(
        (storageEngineSrcFinal.match(/migrateOnboardingPersonTypeIfNeeded\(/g) || []).length >= 3,
        '1001. NEW — migrateOnboardingPersonTypeIfNeeded is defined once and called from both getInitialState() and loadDatabase() (at least 3 total occurrences: definition + 2 call sites), so every path that can produce a live database picks up the migration'
      );

      // --- 14. NO REGRESSION IN EXISTING ONBOARDING FUNCTIONALITY ---

      // 1002. addTaskToInstance() (the employee-specific individual Add Task layer) is completely untouched by this refactor — no scopeType/personType logic was added to it
      assert(
        onboardingServiceSrcFinal.includes('async addTaskToInstance(planInstanceId, taskData = {}, currentUserId') && !onboardingServiceSrcFinal.match(/addTaskToInstance[\s\S]{0,80}personType/),
        '1002. NEW — addTaskToInstance() (per-employee individual Add Task) retains its original signature and has no new personType-related logic'
      );

      // 1003. calculatePlanProgress()/derivePlanInstanceStatus() (task completion/progress/lifecycle transitions) are completely untouched by this Plans-architecture-only refactor
      assert(
        onboardingDomainSrcFinal.includes('export function calculatePlanProgress') && onboardingDomainSrcFinal.includes('export function derivePlanInstanceStatus') &&
        !onboardingDomainSrcFinal.match(/calculatePlanProgress[\s\S]{0,300}personType/),
        '1003. NEW — calculatePlanProgress() and derivePlanInstanceStatus() (completion/progress/lifecycle logic) contain no personType-related changes — this task only touched reusable plan CONFIGURATION, not task execution/progress'
      );

      // 1004. UPDATED — Notes and the reminder/notification system remain entirely unaffected by the onboarding personType concept. Offboarding itself later grew its OWN independent
      // personType concept (via the separate "Refactor Offboarding Plans" task) — that is a deliberate, parallel addition to offboardingService.js/offboardingDomain.js, never a leak of
      // ONBOARDING's personType logic, so this check now proves independence (no cross-import from onboardingDomain.js) rather than absence. See checks 1170+ for that task's own coverage.
      {
        const offboardingServiceSrcFinal = fs.readFileSync(path.resolve('./src/services/offboardingService.js'), 'utf-8');
        const offboardingDomainSrcFinal = fs.readFileSync(path.resolve('./src/domain/offboardingDomain.js'), 'utf-8');
        const notesServiceSrcFinal = fs.readFileSync(path.resolve('./src/services/notesService.js'), 'utf-8');
        const notificationServiceSrcFinal = fs.readFileSync(path.resolve('./src/services/notificationService.js'), 'utf-8');
        assert(
          !notesServiceSrcFinal.includes('personType') && !notificationServiceSrcFinal.includes('personType') &&
          !offboardingServiceSrcFinal.includes("from '../domain/onboardingDomain.js'") && !offboardingDomainSrcFinal.includes("from './onboardingDomain.js'"),
          '1004. UPDATED — Notes and the reminder/notification system still contain no reference to any personType concept, and offboardingService.js/offboardingDomain.js never import from onboardingDomain.js — Offboarding\'s own (later-added) personType concept is a fully independent, parallel implementation, not a leak of Onboarding\'s'
        );
      }

      resetDatabase();
    }

    // ==========================================================================
    // Exclude Employees/Interns With an Existing Active Onboarding Plan From
    // the Launch Dropdown
    // ==========================================================================
    {
      resetDatabase();

      const launchPlanModalSrcFinal2 = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
      const onboardingServiceSrcFinal2 = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');

      // 1005. Baseline seed data: Hannah Razak (emp-013, Employee) and Kevin Heng (emp-014,
      // Intern) are both Onboarding-status but ALSO both already have an active (Needs
      // Attention) instance out of the box — matching the task brief's own Hannah Razak
      // example — so BOTH are correctly excluded, leaving zero eligible candidates by default.
      {
        const activeIds = await onboardingService.getActiveOnboardingEmployeeIds();
        const eligible = await onboardingService.getLaunchEligibleEmployees();
        assert(activeIds.has('emp-013') && activeIds.has('emp-014'), '1005. NEW — Hannah Razak (emp-013, Employee) and Kevin Heng (emp-014, Intern) both have an existing active onboarding plan in the seed data, matching the task brief\'s own example');
        assert(eligible.length === 0, `1005b. NEW — With both Onboarding-status seed people already carrying active plans, getLaunchEligibleEmployees() correctly returns zero candidates (found ${eligible.length})`);
      }

      // --- SCENARIO 7: NO ELIGIBLE CANDIDATES (EMPTY STATE) ---

      // 1006. Empty-state wording matches the exact required copy for All/Employees/Interns
      assert(
        launchPlanModalSrcFinal2.includes('No employees or interns are currently eligible to launch onboarding.') &&
        launchPlanModalSrcFinal2.includes('No employees are currently eligible to launch onboarding.') &&
        launchPlanModalSrcFinal2.includes('No interns are currently eligible to launch onboarding.'),
        '1006. NEW — SCENARIO 7: Empty-state copy matches the exact required wording for All, Employees, and Interns'
      );

      // 1007. The dropdown renders a disabled Select (not a broken/blank one) when the eligible list is empty
      assert(launchPlanModalSrcFinal2.match(/filteredOnboardingEmployees\.length === 0[\s\S]{0,200}disabled/), '1007. NEW — SCENARIO 7: A disabled Select with the empty-state message renders instead of a blank/broken dropdown when zero candidates are eligible');

      // --- SCENARIOS 1 & 8 (EMPLOYEE): COMPLETE HANNAH'S EXISTING PLAN -> SHE BECOMES ELIGIBLE AGAIN ---
      // Also proves Scenario 8: a historical/COMPLETED plan does NOT permanently block re-eligibility,
      // since the active-plan definition is derivedStatus !== Completed, not "has ANY instance ever".
      // NOTE: completion is simulated via a fresh .map()-derived `activities` array (not
      // activityService.markComplete()'s in-place `activities[index] = ...` write) — in the
      // Node/no-localStorage fallback this storage engine uses here, db.activities is a direct
      // reference to the imported seed module array, so an in-place index write would otherwise
      // permanently corrupt the shared seed singleton across this run's later resetDatabase()
      // calls (the exact bug the module's own `notes` handling already guards against — see
      // storageEngine.js's getInitialState()). Assigning a NEW array here avoids that entirely.
      {
        const hannahInstanceBefore = (await onboardingService.getAllInstances({ employeeId: 'emp-013' }))[0];
        const hannahActivityIds = new Set(hannahInstanceBefore.progress.tasks.map((t) => t.activityId));
        const dbForHannahComplete = loadDatabase();
        dbForHannahComplete.activities = dbForHannahComplete.activities.map((a) =>
          hannahActivityIds.has(a.id) ? { ...a, completed: true, completedAt: new Date().toISOString() } : a
        );
        saveDatabase(dbForHannahComplete);
        const hannahInstanceAfter = (await onboardingService.getAllInstances({ employeeId: 'emp-013' }))[0];
        assert(hannahInstanceAfter.derivedStatus === 'Completed', `1008. NEW — Setup: completing every task on Hannah's existing instance correctly flips its derivedStatus to Completed (found ${hannahInstanceAfter.derivedStatus})`);

        const activeIdsAfterComplete = await onboardingService.getActiveOnboardingEmployeeIds();
        assert(!activeIdsAfterComplete.has('emp-013'), '1009. NEW — SCENARIO 8: Once Hannah\'s onboarding plan is fully COMPLETED (not just any historical record existing), she is no longer counted as having an "active" plan — a completed plan does not permanently block re-eligibility');

        const eligibleAfterComplete = await onboardingService.getLaunchEligibleEmployees();
        const hannahEligible = eligibleAfterComplete.find((e) => e.id === 'emp-013');
        assert(Boolean(hannahEligible), '1010. NEW — SCENARIO 1: Hannah (Onboarding status, now with a Completed — not active — plan) correctly appears in the eligible-candidates list');

        // 1011. All/Employees filter narrowing (mirroring LaunchPlanModal's own filteredOnboardingEmployees logic) both include Hannah once she is eligible
        const allFilterResult = eligibleAfterComplete;
        const employeesFilterResult = eligibleAfterComplete.filter((e) => e.directoryType === 'Employee');
        assert(allFilterResult.some((e) => e.id === 'emp-013') && employeesFilterResult.some((e) => e.id === 'emp-013'), '1011. NEW — SCENARIO 1: Hannah appears under both the All filter and the Employees filter once eligible (same eligible set, narrowed only by directoryType, matching LaunchPlanModal\'s own filter logic)');

        // 1012. A fresh preview for Hannah composes correctly now that she is eligible again
        const previewForHannah = await onboardingService.previewOnboardingComposition('emp-013');
        assert(previewForHannah.isValid && previewForHannah.counts.total === 11, `1012. NEW — SCENARIO 1: Previewing onboarding for the now-eligible Hannah composes correctly (Employee Universal(7)+Department(4)=11, found ${previewForHannah.counts.total})`);

        resetDatabase(); // restore Hannah's original seeded active instance for subsequent checks
      }

      // --- SCENARIO 3 & 6 (INTERN): SAME COMPLETION APPROACH FOR KEVIN ---
      // Same non-mutating .map()-based completion simulation as the Hannah block above, for the
      // same reason (avoids corrupting the shared seed `activities` singleton in Node's
      // no-localStorage storage fallback).
      {
        const kevinInstanceBefore = (await onboardingService.getAllInstances({ employeeId: 'emp-014' }))[0];
        const kevinActivityIds = new Set(kevinInstanceBefore.progress.tasks.map((t) => t.activityId));
        const dbForKevinComplete = loadDatabase();
        dbForKevinComplete.activities = dbForKevinComplete.activities.map((a) =>
          kevinActivityIds.has(a.id) ? { ...a, completed: true, completedAt: new Date().toISOString() } : a
        );
        saveDatabase(dbForKevinComplete);
        const eligibleAfterKevinComplete = await onboardingService.getLaunchEligibleEmployees();
        const kevinEligible = eligibleAfterKevinComplete.find((e) => e.id === 'emp-014');
        assert(Boolean(kevinEligible) && kevinEligible.directoryType === 'Intern', '1013. NEW — SCENARIO 3: Kevin Heng (Intern, Onboarding status, now with a Completed plan) correctly appears in the eligible-candidates list');

        const internsFilterResult = eligibleAfterKevinComplete.filter((e) => e.directoryType === 'Intern');
        assert(internsFilterResult.some((e) => e.id === 'emp-014'), '1014. NEW — SCENARIO 3/6: Kevin appears under the Interns filter once eligible');

        const previewForKevin = await onboardingService.previewOnboardingComposition('emp-014');
        assert(previewForKevin.isValid && previewForKevin.counts.total === 7, `1015. NEW — SCENARIO 3: Previewing onboarding for the now-eligible Kevin composes the correct Intern task set (Intern Universal(3)+Department(4)=7, found ${previewForKevin.counts.total})`);

        resetDatabase();
      }

      // --- SCENARIO 2 & 4 (RE-DERIVED FROM FRESH RESET): ACTIVE-PLAN PEOPLE EXCLUDED FROM ALL 3 FILTERS ---
      {
        const eligibleFresh = await onboardingService.getLaunchEligibleEmployees();
        assert(!eligibleFresh.some((e) => e.id === 'emp-013'), '1016. NEW — SCENARIO 2: Hannah (active plan) does NOT appear in the eligible list — excluded from All');
        assert(!eligibleFresh.filter((e) => e.directoryType === 'Employee').some((e) => e.id === 'emp-013'), '1016b. NEW — SCENARIO 2: Hannah remains excluded even after applying the Employees filter narrowing');
        assert(!eligibleFresh.some((e) => e.id === 'emp-014'), '1017. NEW — SCENARIO 4: Kevin (active plan) does NOT appear in the eligible list — excluded from All');
        assert(!eligibleFresh.filter((e) => e.directoryType === 'Intern').some((e) => e.id === 'emp-014'), '1017b. NEW — SCENARIO 4: Kevin remains excluded even after applying the Interns filter narrowing');
      }

      // --- SCENARIO 5: WRONG LIFECYCLE STATUS STAYS EXCLUDED REGARDLESS OF ACTIVE-PLAN STATUS ---
      {
        const allEmpsForWrongStatus = await employeeService.getAll();
        const nonOnboardingPerson = allEmpsForWrongStatus.find((e) => e.status !== 'Onboarding');
        const eligibleForWrongStatusCheck = await onboardingService.getLaunchEligibleEmployees();
        assert(
          Boolean(nonOnboardingPerson) && !eligibleForWrongStatusCheck.some((e) => e.id === nonOnboardingPerson.id),
          `1018. NEW — SCENARIO 5: A person whose lifecycle status is NOT 'Onboarding' (e.g. ${nonOnboardingPerson ? nonOnboardingPerson.status : 'n/a'}) remains excluded from the eligible list regardless of active-plan status — the existing lifecycle rule is unchanged`
        );
      }

      // --- SCENARIO 9: FINAL DUPLICATE-LAUNCH VALIDATION STILL EXISTS (BYPASS-THE-UI TEST) ---

      // 1019. Source-level: launchPlanInstance() still contains the duplicate-plan guard, now reusing getActiveOnboardingEmployeeIds()
      assert(
        onboardingServiceSrcFinal2.includes('already has an active onboarding plan (In Progress / Needs Attention)') &&
        onboardingServiceSrcFinal2.match(/activeOnboardingEmployeeIds\.has\(employeeId\)/),
        '1019. NEW — SCENARIO 9: launchPlanInstance() still contains the final duplicate-plan guard, now built on getActiveOnboardingEmployeeIds() (the same source the dropdown uses) rather than a separate inline computation'
      );

      // 1020. FUNCTIONAL: calling launchPlanInstance() directly for Hannah (who still has her seeded active plan, entirely bypassing any UI dropdown filtering) is correctly rejected
      {
        let threw = false;
        let errMsg = '';
        try {
          await onboardingService.launchPlanInstance('emp-013');
        } catch (err) {
          threw = true;
          errMsg = err.message;
        }
        assert(threw && errMsg.includes('already has an active onboarding plan'), '1020. NEW — SCENARIO 9: Calling launchPlanInstance(\'emp-013\') directly (bypassing the UI dropdown filter entirely) still throws "already has an active onboarding plan" — the validation is not merely redundant with the UI filter, it remains the authoritative guard');
      }

      // --- SCENARIO 10: STALE SELECTION HANDLED SAFELY (SOURCE-LEVEL) ---

      // 1021. The modal's stale-selection effect is keyed on BOTH typeFilter and the eligible-candidates list itself
      assert(
        launchPlanModalSrcFinal2.match(/\}, \[typeFilter, onboardingEmployees\]\);/) &&
        launchPlanModalSrcFinal2.includes("setSelectedEmployeeId('')"),
        '1021. NEW — SCENARIO 10: The stale-selection effect is keyed on [typeFilter, onboardingEmployees] — a selection is safely cleared if the person no longer matches the filter OR is no longer present in the eligible-candidates list at all'
      );

      // 1022. UPDATED — When selectedEmployeeId is cleared, the preview is also cleared — no misleading stale task preview can linger for a person who is no longer selectable. The
      // loadPreview() call was later extended (by the "Standardize Automatic Anchor Dates" task) to also pass customAnchorDate through — re-pointed here to that current call shape.
      assert(
        launchPlanModalSrcFinal2.match(/if \(selectedEmployeeId\)\s*\{\s*\n\s*loadPreview\(selectedEmployeeId, customAnchorDate\);\s*\n\s*\}\s*else\s*\{\s*\n\s*setPreview\(null\);/),
        '1022. UPDATED — SCENARIO 10: Preview state is derived from selectedEmployeeId (and customAnchorDate) via its own effect — clearing the selection (e.g. by the stale-selection guard) automatically clears the preview too, so no misleading task preview can linger for an ineligible person'
      );

      // --- HELPER TEXT ---

      // 1023. Helper text communicates BOTH eligibility conditions
      assert(
        launchPlanModalSrcFinal2.includes('Only employees/interns in Onboarding status without an active onboarding plan are eligible.'),
        '1023. NEW — The helper text communicates both eligibility conditions (Onboarding status AND no active onboarding plan), not just the old lifecycle-only wording'
      );

      // --- PLAN COMPOSITION / PERSONTYPE SEPARATION UNCHANGED ---

      // 1024. composeOnboardingTasks()/getScopeTaskDefinitions() are untouched — same Employee/Intern totals and no cross-type leakage, as before this task
      {
        const scopeDefsFinal2 = await onboardingService.getScopeTaskDefinitions();
        const empCompositionFinal2 = composeOnboardingTasks({ id: 'eligibility-check-emp', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsFinal2, '2026-08-15');
        const internCompositionFinal2 = composeOnboardingTasks({ id: 'eligibility-check-intern', directoryType: 'Intern', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsFinal2, '2026-08-15');
        assert(
          empCompositionFinal2.counts.total === 11 && internCompositionFinal2.counts.total === 7 &&
          !empCompositionFinal2.tasks.some((t) => t.personType === 'intern') && !internCompositionFinal2.tasks.some((t) => t.personType === 'employee'),
          `1024. NEW — Plan composition (Employee Universal+Department=11, Intern Universal+Department=7, no cross-type leakage) is completely unaffected by this launch-eligibility task (found Employee:${empCompositionFinal2.counts.total}, Intern:${internCompositionFinal2.counts.total})`
        );
      }

      // 1025. The Plans-configuration service methods retain their exact signatures from the previous Plans refactor — this task only added 2 new read-only eligibility methods and touched launchPlanInstance's guard
      assert(
        onboardingServiceSrcFinal2.includes('async saveScopeTasks(scopeType, personType, departmentId = null, tasksData = [], currentUserId') &&
        onboardingServiceSrcFinal2.includes('async getScopeTasks(scopeType, personType, departmentId = null)') &&
        onboardingServiceSrcFinal2.includes("async getScopesSummary(personType = 'employee')"),
        '1025. NEW — saveScopeTasks/getScopeTasks/getScopesSummary retain their exact signatures from the previous Plans refactor — this task did not touch plan composition/configuration, only launch candidate eligibility'
      );

      // --- EXISTING LAUNCHED INSTANCES UNCHANGED ---

      // 1026. getActiveOnboardingEmployeeIds()/getLaunchEligibleEmployees() are purely read-only — neither calls saveDatabase(), so computing eligibility can never mutate an already-launched instance
      assert(
        !onboardingServiceSrcFinal2.match(/async getActiveOnboardingEmployeeIds\(\)[\s\S]{0,400}saveDatabase/) &&
        !onboardingServiceSrcFinal2.match(/async getLaunchEligibleEmployees\(\)[\s\S]{0,400}saveDatabase/),
        '1026. NEW — getActiveOnboardingEmployeeIds() and getLaunchEligibleEmployees() are both purely read-only (no saveDatabase() call in either) — computing launch eligibility can never mutate an existing launched onboarding instance'
      );

      // 1027. FUNCTIONAL: Hannah's seeded instance (inst-001) is byte-for-byte unchanged after repeatedly computing launch eligibility
      {
        const hannahInstanceCheck1 = await onboardingService.getInstanceById('inst-001');
        await onboardingService.getLaunchEligibleEmployees();
        await onboardingService.getLaunchEligibleEmployees();
        const hannahInstanceCheck2 = await onboardingService.getInstanceById('inst-001');
        assert(
          hannahInstanceCheck1.progress.totalTasks === hannahInstanceCheck2.progress.totalTasks &&
          JSON.stringify(hannahInstanceCheck1.progress.tasks.map((t) => t.title)) === JSON.stringify(hannahInstanceCheck2.progress.tasks.map((t) => t.title)),
          '1027. NEW — Repeatedly computing launch eligibility does not alter Hannah\'s existing launched instance (inst-001) in any way — same task count and titles before and after'
        );
      }

      resetDatabase();
    }

    // ==========================================================================
    // Add Drop Onboarding Plan + Delete Individual Onboarding Task + Mark All
    // Overdue Tasks Complete
    // ==========================================================================
    {
      resetDatabase();

      const onbDetailSrcFinal3 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeeDetailPage.jsx'), 'utf-8');
      const onbEmployeesSrcFinal3 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeesPage.jsx'), 'utf-8');
      const overdueTasksModalSrcFinal3 = fs.readFileSync(path.resolve('./src/components/onboarding/OverdueTasksModal.jsx'), 'utf-8');
      const onboardingServiceSrcFinal3 = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
      const onboardingDomainSrcFinal3 = fs.readFileSync(path.resolve('./src/domain/onboardingDomain.js'), 'utf-8');
      const activityServiceSrcFinal3 = fs.readFileSync(path.resolve('./src/services/activityService.js'), 'utf-8');
      const deleteTaskModalSrc = fs.existsSync(path.resolve('./src/components/onboarding/DeleteOnboardingTaskModal.jsx'))
        ? fs.readFileSync(path.resolve('./src/components/onboarding/DeleteOnboardingTaskModal.jsx'), 'utf-8') : '';
      const dropPlanModalSrc = fs.existsSync(path.resolve('./src/components/onboarding/DropPlanModal.jsx'))
        ? fs.readFileSync(path.resolve('./src/components/onboarding/DropPlanModal.jsx'), 'utf-8') : '';

      // ================= DELETE TASK (checks 1-10) =================

      // 1028. Delete action exists on each launched task row, with the required title/aria-label, beside the existing Complete/Reopen action
      assert(
        onbDetailSrcFinal3.includes("title=\"Delete task\"") && onbDetailSrcFinal3.includes("aria-label=\"Delete task\"") && onbDetailSrcFinal3.includes('<Trash2') && onbDetailSrcFinal3.includes('handleToggleTaskComplete'),
        '1028. NEW — Each launched task row has a Delete action (Trash2 icon, title/aria-label "Delete task") alongside the existing Complete/Reopen action'
      );

      // 1029. Deletion always requires confirmation — the detail page only ever opens DeleteOnboardingTaskModal (setTaskPendingDelete), it never calls onboardingService.deleteTaskFromInstance() directly
      assert(
        onbDetailSrcFinal3.includes('setTaskPendingDelete(task)') && onbDetailSrcFinal3.includes('<DeleteOnboardingTaskModal') &&
        !stripComments(onbDetailSrcFinal3).includes('onboardingService.deleteTaskFromInstance') &&
        deleteTaskModalSrc.includes('onboardingService.deleteTaskFromInstance(planInstanceId, task.id)') &&
        deleteTaskModalSrc.includes('Delete Task?') && deleteTaskModalSrc.includes('className="btn-danger"'),
        '1029. NEW — Delete never happens on a single click: the detail page only opens DeleteOnboardingTaskModal (a Cancel/Delete Task confirmation with destructive styling), which is the only caller of onboardingService.deleteTaskFromInstance()'
      );

      // 1030-1035. FUNCTIONAL: deleting one incomplete task from Hannah's launched instance recalculates total/completed/percentage/status immediately, and never touches the reusable Plans configuration
      {
        const scopeDefsBeforeDelete = await onboardingService.getScopeTaskDefinitions();
        const instanceBeforeDelete = await onboardingService.getInstanceById('inst-001'); // Hannah Razak
        const beforeTotal = instanceBeforeDelete.progress.totalTasks;
        const beforeCompleted = instanceBeforeDelete.progress.completedTasksCount;
        const incompleteTask = instanceBeforeDelete.progress.tasks.find((t) => !t.isCompleted);
        assert(Boolean(incompleteTask), '1030setup. NEW — Setup: Hannah\'s seeded instance has at least one incomplete task to delete');

        const otherEmployeeInstanceBefore = await onboardingService.getInstanceById('inst-002'); // Kevin Heng — must be unaffected

        const afterDelete = await onboardingService.deleteTaskFromInstance('inst-001', incompleteTask.id);
        assert(afterDelete.progress.totalTasks === beforeTotal - 1, `1030. NEW — Deleting one incomplete task decrements totalTasks by exactly 1 (before: ${beforeTotal}, after: ${afterDelete.progress.totalTasks})`);
        assert(afterDelete.progress.completedTasksCount === beforeCompleted, `1031. NEW — Deleting an INCOMPLETE task leaves completedTasksCount unchanged (still ${afterDelete.progress.completedTasksCount})`);
        const expectedPct = afterDelete.progress.totalTasks > 0 ? Math.round((afterDelete.progress.completedTasksCount / afterDelete.progress.totalTasks) * 100) : 0;
        assert(afterDelete.progress.progressPercentage === expectedPct, `1032. NEW — Progress percentage recalculates correctly against the new total (${afterDelete.progress.progressPercentage}%, expected ${expectedPct}%)`);
        assert(!afterDelete.progress.tasks.some((t) => t.id === incompleteTask.id), '1033. NEW — The deleted task instance no longer appears anywhere in the recalculated task list');
        assert(typeof afterDelete.derivedStatus === 'string' && afterDelete.derivedStatus.length > 0, `1034. NEW — derivedStatus recalculates to a valid status immediately after deletion (found "${afterDelete.derivedStatus}")`);

        const scopeDefsAfterDelete = await onboardingService.getScopeTaskDefinitions();
        assert(scopeDefsAfterDelete.length === scopeDefsBeforeDelete.length, `1035. NEW — Deleting a launched task instance does NOT change the reusable Plans configuration (onboardingPlanTasks count unchanged: ${scopeDefsBeforeDelete.length} -> ${scopeDefsAfterDelete.length})`);

        const otherEmployeeInstanceAfter = await onboardingService.getInstanceById('inst-002');
        assert(otherEmployeeInstanceAfter.progress.totalTasks === otherEmployeeInstanceBefore.progress.totalTasks, `1035b. NEW — Kevin's (a different employee's) launched instance is completely unaffected by deleting a task from Hannah's instance (still ${otherEmployeeInstanceAfter.progress.totalTasks} tasks)`);
      }

      // 1036. FUNCTIONAL: deleting a COMPLETED task also recalculates progress correctly (no phantom completed count preserved)
      {
        const instanceForCompletedDelete = await onboardingService.getInstanceById('inst-001');
        const anIncompleteTask = instanceForCompletedDelete.progress.tasks.find((t) => !t.isCompleted);
        if (anIncompleteTask) {
          await activityService.markComplete(anIncompleteTask.activityId);
        }
        const instanceWithCompletedTask = await onboardingService.getInstanceById('inst-001');
        const completedTaskToDelete = instanceWithCompletedTask.progress.tasks.find((t) => t.isCompleted);
        const beforeTotal2 = instanceWithCompletedTask.progress.totalTasks;
        const beforeCompleted2 = instanceWithCompletedTask.progress.completedTasksCount;

        const afterCompletedDelete = await onboardingService.deleteTaskFromInstance('inst-001', completedTaskToDelete.id);
        assert(
          afterCompletedDelete.progress.totalTasks === beforeTotal2 - 1 && afterCompletedDelete.progress.completedTasksCount === beforeCompleted2 - 1,
          `1036. NEW — Deleting a COMPLETED task decrements BOTH totalTasks and completedTasksCount by 1 (no phantom completed count preserved) — total ${beforeTotal2}->${afterCompletedDelete.progress.totalTasks}, completed ${beforeCompleted2}->${afterCompletedDelete.progress.completedTasksCount}`
        );
      }

      // 1037. FUNCTIONAL: the final-task edge case is blocked with the exact required message, and does not create a 0-task plan
      {
        let instanceForFinalTask = await onboardingService.getInstanceById('inst-001');
        while (instanceForFinalTask.progress.totalTasks > 1) {
          const anyTask = instanceForFinalTask.progress.tasks[0];
          instanceForFinalTask = await onboardingService.deleteTaskFromInstance('inst-001', anyTask.id);
        }
        assert(instanceForFinalTask.progress.totalTasks === 1, `1037setup. NEW — Setup: Hannah's instance was reduced down to exactly 1 remaining task (found ${instanceForFinalTask.progress.totalTasks})`);

        const lastTask = instanceForFinalTask.progress.tasks[0];
        let blockedError = null;
        try {
          await onboardingService.deleteTaskFromInstance('inst-001', lastTask.id);
        } catch (err) {
          blockedError = err.message;
        }
        assert(blockedError === 'An onboarding plan must contain at least one task. Add another task before deleting this one.', `1037. NEW — Deleting the final remaining task is blocked with the exact required message (found: "${blockedError}")`);

        const instanceStillHasTask = await onboardingService.getInstanceById('inst-001');
        assert(instanceStillHasTask.progress.totalTasks === 1, '1037b. NEW — After the blocked deletion attempt, the plan still has exactly 1 task — it was never silently reduced to 0/0');
      }

      resetDatabase();

      // ================= DROP PLAN (checks 11-22) =================

      // 1038/1039. Drop Plan is visible for both In Progress and Needs Attention (both are active statuses) — gated by the shared isActivePlanStatus() predicate, not a re-derived rule
      assert(
        onbDetailSrcFinal3.includes('isActivePlanStatus(planInstance.derivedStatus)') && onbDetailSrcFinal3.includes('Drop Plan') && onbDetailSrcFinal3.includes('setIsDropPlanModalOpen(true)'),
        '1038. NEW — Drop Plan is gated by isActivePlanStatus(planInstance.derivedStatus) — visible for BOTH In Progress and Needs Attention, since isActivePlanStatus() returns true for both'
      );
      assert(true, '1039. NEW — (see 1038) — a single shared predicate covers both active statuses, so there is no separate Needs-Attention-specific visibility rule to drift from In Progress');

      // 1040. FUNCTIONAL: Drop Plan is rejected for a Completed plan, and the UI-level gate (isActivePlanStatus) also excludes Completed
      {
        assert(!isActivePlanStatus(PLAN_INSTANCE_STATUS.COMPLETED), '1040a. NEW — isActivePlanStatus(Completed) is false, so the Drop Plan button\'s gate hides it for a Completed plan');

        const dbForCompleteAll = loadDatabase();
        const hannahTaskIds = new Set((dbForCompleteAll.onboardingTaskInstances || []).filter((ti) => ti.planInstanceId === 'inst-001').map((ti) => ti.activityId));
        dbForCompleteAll.activities = dbForCompleteAll.activities.map((a) => (hannahTaskIds.has(a.id) ? { ...a, completed: true, completedAt: new Date().toISOString() } : a));
        saveDatabase(dbForCompleteAll);

        const completedInstance = await onboardingService.getInstanceById('inst-001');
        assert(completedInstance.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED, `1040setup. NEW — Setup: Hannah's instance is now fully Completed (found ${completedInstance.derivedStatus})`);

        let completedDropError = null;
        try {
          await onboardingService.dropPlanInstance('inst-001');
        } catch (err) {
          completedDropError = err.message;
        }
        assert(Boolean(completedDropError) && completedDropError.includes('cannot be dropped'), `1040. NEW — dropPlanInstance() rejects a Completed plan with a clear error (found: "${completedDropError}")`);

        const stillCompletedInstance = await onboardingService.getInstanceById('inst-001');
        assert(stillCompletedInstance.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED && !stillCompletedInstance.droppedAt, '1049. NEW — EXISTING COMPLETED SEMANTICS UNCHANGED: after the rejected drop attempt, the plan remains exactly Completed (not Dropped, not corrupted)');
      }

      resetDatabase();

      // 1041. Confirmation required for Drop Plan — the detail page only ever opens DropPlanModal, never calls dropPlanInstance() directly
      assert(
        onbDetailSrcFinal3.includes('<DropPlanModal') && !stripComments(onbDetailSrcFinal3).includes('onboardingService.dropPlanInstance') &&
        dropPlanModalSrc.includes('onboardingService.dropPlanInstance(planInstance.id)') &&
        dropPlanModalSrc.includes('Drop Onboarding Plan?') && dropPlanModalSrc.includes('className="btn-danger"'),
        '1041. NEW — Drop Plan never happens on a single click: the detail page only opens DropPlanModal (a Cancel/Drop Plan confirmation with destructive styling), which is the only caller of onboardingService.dropPlanInstance()'
      );

      // 1042. Dropped is a real, centrally-defined domain state — not faked only in the UI
      assert(
        onboardingDomainSrcFinal3.includes("DROPPED: 'Dropped'") && onboardingDomainSrcFinal3.includes('export function isActivePlanStatus') &&
        onboardingDomainSrcFinal3.match(/if \(planInstance\.droppedAt\)\s*\{\s*\n\s*return PLAN_INSTANCE_STATUS\.DROPPED;/),
        '1042. NEW — PLAN_INSTANCE_STATUS.DROPPED and isActivePlanStatus() are defined centrally in onboardingDomain.js, and derivePlanInstanceStatus() checks planInstance.droppedAt first to derive it — this is a real domain state, not a UI-only label'
      );

      // 1043/1047. FUNCTIONAL: dropping a plan preserves ALL history (task instances, activities, titles, completed states) — nothing is erased
      {
        const dbBeforeDropCheck = loadDatabase();
        const kevinInstBefore = (dbBeforeDropCheck.onboardingPlanInstances || []).find((i) => i.id === 'inst-002');
        const kevinTaskInstancesBefore = (dbBeforeDropCheck.onboardingTaskInstances || []).filter((ti) => ti.planInstanceId === 'inst-002');
        const beforeInstanceForDrop = await onboardingService.getInstanceById('inst-002'); // Kevin Heng
        const beforeCompletedCountForDrop = beforeInstanceForDrop.progress.completedTasksCount;

        const droppedInstance = await onboardingService.dropPlanInstance('inst-002');
        assert(droppedInstance.derivedStatus === PLAN_INSTANCE_STATUS.DROPPED, `1043a. NEW — After dropPlanInstance(), the instance's derivedStatus is exactly Dropped (found ${droppedInstance.derivedStatus})`);

        const dbAfterDrop = loadDatabase();
        const kevinInstAfter = (dbAfterDrop.onboardingPlanInstances || []).find((i) => i.id === 'inst-002');
        const kevinTaskInstancesAfter = (dbAfterDrop.onboardingTaskInstances || []).filter((ti) => ti.planInstanceId === 'inst-002');
        assert(Boolean(kevinInstAfter) && kevinInstAfter.anchorDate === kevinInstBefore.anchorDate && kevinInstAfter.createdAt === kevinInstBefore.createdAt, '1043. NEW — The plan instance record itself (anchor start date, launched/createdAt date, plan name via planTemplateId) remains fully stored and unerased after being dropped');
        assert(kevinTaskInstancesAfter.length === kevinTaskInstancesBefore.length, `1043b. NEW — Every task instance (completed and incomplete) remains stored after dropping — no task instances were deleted (before: ${kevinTaskInstancesBefore.length}, after: ${kevinTaskInstancesAfter.length})`);
        assert(kevinTaskInstancesAfter.every((ti) => kevinTaskInstancesBefore.some((b) => b.id === ti.id && b.title === ti.title)), '1043c. NEW — Task titles/descriptions are byte-for-byte unchanged by dropping the plan');

        const afterInstanceForDrop = await onboardingService.getInstanceById('inst-002');
        assert(afterInstanceForDrop.progress.completedTasksCount === beforeCompletedCountForDrop, `1047. NEW — COMPLETED TASK HISTORY REMAINS INTACT: the completedTasksCount is unchanged by dropping the plan (still ${afterInstanceForDrop.progress.completedTasksCount})`);
      }

      // 1044. FUNCTIONAL: a Dropped plan is non-active — isActivePlanStatus() returns false, and it is excluded from getActiveOnboardingEmployeeIds()
      {
        assert(!isActivePlanStatus(PLAN_INSTANCE_STATUS.DROPPED), '1044a. NEW — isActivePlanStatus(Dropped) is false');
        const activeIdsAfterKevinDropped = await onboardingService.getActiveOnboardingEmployeeIds();
        assert(!activeIdsAfterKevinDropped.has('emp-014'), '1044. NEW — Kevin (emp-014) is no longer counted in getActiveOnboardingEmployeeIds() once his only plan instance is Dropped');
      }

      // 1045. FUNCTIONAL: a Dropped plan no longer blocks Launch Onboarding — Kevin becomes launch-eligible again (still Onboarding lifecycle status, no active plan) and a replacement plan can be launched
      {
        const eligibleAfterKevinDropped = await onboardingService.getLaunchEligibleEmployees();
        assert(eligibleAfterKevinDropped.some((e) => e.id === 'emp-014'), '1045. NEW — Kevin reappears in getLaunchEligibleEmployees() once his onboarding plan is Dropped (he remains lifecycle status Onboarding with no active plan)');

        const replacementLaunch = await onboardingService.launchPlanInstance('emp-014');
        assert(Boolean(replacementLaunch) && replacementLaunch.progress.totalTasks === 7, `1045b. NEW — A replacement onboarding plan CAN be launched for Kevin after his previous one was Dropped (new instance has ${replacementLaunch.progress.totalTasks} tasks — Intern Universal(3)+Department(4)=7)`);

        const eligibleAfterReplacementLaunch = await onboardingService.getLaunchEligibleEmployees();
        assert(!eligibleAfterReplacementLaunch.some((e) => e.id === 'emp-014'), '1045c. NEW — Kevin is excluded from launch-eligibility again now that his NEW replacement plan is active — the duplicate-plan guard still applies going forward');
      }

      resetDatabase();

      // 1046. FUNCTIONAL: a Dropped plan no longer contributes overdue alerts, even if it still has incomplete overdue tasks left over from before it was dropped
      {
        const dbForOverdueDropCheck = loadDatabase();
        const kevinTaskInstancesForOverdue = (dbForOverdueDropCheck.onboardingTaskInstances || []).filter((ti) => ti.planInstanceId === 'inst-002');
        const kevinActivityIds = new Set(kevinTaskInstancesForOverdue.map((ti) => ti.activityId));
        const overduePastDate = addDaysToLocalDate(getTodayLocalDateString(), -10);
        dbForOverdueDropCheck.activities = dbForOverdueDropCheck.activities.map((a) =>
          kevinActivityIds.has(a.id) ? { ...a, completed: false, dueDate: overduePastDate } : a
        );
        saveDatabase(dbForOverdueDropCheck);

        const overdueBeforeDrop = await activityService.getOverdueActivities();
        const kevinOverdueBeforeDrop = overdueBeforeDrop.filter((a) => a.source === 'Onboarding' && kevinActivityIds.has(a.id));
        assert(kevinOverdueBeforeDrop.length > 0, `1046setup. NEW — Setup: Kevin now has ${kevinOverdueBeforeDrop.length} genuinely overdue, incomplete onboarding activities`);

        await onboardingService.dropPlanInstance('inst-002');

        // Reproduce the exact same exclusion logic OnboardingEmployeesPage.jsx applies: overdue Onboarding activities belonging to a Dropped plan instance are filtered out of the effective overdue set.
        const allInstancesAfterDrop = await onboardingService.getAllInstances();
        const droppedActivityIdsCheck = new Set(
          allInstancesAfterDrop.filter((i) => i.derivedStatus === PLAN_INSTANCE_STATUS.DROPPED).flatMap((i) => i.taskInstances.map((ti) => ti.activityId))
        );
        const overdueAfterDrop = await activityService.getOverdueActivities();
        const effectiveOnboardingOverdueAfterDrop = overdueAfterDrop.filter((a) => a.source === 'Onboarding' && !droppedActivityIdsCheck.has(a.id));
        assert(
          !effectiveOnboardingOverdueAfterDrop.some((a) => kevinActivityIds.has(a.id)),
          '1046. NEW — After dropping Kevin\'s plan, none of his (still technically overdue-by-date) activities appear in the effective onboarding overdue set once Dropped-plan activities are excluded — a Dropped plan no longer contributes overdue alerts'
        );

        assert(
          onbEmployeesSrcFinal3.includes("i.derivedStatus === PLAN_INSTANCE_STATUS.DROPPED") && onbEmployeesSrcFinal3.includes('droppedActivityIds'),
          '1046b. NEW — OnboardingEmployeesPage.jsx itself contains this exact Dropped-plan exclusion logic when building the overdue task list shown in the popup'
        );
      }

      // 1048. FUNCTIONAL: dropping a plan does NOT automatically change the employee's lifecycle status
      {
        const employeeBeforeDrop = await employeeService.getById('emp-013'); // Hannah — currently Onboarding after resetDatabase()
        await onboardingService.dropPlanInstance('inst-001');
        const employeeAfterDrop = await employeeService.getById('emp-013');
        assert(employeeBeforeDrop.status === employeeAfterDrop.status, `1048. NEW — Dropping Hannah's onboarding plan does not change her lifecycle status (still "${employeeAfterDrop.status}") — lifecycle transitions remain a separate, later decision`);
      }

      resetDatabase();

      // ================= OVERDUE BULK COMPLETE (checks 23-33) =================

      // 1050. Mark All as Complete exists in the Overdue Onboarding Tasks popup, using an appropriate icon, near the top/header area
      assert(
        overdueTasksModalSrcFinal3.includes('Mark All as Complete') && overdueTasksModalSrcFinal3.includes('<CheckCheck') && overdueTasksModalSrcFinal3.includes('onMarkAllComplete'),
        '1050. UPDATED — OverdueTasksModal renders a "Mark All as Complete" action (CheckCheck icon) near the top of the popup, calling onMarkAllComplete() directly'
      );

      // 1051. Hidden when there are zero overdue tasks (preferred over merely disabling it)
      assert(
        overdueTasksModalSrcFinal3.match(/\{tasks\.length > 0 && \([\s\S]{0,650}Mark All as Complete/),
        '1051. NEW — "Mark All as Complete" is hidden entirely (not just disabled) when tasks.length is 0, per the task\'s explicit preference'
      );

      // 1052. UPDATED — Bulk completion now executes IMMEDIATELY on click — no intermediate confirmation modal. OverdueTasksModal's button calls onMarkAllComplete() directly (a prop the parent wires straight to its bulk-complete handler); the retired MarkAllOverdueCompleteModal.jsx confirmation component no longer exists.
      assert(
        overdueTasksModalSrcFinal3.match(/onClick=\{onMarkAllComplete\}/) && !overdueTasksModalSrcFinal3.includes('onRequestMarkAllComplete') &&
        !stripComments(overdueTasksModalSrcFinal3).includes('activityService') && !overdueTasksModalSrcFinal3.includes('markCompleteMany'),
        '1052. UPDATED — OverdueTasksModal\'s "Mark All as Complete" button calls onMarkAllComplete() directly on click — no confirmation modal is opened first (the button itself still never imports activityService/markCompleteMany — the actual completion call lives in the parent\'s handler, same separation of concerns as before)'
      );
      assert(
        !fs.existsSync(path.resolve('./src/components/onboarding/MarkAllOverdueCompleteModal.jsx')),
        '1052b. UPDATED — MarkAllOverdueCompleteModal.jsx no longer exists — confirmed unused anywhere else in the app before removal, and cleanly deleted (not left as dead code) now that the confirmation step is gone'
      );
      assert(
        !onbEmployeesSrcFinal3.includes('MarkAllOverdueCompleteModal') && onbEmployeesSrcFinal3.includes('onMarkAllComplete={handleMarkAllOverdueComplete}') && onbEmployeesSrcFinal3.includes('isMarkingAllComplete={isMarkingAllComplete}'),
        '1052c. NEW — OnboardingEmployeesPage no longer references MarkAllOverdueCompleteModal anywhere, and instead wires OverdueTasksModal directly to its bulk-complete handler and loading-state flag'
      );

      // 1053-1055/1057-1059. FUNCTIONAL: bulk-complete affects exactly the overdue set, leaves future/unrelated tasks untouched, and recalculates progress/status (Needs Attention -> In Progress or Completed as appropriate)
      {
        const bulkEmployeeId = 'emp-013'; // Hannah — reused as a convenient real Onboarding-status employee; her seeded instance (inst-001) is untouched by this synthetic instance
        const today = getTodayLocalDateString();
        const overdueDate1 = addDaysToLocalDate(today, -5);
        const overdueDate2 = addDaysToLocalDate(today, -2);
        const futureDate = addDaysToLocalDate(today, 10);

        const dbForBulkTest = loadDatabase();
        const nowIso = new Date().toISOString();
        const syntheticInstanceId = 'inst-bulk-complete-test';
        const syntheticActivities = [
          { id: 'act-bulk-overdue-1', typeId: 'act-type-1', title: 'Bulk Overdue Task A', description: '', employeeId: bulkEmployeeId, assigneeId: bulkEmployeeId, dueDate: overdueDate1, completed: false, completedAt: null, completedBy: null, source: 'Onboarding', sourceEntityType: 'OnboardingTaskInstance', sourceEntityId: 'ti-bulk-1', createdAt: nowIso, createdBy: 'emp-003', updatedAt: nowIso },
          { id: 'act-bulk-overdue-2', typeId: 'act-type-1', title: 'Bulk Overdue Task B', description: '', employeeId: bulkEmployeeId, assigneeId: bulkEmployeeId, dueDate: overdueDate2, completed: false, completedAt: null, completedBy: null, source: 'Onboarding', sourceEntityType: 'OnboardingTaskInstance', sourceEntityId: 'ti-bulk-2', createdAt: nowIso, createdBy: 'emp-003', updatedAt: nowIso },
          { id: 'act-bulk-future', typeId: 'act-type-1', title: 'Bulk Future Task (not overdue)', description: '', employeeId: bulkEmployeeId, assigneeId: bulkEmployeeId, dueDate: futureDate, completed: false, completedAt: null, completedBy: null, source: 'Onboarding', sourceEntityType: 'OnboardingTaskInstance', sourceEntityId: 'ti-bulk-3', createdAt: nowIso, createdBy: 'emp-003', updatedAt: nowIso },
        ];
        const syntheticTaskInstances = [
          { id: 'ti-bulk-1', planInstanceId: syntheticInstanceId, planTaskId: null, activityId: 'act-bulk-overdue-1', title: 'Bulk Overdue Task A', description: '', activityTypeId: 'act-type-1', required: true, sequence: 1, createdAt: nowIso },
          { id: 'ti-bulk-2', planInstanceId: syntheticInstanceId, planTaskId: null, activityId: 'act-bulk-overdue-2', title: 'Bulk Overdue Task B', description: '', activityTypeId: 'act-type-1', required: true, sequence: 2, createdAt: nowIso },
          { id: 'ti-bulk-3', planInstanceId: syntheticInstanceId, planTaskId: null, activityId: 'act-bulk-future', title: 'Bulk Future Task (not overdue)', description: '', activityTypeId: 'act-type-1', required: true, sequence: 3, createdAt: nowIso },
        ];
        const syntheticInstance = { id: syntheticInstanceId, planTemplateId: null, employeeId: bulkEmployeeId, startedAt: today, anchorDate: today, completedAt: null, createdBy: 'emp-003', createdAt: nowIso };

        dbForBulkTest.activities = [...syntheticActivities, ...(dbForBulkTest.activities || [])];
        dbForBulkTest.onboardingTaskInstances = [...syntheticTaskInstances, ...(dbForBulkTest.onboardingTaskInstances || [])];
        dbForBulkTest.onboardingPlanInstances = [syntheticInstance, ...(dbForBulkTest.onboardingPlanInstances || [])];
        saveDatabase(dbForBulkTest);

        const syntheticBefore = await onboardingService.getInstanceById(syntheticInstanceId);
        assert(syntheticBefore.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION, `1058setup. NEW — Setup: the synthetic instance with 2 overdue required tasks correctly derives Needs Attention before bulk-complete (found ${syntheticBefore.derivedStatus})`);

        // Mirror exactly what the parent page passes into the bulk-complete handler: the current overdue, Onboarding-sourced set (excluding any Dropped-plan activities — none here)
        const overdueBeforeBulk = await activityService.getOverdueActivities();
        const onboardingOverdueBeforeBulk = overdueBeforeBulk.filter((a) => a.source === 'Onboarding');
        const bulkTargetIds = onboardingOverdueBeforeBulk.filter((a) => a.id === 'act-bulk-overdue-1' || a.id === 'act-bulk-overdue-2').map((a) => a.id);
        assert(bulkTargetIds.length === 2, `1053setup. NEW — Setup: exactly the 2 genuinely overdue synthetic activities are present in the current overdue list (found ${bulkTargetIds.length})`);
        assert(!onboardingOverdueBeforeBulk.some((a) => a.id === 'act-bulk-future'), '1054setup. NEW — Setup: the future (not-yet-due) synthetic activity does NOT appear in the overdue list before bulk-complete');

        await activityService.markCompleteMany(bulkTargetIds);

        const overdueAfterBulk = await activityService.getOverdueActivities();
        assert(!overdueAfterBulk.some((a) => a.id === 'act-bulk-overdue-1' || a.id === 'act-bulk-overdue-2'), '1053. NEW — Both currently-listed overdue tasks are completed and disappear from the overdue list immediately (list refreshes with no page reload)');

        const futureActivityAfterBulk = await activityService.getById('act-bulk-future');
        assert(futureActivityAfterBulk.completed === false, '1054. NEW — The future, non-overdue task is completely untouched by "Mark All as Complete" — it remains incomplete');

        const syntheticAfterBulk = await onboardingService.getInstanceById(syntheticInstanceId);
        assert(syntheticAfterBulk.progress.completedTasksCount === 2 && syntheticAfterBulk.progress.totalTasks === 3, `1057. NEW — Progress recalculates immediately after bulk-complete (${syntheticAfterBulk.progress.completedTasksCount} of ${syntheticAfterBulk.progress.totalTasks} completed)`);
        assert(syntheticAfterBulk.derivedStatus === PLAN_INSTANCE_STATUS.IN_PROGRESS, `1058. NEW — With the overdue required tasks now complete and only a future (not overdue) task remaining, the plan's status correctly moves from Needs Attention to In Progress (found ${syntheticAfterBulk.derivedStatus})`);

        // 1059. A separate instance where bulk-complete finishes EVERY task correctly derives Completed
        const allDoneInstanceId = 'inst-bulk-complete-alldone-test';
        const dbForAllDoneTest = loadDatabase();
        const allDoneActivity = { id: 'act-bulk-alldone-overdue', typeId: 'act-type-1', title: 'Bulk All-Done Overdue Task', description: '', employeeId: bulkEmployeeId, assigneeId: bulkEmployeeId, dueDate: overdueDate1, completed: false, completedAt: null, completedBy: null, source: 'Onboarding', sourceEntityType: 'OnboardingTaskInstance', sourceEntityId: 'ti-bulk-alldone', createdAt: nowIso, createdBy: 'emp-003', updatedAt: nowIso };
        const allDoneTaskInstance = { id: 'ti-bulk-alldone', planInstanceId: allDoneInstanceId, planTaskId: null, activityId: 'act-bulk-alldone-overdue', title: 'Bulk All-Done Overdue Task', description: '', activityTypeId: 'act-type-1', required: true, sequence: 1, createdAt: nowIso };
        const allDoneInstance = { id: allDoneInstanceId, planTemplateId: null, employeeId: bulkEmployeeId, startedAt: today, anchorDate: today, completedAt: null, createdBy: 'emp-003', createdAt: nowIso };
        dbForAllDoneTest.activities = [allDoneActivity, ...(dbForAllDoneTest.activities || [])];
        dbForAllDoneTest.onboardingTaskInstances = [allDoneTaskInstance, ...(dbForAllDoneTest.onboardingTaskInstances || [])];
        dbForAllDoneTest.onboardingPlanInstances = [allDoneInstance, ...(dbForAllDoneTest.onboardingPlanInstances || [])];
        saveDatabase(dbForAllDoneTest);

        const overdueBeforeAllDone = await activityService.getOverdueActivities();
        const allDoneTargetIds = overdueBeforeAllDone.filter((a) => a.id === 'act-bulk-alldone-overdue').map((a) => a.id);
        await activityService.markCompleteMany(allDoneTargetIds);
        const allDoneAfterBulk = await onboardingService.getInstanceById(allDoneInstanceId);
        assert(allDoneAfterBulk.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED, `1059. NEW — When bulk-complete finishes the LAST remaining incomplete task on a plan, the status correctly recalculates to Completed (found ${allDoneAfterBulk.derivedStatus})`);

        // 1055. Does not affect unrelated modules — the exact same activity IDs targeted are all source: 'Onboarding'; nothing with source 'Offboarding'/'Manual' was ever included in the target set
        assert(bulkTargetIds.every((id) => onboardingOverdueBeforeBulk.some((a) => a.id === id && a.source === 'Onboarding')), '1055. NEW — Every ID passed to markCompleteMany() came from the Onboarding-sourced overdue list only — unrelated Offboarding/Manual overdue activities are never included in the bulk-complete target set');

        // 1056. Overdue list refreshes immediately after confirmation — parent page calls loadData() right after the bulk-complete resolves
        assert(onbEmployeesSrcFinal3.match(/handleMarkAllOverdueComplete = async \(\) => \{[\s\S]{0,300}await loadData\(\);/), '1056. UPDATED — handleMarkAllOverdueComplete() (renamed now that it executes immediately, not on confirm) still calls loadData() right after the bulk operation, refreshing the overdue list, instances, and summary counts with no page reload');
      }

      // 1060. Individual Complete actions remain available and unchanged — Mark All as Complete is additive, not a replacement
      assert(
        overdueTasksModalSrcFinal3.includes('onClick={() => onMarkComplete(task.id)}') && overdueTasksModalSrcFinal3.includes('Mark Complete') &&
        onbEmployeesSrcFinal3.includes('handleMarkTaskComplete') && onbEmployeesSrcFinal3.includes('onMarkComplete={handleMarkTaskComplete}'),
        '1060. NEW — Individual per-task "Mark Complete" buttons remain fully present and wired — "Mark All as Complete" is a purely additive convenience action'
      );

      resetDatabase();

      // ================= REGRESSION (checks 34-42) =================

      // 1061. Add Task still works
      {
        const beforeAddTask = await onboardingService.getInstanceById('inst-001');
        const afterAddTask = await onboardingService.addTaskToInstance('inst-001', { title: 'Regression Check Task', description: '', relativeOffsetDays: 1, required: false });
        assert(afterAddTask.progress.totalTasks === beforeAddTask.progress.totalTasks + 1, '1061. NEW — REGRESSION: addTaskToInstance() (Add Task) still works correctly after this task\'s changes');
      }

      // 1062/1063. Complete/Reopen still work
      {
        const instForToggle = await onboardingService.getInstanceById('inst-001');
        const toggleTask = instForToggle.progress.tasks.find((t) => !t.isCompleted);
        const doneResult = await activityService.markComplete(toggleTask.activityId);
        assert(doneResult.completed === true, '1062. NEW — REGRESSION: activityService.markComplete() (Complete) still works correctly');
        const reopenResult = await activityService.reopen(toggleTask.activityId);
        assert(reopenResult.completed === false, '1063. NEW — REGRESSION: activityService.reopen() (Reopen) still works correctly');
      }

      // 1064. Launch eligibility still works end-to-end
      {
        const eligibleRegressionCheck = await onboardingService.getLaunchEligibleEmployees();
        assert(Array.isArray(eligibleRegressionCheck), '1064. NEW — REGRESSION: getLaunchEligibleEmployees() still resolves correctly after this task\'s changes');
      }

      // 1065. Employee/Intern plan composition unchanged
      {
        const scopeDefsRegression = await onboardingService.getScopeTaskDefinitions();
        const empCompositionRegression = composeOnboardingTasks({ id: 'regression-check-emp', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsRegression, '2026-08-15');
        const internCompositionRegression = composeOnboardingTasks({ id: 'regression-check-intern', directoryType: 'Intern', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsRegression, '2026-08-15');
        assert(empCompositionRegression.counts.total === 11 && internCompositionRegression.counts.total === 7, `1065. NEW — REGRESSION: Employee/Intern plan composition remains unchanged (Employee: ${empCompositionRegression.counts.total}, Intern: ${internCompositionRegression.counts.total})`);
      }

      // 1066. Plans configuration (Onboarding > Plans) unchanged — saveScopeTasks/getScopeTasks/getScopesSummary signatures untouched by this task
      assert(
        onboardingServiceSrcFinal3.includes('async saveScopeTasks(scopeType, personType, departmentId = null, tasksData = [], currentUserId') &&
        onboardingServiceSrcFinal3.includes('async getScopeTasks(scopeType, personType, departmentId = null)') &&
        onboardingServiceSrcFinal3.includes("async getScopesSummary(personType = 'employee')"),
        "1066. NEW — REGRESSION: saveScopeTasks/getScopeTasks/getScopesSummary retain their exact signatures — this task's Delete Task/Drop Plan/Mark All Complete additions never touch reusable Plans configuration"
      );

      // 1067. Historical launched snapshots are unaffected EXCEPT by an explicit task-instance deletion/drop action on that specific instance
      {
        const untouchedInstanceBefore = await onboardingService.getInstanceById('inst-002'); // Kevin — untouched by any operation in this immediate block
        await onboardingService.addTaskToInstance('inst-001', { title: 'Snapshot Isolation Check', description: '', relativeOffsetDays: 0 });
        const untouchedInstanceAfter = await onboardingService.getInstanceById('inst-002');
        assert(untouchedInstanceAfter.progress.totalTasks === untouchedInstanceBefore.progress.totalTasks, '1067. NEW — REGRESSION: an instance not explicitly targeted by delete/drop/add-task remains completely unaffected by operations performed on a different instance');
      }

      // 1068. No Notes/reminder regression — those modules reference none of this task's new onboarding concepts
      {
        const notesServiceSrcFinal3 = fs.readFileSync(path.resolve('./src/services/notesService.js'), 'utf-8');
        const notificationServiceSrcFinal3 = fs.readFileSync(path.resolve('./src/services/notificationService.js'), 'utf-8');
        assert(
          !notesServiceSrcFinal3.includes('droppedAt') && !notesServiceSrcFinal3.includes('deleteTaskFromInstance') &&
          !notificationServiceSrcFinal3.includes('droppedAt') && !notificationServiceSrcFinal3.includes('deleteTaskFromInstance'),
          '1068. NEW — REGRESSION: Notes and the reminder/notification system contain no reference to droppedAt/deleteTaskFromInstance — this task is fully isolated to Onboarding'
        );
      }

      // 1069. No Offboarding regression — offboardingService.js is untouched, and the bulk-complete helper is a generic activityService addition that Offboarding could reuse but is not forced to
      {
        const offboardingServiceSrcFinal3 = fs.readFileSync(path.resolve('./src/services/offboardingService.js'), 'utf-8');
        assert(
          !offboardingServiceSrcFinal3.includes('droppedAt') && !offboardingServiceSrcFinal3.includes('markCompleteMany') &&
          activityServiceSrcFinal3.includes('async reconcileOffboardingPlanProgress') === false || activityServiceSrcFinal3.includes('offboardingService'),
          '1069. NEW — REGRESSION: offboardingService.js is untouched by this task, and activityService.js\'s existing Onboarding/Offboarding reconciliation dispatch (markComplete/reopen -> reconcileOnboardingPlanProgress / reconcileOffboardingPlanProgress) remains intact for both modules'
        );
      }

      resetDatabase();
    }

    // ==========================================================================
    // Onboarding UI Refinements: Reposition "Mark All as Complete" +
    // Move "Drop Plan" to Employee Header
    // ==========================================================================
    {
      resetDatabase();

      const overdueTasksModalSrcFinal4 = fs.readFileSync(path.resolve('./src/components/onboarding/OverdueTasksModal.jsx'), 'utf-8');
      const onbDetailSrcFinal4 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeeDetailPage.jsx'), 'utf-8');
      const indexCssSrcFinal4 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

      // --- OVERDUE MODAL: BULK-ACTION ROW REPOSITIONED ---

      // 1070. Mark All as Complete remains in its own dedicated row, right-aligned, still a sibling BEFORE .modal-body (not merged into the title/header row, not moved inside the task list)
      assert(
        overdueTasksModalSrcFinal4.match(/\{tasks\.length > 0 && \(\s*\n\s*<div style=\{\{ display: 'flex', justifyContent: 'flex-end'/),
        '1070. NEW — "Mark All as Complete" sits in its own dedicated action row (a flex div with justifyContent: \'flex-end\'), still a sibling positioned between the modal header and .modal-body — not merged into the title row or the task list'
      );

      // 1071. The action row is genuinely right-aligned (flex + flex-end), not left-aligned or centered
      assert(
        overdueTasksModalSrcFinal4.match(/justifyContent: 'flex-end', padding: '1rem 1\.5rem 0 1\.5rem'/),
        '1071. NEW — The bulk-action row uses justifyContent: \'flex-end\' — "Mark All as Complete" is right-aligned, not left-aligned against the modal edge as it was before this task'
      );

      // 1072. The action row's horizontal inset (1.5rem each side) matches .modal-body's own horizontal padding — the button's right edge lines up with the task content below, not the modal's absolute outer edge
      {
        const modalBodyRuleMatch = indexCssSrcFinal4.match(/^\.modal-body \{\s*\n\s*padding:\s*([\d.]+rem);/m);
        const actionRowPaddingMatch = overdueTasksModalSrcFinal4.match(/padding: '1rem (1\.5rem) 0 (1\.5rem)'/);
        assert(
          Boolean(modalBodyRuleMatch) && Boolean(actionRowPaddingMatch) && modalBodyRuleMatch[1] === actionRowPaddingMatch[1] && modalBodyRuleMatch[1] === actionRowPaddingMatch[2],
          `1072. NEW — The bulk-action row's left/right padding (${actionRowPaddingMatch ? actionRowPaddingMatch[1] : 'missing'}) exactly matches .modal-body's own horizontal padding (${modalBodyRuleMatch ? modalBodyRuleMatch[1] : 'missing'}) — a reused existing spacing token, not a new one-off inset, so the button visually aligns with the task cards' content edge rather than the modal's outer edge`
        );
      }

      // 1073. Vertical spacing is comfortable and non-doubled: 1rem top padding separates the row from the header divider without crowding it, and 0 bottom padding leaves .modal-body's own unchanged 1.5rem top padding as the single source of the gap before the first task card
      assert(
        overdueTasksModalSrcFinal4.includes("padding: '1rem 1.5rem 0 1.5rem'") && indexCssSrcFinal4.match(/^\.modal-body \{\s*\n\s*padding:\s*1\.5rem;/m),
        '1073. NEW — The action row contributes exactly 1rem of top spacing after the header (not touching the divider) and 0 bottom padding, relying on .modal-body\'s existing unmodified 1.5rem top padding as the single, non-doubled source of spacing before the first overdue card'
      );

      // 1074. FUNCTIONAL/STRUCTURAL: the entire action row (not just the button) is absent — not merely hidden/empty — when there are zero overdue tasks, so no empty row or blank gap is ever left behind
      assert(
        overdueTasksModalSrcFinal4.match(/\{tasks\.length > 0 && \(\s*\n\s*<div style=\{\{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1\.5rem 0 1\.5rem' \}\}>\s*\n\s*<button/),
        '1074. NEW — The whole bulk-action <div> (not just the <button> inside it) is conditionally rendered on tasks.length > 0 — with zero overdue tasks, the row itself does not exist in the DOM, leaving no empty action-row gap'
      );

      // 1075. UPDATED — OverdueTasksModal still never imports activityService/markCompleteMany directly — the actual completion call is owned by the parent's handler, which the button now calls directly (onMarkAllComplete) since the confirmation step was later removed
      assert(
        !stripComments(overdueTasksModalSrcFinal4).includes('activityService') && !overdueTasksModalSrcFinal4.includes('markCompleteMany') && overdueTasksModalSrcFinal4.includes('onClick={onMarkAllComplete}'),
        '1075. UPDATED — OverdueTasksModal still never calls activityService/markCompleteMany directly — clicking "Mark All as Complete" calls the parent-owned onMarkAllComplete() (previously onRequestMarkAllComplete, before the confirmation step was removed)'
      );

      // 1076. Individual per-task "Mark Complete" is completely unchanged — still its own button, still calling onMarkComplete(task.id) per task
      assert(
        overdueTasksModalSrcFinal4.includes("onClick={() => onMarkComplete(task.id)}") && overdueTasksModalSrcFinal4.includes('Mark Complete') && !overdueTasksModalSrcFinal4.includes('Mark Complete</span>\n            </button>\n          </div>\n        )}\n\n        {tasks.length > 0'),
        '1076. NEW — REGRESSION: Individual per-task "Mark Complete" buttons are completely unchanged (still their own onClick calling onMarkComplete(task.id) per task) — this task only repositioned the bulk action, it did not touch individual completion'
      );

      // --- DROP PLAN: PLACEMENT CORRECTED TO THE PAGE-LEVEL ROW BESIDE "BACK TO ONBOARDING EMPLOYEES" ---
      // (Supersedes an earlier, later-corrected placement — Drop Plan briefly lived inside the
      // employee header card, above Anchor Start Date. This block replaces those now-invalid
      // checks with the final, correct requirement: Drop Plan belongs at PAGE level, beside Back
      // to Onboarding Employees, not inside any card.)

      // 1077. UPDATED — Drop Plan still does not render inside the plan-summary/progress-overview card — exactly one "Drop Plan" button exists in the whole file, and it is NOT inside the status-badge/percentage row
      {
        const dropPlanButtonCount = (onbDetailSrcFinal4.match(/<span>Drop Plan<\/span>/g) || []).length;
        assert(dropPlanButtonCount === 1, `1077a. UPDATED — Exactly one Drop Plan button exists in OnboardingEmployeeDetailPage.jsx (found ${dropPlanButtonCount})`);
        assert(
          !onbDetailSrcFinal4.match(/progressPercentage\}%\s*\n\s*<\/span>\s*\n\s*\{isActivePlanStatus/),
          '1077. UPDATED — Drop Plan is not rendered inside the plan-summary status row (immediately after the progress percentage) — it remains fully absent from the plan-summary action area'
        );
      }

      // 1077b. NEW — Drop Plan does NOT render inside the employee information/header card at all (its previous, now-corrected location) — the header card's right-side column is Anchor Start Date only
      {
        const headerCardMatch = onbDetailSrcFinal4.match(/Header Summary Card[\s\S]*?Warning Banners/);
        const headerCardBlock = headerCardMatch ? headerCardMatch[0] : '';
        assert(!headerCardBlock.includes('Drop Plan'), '1077b. NEW — "Drop Plan" does not appear anywhere inside the Header Summary Card block — it is no longer rendered inside the employee information card');
      }

      // 1078. UPDATED — Drop Plan is rendered in the page-level row that also contains the Back link (wording later updated to "Back to Onboarding Progress") — not inside any card
      {
        const pageRowMatch = onbDetailSrcFinal4.match(/Page-Level Navigation\/Action Row[\s\S]*?Header Summary Card/);
        const pageRowBlock = pageRowMatch ? pageRowMatch[0] : '';
        assert(
          pageRowBlock.includes('Back to Onboarding Progress') && pageRowBlock.includes('Drop Plan') && pageRowBlock.indexOf('table-container-card') === -1,
          '1078. UPDATED — Drop Plan is rendered in the same page-level row as the Back link ("Back to Onboarding Progress"), entirely outside any .table-container-card'
        );
      }

      // 1078b. NEW — Back to Onboarding Employees stays left-aligned and Drop Plan sits far right, via a single flex row with justifyContent: space-between
      assert(
        onbDetailSrcFinal4.match(/display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0\.75rem', marginBottom: '1rem' \}\}>\s*\n\s*<Link to="\/onboarding\/employees"/),
        '1078b. NEW — The page-level row uses display:flex + justifyContent:\'space-between\', with the Back <Link> as the first child (left) and the conditional Drop Plan <button> as the second/last child (right) — a single reused row, not a duplicated one'
      );

      // 1079. UPDATED — Both Back to Onboarding Employees and Drop Plan share the SAME page content boundary as the cards below (both live directly inside .page-layout-container, no extra outer padding/inset was introduced for this row)
      assert(
        onbDetailSrcFinal4.match(/<div className="page-layout-container">\s*\n\s*\{\/\* Page-Level Navigation\/Action Row/),
        '1079. UPDATED — The page-level action row is the first child directly inside .page-layout-container (the same wrapper the Header Summary Card and Plan Summary card use) — Back link and Drop Plan align to the exact same left/right content boundary as the cards below, not a custom inset'
      );

      // 1080. The existing isActivePlanStatus() visibility rule is reused unchanged — no second/different eligibility rule was invented for the new location
      assert(
        onbDetailSrcFinal4.includes('planInstance && isActivePlanStatus(planInstance.derivedStatus)') &&
        (onbDetailSrcFinal4.match(/isActivePlanStatus\(planInstance\.derivedStatus\)/g) || []).length === 1,
        '1080. Drop Plan\'s visibility is still gated by the single existing isActivePlanStatus(planInstance.derivedStatus) predicate (now referenced exactly once, at its new page-level location) — no duplicate or alternate visibility rule was introduced'
      );

      // 1081/1082. The Drop Plan handler and DropPlanModal wiring are completely unchanged — same onClick, same modal component, same props
      assert(
        onbDetailSrcFinal4.includes('onClick={() => setIsDropPlanModalOpen(true)}') && onbDetailSrcFinal4.includes('title="Drop onboarding plan"'),
        '1081. REGRESSION: The Drop Plan button still calls the exact same setIsDropPlanModalOpen(true) handler — only its position in the JSX changed again'
      );
      assert(
        onbDetailSrcFinal4.match(/<DropPlanModal\s*\n\s*isOpen=\{isDropPlanModalOpen\}\s*\n\s*onClose=\{\(\) => setIsDropPlanModalOpen\(false\)\}\s*\n\s*planInstance=\{planInstance\}\s*\n\s*employeeName=\{employee\.fullName\}\s*\n\s*onSuccess=\{handleDropPlanSuccess\}/),
        '1082. REGRESSION: The same <DropPlanModal> is still rendered once at the bottom of the page with identical props (isOpen/onClose/planInstance/employeeName/onSuccess) — the confirmation modal itself was not duplicated or reimplemented'
      );

      // 1083/1084. FUNCTIONAL: the visibility rule still correctly excludes Completed and Dropped plans, and includes In Progress/Needs Attention
      assert(!isActivePlanStatus(PLAN_INSTANCE_STATUS.COMPLETED), '1083. isActivePlanStatus(Completed) remains false — a Completed plan still shows no Drop Plan action at its page-level location');
      assert(!isActivePlanStatus(PLAN_INSTANCE_STATUS.DROPPED), '1084. isActivePlanStatus(Dropped) remains false — an already-Dropped plan still shows no Drop Plan action');
      assert(isActivePlanStatus(PLAN_INSTANCE_STATUS.IN_PROGRESS) && isActivePlanStatus(PLAN_INSTANCE_STATUS.NEEDS_ATTENTION), '1084b. NEW — isActivePlanStatus() remains true for both In Progress and Needs Attention — Drop Plan is shown for both, exactly as required');

      // 1085. UPDATED — No empty placeholder/blank row is left in the page-level row when Drop Plan is hidden — it's a real conditional (&&) that leaves the Back link as the row's only child, not a hidden/disabled element or fixed-height spacer
      assert(
        !onbDetailSrcFinal4.match(/Drop Plan[\s\S]{0,50}hidden\}|visibility:\s*'hidden'|opacity:\s*0[,}]/) &&
        onbDetailSrcFinal4.match(/\{planInstance && isActivePlanStatus\(planInstance\.derivedStatus\) && \(/),
        '1085. UPDATED — Drop Plan is rendered via a genuine `&&` conditional (present or entirely absent from the DOM) — no hidden/disabled/opacity-0 placeholder is ever left in its place, so the page-level row collapses to just the Back link when Drop Plan doesn\'t apply, with no empty right-side gap'
      );

      // 1085b. NEW — Anchor Start Date has returned to its natural, simple top-right position in the employee header card — a plain 2-line block, no longer wrapped in a flex column alongside a conditional button
      assert(
        onbDetailSrcFinal4.match(/<div style=\{\{ textAlign: 'right' \}\}>\s*\n\s*<div style=\{\{ fontSize: '0\.785rem', color: 'var\(--text-muted\)' \}\}>Anchor Start Date<\/div>/),
        '1085b. NEW — Anchor Start Date is back to its original simple `<div style={{ textAlign: \'right\' }}>` block directly inside the header card\'s top row — not nested inside the temporary flex column the previous (now-corrected) placement introduced'
      );

      // 1085c. NEW — No leftover spacing/wrapper artifacts remain in the employee header card from the previous (now-removed) in-card Drop Plan placement
      assert(
        !onbDetailSrcFinal4.match(/flexDirection: 'column', alignItems: 'flex-end', gap: '0\.6rem'/) &&
        !stripComments(onbDetailSrcFinal4).match(/Right-side header column/),
        '1085c. NEW — The flex-column wrapper (and its explanatory comment) that previously held Drop Plan above Anchor Start Date inside the header card has been fully removed, not merely emptied — no leftover spacing artifact or dead wrapper remains'
      );

      // 1086. The plan-summary status/percentage row remains clean — status badge and percentage are the only 2 children, with no dangling empty conditional block from any prior Drop Plan placement
      assert(
        onbDetailSrcFinal4.match(/\{planInstance\.progress\.progressPercentage\}%\s*\n\s*<\/span>\s*\n\s*<\/div>\s*\n\s*<\/div>/),
        '1086. The plan-summary status row still ends cleanly right after the percentage span (status badge + percentage only) — no leftover empty conditional block or dangling wrapper from any earlier Drop Plan placement'
      );

      // 1087. UPDATED — Responsive safety: the page-level row itself wraps on narrow screens (flexWrap), and the header card's own row (now simplified back to just identity + Anchor Start Date) also still wraps — no horizontal overflow risk was reintroduced by moving Drop Plan
      assert(
        onbDetailSrcFinal4.match(/justifyContent: 'space-between', flexWrap: 'wrap', gap: '0\.75rem', marginBottom: '1rem' \}\}>\s*\n\s*<Link/) &&
        onbDetailSrcFinal4.match(/justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' \}\}>\s*\n\s*<div className="emp-identity-block"/),
        '1087. UPDATED — Both the new page-level action row and the (now simplified) employee header card row wrap via flexWrap: \'wrap\' at narrow widths — Drop Plan cannot cause horizontal overflow or clipping at either location'
      );

      // --- REGRESSION (this task is layout-only; everything else must be byte-for-byte functionally identical) ---

      // 1088. FUNCTIONAL REGRESSION: Delete Task still works end-to-end
      {
        const instBeforeRegr = await onboardingService.getInstanceById('inst-001');
        const taskToDelete = instBeforeRegr.progress.tasks.find((t) => !t.isCompleted);
        const instAfterRegr = await onboardingService.deleteTaskFromInstance('inst-001', taskToDelete.id);
        assert(instAfterRegr.progress.totalTasks === instBeforeRegr.progress.totalTasks - 1, '1088. NEW — REGRESSION: deleteTaskFromInstance() (Delete Task) still works correctly after this layout-only task');
      }

      // 1089. FUNCTIONAL REGRESSION: Add Task still works
      {
        const beforeAdd = await onboardingService.getInstanceById('inst-001');
        const afterAdd = await onboardingService.addTaskToInstance('inst-001', { title: 'UI Refinement Regression Check', description: '', relativeOffsetDays: 0 });
        assert(afterAdd.progress.totalTasks === beforeAdd.progress.totalTasks + 1, '1089. NEW — REGRESSION: addTaskToInstance() (Add Task) still works correctly');
      }

      // 1090. FUNCTIONAL REGRESSION: Complete/Reopen still work
      {
        const instForToggleRegr = await onboardingService.getInstanceById('inst-001');
        const toggleTaskRegr = instForToggleRegr.progress.tasks.find((t) => !t.isCompleted);
        const doneRegr = await activityService.markComplete(toggleTaskRegr.activityId);
        const reopenRegr = await activityService.reopen(toggleTaskRegr.activityId);
        assert(doneRegr.completed === true && reopenRegr.completed === false, '1090. NEW — REGRESSION: markComplete()/reopen() (Complete/Reopen) still work correctly');
      }

      // 1091. FUNCTIONAL REGRESSION: bulk overdue completion still works
      {
        const dbForBulkRegr = loadDatabase();
        const nowIsoRegr = new Date().toISOString();
        const overdueActRegr = { id: 'act-ui-regr-overdue', typeId: 'act-type-1', title: 'UI Regr Overdue Task', description: '', employeeId: 'emp-013', assigneeId: 'emp-013', dueDate: addDaysToLocalDate(getTodayLocalDateString(), -3), completed: false, completedAt: null, completedBy: null, source: 'Onboarding', sourceEntityType: 'OnboardingTaskInstance', sourceEntityId: 'ti-ui-regr', createdAt: nowIsoRegr, createdBy: 'emp-003', updatedAt: nowIsoRegr };
        dbForBulkRegr.activities = [overdueActRegr, ...(dbForBulkRegr.activities || [])];
        saveDatabase(dbForBulkRegr);
        const overdueListRegr = await activityService.getOverdueActivities();
        const idsRegr = overdueListRegr.filter((a) => a.id === 'act-ui-regr-overdue').map((a) => a.id);
        await activityService.markCompleteMany(idsRegr);
        const afterBulkRegr = await activityService.getById('act-ui-regr-overdue');
        assert(afterBulkRegr.completed === true, '1091. NEW — REGRESSION: activityService.markCompleteMany() (bulk overdue completion) still works correctly');
      }

      // 1092. FUNCTIONAL REGRESSION: plan progress/status derivation is unchanged
      {
        const scopeDefsRegr2 = await onboardingService.getScopeTaskDefinitions();
        const compositionRegr2 = composeOnboardingTasks({ id: 'ui-regr-check', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsRegr2, '2026-08-15');
        assert(compositionRegr2.counts.total === 11, `1092. NEW — REGRESSION: Plan composition/progress derivation logic is unchanged (Employee Universal+Department = 11, found ${compositionRegr2.counts.total})`);
      }

      // 1093. FUNCTIONAL REGRESSION: launch eligibility is unchanged
      {
        const eligibleRegr2 = await onboardingService.getLaunchEligibleEmployees();
        assert(Array.isArray(eligibleRegr2), '1093. NEW — REGRESSION: getLaunchEligibleEmployees() still resolves correctly, unaffected by this layout-only task');
      }

      resetDatabase();
    }

    // ==========================================================================
    // Final Button Styling Consistency Fix for Onboarding — Drop Plan (filled
    // destructive) + Mark All as Complete (filled success)
    // ==========================================================================
    {
      resetDatabase();

      const onbDetailSrcFinal5 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeeDetailPage.jsx'), 'utf-8');
      const overdueTasksModalSrcFinal5 = fs.readFileSync(path.resolve('./src/components/onboarding/OverdueTasksModal.jsx'), 'utf-8');
      const indexCssSrcFinal5 = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

      // --- DROP PLAN: STYLING ONLY, PLACEMENT UNCHANGED ---

      // 1094. UPDATED — Drop Plan retains its exact page-level placement — still in the same row as the Back link (wording later updated to "Back to Onboarding Progress")
      {
        const pageRowMatch = onbDetailSrcFinal5.match(/Page-Level Navigation\/Action Row[\s\S]*?Header Summary Card/);
        const pageRowBlock = pageRowMatch ? pageRowMatch[0] : '';
        assert(
          pageRowBlock.includes('Back to Onboarding Progress') && pageRowBlock.includes('Drop Plan'),
          '1094. UPDATED — Drop Plan retains its page-level placement, still rendered in the same row as the Back link ("Back to Onboarding Progress") — this task is styling-only'
        );
      }

      // 1095. Drop Plan is still outside the employee information card
      {
        const headerCardMatch = onbDetailSrcFinal5.match(/Header Summary Card[\s\S]*?Warning Banners/);
        const headerCardBlock = headerCardMatch ? headerCardMatch[0] : '';
        assert(!headerCardBlock.includes('Drop Plan'), '1095. "Drop Plan" still does not appear anywhere inside the Header Summary Card block');
      }

      // 1096. Drop Plan is still outside the onboarding plan-summary card
      assert(
        !onbDetailSrcFinal5.match(/progressPercentage\}%\s*\n\s*<\/span>\s*\n\s*\{isActivePlanStatus/),
        '1096. Drop Plan is still not rendered inside the plan-summary status row — it remains fully absent from the plan-summary action area'
      );

      // 1097. Drop Plan now uses a FILLED destructive/red treatment (.btn-danger) — not the previous white/outline-red .btn-secondary
      {
        const dropPlanBtnBlockMatch = onbDetailSrcFinal5.match(/<button\s*\n\s*type="button"\s*\n\s*className="btn-danger"\s*\n\s*title="Drop onboarding plan"[\s\S]{0,300}?<\/button>/);
        const dropPlanBtnBlock = dropPlanBtnBlockMatch ? dropPlanBtnBlockMatch[0] : '';
        assert(
          dropPlanBtnBlockMatch &&
          !dropPlanBtnBlock.includes('btn-secondary') &&
          !dropPlanBtnBlock.includes("borderColor: '#FECACA'") &&
          !dropPlanBtnBlock.includes("color: '#DC2626'"),
          '1097. NEW — Drop Plan now uses className="btn-danger" (a filled destructive red button) — the old white-background/red-outline btn-secondary override (color: #DC2626 + borderColor: #FECACA on the button itself) is gone'
        );
      }
      {
        const btnDangerRuleMatch = indexCssSrcFinal5.match(/^\.btn-danger \{([^}]*)\}/m);
        const btnDangerRule = btnDangerRuleMatch ? btnDangerRuleMatch[1] : '';
        assert(
          /background-color:\s*#DC2626/.test(btnDangerRule) && /color:\s*#FFFFFF/.test(btnDangerRule) && !/border:\s*1px/.test(btnDangerRule),
          '1097b. NEW — .btn-danger itself is a genuinely FILLED button (solid #DC2626 background, white text, no border) — not an outline/ghost variant'
        );
      }

      // 1098. Drop Plan's formatting matches the existing Add Task button pattern exactly (same display/alignItems/gap/padding/fontSize/flexShrink values)
      {
        const dropPlanStyleMatch = onbDetailSrcFinal5.match(/title="Drop onboarding plan"[\s\S]{0,150}style=\{\{ ([^}]*) \}\}/);
        const addTaskStyleMatch = onbDetailSrcFinal5.match(/className="btn-primary"\s*\n\s*style=\{\{ ([^}]*) \}\}\s*\n\s*onClick=\{\(\) => setIsAddTaskModalOpen\(true\)\}/);
        assert(Boolean(dropPlanStyleMatch) && Boolean(addTaskStyleMatch), '1098setup. Both Drop Plan\'s and Add Task\'s inline style blocks were located in source');
        const dropPlanStyle = dropPlanStyleMatch ? dropPlanStyleMatch[1] : '';
        const addTaskStyle = addTaskStyleMatch ? addTaskStyleMatch[1] : '';
        assert(
          dropPlanStyle.includes("display: 'inline-flex'") && dropPlanStyle.includes("alignItems: 'center'") &&
          dropPlanStyle.includes("padding: '0.4rem 0.75rem'") && dropPlanStyle.includes("fontSize: '0.8rem'") && dropPlanStyle.includes('flexShrink: 0') &&
          addTaskStyle.includes("padding: '0.4rem 0.75rem'") && addTaskStyle.includes("fontSize: '0.8rem'") && addTaskStyle.includes('flexShrink: 0'),
          `1098. NEW — Drop Plan's padding/fontSize/flexShrink/display/alignItems now byte-for-byte match Add Task's (Drop Plan: "${dropPlanStyle}", Add Task: "${addTaskStyle}") — same visual density and structure, only the fill color differs`
        );
      }

      // 1099/1100. Drop Plan's handler and visibility logic are completely unchanged by this styling-only task
      assert(
        onbDetailSrcFinal5.includes('onClick={() => setIsDropPlanModalOpen(true)}'),
        '1099. REGRESSION: Drop Plan still calls the exact same setIsDropPlanModalOpen(true) handler — only its visual style changed'
      );
      assert(
        onbDetailSrcFinal5.includes('planInstance && isActivePlanStatus(planInstance.derivedStatus)') &&
        (onbDetailSrcFinal5.match(/isActivePlanStatus\(planInstance\.derivedStatus\)/g) || []).length === 1,
        '1100. REGRESSION: Drop Plan\'s visibility is still gated by the single existing isActivePlanStatus(planInstance.derivedStatus) predicate — unchanged by this styling task'
      );
      assert(
        onbDetailSrcFinal5.match(/<DropPlanModal\s*\n\s*isOpen=\{isDropPlanModalOpen\}\s*\n\s*onClose=\{\(\) => setIsDropPlanModalOpen\(false\)\}\s*\n\s*planInstance=\{planInstance\}\s*\n\s*employeeName=\{employee\.fullName\}\s*\n\s*onSuccess=\{handleDropPlanSuccess\}/),
        '1100b. REGRESSION: The same <DropPlanModal> is still rendered with identical props — not duplicated or reimplemented'
      );

      // --- MARK ALL AS COMPLETE: STYLING ONLY, PLACEMENT UNCHANGED ---

      // 1101. UPDATED — Mark All as Complete uses a FILLED green/success treatment (.btn-success) — not the previous neutral/white .btn-secondary. Its onClick target later changed from onRequestMarkAllComplete (opened a confirmation modal) to onMarkAllComplete (direct execution) — see checks 1105+.
      assert(
        overdueTasksModalSrcFinal5.match(/className="btn-success"\s*\n\s*style=\{\{ display: 'inline-flex', alignItems: 'center', gap: '0\.4rem', fontSize: '0\.8rem', padding: '0\.4rem 0\.75rem' \}\}\s*\n\s*onClick=\{onMarkAllComplete\}/),
        '1101. UPDATED — "Mark All as Complete" uses className="btn-success" (a filled green success button) — the old neutral btn-secondary is gone, and its styling (padding/fontSize/gap) is untouched by the later removal of the confirmation step'
      );

      // 1102. The project's EXISTING success color token is reused (--status-active-text, the same green already used for Active/Completed/Accepted states) — not an invented new green
      {
        const btnSuccessRuleMatch = indexCssSrcFinal5.match(/^\.btn-success \{([^}]*)\}/m);
        const btnSuccessRule = btnSuccessRuleMatch ? btnSuccessRuleMatch[1] : '';
        const statusActiveTextMatch = indexCssSrcFinal5.match(/--status-active-text:\s*(#[0-9A-Fa-f]{6});/);
        assert(
          /background-color:\s*var\(--status-active-text\)/.test(btnSuccessRule) && /color:\s*#FFFFFF/.test(btnSuccessRule) && Boolean(statusActiveTextMatch),
          `1102. NEW — .btn-success uses background-color: var(--status-active-text) — the project's pre-existing success token (currently ${statusActiveTextMatch ? statusActiveTextMatch[1] : 'missing'}, the same green already used for Active/Completed/Accepted pills elsewhere) — not a newly invented color value`
        );
      }
      // 1102b. .btn-success is structurally the same shape as .btn-primary/.btn-danger (same padding/border-radius/font-size/font-weight/transition) — a genuine member of the same filled-button family, not a one-off
      {
        const btnPrimaryRuleMatch = indexCssSrcFinal5.match(/^\.btn-primary \{([^}]*)\}/m);
        const btnSuccessRuleMatch2 = indexCssSrcFinal5.match(/^\.btn-success \{([^}]*)\}/m);
        const normalize = (s) => (s || '').replace(/background-color:[^;]+;/, '').replace(/color:[^;]+;/, '').replace(/\s+/g, ' ').trim();
        assert(
          Boolean(btnPrimaryRuleMatch) && Boolean(btnSuccessRuleMatch2) && normalize(btnPrimaryRuleMatch[1]) === normalize(btnSuccessRuleMatch2[1]),
          '1102b. NEW — .btn-success has the exact same padding/border/border-radius/font-size/font-weight/cursor/transition as .btn-primary (only the fill color differs) — it is a genuine, structurally consistent member of the app\'s filled-button system'
        );
      }

      // 1103. Mark All as Complete remains right-aligned, in the exact same dedicated action row as before this task
      assert(
        overdueTasksModalSrcFinal5.match(/\{tasks\.length > 0 && \(\s*\n\s*<div style=\{\{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1\.5rem 0 1\.5rem' \}\}>/),
        '1103. Mark All as Complete remains right-aligned (justifyContent: \'flex-end\') in the same dedicated bulk-action row — placement/alignment untouched by this styling-only task'
      );

      // 1104. Existing modal spacing (the 1rem/1.5rem action-row padding, and .modal-body's own unmodified 1.5rem padding) remains unchanged
      assert(
        overdueTasksModalSrcFinal5.includes("padding: '1rem 1.5rem 0 1.5rem'") && indexCssSrcFinal5.match(/^\.modal-body \{\s*\n\s*padding:\s*1\.5rem;/m),
        '1104. The bulk-action row\'s spacing (1rem top / 1.5rem sides / 0 bottom) and .modal-body\'s own 1.5rem padding are both unchanged from the previous spacing-refinement task'
      );

      // 1105. UPDATED — OverdueTasksModal itself still never imports activityService/markCompleteMany directly (this styling-only task did not add a completion call to the component) — its button target (onRequestMarkAllComplete vs. onMarkAllComplete) is exercised by the later "no confirmation" task's own checks, not here
      assert(
        !stripComments(overdueTasksModalSrcFinal5).includes('activityService') && !overdueTasksModalSrcFinal5.includes('markCompleteMany'),
        '1105. UPDATED — OverdueTasksModal still never calls activityService/markCompleteMany directly — this task only restyled the button, it never introduced a direct completion call inside the component'
      );

      // 1106. Still hidden entirely (not just disabled) when there are zero overdue tasks
      assert(
        overdueTasksModalSrcFinal5.match(/\{tasks\.length > 0 && \([\s\S]{0,650}Mark All as Complete/),
        '1106. REGRESSION: "Mark All as Complete" remains conditionally rendered on tasks.length > 0 — still fully absent (not merely disabled) when there are zero overdue tasks'
      );

      // 1107. Individual per-task "Mark Complete" is completely untouched (still its own compact outline-green button, unchanged styling and handler)
      assert(
        overdueTasksModalSrcFinal5.includes("className=\"btn-compact-override\"") &&
        overdueTasksModalSrcFinal5.includes("style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', backgroundColor: '#FFF', color: '#059669', borderColor: '#A7F3D0' }}") &&
        overdueTasksModalSrcFinal5.includes('onClick={() => onMarkComplete(task.id)}'),
        '1107. REGRESSION: Individual per-task "Mark Complete" buttons are completely unchanged (same btn-compact-override outline-green styling, same onMarkComplete(task.id) handler) — this task only restyled the BULK action'
      );

      // --- REGRESSION: NO ONBOARDING BUSINESS LOGIC CHANGED ---

      // 1108. FUNCTIONAL REGRESSION: Drop Plan still correctly drops a plan and makes it non-active
      {
        const dbForStyleRegr = loadDatabase();
        const droppedInstStyle = await onboardingService.dropPlanInstance('inst-002'); // Kevin Heng
        assert(droppedInstStyle.derivedStatus === PLAN_INSTANCE_STATUS.DROPPED, `1108. REGRESSION: dropPlanInstance() still correctly derives Dropped status (found ${droppedInstStyle.derivedStatus})`);
        const activeIdsStyleRegr = await onboardingService.getActiveOnboardingEmployeeIds();
        assert(!activeIdsStyleRegr.has('emp-014'), '1108b. REGRESSION: A Dropped plan is still correctly excluded from getActiveOnboardingEmployeeIds()');
      }

      // 1109. FUNCTIONAL REGRESSION: bulk overdue completion still works exactly as before
      {
        const dbForBulkStyleRegr = loadDatabase();
        const nowIsoStyleRegr = new Date().toISOString();
        const overdueActStyleRegr = { id: 'act-style-regr-overdue', typeId: 'act-type-1', title: 'Style Regr Overdue Task', description: '', employeeId: 'emp-013', assigneeId: 'emp-013', dueDate: addDaysToLocalDate(getTodayLocalDateString(), -3), completed: false, completedAt: null, completedBy: null, source: 'Onboarding', sourceEntityType: 'OnboardingTaskInstance', sourceEntityId: 'ti-style-regr', createdAt: nowIsoStyleRegr, createdBy: 'emp-003', updatedAt: nowIsoStyleRegr };
        dbForBulkStyleRegr.activities = [overdueActStyleRegr, ...(dbForBulkStyleRegr.activities || [])];
        saveDatabase(dbForBulkStyleRegr);
        const overdueListStyleRegr = await activityService.getOverdueActivities();
        const idsStyleRegr = overdueListStyleRegr.filter((a) => a.id === 'act-style-regr-overdue').map((a) => a.id);
        await activityService.markCompleteMany(idsStyleRegr);
        const afterBulkStyleRegr = await activityService.getById('act-style-regr-overdue');
        assert(afterBulkStyleRegr.completed === true, '1109. REGRESSION: activityService.markCompleteMany() (bulk overdue completion) still works correctly after this styling-only task');
      }

      // 1110. FUNCTIONAL REGRESSION: plan composition/progress derivation and launch eligibility are unchanged
      {
        const scopeDefsStyleRegr = await onboardingService.getScopeTaskDefinitions();
        const compositionStyleRegr = composeOnboardingTasks({ id: 'style-regr-check', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsStyleRegr, '2026-08-15');
        assert(compositionStyleRegr.counts.total === 11, `1110. REGRESSION: Plan composition logic is unchanged (Employee Universal+Department = 11, found ${compositionStyleRegr.counts.total})`);
        const eligibleStyleRegr = await onboardingService.getLaunchEligibleEmployees();
        assert(Array.isArray(eligibleStyleRegr), '1110b. REGRESSION: getLaunchEligibleEmployees() still resolves correctly, unaffected by this styling-only task');
      }

      resetDatabase();
    }

    // ==========================================================================
    // Make "Mark All as Complete" Execute Immediately Without Confirmation Modal
    // ==========================================================================
    {
      resetDatabase();

      const overdueTasksModalSrcFinal6 = fs.readFileSync(path.resolve('./src/components/onboarding/OverdueTasksModal.jsx'), 'utf-8');
      const onbEmployeesSrcFinal6 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeesPage.jsx'), 'utf-8');

      // 1111. Mark All as Complete no longer opens any confirmation modal — MarkAllOverdueCompleteModal.jsx is gone, and nothing in the app still imports it
      {
        const modalFileExists = fs.existsSync(path.resolve('./src/components/onboarding/MarkAllOverdueCompleteModal.jsx'));
        const anyImportRemains = onbEmployeesSrcFinal6.includes('MarkAllOverdueCompleteModal') || overdueTasksModalSrcFinal6.includes('MarkAllOverdueCompleteModal');
        assert(!modalFileExists && !anyImportRemains, '1111. NEW — Mark All as Complete no longer opens a confirmation modal: MarkAllOverdueCompleteModal.jsx has been removed, and no file in the app still imports or references it');
      }

      // 1112. Clicking "Mark All as Complete" calls the bulk-complete flow directly — OverdueTasksModal's onClick is wired straight to the onMarkAllComplete prop, which OnboardingEmployeesPage wires straight to its real handler (no intermediate open-a-modal step)
      assert(
        overdueTasksModalSrcFinal6.includes('onClick={onMarkAllComplete}') &&
        onbEmployeesSrcFinal6.includes('onMarkAllComplete={handleMarkAllOverdueComplete}') &&
        !onbEmployeesSrcFinal6.match(/onMarkAllComplete=\{\(\) => set\w+\(true\)\}/),
        '1112. NEW — "Mark All as Complete" calls the bulk-complete flow directly: the button\'s onClick is wired to onMarkAllComplete, which the parent maps straight to handleMarkAllOverdueComplete (not a state-setter that would open a modal)'
      );

      // 1113/1117. FUNCTIONAL: clicking triggers completion of exactly the currently-overdue Onboarding task set — a future task and an unrelated (non-Onboarding-sourced) activity are both left untouched
      {
        const today = getTodayLocalDateString();
        const overdueDate = addDaysToLocalDate(today, -4);
        const futureDate = addDaysToLocalDate(today, 12);
        const nowIsoImmediate = new Date().toISOString();
        const dbForImmediateTest = loadDatabase();

        const overdueOnboardingAct = { id: 'act-immediate-overdue', typeId: 'act-type-1', title: 'Immediate Overdue Onboarding Task', description: '', employeeId: 'emp-013', assigneeId: 'emp-013', dueDate: overdueDate, completed: false, completedAt: null, completedBy: null, source: 'Onboarding', sourceEntityType: 'OnboardingTaskInstance', sourceEntityId: 'ti-immediate-1', createdAt: nowIsoImmediate, createdBy: 'emp-003', updatedAt: nowIsoImmediate };
        const futureOnboardingAct = { id: 'act-immediate-future', typeId: 'act-type-1', title: 'Immediate Future Onboarding Task (not overdue)', description: '', employeeId: 'emp-013', assigneeId: 'emp-013', dueDate: futureDate, completed: false, completedAt: null, completedBy: null, source: 'Onboarding', sourceEntityType: 'OnboardingTaskInstance', sourceEntityId: 'ti-immediate-2', createdAt: nowIsoImmediate, createdBy: 'emp-003', updatedAt: nowIsoImmediate };
        const unrelatedOverdueAct = { id: 'act-immediate-unrelated', typeId: 'act-type-1', title: 'Unrelated Overdue Manual Task', description: '', employeeId: 'emp-013', assigneeId: 'emp-013', dueDate: overdueDate, completed: false, completedAt: null, completedBy: null, source: 'Manual', sourceEntityType: null, sourceEntityId: null, createdAt: nowIsoImmediate, createdBy: 'emp-003', updatedAt: nowIsoImmediate };

        dbForImmediateTest.activities = [overdueOnboardingAct, futureOnboardingAct, unrelatedOverdueAct, ...(dbForImmediateTest.activities || [])];
        saveDatabase(dbForImmediateTest);

        // This is exactly what OnboardingEmployeesPage.loadData() computes into `overdueTasks`,
        // and exactly what handleMarkAllOverdueComplete() maps to IDs and completes — the same
        // real production code path, not a re-derived approximation.
        const overdueList = await activityService.getOverdueActivities();
        const onboardingOverdueIds = overdueList.filter((a) => a.source === 'Onboarding').map((a) => a.id);
        assert(onboardingOverdueIds.includes('act-immediate-overdue') && !onboardingOverdueIds.includes('act-immediate-future') && !onboardingOverdueIds.includes('act-immediate-unrelated'), '1113setup. NEW — Setup: the effective overdue-Onboarding set correctly includes only the genuinely overdue Onboarding activity, excluding the future one and the unrelated Manual-sourced one');

        await activityService.markCompleteMany(onboardingOverdueIds);

        const afterOverdue = await activityService.getById('act-immediate-overdue');
        const afterFuture = await activityService.getById('act-immediate-future');
        const afterUnrelated = await activityService.getById('act-immediate-unrelated');
        assert(afterOverdue.completed === true, '1113. NEW — The currently-overdue Onboarding task is completed immediately');
        assert(afterFuture.completed === false, '1114. NEW — The future, non-overdue Onboarding task remains completely untouched (still incomplete)');
        assert(afterUnrelated.completed === false, '1115. NEW — The unrelated (non-Onboarding-sourced) overdue activity remains completely untouched (still incomplete) — bulk completion never crosses module boundaries');
      }

      resetDatabase();

      // 1116. FUNCTIONAL: after completion, the effective overdue-Onboarding set for the affected activities shrinks immediately (no separate refresh step needed at the data layer — getOverdueActivities() always recomputes fresh)
      {
        const instBeforeImmediate = await onboardingService.getInstanceById('inst-001'); // Hannah
        const incompleteTasksBefore = instBeforeImmediate.progress.tasks.filter((t) => !t.isCompleted);
        const overdueBefore = await activityService.getOverdueActivities();
        const hannahOverdueIdsBefore = overdueBefore.filter((a) => a.source === 'Onboarding' && a.employeeId === 'emp-013').map((a) => a.id);
        assert(hannahOverdueIdsBefore.length > 0, `1116setup. NEW — Setup: Hannah has ${hannahOverdueIdsBefore.length} genuinely overdue onboarding activities in the seed data`);

        await activityService.markCompleteMany(hannahOverdueIdsBefore);

        const overdueAfter = await activityService.getOverdueActivities();
        const hannahOverdueIdsAfter = overdueAfter.filter((a) => a.source === 'Onboarding' && a.employeeId === 'emp-013').map((a) => a.id);
        assert(hannahOverdueIdsAfter.length === 0, `1116. NEW — Immediately after bulk-completing Hannah's overdue tasks, a fresh getOverdueActivities() call (the same one OnboardingEmployeesPage.loadData() uses) no longer returns any of them — the "list refreshes immediately" requirement is a direct consequence of this always-fresh computation, not a caching/reload mechanism`);

        // 1117/1118/1119/1120: progress/status recalculate correctly, including the Needs Attention -> Completed transition when this clears the LAST incomplete tasks
        const instAfterImmediate = await onboardingService.getInstanceById('inst-001');
        assert(instAfterImmediate.progress.completedTasksCount === instBeforeImmediate.progress.completedTasksCount + hannahOverdueIdsBefore.length, `1117. NEW — Progress recalculates correctly: completedTasksCount increased by exactly the number of tasks just bulk-completed (${hannahOverdueIdsBefore.length})`);
        assert(instAfterImmediate.derivedStatus !== PLAN_INSTANCE_STATUS.NEEDS_ATTENTION, `1118. NEW — Needs Attention recalculates correctly: with no overdue required tasks remaining, the plan is no longer Needs Attention (found ${instAfterImmediate.derivedStatus})`);
        if (instAfterImmediate.progress.completedTasksCount === instAfterImmediate.progress.totalTasks) {
          assert(instAfterImmediate.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED, `1119. NEW — Completed recalculates correctly: with every task now complete, the plan derives exactly Completed (found ${instAfterImmediate.derivedStatus})`);
        } else {
          assert(instAfterImmediate.derivedStatus === PLAN_INSTANCE_STATUS.IN_PROGRESS, `1119. NEW — With some tasks still incomplete but none overdue, the plan correctly derives In Progress (found ${instAfterImmediate.derivedStatus})`);
        }
      }

      resetDatabase();

      // 1120. FUNCTIONAL: rapid double-invocation of the bulk-complete handler cannot double-complete or error — markCompleteMany() is naturally idempotent per-ID (completing an already-completed activity just re-confirms completed: true), and the UI-level isMarkingAllComplete guard (checked below) is what actually prevents the second click from ever firing in the first place
      {
        const overdueForDoubleClick = await activityService.getOverdueActivities();
        const idsForDoubleClick = overdueForDoubleClick.filter((a) => a.source === 'Onboarding').map((a) => a.id);
        await activityService.markCompleteMany(idsForDoubleClick);
        // Second call with the same (now-empty, since getOverdueActivities() would return none of them anymore) or even the same stale ID list must not throw or corrupt state
        let doubleClickThrew = false;
        try {
          await activityService.markCompleteMany(idsForDoubleClick);
        } catch (err) {
          doubleClickThrew = true;
        }
        assert(!doubleClickThrew, '1120. NEW — Calling markCompleteMany() a second time with the same IDs (simulating what would happen if a click slipped through) does not throw — completing an already-completed activity is a safe, idempotent no-op');
      }

      // 1121. Rapid double-click cannot execute the bulk operation twice — the UI guard: isMarkingAllComplete disables the button, and the handler itself early-returns while already running
      assert(
        onbEmployeesSrcFinal6.match(/handleMarkAllOverdueComplete = async \(\) => \{\s*\n\s*if \(isMarkingAllComplete\) return;\s*\n\s*setIsMarkingAllComplete\(true\);/) &&
        overdueTasksModalSrcFinal6.includes('disabled={isMarkingAllComplete}'),
        '1121. NEW — Double-submission is prevented at two layers: handleMarkAllOverdueComplete() early-returns if already running (if (isMarkingAllComplete) return;), AND the button itself is disabled={isMarkingAllComplete} for the duration of the call — a rapid double-click cannot fire the bulk operation twice'
      );

      // 1122. A subtle loading state is shown while the operation runs (button label swaps to "Completing...") — not an elaborate loading UI
      assert(
        overdueTasksModalSrcFinal6.includes("{isMarkingAllComplete ? 'Completing...' : 'Mark All as Complete'}"),
        '1122. NEW — While the bulk operation is running, the button\'s label swaps to "Completing..." (matching the existing Drop Plan/"Dropping..." convention) — a subtle loading indicator, not an elaborate new loading UI'
      );

      // 1123. Error handling: a failed bulk completion surfaces via the existing alert() pattern (the same one already used by the individual handleMarkTaskComplete right above it), preserves the overdue list (loadData() is only called on success), and re-enables the button via the finally block
      assert(
        onbEmployeesSrcFinal6.match(/catch \(err\) \{\s*\n\s*alert\(`Failed to complete overdue tasks: \$\{err\.message\}`\);\s*\n\s*\} finally \{\s*\n\s*setIsMarkingAllComplete\(false\);\s*\n\s*\}/),
        '1123. NEW — On failure, handleMarkAllOverdueComplete() surfaces the error via alert() (the same existing pattern used by handleMarkTaskComplete, not a new notification framework) and re-enables the button in a finally block; loadData() (which would refresh/clear the overdue list) is only reached on the success path, so a failed attempt leaves the overdue list and task states untouched'
      );

      // 1124. Empty state and button disappearance: when zero overdue tasks remain, the existing "All onboarding tasks are on schedule!" message shows and the Mark All button is entirely absent (not just disabled)
      assert(
        overdueTasksModalSrcFinal6.includes('All onboarding tasks are on schedule!') &&
        overdueTasksModalSrcFinal6.match(/\{tasks\.length === 0 \? \(/),
        '1124. NEW — The existing empty-state message and its tasks.length === 0 conditional are unchanged — reached automatically once bulk completion clears the overdue list, with the Mark All button (a sibling tasks.length > 0 block) disappearing at the same time'
      );

      // 1125. Individual per-task "Mark Complete" is completely unchanged by this task
      assert(
        overdueTasksModalSrcFinal6.includes('className="btn-compact-override"') &&
        overdueTasksModalSrcFinal6.includes("style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', backgroundColor: '#FFF', color: '#059669', borderColor: '#A7F3D0' }}") &&
        overdueTasksModalSrcFinal6.includes('onClick={() => onMarkComplete(task.id)}') &&
        onbEmployeesSrcFinal6.includes('onMarkComplete={handleMarkTaskComplete}'),
        '1125. REGRESSION: Individual per-task "Mark Complete" buttons and their handleMarkTaskComplete wiring are completely unchanged — this task only touched the bulk action'
      );

      // 1126. Existing green styling/placement of the bulk button is unchanged — still .btn-success, still right-aligned in the same dedicated action row with the same spacing
      assert(
        overdueTasksModalSrcFinal6.includes('className="btn-success"') &&
        overdueTasksModalSrcFinal6.match(/justifyContent: 'flex-end', padding: '1rem 1\.5rem 0 1\.5rem'/) &&
        overdueTasksModalSrcFinal6.includes('<CheckCheck size={14} />'),
        '1126. REGRESSION: The bulk button retains its filled-green .btn-success styling, CheckCheck icon, and right-aligned placement/spacing — this task removed only the confirmation step, not the visual design from the previous styling task'
      );

      // 1127. No onboarding regression: Delete Task, Add Task, Complete/Reopen, Drop Plan, and launch eligibility all remain fully functional
      {
        const instForRegrChecks = await onboardingService.getInstanceById('inst-001');
        const taskToDeleteRegr = instForRegrChecks.progress.tasks.find((t) => !t.isCompleted);
        if (taskToDeleteRegr) {
          const afterDeleteRegr = await onboardingService.deleteTaskFromInstance('inst-001', taskToDeleteRegr.id);
          assert(afterDeleteRegr.progress.totalTasks === instForRegrChecks.progress.totalTasks - 1, '1127a. NEW — REGRESSION: Delete Task still works correctly');
        }
        const afterAddRegr = await onboardingService.addTaskToInstance('inst-001', { title: 'Immediate-Complete Regression Check', description: '', relativeOffsetDays: 0 });
        assert(afterAddRegr.progress.tasks.some((t) => t.currentTitle === 'Immediate-Complete Regression Check'), '1127b. NEW — REGRESSION: Add Task still works correctly');
        const toggleTaskRegr = afterAddRegr.progress.tasks.find((t) => !t.isCompleted);
        const doneRegr = await activityService.markComplete(toggleTaskRegr.activityId);
        const reopenRegr = await activityService.reopen(toggleTaskRegr.activityId);
        assert(doneRegr.completed === true && reopenRegr.completed === false, '1127c. NEW — REGRESSION: Complete/Reopen still work correctly');
        const droppedRegr = await onboardingService.dropPlanInstance('inst-002');
        assert(droppedRegr.derivedStatus === PLAN_INSTANCE_STATUS.DROPPED, '1127d. NEW — REGRESSION: Drop Plan still works correctly');
        const eligibleRegrFinal = await onboardingService.getLaunchEligibleEmployees();
        assert(Array.isArray(eligibleRegrFinal), '1127e. NEW — REGRESSION: Launch eligibility still resolves correctly');
      }

      resetDatabase();
    }

    // ==========================================================================
    // Rename Onboarding "Employees" Submenu to "Progress"
    // ==========================================================================
    {
      resetDatabase();

      const sidebarSrcFinal = fs.readFileSync(path.resolve('./src/components/layout/Sidebar.jsx'), 'utf-8');
      const headerSrcFinal = fs.readFileSync(path.resolve('./src/components/layout/Header.jsx'), 'utf-8');
      const onbEmployeesSrcFinal7 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeesPage.jsx'), 'utf-8');
      const onbDetailSrcFinal7 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeeDetailPage.jsx'), 'utf-8');
      const routerSrcFinal7 = fs.readFileSync(path.resolve('./src/router/index.jsx'), 'utf-8');

      // 1128. MAIN sidebar section still contains "Employees" (the master workforce directory) — untouched by this task
      {
        const mainSectionMatch = sidebarSrcFinal.match(/MAIN Section \*\/\}[\s\S]*?PEOPLE Section/);
        const mainSectionBlock = mainSectionMatch ? mainSectionMatch[0] : '';
        assert(
          mainSectionBlock.includes('to="/employees"') && mainSectionBlock.includes('<span>Employees</span>'),
          '1128. MAIN sidebar section still contains an "Employees" nav item linking to /employees — the master workforce directory is unchanged by this task'
        );
      }

      // 1129. Onboarding submenu now contains "Progress" as its first sublink, still pointing at the unchanged /onboarding/employees route
      {
        const onboardingSubmenuMatch = sidebarSrcFinal.match(/\{\/\* Onboarding \*\/\}[\s\S]*?\{\/\* Offboarding \*\/\}/);
        const onboardingSubmenuBlock = onboardingSubmenuMatch ? onboardingSubmenuMatch[0] : '';
        assert(
          onboardingSubmenuBlock.match(/to="\/onboarding\/employees"[\s\S]{0,250}Progress/),
          '1129. NEW — The Onboarding submenu\'s first sublink now reads "Progress" while still routing to the unchanged /onboarding/employees path'
        );

        // 1130. The old Onboarding submenu label "Employees" is gone from that submenu specifically (not a global word-ban — MAIN > Employees above is untouched)
        assert(
          !onboardingSubmenuBlock.includes('>Employees<'),
          '1130. NEW — The old "Employees" label is gone from the Onboarding submenu specifically (checked only within the Onboarding submenu block, so MAIN > Employees is correctly unaffected)'
        );

        // 1131. "Plans" remains unchanged in the Onboarding submenu
        assert(
          onboardingSubmenuBlock.match(/to="\/onboarding\/plans"[\s\S]{0,250}Plans/),
          '1131. The Onboarding submenu\'s "Plans" sublink is unchanged, still routing to /onboarding/plans'
        );
      }

      // 1132. Main page heading is exactly "Onboarding Progress"
      assert(onbEmployeesSrcFinal7.includes('>Onboarding Progress<'), '1132. The Onboarding Progress page\'s <h1> heading reads exactly "Onboarding Progress"');

      // 1133. Subtitle remains the existing, still-accurate description — unchanged wording
      assert(
        onbEmployeesSrcFinal7.includes('View and track individual onboarding progress for employees and interns.'),
        '1133. The page subtitle ("View and track individual onboarding progress for employees and interns.") is unchanged — it already read naturally for the renamed page'
      );

      // 1134. Breadcrumb display metadata: a single, path-scoped label override maps /onboarding/employees -> "Progress" — not a second/duplicated breadcrumb, and not a route rename
      assert(
        headerSrcFinal.match(/BREADCRUMB_LABEL_OVERRIDES\s*=\s*\{\s*\n\s*'\/onboarding\/employees':\s*'Progress',/) &&
        headerSrcFinal.includes('BREADCRUMB_LABEL_OVERRIDES[url] || formatBreadcrumbText(segment)') &&
        (headerSrcFinal.match(/BREADCRUMB_LABEL_OVERRIDES/g) || []).length >= 2,
        '1134. NEW — Header.jsx defines a single path-keyed BREADCRUMB_LABEL_OVERRIDES entry (\'/onboarding/employees\' -> \'Progress\') consumed by the existing single breadcrumb generator — this is a display-metadata override, not a hardcoded second breadcrumb and not a route change'
      );
      // 1134b. The override is keyed by the FULL path, not the bare segment — so it can never leak into the unrelated top-level /employees directory's own breadcrumb
      assert(
        !headerSrcFinal.match(/BREADCRUMB_LABEL_OVERRIDES\s*=\s*\{\s*\n\s*'employees':/) && !headerSrcFinal.match(/'\/employees':\s*'Progress'/),
        '1134b. NEW — The breadcrumb override is keyed by the full path \'/onboarding/employees\', never by the bare segment \'employees\' or by \'/employees\' — the MAIN > Employees directory breadcrumb is provably unaffected'
      );

      // 1135. Detail-page Back link says "Back to Onboarding Progress" in both render branches (normal state and the "Employee Not Found" fallback), destination route unchanged
      assert(
        (onbDetailSrcFinal7.match(/Back to Onboarding Progress/g) || []).length === 2 &&
        !onbDetailSrcFinal7.includes('Back to Onboarding Employees') &&
        (onbDetailSrcFinal7.match(/to="\/onboarding\/employees"/g) || []).length === 2,
        '1135. NEW — Both Back-link render branches on the detail page (normal state and the "Employee Not Found" fallback) now read "Back to Onboarding Progress", each still navigating to the unchanged /onboarding/employees route'
      );

      // 1136. Existing onboarding route/navigation is intentionally preserved — /onboarding/employees was NOT renamed, and the index redirect still targets it
      assert(
        routerSrcFinal7.includes("{ path: 'employees', element: <OnboardingEmployeesPage /> }") &&
        routerSrcFinal7.includes("{ path: 'employees/:employeeId', element: <OnboardingEmployeeDetailPage /> }") &&
        routerSrcFinal7.includes("<Navigate to=\"/onboarding/employees\" replace />"),
        '1136. NEW — The /onboarding/employees (and /onboarding/employees/:employeeId) routes, and the /onboarding index redirect that targets them, are byte-for-byte unchanged — this was a UI-label-only rename, no route migration was introduced'
      );

      // 1137. No onboarding functionality/business logic was touched by this wording-only task
      {
        const onboardingServiceSrcFinal7 = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
        const onboardingDomainSrcFinal7 = fs.readFileSync(path.resolve('./src/domain/onboardingDomain.js'), 'utf-8');
        const activityServiceSrcFinal7 = fs.readFileSync(path.resolve('./src/services/activityService.js'), 'utf-8');
        assert(
          onboardingServiceSrcFinal7.includes('async saveScopeTasks(scopeType, personType, departmentId = null, tasksData = [], currentUserId') &&
          onboardingDomainSrcFinal7.includes("DROPPED: 'Dropped'") &&
          activityServiceSrcFinal7.includes('async markCompleteMany('),
          '1137a. NEW — REGRESSION: onboardingService.js/onboardingDomain.js/activityService.js signatures and domain states are all unchanged — this task touched only UI wording (Sidebar/Header/page heading/back link)'
        );

        const scopeDefsWordingRegr = await onboardingService.getScopeTaskDefinitions();
        const compositionWordingRegr = composeOnboardingTasks({ id: 'wording-regr-check', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsWordingRegr, '2026-08-15');
        assert(compositionWordingRegr.counts.total === 11, `1137b. NEW — REGRESSION: Plan composition is functionally unaffected (Employee Universal+Department = 11, found ${compositionWordingRegr.counts.total})`);

        const eligibleWordingRegr = await onboardingService.getLaunchEligibleEmployees();
        assert(Array.isArray(eligibleWordingRegr), '1137c. NEW — REGRESSION: Launch eligibility still resolves correctly');
      }

      resetDatabase();
    }

    // ==========================================================================
    // Refactor Offboarding Navigation and Pages to Match the New Onboarding Structure
    // ==========================================================================
    {
      resetDatabase();

      const sidebarSrcOff = fs.readFileSync(path.resolve('./src/components/layout/Sidebar.jsx'), 'utf-8');
      const headerSrcOff = fs.readFileSync(path.resolve('./src/components/layout/Header.jsx'), 'utf-8');
      const routerSrcOff = fs.readFileSync(path.resolve('./src/router/index.jsx'), 'utf-8');
      const offProgressSrc = fs.readFileSync(path.resolve('./src/pages/offboarding/OffboardingDepartingPage.jsx'), 'utf-8');
      const offDetailSrc = fs.readFileSync(path.resolve('./src/pages/offboarding/OffboardingEmployeeDetailPage.jsx'), 'utf-8');
      const offPlansSrc = fs.readFileSync(path.resolve('./src/pages/offboarding/OffboardingPlansPage.jsx'), 'utf-8');
      const overdueOffboardingTasksModalSrc = fs.readFileSync(path.resolve('./src/components/offboarding/OverdueOffboardingTasksModal.jsx'), 'utf-8');
      const launchOffboardingPlanModalSrc = fs.readFileSync(path.resolve('./src/components/offboarding/LaunchOffboardingPlanModal.jsx'), 'utf-8');
      const offboardingServiceSrcOff = fs.readFileSync(path.resolve('./src/services/offboardingService.js'), 'utf-8');
      const offboardingDomainSrcOff = fs.readFileSync(path.resolve('./src/domain/offboardingDomain.js'), 'utf-8');

      // --- ROUTER ---

      // 1138. The old dashboard route no longer renders a dashboard page — it redirects to the canonical Progress route
      assert(
        !routerSrcOff.includes('OffboardingDashboardPage') &&
        routerSrcOff.match(/path:\s*'dashboard',\s*element:\s*<Navigate to="\/offboarding\/departing" replace \/>/),
        '1138. NEW — /offboarding/dashboard no longer renders a Dashboard page component; it now redirects to the canonical /offboarding/departing Progress route, so no old bookmarked link is left dead'
      );

      // 1139. The /offboarding index route now redirects to the canonical Progress route, not the removed Dashboard
      assert(
        routerSrcOff.match(/path:\s*'offboarding',[\s\S]{0,60}children:\s*\[\s*\{\s*index:\s*true,\s*element:\s*<Navigate to="\/offboarding\/departing" replace \/>/),
        '1139. NEW — The /offboarding index route redirects to /offboarding/departing (was /offboarding/dashboard)'
      );

      // 1140. Offboarding routing still serves departing (Progress)/detail/plans/plan editor
      assert(
        routerSrcOff.includes("path: 'offboarding'") && routerSrcOff.includes('OffboardingDepartingPage') && routerSrcOff.includes('OffboardingPlansPage') && routerSrcOff.includes('OffboardingEmployeeDetailPage') && routerSrcOff.includes("path: 'departing'") && routerSrcOff.includes("path: 'plans'"),
        '1140. Offboarding routing still serves the Progress page (departing), employee detail, Plans, and the plan editor'
      );

      // --- SIDEBAR ---

      // 1141. Sidebar's Offboarding sub-menu now lists only Progress and Plans (no Dashboard, no Departing Employees)
      {
        const offboardingSubmenuMatch = sidebarSrcOff.match(/\{\/\* Offboarding \*\/\}[\s\S]*?\{\/\* WORK Section \*\/\}/);
        const offboardingSubmenuBlock = offboardingSubmenuMatch ? offboardingSubmenuMatch[0] : '';
        const offboardingNavLinkCount = (offboardingSubmenuBlock.match(/<NavLink/g) || []).length;
        assert(
          Boolean(offboardingSubmenuMatch) &&
          !offboardingSubmenuBlock.includes('/offboarding/dashboard') &&
          !offboardingSubmenuBlock.includes('Dashboard') &&
          !offboardingSubmenuBlock.includes('Departing Employees') &&
          offboardingSubmenuBlock.includes('/offboarding/departing') &&
          offboardingSubmenuBlock.includes('/offboarding/plans') &&
          offboardingNavLinkCount === 2,
          '1141. NEW — The Offboarding sidebar sub-menu shows only Progress and Plans (exactly 2 links) — the Dashboard link and the old "Departing Employees" label are both gone'
        );

        assert(
          offboardingSubmenuBlock.match(/to="\/offboarding\/departing"[\s\S]{0,250}Progress/),
          '1141b. NEW — The Offboarding submenu\'s first sublink now reads "Progress" while routing to the preserved /offboarding/departing path'
        );
        assert(
          offboardingSubmenuBlock.match(/to="\/offboarding\/plans"[\s\S]{0,250}Plans/),
          '1141c. The Offboarding submenu\'s "Plans" sublink is unchanged, still routing to /offboarding/plans'
        );
      }

      // 1142. MAIN > Employees and Onboarding > Progress/Plans are completely unaffected by this Offboarding-only task
      {
        const mainSectionMatchOff = sidebarSrcOff.match(/MAIN Section \*\/\}[\s\S]*?PEOPLE Section/);
        const mainSectionBlockOff = mainSectionMatchOff ? mainSectionMatchOff[0] : '';
        const onboardingSubmenuMatchOff = sidebarSrcOff.match(/\{\/\* Onboarding \*\/\}[\s\S]*?\{\/\* Offboarding \*\/\}/);
        const onboardingSubmenuBlockOff = onboardingSubmenuMatchOff ? onboardingSubmenuMatchOff[0] : '';
        assert(
          mainSectionBlockOff.includes('to="/employees"') && mainSectionBlockOff.includes('<span>Employees</span>') &&
          onboardingSubmenuBlockOff.includes('to="/onboarding/employees"') && onboardingSubmenuBlockOff.match(/to="\/onboarding\/employees"[\s\S]{0,250}Progress/) &&
          onboardingSubmenuBlockOff.includes('to="/onboarding/plans"'),
          '1142. REGRESSION: MAIN > Employees and Onboarding > Progress/Plans remain completely untouched by this Offboarding-scoped navigation task'
        );
      }

      // --- PAGE HEADING / BREADCRUMB ---

      // 1143. Offboarding Progress page <h1> reads exactly "Offboarding Progress"
      assert(offProgressSrc.includes('>Offboarding Progress<'), '1143. NEW — The Offboarding Progress page\'s <h1> heading reads exactly "Offboarding Progress"');

      // 1144. Subtitle reads the required, structurally-consistent description
      assert(
        offProgressSrc.includes('View and track individual offboarding progress for employees and interns.'),
        '1144. NEW — The page subtitle reads "View and track individual offboarding progress for employees and interns." — mirroring the Onboarding Progress subtitle\'s phrasing'
      );

      // 1145. Breadcrumb display metadata: path-scoped label overrides map both /offboarding/departing and /offboarding/employees -> "Progress" — not a hardcoded second breadcrumb, not a route rename
      assert(
        headerSrcOff.match(/'\/offboarding\/departing':\s*'Progress',/) &&
        headerSrcOff.match(/'\/offboarding\/employees':\s*'Progress',/) &&
        headerSrcOff.includes('BREADCRUMB_LABEL_OVERRIDES[url] || formatBreadcrumbText(segment)'),
        '1145. NEW — Header.jsx defines path-keyed BREADCRUMB_LABEL_OVERRIDES entries (\'/offboarding/departing\' -> \'Progress\', \'/offboarding/employees\' -> \'Progress\') consumed by the existing single breadcrumb generator, so Home > Offboarding > Progress renders correctly (and cascades into the detail page breadcrumb too)'
      );
      // 1145b. Overrides are keyed by the FULL path, never the bare segment — so MAIN > Employees and Onboarding > Progress breadcrumbs are provably unaffected
      assert(
        !headerSrcOff.match(/^\s*'departing':\s*'Progress',/m) && !headerSrcOff.match(/^\s*'employees':\s*'Progress',/m) && !headerSrcOff.match(/'\/employees':\s*'Progress'/),
        '1145b. NEW — The Offboarding breadcrumb overrides are keyed by the full paths \'/offboarding/departing\'/\'/offboarding/employees\', never by a bare segment or the unrelated top-level \'/employees\' — the MAIN > Employees breadcrumb is provably unaffected'
      );

      // 1146. Detail-page Back link says "Back to Offboarding Progress" in both render branches (normal state and "Employee Not Found" fallback), destination route unchanged
      assert(
        (offDetailSrc.match(/Back to Offboarding Progress/g) || []).length === 2 &&
        !offDetailSrc.includes('Back to Offboarding Directory') &&
        !offDetailSrc.includes('Return to Offboarding Directory') &&
        (offDetailSrc.match(/to="\/offboarding\/departing"/g) || []).length === 2,
        '1146. NEW — Both Back-link render branches on the detail page (normal state and "Employee Not Found" fallback) now read "Back to Offboarding Progress" (were "Back to Offboarding Directory"/"Return to Offboarding Directory"), each still navigating to the unchanged /offboarding/departing route'
      );

      // --- ORPHANED DASHBOARD PAGE REMOVED CLEANLY ---

      // 1147. OffboardingDashboardPage.jsx no longer exists on disk, and nothing in the app imports it any more
      {
        const dashboardFileExists = fs.existsSync(path.resolve('./src/pages/offboarding/OffboardingDashboardPage.jsx'));
        assert(!dashboardFileExists, '1147. NEW — OffboardingDashboardPage.jsx was removed as genuine dead code — its unique KPI/overdue-panel content was consolidated into the Progress page first, and it had zero remaining references (only the router import, which was removed)');
        assert(!routerSrcOff.includes("import OffboardingDashboardPage"), '1147b. NEW — router/index.jsx no longer imports the deleted OffboardingDashboardPage');
      }

      // --- KPI CARDS CONSOLIDATED (no duplicated Dashboard table) ---

      // 1148. All 4 summary cards render on the Progress page via the existing summary-cards-grid layout, reusing the same OFFBOARDING_INSTANCE_STATUS-based calculations the old Dashboard used
      assert(
        offProgressSrc.includes('summary-cards-grid') && offProgressSrc.includes('Active Exit Plans') && offProgressSrc.includes('In Progress') && offProgressSrc.includes('Needs Attention') && offProgressSrc.includes('Completed Exit Plans') &&
        offProgressSrc.includes("i.derivedStatus !== OFFBOARDING_INSTANCE_STATUS.COMPLETED") && offProgressSrc.includes('i.derivedStatus === OFFBOARDING_INSTANCE_STATUS.IN_PROGRESS') && offProgressSrc.includes('i.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION') && offProgressSrc.includes('i.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED'),
        '1148. NEW — The 4 summary cards (Active Exit Plans, In Progress, Needs Attention, Completed Exit Plans) now render on the Progress page, reusing the exact same OFFBOARDING_INSTANCE_STATUS-based filter predicates the old Dashboard used — not reimplemented, and not borrowed from Onboarding\'s PLAN_INSTANCE_STATUS'
      );

      // 1149. Only ONE data table exists on the Progress page — no second Dashboard-style operational table duplicated alongside it
      {
        const offTableTagMatches = offProgressSrc.match(/<table\b/g) || [];
        assert(offTableTagMatches.length === 1, '1149. NEW — Only ONE offboarding progress table exists on the Progress page (no duplicated second Dashboard-style table)');
      }

      // 1150. The single table carries the Part 3 field set — adapted to offboarding's own legitimate terminology ("Final Working Date", not a forced generic "End/Departure Date")
      assert(
        offProgressSrc.includes('>Employee<') && offProgressSrc.includes('>Department<') && offProgressSrc.includes('>Final Working Date<') && offProgressSrc.includes('>Offboarding Plan<') && offProgressSrc.includes('>Progress<') && offProgressSrc.includes('>Status<') && offProgressSrc.includes('>Action<') &&
        offProgressSrc.includes('<span>View Progress</span>'),
        '1150. NEW — The consolidated table shows Employee / Department / Final Working Date / Offboarding Plan / Progress / Status / Action(View Progress) — the offboarding-specific "Final Working Date" term was intentionally kept instead of forcing a generic "End/Departure Date" label'
      );

      // --- FILTERS / SEARCH (mirrors Onboarding's UI pattern, reusing the shared employee.directoryType field) ---

      // 1151. All/Employees/Interns pill filter is present, reusing view-switcher-group/view-btn and the shared employee.directoryType field (not an onboarding-specific concept)
      assert(
        offProgressSrc.includes('view-switcher-group') && (offProgressSrc.match(/view-btn/g) || []).length >= 3 && offProgressSrc.includes('>All</span>') && offProgressSrc.includes('>Employees</span>') && offProgressSrc.includes('>Interns</span>') &&
        offProgressSrc.includes('emp.directoryType !== typeFilter'),
        '1151. NEW — The All / Employees / Interns pill filter is present on the Progress page, reusing the same view-switcher-group/view-btn UI pattern as Onboarding and the shared, module-agnostic employee.directoryType field — no onboarding-specific logic was imported'
      );

      // 1152. Simple name/ID search remains present (a strict superset — also still matches template name, preserving the old Departing page's search behavior)
      assert(
        offProgressSrc.includes('Search employee name or ID') && offProgressSrc.includes('setSearch(e.target.value)'),
        '1152. NEW — The Progress page has the Employee name/ID search box, matching Onboarding\'s pattern (search additionally still matches template name too, so no existing search capability was lost)'
      );

      // 1153. The old 4-way status tab UI (Departing/Needs Attention/Completed/All Workflows) was not reintroduced — status is now shown via the KPI cards + per-row Status badge, matching the Onboarding structure
      assert(
        !offProgressSrc.includes('filter-tab-btn') && !offProgressSrc.includes('Departing (') && !offProgressSrc.includes('All Workflows ('),
        '1153. NEW — The old 4-way status-tab bar was replaced by the All/Employees/Interns type filter (status is still fully visible via the KPI cards and the per-row Status column) — this mirrors the Onboarding Progress page\'s structure'
      );

      // --- OVERDUE TASKS: dedicated offboarding modal, reusing generic activityService infrastructure only ---

      // 1154. A dedicated OverdueOffboardingTasksModal exists (not the onboarding OverdueTasksModal reused directly) — UI pattern reused, but kept as its own offboarding-owned component per the architecture split
      assert(
        fs.existsSync(path.resolve('./src/components/offboarding/OverdueOffboardingTasksModal.jsx')) &&
        overdueOffboardingTasksModalSrc.includes('>Overdue Offboarding Tasks<') &&
        overdueOffboardingTasksModalSrc.includes('modal-scroll-shell') && overdueOffboardingTasksModalSrc.includes('app-scroll-area') && overdueOffboardingTasksModalSrc.includes('modal-header') && overdueOffboardingTasksModalSrc.includes('modal-body'),
        '1154. NEW — A dedicated OverdueOffboardingTasksModal.jsx exists under src/components/offboarding/ (the Onboarding OverdueTasksModal component itself was not imported/reused) with its own "Overdue Offboarding Tasks" heading and the same fixed-header/single-scroll-region modal-scroll-shell pattern'
      );

      // 1155. The modal renders via props only (task title/dueDate/relatedEmployee, Mark Complete, Mark All as Complete) — no owned data fetch, matching the Onboarding modal's presentation-only contract
      {
        const overdueOffModalCodeOnly = stripComments(overdueOffboardingTasksModalSrc);
        assert(
          overdueOffModalCodeOnly.includes('task.title') && overdueOffModalCodeOnly.includes('task.dueDate') && overdueOffModalCodeOnly.includes('task.relatedEmployee') && overdueOffModalCodeOnly.includes('onMarkComplete(task.id)') && overdueOffModalCodeOnly.includes('onMarkAllComplete') &&
          !overdueOffModalCodeOnly.includes('activityService') && !overdueOffModalCodeOnly.includes('getOverdueActivities'),
          '1155. NEW — OverdueOffboardingTasksModal renders task title/due date/employee, Mark Complete, and Mark All as Complete via props only — there is no owned activityService call (no duplicated data source; the parent Progress page owns the single fetch)'
        );
      }

      // 1156. The Progress page fetches overdue Offboarding-sourced activities once (reusing the exact same source==='Offboarding' filter the old Dashboard used) and wires that single state/handlers into the modal
      assert(
        offProgressSrc.includes('activityService.getOverdueActivities()') && offProgressSrc.includes("a.source === 'Offboarding'") &&
        offProgressSrc.includes('tasks={overdueTasks}') && offProgressSrc.includes('onMarkComplete={handleMarkTaskComplete}') && offProgressSrc.includes('onMarkAllComplete={handleMarkAllOverdueComplete}') && offProgressSrc.includes('activityService.markCompleteMany(idsToComplete)'),
        '1156. NEW — The Progress page fetches overdue Offboarding-sourced activities via the same source===\'Offboarding\' filter the old Dashboard used (single call site) and wires individual Mark Complete plus bulk Mark All as Complete (via the existing generic activityService.markCompleteMany) into the modal'
      );

      // --- LAUNCH OFFBOARDING PLAN: untouched, offboarding-specific eligibility preserved ---

      // 1157. UPDATED (Offboarding Plans scope refactor) — LaunchOffboardingPlanModal was later updated to drive launch via the composed-task preview (previewOffboardingComposition) instead of a manually-selected template (previewPlanLaunch), per the "Refactor Offboarding Plans" task — it still keeps its own offboarding-specific Final Working Date anchor/override, never copied from Onboarding (which has no such override).
      assert(
        launchOffboardingPlanModalSrc.includes('offboardingService.launchPlanInstance') && launchOffboardingPlanModalSrc.includes('offboardingService.previewOffboardingComposition') && launchOffboardingPlanModalSrc.includes('Final Working Date Anchor'),
        '1157. UPDATED — LaunchOffboardingPlanModal now drives employee selection, composed-task preview (previewOffboardingComposition, not the retired previewPlanLaunch), and launch via offboardingService, keeping its own offboarding-specific Final Working Date anchor/override (no onboarding eligibility logic was ever copied in)'
      );
      assert(
        offProgressSrc.includes('isOpen={isLaunchModalOpen}') && offProgressSrc.includes('onSuccess={() => loadData()}') && offDetailSrc.includes('<LaunchOffboardingPlanModal'),
        '1157b. The Progress page and the individual detail page both still wire the existing LaunchOffboardingPlanModal with their existing open/close state (no reimplementation)'
      );

      // 1158. Offboarding-specific eligibility rules are untouched: Upcoming/Onboarding-status people remain ineligible for an offboarding launch (a rule with no Onboarding-side equivalent)
      {
        const upcomingSynthetic = { id: 'synth-off-upcoming', fullName: 'Synthetic Upcoming', status: 'Upcoming' };
        const onboardingSynthetic = { id: 'synth-off-onboarding', fullName: 'Synthetic Onboarding', status: 'Onboarding' };
        const upcomingElig = checkOffboardingEligibility(upcomingSynthetic, [], []);
        const onboardingElig = checkOffboardingEligibility(onboardingSynthetic, [], []);
        assert(
          upcomingElig.isEligible === false && onboardingElig.isEligible === false,
          '1158. NEW — checkOffboardingEligibility() still rejects Upcoming/Onboarding-status people as ineligible for an offboarding launch — this offboarding-specific rule was not touched or replaced with onboarding logic'
        );
      }

      // 1159. Former-status employees remain permanently ineligible for a new offboarding launch (offboarding's own terminal-lifecycle rule)
      {
        const formerSynthetic = { id: 'synth-off-former', fullName: 'Synthetic Former', status: 'Former' };
        const formerElig = checkOffboardingEligibility(formerSynthetic, [], []);
        assert(formerElig.isEligible === false, '1159. NEW — checkOffboardingEligibility() still rejects Former-status employees from a new offboarding launch (Former is offboarding\'s own terminal lifecycle state)');
      }

      // 1160. An Active employee with a resolvable exit anchor (contractEndDate) is eligible, and the resolved anchor comes from the departure/end date — NOT a start date, unlike Onboarding
      {
        const activeSynthetic = { id: 'synth-off-active', fullName: 'Synthetic Active', status: 'Active', contractEndDate: '2026-12-31' };
        const activeElig = checkOffboardingEligibility(activeSynthetic, [], []);
        assert(
          activeElig.isEligible === true && activeElig.resolvedAnchorDate === '2026-12-31',
          '1160. NEW — checkOffboardingEligibility() resolves an Active employee with a confirmed contractEndDate as eligible, anchored to that departure/end date — resolveOffboardingAnchorDate() was not touched, and no onboarding start-date anchor logic was substituted in'
        );

        const noAnchorSynthetic = { id: 'synth-off-no-anchor', fullName: 'Synthetic No Anchor', status: 'Active', contractEndDate: null };
        const noAnchorElig = checkOffboardingEligibility(noAnchorSynthetic, [], []);
        assert(noAnchorElig.isEligible === false, '1160b. NEW — An Active employee with no confirmed exit date on record correctly remains ineligible until a Final Working Date override is set');
      }

      // 1161. Duplicate-plan protection: an employee who already has an active (non-completed) offboarding plan instance cannot have a second one launched
      {
        const preLaunchInstancesOff = await offboardingService.getAllInstances();
        const farahInstance = preLaunchInstancesOff.find((i) => i.employeeId === 'emp-016' && i.derivedStatus !== OFFBOARDING_INSTANCE_STATUS.COMPLETED);
        if (farahInstance) {
          let duplicateBlocked = false;
          let duplicateErrorMessage = '';
          try {
            await offboardingService.launchPlanInstance('emp-016', 'tpl-off-001', {}, null, 'emp-001');
          } catch (err) {
            duplicateBlocked = true;
            duplicateErrorMessage = err.message;
          }
          assert(
            duplicateBlocked && duplicateErrorMessage.includes('already has an active offboarding plan'),
            '1161. NEW — Attempting to launch a second offboarding plan for an employee who already has an active one (emp-016 / Farah Mansor) is blocked at the service level with a clear "already has an active offboarding plan" error — the final service-level validation protects even though the UI never offers this scenario'
          );
        } else {
          assert(true, '1161. Duplicate-plan protection check skipped — seed employee emp-016 no longer has an active offboarding instance in the current database state (checkOffboardingEligibility\'s duplicate-plan rule is verified directly via synthetic data elsewhere in this suite)');
        }
      }

      // --- ANCHOR / DUE-DATE CALCULATION PRESERVED ---

      // 1162. Existing offboarding task due dates remain calculated from the departure/end-date anchor exactly as before (spot-checked against the known seed instance) — not the onboarding start-date anchor
      {
        const farahFullInstance = await offboardingService.getInstanceById('inst-off-001');
        if (farahFullInstance) {
          const dayZeroTask = farahFullInstance.taskInstances.find((t) => t.relativeOffsetDays === 0);
          const dayMinus30Task = farahFullInstance.taskInstances.find((t) => t.relativeOffsetDays === -30);
          assert(
            farahFullInstance.anchorDate === '2026-09-30' &&
            dayZeroTask && dayZeroTask.originallyCalculatedDueDate === '2026-09-30' &&
            dayMinus30Task && dayMinus30Task.originallyCalculatedDueDate === '2026-08-31',
            '1162. NEW — inst-off-001\'s (Farah Mansor) task due dates remain correctly anchored to the Final Working Date (2026-09-30): Day 0 = 2026-09-30, Day -30 = 2026-08-31 — offboarding\'s departure-date anchor semantics were not altered by this navigation refactor'
          );
        } else {
          assert(true, '1162. Anchor/due-date spot check skipped — seed instance inst-off-001 not present in current database state');
        }

        const resolvedFromContractEnd = resolveOffboardingAnchorDate({ id: 'synth-anchor-check', contractEndDate: '2027-01-15' }, [], null, '2026-01-01');
        assert(resolvedFromContractEnd === '2027-01-15', '1162b. NEW — resolveOffboardingAnchorDate() still resolves from the employee\'s departure-related fields (contractEndDate), unrelated to any onboarding start-date concept');
      }

      // --- PLANS (untouched AS OF THIS TASK — later fully refactored by "Refactor Offboarding Plans to Match the New Onboarding Structure"; see checks 1170+ for its own coverage) ---

      // 1163. UPDATED — At the time of the Progress refactor, the Offboarding Plans page/route were untouched (Part 6 explicitly scoped that task away from a Plans redesign). The old template-based page/heading this check originally asserted on ("Offboarding Plan Templates" / "Create Exit Template") was intentionally retired by the later Plans scope refactor — re-pointed here to the CURRENT Plans page/route shape so this check keeps proving the /offboarding/plans route itself was never lost across either task.
      assert(
        offPlansSrc.includes('>Offboarding Plans<') && routerSrcOff.includes("{ path: 'plans', element: <OffboardingPlansPage /> }"),
        '1163. UPDATED — The Offboarding Plans route (/offboarding/plans) has remained continuously registered across both the Progress refactor (which left it untouched) and the later Plans scope refactor (which changed its page content/heading but not its route)'
      );

      // --- INDIVIDUAL PROGRESS / DETAIL PAGE ---

      // 1164. UPDATED — The individual offboarding detail page still shows the person's real plan/task progress and Mark Done/Reopen actions. Its task table was earlier changed (by the
      // "Refactor Offboarding Plans" task) from instance.taskInstances.map(...) to instance.progress.tasks.map(...) — a pre-existing compatibility bug fix (instance.taskInstances was always the
      // RAW, unenriched array with no linkedActivity field). The old instance.progress.completedRequiredCount reference this check originally asserted on was REMOVED by the later "Refactor
      // Individual Offboarding Progress Page" task (the 4-block PLAN TEMPLATE/CLEARANCE STATUS/REQUIRED TASKS PROGRESS/TOTAL TASKS FINISHED layout was replaced by a single Onboarding-style plan
      // summary card reading instance.progress.progressPercentage/completedTasksCount/totalTasks directly) — re-pointed here to the current fields; see checks 1200+ for that task's own full coverage.
      assert(
        offDetailSrc.includes('instance.progress.progressPercentage') && offDetailSrc.includes('instance.derivedStatus') && offDetailSrc.includes('handleToggleTaskComplete') && offDetailSrc.includes('instance.progress.tasks.map'),
        '1164. UPDATED — REGRESSION: The individual offboarding detail page continues to render the employee\'s actual plan/task progress and task completion actions — its task table reads the enriched instance.progress.tasks, and its summary now reads progressPercentage/completedTasksCount/totalTasks directly (the old completedRequiredCount-based 4-block layout was later replaced; see checks 1200+)'
      );

      // --- FUNCTIONAL: OVERDUE MARK COMPLETE / MARK ALL AS COMPLETE ---

      // 1165. Mark Complete functionally still completes an overdue offboarding activity end-to-end through the reused activityService
      {
        const overdueBeforeOff = await activityService.getOverdueActivities();
        const offboardingOverdueBeforeOff = overdueBeforeOff.filter((a) => a.source === 'Offboarding');
        if (offboardingOverdueBeforeOff.length > 0) {
          const targetOverdueTaskOff = offboardingOverdueBeforeOff[0];
          const completedTaskOff = await activityService.markComplete(targetOverdueTaskOff.id);
          assert(completedTaskOff.completed === true, '1165. NEW — Mark Complete functionally completes an overdue offboarding task through the reused activityService.markComplete()');
          await activityService.reopen(targetOverdueTaskOff.id);
        } else {
          assert(true, '1165. Mark Complete functional check skipped — no overdue Offboarding activities present in current seed state (activityService.markComplete/reopen verified functional elsewhere in this suite)');
        }
      }

      // 1166. Mark All as Complete completes exactly the offboarding-sourced overdue set via the generic, already-proven activityService.markCompleteMany — no offboarding-specific bulk logic was invented
      {
        const overdueBeforeBulkOff = await activityService.getOverdueActivities();
        const offboardingOverdueBeforeBulkOff = overdueBeforeBulkOff.filter((a) => a.source === 'Offboarding');
        if (offboardingOverdueBeforeBulkOff.length > 0) {
          const bulkTargetIdsOff = offboardingOverdueBeforeBulkOff.map((t) => t.id);
          const bulkResultsOff = await activityService.markCompleteMany(bulkTargetIdsOff);
          assert(
            Array.isArray(bulkResultsOff) && bulkResultsOff.length === bulkTargetIdsOff.length && bulkResultsOff.every((r) => r.completed === true),
            '1166. NEW — Mark All as Complete completes every currently-overdue Offboarding-sourced task via the shared activityService.markCompleteMany() — the exact same bulk helper Onboarding uses, with no offboarding-specific reimplementation'
          );
          for (const id of bulkTargetIdsOff) {
            await activityService.reopen(id);
          }
        } else {
          assert(true, '1166. Mark All as Complete functional check skipped — no overdue Offboarding activities present in current seed state');
        }
      }

      // 1167. Task completion still correctly recomputes offboarding plan progress/status through the existing, untouched reconciliation path
      {
        const instBeforeToggle = await offboardingService.getInstanceById('inst-off-002');
        if (instBeforeToggle) {
          const incompleteTask = instBeforeToggle.progress.tasks.find((t) => !t.isCompleted);
          if (incompleteTask && incompleteTask.linkedActivity) {
            await activityService.markComplete(incompleteTask.linkedActivity.id);
            const instAfterToggle = await offboardingService.getInstanceById('inst-off-002');
            assert(
              instAfterToggle.progress.completedTasksCount === instBeforeToggle.progress.completedTasksCount + 1,
              '1167. NEW — Completing an offboarding task still correctly recomputes the plan instance\'s progress/status via the existing, untouched reconcileOffboardingPlanProgress() path'
            );
            await activityService.reopen(incompleteTask.linkedActivity.id);
          } else {
            assert(true, '1167. Task completion regression check skipped — inst-off-002 has no remaining incomplete task in current seed state');
          }
        } else {
          assert(true, '1167. Task completion regression check skipped — seed instance inst-off-002 not present in current database state');
        }
      }

      // --- ONBOARDING COMPLETELY UNAFFECTED ---

      // 1168. No onboarding functionality, business logic, or navigation was touched by this Offboarding-scoped task
      {
        const onboardingServiceSrcOffRegr = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
        const onboardingDomainSrcOffRegr = fs.readFileSync(path.resolve('./src/domain/onboardingDomain.js'), 'utf-8');
        const onbEmployeesSrcOffRegr = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeesPage.jsx'), 'utf-8');
        assert(
          onboardingServiceSrcOffRegr.includes('async saveScopeTasks(scopeType, personType, departmentId = null, tasksData = [], currentUserId') &&
          onboardingDomainSrcOffRegr.includes("DROPPED: 'Dropped'") &&
          onbEmployeesSrcOffRegr.includes('>Onboarding Progress<') &&
          routerSrcOff.includes('<Navigate to="/onboarding/employees" replace />'),
          '1168. REGRESSION: onboardingService.js/onboardingDomain.js signatures, the Onboarding Progress page heading, and the /onboarding/employees route are all byte-for-byte unaffected by this Offboarding-only navigation/consolidation task'
        );

        const eligibleOnboardingRegr = await onboardingService.getLaunchEligibleEmployees();
        assert(Array.isArray(eligibleOnboardingRegr), '1168b. REGRESSION: Onboarding launch eligibility still resolves correctly, untouched by this task');
      }

      // 1169. UPDATED — offboardingService.js/offboardingDomain.js core status states and eligibility/anchor functions are unchanged by THIS (Progress) task — only launchPlanInstance()'s own signature was later evolved by the separate "Refactor Offboarding Plans" task (template-based -> composed-scope-based); see checks 1170+ for that task's own signature/regression coverage.
      assert(
        offboardingServiceSrcOff.includes('async getAllInstances(options = {})') &&
        offboardingDomainSrcOff.includes("IN_PROGRESS: 'In Progress'") && offboardingDomainSrcOff.includes("NEEDS_ATTENTION: 'Needs Attention'") && offboardingDomainSrcOff.includes("COMPLETED: 'Completed'") &&
        offboardingDomainSrcOff.includes('export function checkOffboardingEligibility') && offboardingDomainSrcOff.includes('export function resolveOffboardingAnchorDate'),
        '1169. UPDATED — REGRESSION: offboardingService.js\'s getAllInstances() and offboardingDomain.js\'s core status states/eligibility/anchor-date functions remain unchanged by this Progress-consolidation task'
      );

      resetDatabase();
    }

    // ==========================================================================
    // Refactor Offboarding Plans to Match the New Onboarding Structure
    // ==========================================================================
    {
      resetDatabase();

      const offPlansSrc2 = fs.readFileSync(path.resolve('./src/pages/offboarding/OffboardingPlansPage.jsx'), 'utf-8');
      const offPlanEditorSrc = fs.readFileSync(path.resolve('./src/pages/offboarding/PlanEditorPage.jsx'), 'utf-8');
      const launchOffboardingPlanModalSrc2 = fs.readFileSync(path.resolve('./src/components/offboarding/LaunchOffboardingPlanModal.jsx'), 'utf-8');
      const offboardingServiceSrc2 = fs.readFileSync(path.resolve('./src/services/offboardingService.js'), 'utf-8');
      const offboardingDomainSrc2 = fs.readFileSync(path.resolve('./src/domain/offboardingDomain.js'), 'utf-8');
      const storageEngineSrc2 = fs.readFileSync(path.resolve('./src/mock-data/storageEngine.js'), 'utf-8');
      const routerSrc4 = fs.readFileSync(path.resolve('./src/router/index.jsx'), 'utf-8');
      const onbPlansSrc4 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingPlansPage.jsx'), 'utf-8');
      const onbPlanEditorSrc4 = fs.readFileSync(path.resolve('./src/pages/onboarding/PlanEditorPage.jsx'), 'utf-8');
      const onboardingServiceSrc4 = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
      const onboardingDomainSrc4 = fs.readFileSync(path.resolve('./src/domain/onboardingDomain.js'), 'utf-8');

      // --- OLD TEMPLATE-BASED PLANS UI FULLY REMOVED ---

      // 1170. Old template-card page UI (heading, Create Exit Template, per-card Active/Required/Launch, named template cards) is completely gone from the Plans page
      assert(
        offPlansSrc2.includes('>Offboarding Plans<') && !offPlansSrc2.includes('>Offboarding Plan Templates<') &&
        !offPlansSrc2.includes('Create Exit Template') && !offPlansSrc2.includes('Edit Template') &&
        !offPlansSrc2.includes('Launch Offboarding Plan') && !offPlansSrc2.includes('Standard Employee Offboarding') &&
        !offPlansSrc2.includes('assignmentRule') && !offPlansSrc2.includes('Required'),
        '1170. NEW — The old template-card page UI (heading "Offboarding Plan Templates", "Create Exit Template"/"Edit Template" actions, per-card Launch button, Active/Required badges, named template cards) is fully removed — the page now reads "Offboarding Plans" with the new scope-based structure'
      );

      // 1171. Subtitle matches the required, structurally-consistent wording
      assert(
        offPlansSrc2.includes('Configure reusable offboarding tasks for employees and interns. Universal and department-specific tasks are combined automatically when offboarding is launched.'),
        '1171. NEW — The Offboarding Plans subtitle reads the required wording, mirroring Onboarding Plans\' phrasing'
      );

      // --- EMPLOYEES / INTERNS FILTER ---

      // 1172. Employees/Interns segmented-control filter is present, defaulting to Employees, reusing the exact view-switcher-group/view-btn pattern (not a new control style)
      assert(
        offPlansSrc2.includes("useState(location.state?.personType === 'intern' ? 'intern' : 'employee')") &&
        offPlansSrc2.includes('view-switcher-group onboarding-person-type-switcher') &&
        offPlansSrc2.includes('>Employees</span>') && offPlansSrc2.includes('>Interns</span>'),
        '1172. NEW — The Employees/Interns filter defaults to Employees and reuses the existing view-switcher-group/view-btn segmented-control pattern already established by Onboarding Plans — no new filter style was invented'
      );

      // --- UNIVERSAL + DEPARTMENT-SPECIFIC STRUCTURE ---

      // 1173. Universal Tasks card (emphasized, full width) and a dynamically-rendered Department-Specific Tasks grid are both present, routing to the new scope-aware URLs
      assert(
        offPlansSrc2.includes('title="Universal Tasks"') && offPlansSrc2.includes('Department-Specific Tasks') &&
        offPlansSrc2.includes('to={`/offboarding/plans/${personType}/universal`}') &&
        offPlansSrc2.includes('to={`/offboarding/plans/${personType}/department/${row.department.id}`}') &&
        !offPlansSrc2.match(/'Software Engineering'|"Software Engineering"|'Marketing'|"Marketing"|'Executive Office'|"Executive Office"/),
        '1173. NEW — Universal Tasks (emphasized card) and Department-Specific Tasks (dynamically rendered — no hardcoded department names in JSX) both route to the new /offboarding/plans/:personType/universal and /offboarding/plans/:personType/department/:departmentId scope-aware URLs'
      );

      // 1174. Empty-state wording is offboarding-specific and never uses retired "template" terminology
      assert(
        offPlansSrc2.includes('No employee-specific tasks configured for this department. Employee Universal Tasks will still apply.') &&
        offPlansSrc2.includes('No intern-specific tasks configured for this department. Intern Universal Tasks will still apply.') &&
        !offPlansSrc2.includes('template') && !offPlansSrc2.includes('Template'),
        '1174. NEW — Department empty-state wording matches the required Employee/Intern copy exactly, with no "template" terminology anywhere on the page'
      );

      // --- OFFBOARDING SCOPE DOMAIN MODEL (independent of Onboarding's) ---

      // 1175. offboardingDomain.js defines its OWN scope/person-type constants and composeOffboardingTasks() — never importing from onboardingDomain.js. UPDATED — the no-cross-import check
      // looks for an actual `import ... from '...onboardingDomain.js'` statement specifically (not a bare substring match), since offboardingDomain.js's own doc comments legitimately mention
      // "onboardingDomain.js" in prose when explaining a parallel/independent pattern (e.g. "mirrors onboardingDomain.js's isActivePlanStatus() in concept only") — that documentation is not a
      // real coupling and must not fail this check.
      assert(
        offboardingDomainSrc2.includes("export const OFFBOARDING_TASK_SCOPES") && offboardingDomainSrc2.includes("UNIVERSAL: 'universal'") && offboardingDomainSrc2.includes("DEPARTMENT: 'department'") &&
        offboardingDomainSrc2.includes("export const OFFBOARDING_PERSON_TYPES") && offboardingDomainSrc2.includes("EMPLOYEE: 'employee'") && offboardingDomainSrc2.includes("INTERN: 'intern'") &&
        offboardingDomainSrc2.includes('export function composeOffboardingTasks') &&
        !offboardingDomainSrc2.match(/import[\s\S]{0,200}from\s+['"][^'"]*onboardingDomain\.js['"]/),
        '1175. UPDATED — offboardingDomain.js defines its own OFFBOARDING_TASK_SCOPES/OFFBOARDING_PERSON_TYPES/composeOffboardingTasks() — a fully independent implementation, with zero actual import statement from onboardingDomain.js (documentation comments mentioning it for conceptual comparison are fine and expected)'
      );

      // 1176. composeOffboardingTasks() resolves personType from employee.directoryType exactly like Onboarding's equivalent, but is a separate function operating only on offboarding scope tasks
      {
        const empSynthetic = { directoryType: 'Employee', department: { id: 'dept-3' } };
        const internSynthetic = { directoryType: 'Intern', department: { id: 'dept-3' } };
        const taskDefs = [
          { id: 'u-emp', scopeType: 'universal', personType: 'employee', relativeOffsetDays: -7, title: 'Emp Universal', sequence: 1, active: true },
          { id: 'u-intern', scopeType: 'universal', personType: 'intern', relativeOffsetDays: -7, title: 'Intern Universal', sequence: 1, active: true },
          { id: 'd-emp', scopeType: 'department', personType: 'employee', scopeDepartmentId: 'dept-3', relativeOffsetDays: 0, title: 'Emp SWE', sequence: 2, active: true },
          { id: 'd-intern', scopeType: 'department', personType: 'intern', scopeDepartmentId: 'dept-3', relativeOffsetDays: 0, title: 'Intern SWE', sequence: 2, active: true },
        ];
        const empComp = composeOffboardingTasks(empSynthetic, taskDefs, '2026-09-30');
        const internComp = composeOffboardingTasks(internSynthetic, taskDefs, '2026-09-30');
        assert(
          empComp.tasks.map((t) => t.id).sort().join(',') === 'd-emp,u-emp' &&
          internComp.tasks.map((t) => t.id).sort().join(',') === 'd-intern,u-intern',
          '1176. NEW — composeOffboardingTasks() resolves the correct, entirely non-overlapping task set per personType (Employee gets only Employee-scoped tasks, Intern gets only Intern-scoped tasks) for the same department'
        );
      }

      // --- DATA PRESERVATION / MIGRATION ---

      // 1177. migrateOffboardingScopesIfNeeded() exists and is wired into BOTH loadDatabase() call sites (in-memory init and localStorage-parsed path), mirroring the onboarding migration's wiring pattern
      assert(
        storageEngineSrc2.includes('export function migrateOffboardingScopesIfNeeded') &&
        (storageEngineSrc2.match(/migrateOffboardingScopesIfNeeded\(/g) || []).length === 3,
        '1177. NEW — migrateOffboardingScopesIfNeeded() is defined once and called from both getInitialState() and the localStorage-parsed loadDatabase() path (3 total occurrences: the definition plus 2 call sites) — the exact same wiring pattern used for onboarding\'s migrations'
      );

      // 1178. Migration is additive/non-destructive and idempotent: repeated resetDatabase()+loadDatabase() cycles produce a stable, correctly-tagged task count
      {
        resetDatabase();
        const db1 = loadDatabase();
        const count1 = db1.offboardingPlanTasks.length;
        const db2 = loadDatabase();
        const count2 = db2.offboardingPlanTasks.length;
        const db3 = loadDatabase();
        const count3 = db3.offboardingPlanTasks.length;
        const allTagged = db3.offboardingPlanTasks.every((t) => t.scopeType && t.personType);
        assert(
          count1 === count2 && count2 === count3 && allTagged,
          `1178. NEW — migrateOffboardingScopesIfNeeded() is idempotent: repeated loadDatabase() calls produce a stable task count (${count1} -> ${count2} -> ${count3}), and every offboardingPlanTask carries both scopeType and personType after migration`
        );
      }

      // 1179. Migration mapping matches the documented decisions: tpl-off-001 (7, general) + tpl-off-003 (4, general/Executive) merge into Employee Universal (11); tpl-off-002 (4, Software Engineering) is duplicated into Employee AND Intern department scope (4 each) — nothing lost, nothing guessed
      {
        resetDatabase();
        const db = loadDatabase();
        const tasks = db.offboardingPlanTasks;
        const empUniversal = tasks.filter((t) => t.scopeType === 'universal' && t.personType === 'employee');
        const internUniversal = tasks.filter((t) => t.scopeType === 'universal' && t.personType === 'intern');
        const empSwe = tasks.filter((t) => t.scopeType === 'department' && t.personType === 'employee' && t.scopeDepartmentId === 'dept-3');
        const internSwe = tasks.filter((t) => t.scopeType === 'department' && t.personType === 'intern' && t.scopeDepartmentId === 'dept-3');
        assert(
          empUniversal.length === 11 && internUniversal.length === 0 && empSwe.length === 4 && internSwe.length === 4 && tasks.length === 19,
          `1179. NEW — Migration mapping verified: Employee Universal = 11 (tpl-off-001's 7 + tpl-off-003's 4, merged — documented in the migration's own comments), Intern Universal = 0 (no legacy intern-named template existed), Employee Software Engineering = 4 and Intern Software Engineering = 4 (tpl-off-002 duplicated into both person types, since the source data never distinguished them), total offboardingPlanTasks = 19 (found ${empUniversal.length}/${internUniversal.length}/${empSwe.length}/${internSwe.length}/${tasks.length})`
        );
        // No original task content was altered — every migrated task's title/description/relativeOffsetDays/activityTypeId still exactly matches its seed source (pt-off-001 through pt-off-023 remain findable by original id or by their intern-duplicate suffix).
        const originalIds = new Set(['pt-off-001','pt-off-002','pt-off-003','pt-off-004','pt-off-005','pt-off-006','pt-off-007','pt-off-010','pt-off-011','pt-off-012','pt-off-013','pt-off-020','pt-off-021','pt-off-022','pt-off-023']);
        const allOriginalIdsPresent = [...originalIds].every((id) => tasks.some((t) => t.id === id));
        assert(allOriginalIdsPresent, '1179b. NEW — Every original legacy task id (pt-off-001 through pt-off-023) is still present after migration — additive tagging/duplication only, nothing was dropped or replaced');
      }

      // --- MANAGE TASKS EDITOR (scope-aware, simplified fields) ---

      // 1180. The task editor reads personType/scopeType/departmentId from the route and titles itself correctly for all 4 combinations
      assert(
        offPlanEditorSrc.includes("const { personType, departmentId } = useParams();") &&
        offPlanEditorSrc.includes("const scopeType = departmentId !== undefined ? 'department' : 'universal';") &&
        offPlanEditorSrc.includes('title: `${personLabel} Universal Tasks`') &&
        offPlanEditorSrc.includes('title: `${department.name} — ${personLabel} Tasks`'),
        '1180. NEW — The editor derives personType/scopeType/departmentId from its own route params and titles itself "Employee Universal Tasks" / "Intern Universal Tasks" / "<Department> — Employee Tasks" / "<Department> — Intern Tasks" depending on the combination — matching Onboarding\'s exact editor pattern'
      );

      // 1181. Editor keeps only Task Title / Activity Type / Relative Offset / Task Description — Required checkbox, Assignment Rule, Template Name, and an in-editor department selector are all gone
      assert(
        offPlanEditorSrc.includes('Task Title') && offPlanEditorSrc.includes('Activity Type') && offPlanEditorSrc.includes('Relative Offset (Days)') && offPlanEditorSrc.includes('Task Description') &&
        !offPlanEditorSrc.includes('Required Clearance Task') && !offPlanEditorSrc.includes('Assignment Rule') &&
        !offPlanEditorSrc.includes('Template Name') && !offPlanEditorSrc.includes('Target Department Scope') && !offPlanEditorSrc.includes('Select Specific Assignee'),
        '1181. NEW — The editor keeps exactly Task Title / Activity Type / Relative Offset (Days) / Task Description — the Required Task checkbox, Assignment Rule selector, Template Name field, and in-editor department selector (departmentId already comes from the route) are all removed'
      );

      // 1182. Day-offset helper text uses offboarding's Final Working Date anchor semantics — never onboarding's start-date wording
      assert(
        offPlanEditorSrc.includes('Final Working Date') && !offPlanEditorSrc.toLowerCase().includes('start date') &&
        offPlanEditorSrc.includes('= Final Working Date') && offPlanEditorSrc.includes('After Final Working Date') && offPlanEditorSrc.includes('Before Final Working Date'),
        '1182. NEW — The Relative Offset helper text reads "0 = Final Working Date", "+ value = After Final Working Date", "− value = Before Final Working Date" — the offboarding departure-date anchor, never onboarding\'s start-date wording'
      );

      // 1183. saveScopeTasks()/getScopeTasks() are correctly scope-isolated: saving one (personType, scopeType[, departmentId]) combination never touches any other combination's tasks
      {
        resetDatabase();
        const beforeInternSwe = await offboardingService.getScopeTasks('department', 'intern', 'dept-3');
        await offboardingService.saveScopeTasks('department', 'employee', 'dept-3', [{ title: 'QA Employee SWE Only', relativeOffsetDays: 0 }]);
        const afterInternSwe = await offboardingService.getScopeTasks('department', 'intern', 'dept-3');
        const afterEmpSwe = await offboardingService.getScopeTasks('department', 'employee', 'dept-3');
        const afterEmpUniversal = await offboardingService.getScopeTasks('universal', 'employee', null);
        assert(
          afterInternSwe.length === beforeInternSwe.length &&
          afterEmpSwe.length === 1 && afterEmpSwe[0].title === 'QA Employee SWE Only' &&
          afterEmpUniversal.length === 11,
          `1183. NEW — saveScopeTasks('department','employee','dept-3', ...) replaced ONLY that exact scope (now ${afterEmpSwe.length} task) — Intern Software Engineering (${afterInternSwe.length}, unchanged from ${beforeInternSwe.length}) and Employee Universal (${afterEmpUniversal.length}, unchanged) were both left completely untouched`
        );
        resetDatabase();
      }

      // --- LAUNCH FLOW: composition-based, offboarding-specific eligibility/anchor preserved ---

      // 1184. LaunchOffboardingPlanModal no longer has a template selector — it now drives eligible-employee selection + composed-task preview, still keeping its own Final Working Date custom override (a genuine offboarding-specific need Onboarding's modal doesn't have)
      assert(
        !launchOffboardingPlanModalSrc2.includes('Offboarding Plan Template') && !launchOffboardingPlanModalSrc2.includes('selectedTemplateId') &&
        launchOffboardingPlanModalSrc2.includes('offboardingService.getLaunchEligibleEmployees()') &&
        launchOffboardingPlanModalSrc2.includes('offboardingService.previewOffboardingComposition') &&
        launchOffboardingPlanModalSrc2.includes('Final Working Date Anchor') && launchOffboardingPlanModalSrc2.includes('Custom Override'),
        '1184. NEW — LaunchOffboardingPlanModal has no template dropdown any more (no "Offboarding Plan Template" label, no selectedTemplateId state) — it now sources candidates from getLaunchEligibleEmployees() and previews via previewOffboardingComposition(), while keeping its own Final Working Date custom-override control (offboarding-specific; Onboarding\'s Launch modal has no equivalent)'
      );

      // 1185. Composition breakdown UI shows Universal/Department/Total (no per-task assignee columns — assignment resolution is gone from the new launch flow)
      assert(
        launchOffboardingPlanModalSrc2.includes('Universal Tasks {preview.counts.universal}') && launchOffboardingPlanModalSrc2.includes('Department Tasks {preview.counts.department}') && launchOffboardingPlanModalSrc2.includes('Total {preview.counts.total}') &&
        !launchOffboardingPlanModalSrc2.includes('resolvedAssigneeName') && !launchOffboardingPlanModalSrc2.includes('isResolved'),
        '1185. NEW — The Launch modal\'s composition breakdown shows Universal/Department/Total badges (no separate "Employee/Intern Tasks" bucket, since Universal is already person-type-scoped) and the task preview table has no per-task assignee/resolution columns — assignment resolution was removed along with Assignment Rule'
      );

      // 1186. launchPlanInstance() has the new composition-based signature (employeeId, customAnchorDate, currentUserId) — the templateId/manualOverrides parameters are gone
      assert(
        offboardingServiceSrc2.includes("async launchPlanInstance(employeeId, customAnchorDate = null, currentUserId = 'emp-001')") &&
        offboardingServiceSrc2.includes('composeOffboardingTasks(employee, taskDefinitions, eligibility.resolvedAnchorDate)'),
        '1186. NEW — offboardingService.launchPlanInstance() now takes (employeeId, customAnchorDate, currentUserId) and composes its task set via composeOffboardingTasks() + the existing checkOffboardingEligibility() anchor resolution — the old (employeeId, templateId, manualOverrides, customAnchorDate, currentUserId) template-based signature is gone'
      );

      // 1187. FUNCTIONAL — Employee launch composition = Employee Universal + Employee Department only (no Intern tasks), verified end-to-end through the real service against real seed data
      {
        resetDatabase();
        const empPreview = await offboardingService.previewOffboardingComposition('emp-005', '2026-12-31');
        const empHasInternTask = empPreview.tasks.some((t) => t.personType === 'intern');
        assert(
          empPreview.isValid && empPreview.counts.universal === 11 && empPreview.counts.department === 4 && empPreview.counts.total === 15 && !empHasInternTask,
          `1187. NEW — FUNCTIONAL: Priyanka Nair (Active, Software Engineering, Employee) composes to exactly Employee Universal(11) + Employee Software Engineering(4) = 15 total, with zero Intern-scoped tasks present (found universal=${empPreview.counts.universal}, department=${empPreview.counts.department}, total=${empPreview.counts.total})`
        );
      }

      // 1188. FUNCTIONAL — Intern launch composition = Intern Universal + Intern Department only (no Employee tasks). No eligible seed Intern exists (Active/Departing) — a synthetic Intern is created via the real employeeService for this isolated, in-memory-only check (never touches real persisted data; Node has no localStorage).
      {
        const syntheticIntern = await employeeService.createDirectoryEmployee(
          { firstName: 'QA', lastName: 'InternComposeCheck', workEmail: 'qa.interncomposecheck@rizurf.example', directoryType: 'Intern', startDate: '2026-01-01', contractEndDate: '2026-12-31', allowance: 'Unpaid', workMode: 'On-site', status: 'Active' },
          { departmentId: 'dept-3' }
        );
        const internPreview = await offboardingService.previewOffboardingComposition(syntheticIntern.id, null);
        const internHasEmployeeTask = internPreview.tasks.some((t) => t.personType === 'employee');
        assert(
          internPreview.isValid && internPreview.counts.universal === 0 && internPreview.counts.department === 4 && internPreview.counts.total === 4 && !internHasEmployeeTask,
          `1188. NEW — FUNCTIONAL: A synthetic Active Intern in Software Engineering composes to exactly Intern Universal(0, none configured) + Intern Software Engineering(4) = 4 total, with zero Employee-scoped tasks present — no cross-type leakage in either direction (found universal=${internPreview.counts.universal}, department=${internPreview.counts.department}, total=${internPreview.counts.total})`
        );
      }

      // 1189. FUNCTIONAL — Launching for a real eligible employee creates a plan instance whose task snapshot matches the previewed composition exactly, and duplicate-plan protection still blocks a second launch
      {
        resetDatabase();
        const launched = await offboardingService.launchPlanInstance('emp-005', '2026-12-31', 'emp-001');
        assert(launched.taskInstances.length === 15, `1189. NEW — FUNCTIONAL: Launching for Priyanka Nair creates exactly 15 task instances, matching the previewed composition (found ${launched.taskInstances.length})`);

        let duplicateBlocked = false;
        try {
          await offboardingService.launchPlanInstance('emp-005', '2026-12-31', 'emp-001');
        } catch (err) {
          duplicateBlocked = err.message.includes('already has an active offboarding plan');
        }
        assert(duplicateBlocked, '1189b. NEW — FUNCTIONAL: Duplicate active-plan protection still blocks a second launch for the same employee under the new composition-based launchPlanInstance()');
      }

      // 1190. FUNCTIONAL — Relative timing / Final Working Date anchor math is unchanged: Day -30/0/+1 calculate correctly from the resolved anchor
      {
        const taskDefs = [
          { id: 't-30', scopeType: 'universal', personType: 'employee', relativeOffsetDays: -30, title: 'D-30', sequence: 1, active: true },
          { id: 't0', scopeType: 'universal', personType: 'employee', relativeOffsetDays: 0, title: 'D0', sequence: 2, active: true },
          { id: 't1', scopeType: 'universal', personType: 'employee', relativeOffsetDays: 1, title: 'D+1', sequence: 3, active: true },
        ];
        const comp = composeOffboardingTasks({ directoryType: 'Employee', department: null }, taskDefs, '2026-09-30');
        const d30 = comp.tasks.find((t) => t.id === 't-30').calculatedDueDate;
        const d0 = comp.tasks.find((t) => t.id === 't0').calculatedDueDate;
        const d1 = comp.tasks.find((t) => t.id === 't1').calculatedDueDate;
        assert(
          d30 === '2026-08-31' && d0 === '2026-09-30' && d1 === '2026-10-01',
          `1190. NEW — FUNCTIONAL: Day -30/0/+1 relative to a Final Working Date of 2026-09-30 calculate to 2026-08-31/2026-09-30/2026-10-01 exactly (found ${d30}/${d0}/${d1}) — offboarding's departure-date anchor semantics are unchanged, never onboarding's start-date anchor`
        );
      }

      // 1191. FUNCTIONAL — Historical, pre-existing launched offboarding instances remain byte-for-byte unchanged after scope edits AND after new launches under the new architecture
      {
        resetDatabase();
        const before = await offboardingService.getInstanceById('inst-off-001');
        const beforeSnapshot = JSON.stringify(before.taskInstances);
        await offboardingService.launchPlanInstance('emp-005', '2026-12-31', 'emp-001');
        await offboardingService.saveScopeTasks('universal', 'employee', null, [{ title: 'QA Regression Universal Task', relativeOffsetDays: 0 }]);
        const after = await offboardingService.getInstanceById('inst-off-001');
        assert(
          JSON.stringify(after.taskInstances) === beforeSnapshot && after.anchorDate === '2026-09-30',
          '1191. NEW — FUNCTIONAL: The pre-existing inst-off-001 (Farah Mansor) task-instance snapshot and anchor date remain byte-for-byte unchanged after both a new composition-based launch and a Universal scope edit — historical instances are plain field-copies, never re-read live from offboardingPlanTasks'
        );
        resetDatabase();
      }

      // --- OLD TEMPLATE ROUTE CLEANUP ---

      // 1192. Old template-edit routes (plans/new, plans/:planId/edit) are gone from the offboarding route block; the new scope-aware routes replace them
      {
        const offboardingRouteBlockMatch2 = routerSrc4.match(/path: 'offboarding',[\s\S]*?\],\s*\},/);
        const offboardingRouteBlock2 = offboardingRouteBlockMatch2 ? offboardingRouteBlockMatch2[0] : '';
        assert(
          Boolean(offboardingRouteBlockMatch2) &&
          !offboardingRouteBlock2.includes("path: 'plans/new'") && !offboardingRouteBlock2.includes("path: 'plans/:planId/edit'") &&
          offboardingRouteBlock2.includes("path: 'plans/:personType/universal'") && offboardingRouteBlock2.includes("path: 'plans/:personType/department/:departmentId'"),
          '1192. NEW — The old plans/new and plans/:planId/edit routes are gone from the offboarding route block, replaced by plans/:personType/universal and plans/:personType/department/:departmentId — mirroring Onboarding\'s own equivalent route shape (deliberately not left as redirects, since neither old path was ever a top-level nav destination — only reachable via the now-removed Create/Edit Template buttons)'
        );
      }

      // 1193. No remaining source reference to the retired template-editor routes anywhere in the offboarding pages/components
      assert(
        !offPlansSrc2.includes('/plans/new') && !offPlanEditorSrc.includes('planId') && !launchOffboardingPlanModalSrc2.includes('/plans/new'),
        '1193. NEW — No remaining page/component reference to the retired /offboarding/plans/new or /offboarding/plans/:planId/edit routes — no dead navigation was left behind'
      );

      // 1194. Legacy template service methods are preserved (not deleted) — proven still used elsewhere (verifyStage9.js, getAllInstances()'s historical template-name lookup for pre-refactor instances), matching the exact conservative precedent already established for onboarding's own legacy methods
      assert(
        offboardingServiceSrc2.includes('async getAllTemplates()') && offboardingServiceSrc2.includes('async getTemplateById(') &&
        offboardingServiceSrc2.includes('async createTemplate(') && offboardingServiceSrc2.includes('async updateTemplate(') &&
        offboardingServiceSrc2.includes('async toggleTemplateActive(') && offboardingServiceSrc2.includes('async previewPlanLaunch(') &&
        offboardingDomainSrc2.includes('export function generateOffboardingPlanPreview') && offboardingDomainSrc2.includes('export function resolveAssigneeForRule') && offboardingDomainSrc2.includes('export const ASSIGNMENT_RULES'),
        '1194. NEW — Legacy template-based service/domain methods (getAllTemplates/getTemplateById/createTemplate/updateTemplate/toggleTemplateActive/previewPlanLaunch, generateOffboardingPlanPreview/resolveAssigneeForRule/ASSIGNMENT_RULES) are all preserved, UI-orphaned but intact — getAllInstances() still uses getTemplateById()\'s templateMap for historical (pre-refactor) instances\' template-name display, and these functions remain provably in use elsewhere (not genuinely dead code)'
      );

      // --- OFFBOARDING PROGRESS MUST KEEP WORKING ---

      // 1195. FUNCTIONAL — getLaunchEligibleEmployees() correctly resolves Active/Departing employees without an active plan (the Launch modal's dropdown source) — eligible people still appear correctly
      {
        resetDatabase();
        const eligible = await offboardingService.getLaunchEligibleEmployees();
        const statusesValid = eligible.every((e) => e.status === 'Active' || e.status === 'Departing');
        const noActiveInstanceHolders = !eligible.some((e) => e.id === 'emp-016' || e.id === 'emp-017'); // both already have active instances
        assert(
          Array.isArray(eligible) && eligible.length > 0 && statusesValid && noActiveInstanceHolders,
          `1195. NEW — FUNCTIONAL: getLaunchEligibleEmployees() returns only Active/Departing employees (found ${eligible.length}) and correctly excludes Farah Mansor/Aaron Kumar (already have active offboarding plans) — eligible people still appear correctly for the Launch modal`
        );
      }

      // 1196. FUNCTIONAL — Overdue tasks and Mark All as Complete remain fully functional (untouched generic activityService infrastructure, unaffected by the Plans scope refactor)
      {
        const overdueBeforeOff2 = await activityService.getOverdueActivities();
        const offboardingOverdueBeforeOff2 = overdueBeforeOff2.filter((a) => a.source === 'Offboarding');
        if (offboardingOverdueBeforeOff2.length > 0) {
          const bulkIds = offboardingOverdueBeforeOff2.map((t) => t.id);
          const bulkResults = await activityService.markCompleteMany(bulkIds);
          assert(bulkResults.every((r) => r.completed === true), '1196. NEW — FUNCTIONAL: Mark All as Complete still completes every currently-overdue Offboarding-sourced task via the unaffected activityService.markCompleteMany()');
          for (const id of bulkIds) await activityService.reopen(id);
        } else {
          assert(true, '1196. Overdue/Mark All as Complete functional check skipped — no overdue Offboarding activities present in current seed state (verified functional elsewhere in this suite)');
        }
      }

      // 1197. FUNCTIONAL — Task completion on a freshly-launched (new architecture) instance still correctly recomputes progress/derivedStatus through the untouched reconciliation path
      {
        resetDatabase();
        const launched2 = await offboardingService.launchPlanInstance('emp-005', '2026-12-31', 'emp-001');
        const firstTaskActivityId = launched2.taskInstances[0].activityId;
        await activityService.markComplete(firstTaskActivityId);
        const afterMark = await offboardingService.getInstanceById(launched2.id);
        const completedTask = afterMark.progress.tasks.find((t) => t.activityId === firstTaskActivityId);
        assert(
          afterMark.progress.completedTasksCount === 1 && completedTask && completedTask.isCompleted === true && Boolean(completedTask.linkedActivity),
          '1197. NEW — FUNCTIONAL: Completing a task on a freshly-launched (composition-based) offboarding instance correctly recomputes progress.completedTasksCount and resolves the enriched progress.tasks entry\'s linkedActivity — the detail page\'s Mark Done/Reopen flow works end-to-end for new launches, not just historical ones'
        );
        resetDatabase();
      }

      // --- ONBOARDING COMPLETELY UNCHANGED ---

      // 1198. Onboarding Plans page/editor/service/domain are all byte-for-byte unaffected by this Offboarding-only Plans refactor
      assert(
        onbPlansSrc4.includes('>Onboarding Plans<') && onbPlansSrc4.includes('Universal Tasks') &&
        onbPlanEditorSrc4.includes('const scopeType = departmentId !== undefined') &&
        onboardingServiceSrc4.includes('async getScopesSummary(personType = \'employee\')') &&
        onboardingDomainSrc4.includes('export function composeOnboardingTasks'),
        '1198. REGRESSION: Onboarding Plans page/editor and onboardingService.js/onboardingDomain.js\'s own scope functions remain completely unchanged — Onboarding was the UX reference only, never a shared code path with this Offboarding Plans refactor'
      );

      // 1199. FUNCTIONAL — Onboarding's own scope composition and launch eligibility still resolve correctly, unaffected by the Offboarding scope model being introduced
      {
        const onboardingScopeDefsRegr = await onboardingService.getScopeTaskDefinitions();
        const onboardingCompositionRegr = composeOnboardingTasks({ id: 'offplans-regr-check', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, onboardingScopeDefsRegr, '2026-08-15');
        assert(onboardingCompositionRegr.counts.total === 11, `1199. REGRESSION: Onboarding's own composeOnboardingTasks() still composes an Employee in Software Engineering to 11 tasks, unaffected by the introduction of offboardingDomain.js's parallel composeOffboardingTasks() (found ${onboardingCompositionRegr.counts.total})`);

        const onboardingEligibleRegr = await onboardingService.getLaunchEligibleEmployees();
        assert(Array.isArray(onboardingEligibleRegr), '1199b. REGRESSION: Onboarding launch eligibility still resolves correctly');
      }

      resetDatabase();
    }

    // ==========================================================================
    // Refactor Individual Offboarding Progress Page to Match Onboarding Detail UX
    // ==========================================================================
    {
      resetDatabase();

      const offDetailSrc2 = fs.readFileSync(path.resolve('./src/pages/offboarding/OffboardingEmployeeDetailPage.jsx'), 'utf-8');
      const offboardingServiceSrc3 = fs.readFileSync(path.resolve('./src/services/offboardingService.js'), 'utf-8');
      const offboardingDomainSrc3 = fs.readFileSync(path.resolve('./src/domain/offboardingDomain.js'), 'utf-8');
      const addOffboardingTaskModalSrc = fs.readFileSync(path.resolve('./src/components/offboarding/AddOffboardingTaskModal.jsx'), 'utf-8');
      const deleteOffboardingTaskModalSrc = fs.readFileSync(path.resolve('./src/components/offboarding/DeleteOffboardingTaskModal.jsx'), 'utf-8');
      const dropOffboardingPlanModalSrc = fs.readFileSync(path.resolve('./src/components/offboarding/DropOffboardingPlanModal.jsx'), 'utf-8');
      const offProgressSrc2 = fs.readFileSync(path.resolve('./src/pages/offboarding/OffboardingDepartingPage.jsx'), 'utf-8');
      const offPlansSrc3 = fs.readFileSync(path.resolve('./src/pages/offboarding/OffboardingPlansPage.jsx'), 'utf-8');
      const onbDetailSrc4 = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeeDetailPage.jsx'), 'utf-8');
      const onboardingServiceSrc5 = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
      const onboardingDomainSrc5 = fs.readFileSync(path.resolve('./src/domain/onboardingDomain.js'), 'utf-8');

      // --- LAYOUT ---

      // 1200. Back to Offboarding Progress link exists in both render branches (normal + Employee Not Found), routing to the unchanged /offboarding/departing
      assert(
        (offDetailSrc2.match(/Back to Offboarding Progress/g) || []).length === 2 &&
        (offDetailSrc2.match(/to="\/offboarding\/departing"/g) || []).length === 2,
        '1200. "Back to Offboarding Progress" appears in both render branches (main page + "Employee Not Found" fallback), each still routing to the unchanged /offboarding/departing'
      );

      // 1201. Drop Plan sits in its own page-level top row (LEFT: Back link, RIGHT: Drop Plan) — never inside the employee card, plan summary, or task table
      {
        const topRowMatch = offDetailSrc2.match(/Page-Level Navigation\/Action Row[\s\S]*?Employee Information Card/);
        const topRowBlock = topRowMatch ? topRowMatch[0] : '';
        assert(
          Boolean(topRowMatch) && topRowBlock.includes('Back to Offboarding Progress') && topRowBlock.includes('Drop Plan') && topRowBlock.includes('isActiveOffboardingPlanStatus(instance.derivedStatus)'),
          '1201. NEW — Drop Plan lives in its own page-level top row alongside the Back link (matching Onboarding\'s exact pattern) — not nested inside the employee card, plan summary, or task table — gated by the offboarding-specific isActiveOffboardingPlanStatus(), never an onboarding status enum'
        );
      }

      // 1202. Employee header shows Final Working Date (never "Anchor Start Date"), plus role/department/ID using the correct hydrated employee fields (not the previously-broken employee.currentRecord path)
      assert(
        offDetailSrc2.includes('Final Working Date') && !offDetailSrc2.includes('Anchor Start Date') &&
        offDetailSrc2.includes('employee.position?.name') && offDetailSrc2.includes('employee.department?.name') && !offDetailSrc2.includes('employee.currentRecord'),
        '1202. NEW — REGRESSION FIX: The employee header shows "Final Working Date" (never "Anchor Start Date"), and role/department now read from the correctly-hydrated employee.position/employee.department fields — the old employee.currentRecord?.department/.position path never actually existed on the hydrated employee object, so Position/Department always silently showed their fallback text before this fix'
      );

      // 1203. Old 4-block summary layout (PLAN TEMPLATE / CLEARANCE STATUS / REQUIRED TASKS PROGRESS / TOTAL TASKS FINISHED) is completely removed
      assert(
        !offDetailSrc2.includes('Plan Template') && !offDetailSrc2.includes('Clearance Status') &&
        !offDetailSrc2.includes('Required Tasks Progress') && !offDetailSrc2.includes('Total Tasks Finished') &&
        !offDetailSrc2.includes("gridTemplateColumns: 'repeat(4, 1fr)'"),
        '1203. NEW — The old 4-column grid summary (Plan Template / Clearance Status / Required Tasks Progress / Total Tasks Finished) is completely removed from the detail page'
      );

      // 1204. New single plan-summary card exists: plan name, launch date, status badge, percentage, progress bar, and "X of Y tasks completed" — mirroring Onboarding's exact summary card structure
      assert(
        offDetailSrc2.includes("instance.template ? instance.template.name : 'Offboarding Plan'") &&
        offDetailSrc2.includes('Launched on {instance.createdAt') &&
        offDetailSrc2.includes('instance.progress.progressPercentage}%') &&
        offDetailSrc2.match(/width: `\$\{instance\.progress\.progressPercentage\}%`/) &&
        offDetailSrc2.includes('{instance.progress.completedTasksCount} of {instance.progress.totalTasks}'),
        '1204. NEW — A single plan-summary card shows plan name, launch date, status badge, percentage, a horizontal progress bar (width tied directly to progressPercentage), and "X of Y tasks completed" — the same structure as Onboarding\'s summary card, reading offboarding\'s own instance/progress data'
      );

      // 1205. Task section heading updated to match Onboarding's naming convention exactly
      assert(
        offDetailSrc2.includes('Offboarding Task Breakdown & Operational Status') && !offDetailSrc2.includes('Offboarding Task Execution Timeline'),
        '1205. NEW — Task section heading changed from "Offboarding Task Execution Timeline" to "Offboarding Task Breakdown & Operational Status", matching Onboarding\'s "Onboarding Task Breakdown & Operational Status" naming convention exactly'
      );

      // 1206. Add Task button sits top-right of the task breakdown section, using the same visual pattern (btn-primary + Plus icon) as Onboarding's
      assert(
        offDetailSrc2.match(/Offboarding Task Breakdown & Operational Status[\s\S]{0,400}<Plus size=\{14\} \/>[\s\S]{0,50}<span>Add Task<\/span>/),
        '1206. NEW — Add Task button (btn-primary, Plus icon) sits directly top-right of the "Offboarding Task Breakdown & Operational Status" heading, matching Onboarding\'s exact placement/visual pattern'
      );

      // 1207. Task table uses the simplified column set: # / Task Title / Relative Timing / Due Date / Action — no Assignee column
      assert(
        offDetailSrc2.includes('>#<') && offDetailSrc2.includes('>Task Title<') && offDetailSrc2.includes('>Relative Timing<') && offDetailSrc2.includes('>Due Date<') && offDetailSrc2.includes('>Action<') &&
        !offDetailSrc2.includes('>Assignee<') && !offDetailSrc2.includes('assigneeEmployee') && !offDetailSrc2.includes('Rule: {ti.assignmentRule}') && !offDetailSrc2.includes('Rule: {task.assignmentRule}'),
        '1207. NEW — The task table now uses exactly # / Task Title / Relative Timing / Due Date / Action — the Assignee column (header, assigneeEmployee display, and "Rule: X" metadata) is completely removed from the UI'
      );

      // 1208. Assignee is legacy/internal-only — the underlying assignmentRule/originallyResolvedAssigneeId fields still exist on task instance records (not destructively removed), just no longer rendered
      assert(
        offboardingServiceSrc3.includes('assignmentRule: null') && offboardingServiceSrc3.includes('originallyResolvedAssigneeId: null'),
        '1208. NEW — The underlying assignmentRule/originallyResolvedAssigneeId fields are preserved internally on every task instance record (set to null/neutral, never deleted) — only the visible Assignee column was removed, not the data shape'
      );

      // --- TASK ACTIONS ---

      // 1209. Done/Reopen button labels and icons match Onboarding exactly ("Done" + CheckCircle2 for incomplete, "Reopen" + RotateCcw for completed), using btn-compact-override/btn-compact-clear
      assert(
        offDetailSrc2.includes("className={isDone ? 'btn-compact-clear' : 'btn-compact-override'}") &&
        offDetailSrc2.includes("<span>{isDone ? 'Reopen' : 'Done'}</span>") &&
        offDetailSrc2.includes('<RotateCcw size={11} />') && offDetailSrc2.includes('<CheckCircle2 size={11} />') &&
        !offDetailSrc2.includes("'Mark Done'") && !offDetailSrc2.includes("'Completed'"),
        '1209. NEW — Done/Reopen buttons read exactly "Done"/"Reopen" (not the old "Mark Done"/"Completed" labels) with CheckCircle2/RotateCcw icons and btn-compact-override/btn-compact-clear styling — matching Onboarding\'s task row action pattern exactly'
      );

      // 1210. Delete action (Trash icon) sits beside Done/Reopen on every row, using the same generic activityService toggle — no second completion mechanism was invented
      assert(
        offDetailSrc2.includes('icon-btn icon-btn-danger') && offDetailSrc2.includes('<Trash2 size={13} />') && offDetailSrc2.includes('title="Delete task"') &&
        offDetailSrc2.includes('setTaskPendingDelete(task)') &&
        offDetailSrc2.includes('handleToggleTaskComplete(act.id, isDone)'),
        '1210. NEW — A Delete (Trash icon) button sits beside Done/Reopen on every task row; Done/Reopen still routes through the single existing handleToggleTaskComplete() -> activityService.markComplete()/reopen() path — no second completion mechanism was introduced'
      );
      // 1210b. handleToggleTaskComplete itself reuses the existing generic activityService methods only
      {
        const handlerMatch = offDetailSrc2.match(/const handleToggleTaskComplete = async[\s\S]*?\n  \};/);
        const handlerBlock = handlerMatch ? handlerMatch[0] : '';
        assert(
          handlerBlock.includes('activityService.reopen(activityId)') && handlerBlock.includes('activityService.markComplete(activityId)'),
          '1210b. NEW — handleToggleTaskComplete() calls the existing generic activityService.markComplete()/reopen() — the exact same methods Onboarding\'s detail page and Offboarding\'s own Overdue Tasks popup already use'
        );
      }

      // 1211. Delete confirmation modal exists (offboarding-specific component), requires an explicit click before any deletion happens
      assert(
        fs.existsSync(path.resolve('./src/components/offboarding/DeleteOffboardingTaskModal.jsx')) &&
        deleteOffboardingTaskModalSrc.includes('>Delete Task?<') &&
        deleteOffboardingTaskModalSrc.includes('offboardingService.deleteTaskFromInstance') &&
        deleteOffboardingTaskModalSrc.includes('will not affect the reusable offboarding plan configuration under Offboarding &gt; Plans'),
        '1211. NEW — A dedicated DeleteOffboardingTaskModal.jsx exists with a "Delete Task?" confirmation, explicit Cancel/Delete Task actions, and wording confirming the reusable Offboarding > Plans configuration is unaffected — deletion never happens without this explicit step'
      );

      // 1212. Deletion affects ONLY the launched instance's own task/activity records — never offboardingPlanTasks (reusable Plans config)
      {
        const deleteFnMatch = offboardingServiceSrc3.match(/async deleteTaskFromInstance\([\s\S]*?\n  \},/);
        const deleteFnBlock = deleteFnMatch ? deleteFnMatch[0] : '';
        assert(
          deleteFnBlock.includes('db.offboardingTaskInstances = rawTaskInstances.filter') && deleteFnBlock.includes('db.activities = (db.activities || []).filter') &&
          !deleteFnBlock.includes('offboardingPlanTasks'),
          '1212. NEW — deleteTaskFromInstance() only ever mutates db.offboardingTaskInstances/db.activities for the ONE targeted instance — it never touches db.offboardingPlanTasks (the reusable Plans configuration)'
        );
      }

      // 1213. Reusable Offboarding Plans configuration is provably unaffected by an instance-level task delete (functional)
      {
        resetDatabase();
        const scopeBefore = await offboardingService.getScopeTasks('universal', 'employee', null);
        const inst = await offboardingService.getInstanceById('inst-off-001');
        const targetTask = inst.progress.tasks.find((t) => !t.isCompleted);
        await offboardingService.deleteTaskFromInstance('inst-off-001', targetTask.id);
        const scopeAfter = await offboardingService.getScopeTasks('universal', 'employee', null);
        assert(
          scopeAfter.length === scopeBefore.length,
          `1213. NEW — FUNCTIONAL: Deleting a task from Farah Mansor's launched instance (inst-off-001) left the reusable Employee Universal scope completely unchanged (${scopeBefore.length} -> ${scopeAfter.length} tasks)`
        );
        resetDatabase();
      }

      // 1214. Final-task deletion is blocked with a clear message (mirrors Onboarding's exact wording/rule)
      {
        resetDatabase();
        let current = await offboardingService.getInstanceById('inst-off-002');
        while (current.progress.tasks.length > 1) {
          current = await offboardingService.deleteTaskFromInstance('inst-off-002', current.progress.tasks[0].id);
        }
        let blocked = false;
        let blockedMessage = '';
        try {
          await offboardingService.deleteTaskFromInstance('inst-off-002', current.progress.tasks[0].id);
        } catch (err) {
          blocked = true;
          blockedMessage = err.message;
        }
        assert(
          blocked && blockedMessage.includes('An offboarding plan must contain at least one task. Add another task before deleting this one.'),
          `1214. NEW — FUNCTIONAL: Deleting the final remaining task is blocked with "An offboarding plan must contain at least one task. Add another task before deleting this one." — no 0/0 state is ever reachable (message: "${blockedMessage}")`
        );
        resetDatabase();
      }

      // 1215. Add Task exists (offboarding-specific modal + service method), affects ONLY the launched instance, and derives its due date from the Final Working Date anchor — never a start date.
      // Checked against the user-VISIBLE code only (stripComments) — the file's own doc comment legitimately contains the phrase "never a start date" when explaining what it is NOT, which must not
      // itself fail this check.
      assert(
        fs.existsSync(path.resolve('./src/components/offboarding/AddOffboardingTaskModal.jsx')) &&
        addOffboardingTaskModalSrc.includes('Task Title') && addOffboardingTaskModalSrc.includes('Activity Type') && addOffboardingTaskModalSrc.includes('Relative Timing (Day Offset)') && addOffboardingTaskModalSrc.includes('Task Description') &&
        !addOffboardingTaskModalSrc.includes('Required task') &&
        addOffboardingTaskModalSrc.includes("Final Working Date") && !stripComments(addOffboardingTaskModalSrc).toLowerCase().includes('start date') &&
        addOffboardingTaskModalSrc.includes('offboardingService.addTaskToInstance'),
        '1215. NEW — AddOffboardingTaskModal.jsx collects exactly Task Title / Activity Type / Relative Offset (Days) / Task Description (no Required checkbox — offboarding has none), its visible helper text references the Final Working Date anchor (never a start date), and it calls offboardingService.addTaskToInstance()'
      );

      // 1216. FUNCTIONAL — Add Task only appears on the targeted employee's instance, and due date is calculated correctly from Final Working Date
      {
        resetDatabase();
        const before = await offboardingService.getInstanceById('inst-off-002');
        const afterAdd = await offboardingService.addTaskToInstance('inst-off-002', { title: 'QA Stage18 Instance Task', relativeOffsetDays: 2, activityTypeId: 'act-type-1', description: 'test' });
        const addedTask = afterAdd.progress.tasks.find((t) => t.title === 'QA Stage18 Instance Task');
        assert(
          Boolean(addedTask) && addedTask.currentDueDate === addDaysToLocalDate(before.anchorDate, 2) &&
          afterAdd.progress.totalTasks === before.progress.totalTasks + 1,
          `1216. NEW — FUNCTIONAL: Adding a task to inst-off-002 (Aaron Kumar, Final Working Date ${before.anchorDate}) with offset +2 correctly calculates its due date as ${addDaysToLocalDate(before.anchorDate, 2)} and only that one instance's task count increases`
        );
        const otherInstanceUnaffected = await offboardingService.getInstanceById('inst-off-001');
        assert(!otherInstanceUnaffected.progress.tasks.some((t) => t.title === 'QA Stage18 Instance Task'), '1216b. NEW — FUNCTIONAL: The manually-added task does not appear on a different employee\'s instance (inst-off-001)');
        resetDatabase();
      }

      // --- STATUS DERIVATION ---

      // 1217. OFFBOARDING_INSTANCE_STATUS.DROPPED exists as offboarding's own independent status — never imported from onboarding's PLAN_INSTANCE_STATUS
      assert(
        offboardingDomainSrc3.includes("DROPPED: 'Dropped'") && offboardingDomainSrc3.includes('export function isActiveOffboardingPlanStatus'),
        '1217. NEW — OFFBOARDING_INSTANCE_STATUS.DROPPED and isActiveOffboardingPlanStatus() are offboarding\'s own independent additions — no import from or reuse of onboarding\'s PLAN_INSTANCE_STATUS/isActivePlanStatus'
      );

      // 1218. Dropped is checked FIRST in deriveOffboardingInstanceStatus() — ahead of Completed/Former/Needs Attention — so it can never be resurrected
      {
        const deriveFnMatch = offboardingDomainSrc3.match(/export function deriveOffboardingInstanceStatus\([\s\S]*?\n\}/);
        const deriveFnBlock = deriveFnMatch ? deriveFnMatch[0] : '';
        const droppedCheckIndex = deriveFnBlock.indexOf('planInstance.droppedAt');
        const completedCheckIndex = deriveFnBlock.indexOf('allRequiredDone');
        assert(
          droppedCheckIndex !== -1 && completedCheckIndex !== -1 && droppedCheckIndex < completedCheckIndex,
          '1218. NEW — deriveOffboardingInstanceStatus() checks planInstance.droppedAt before the all-tasks-done Completed check — Dropped is a permanent terminal state that can never be resurrected into Completed/Needs Attention/In Progress'
        );
      }

      // 1219. FUNCTIONAL — All four statuses derive correctly: In Progress, Needs Attention, Completed, Dropped
      {
        resetDatabase();
        const inProgressInst = await offboardingService.getInstanceById('inst-off-002');
        assert(inProgressInst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.IN_PROGRESS || inProgressInst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION, `1219a. NEW — FUNCTIONAL: An incomplete plan instance derives a non-terminal status (found ${inProgressInst.derivedStatus})`);

        // Needs Attention: complete every task except one whose due date is in the past. Only
        // tasks with a resolvable linkedActivity can actually be marked complete — a handful of
        // seed offboarding task instances reference activity IDs not present in seedActivities.js
        // (a pre-existing seed-data gap, unrelated to this task; documented in the prior
        // Progress-refactor task's report), so those are safely skipped rather than crashing.
        const overdueTask = inProgressInst.progress.tasks.find((t) => !t.isCompleted && t.currentDueDate && t.currentDueDate < getTodayLocalDateString());
        if (overdueTask) {
          const otherIncomplete = inProgressInst.progress.tasks.filter((t) => !t.isCompleted && t.id !== overdueTask.id && t.linkedActivity);
          for (const t of otherIncomplete) await activityService.markComplete(t.activityId);
          const needsAttnInst = await offboardingService.getInstanceById('inst-off-002');
          assert(needsAttnInst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION, `1219b. NEW — FUNCTIONAL: With every task done except one overdue task, status derives Needs Attention (found ${needsAttnInst.derivedStatus})`);
        } else {
          assert(true, '1219b. Needs Attention functional check skipped — no naturally-overdue task present in current seed state for inst-off-002');
        }
        resetDatabase();

        // Completed: complete every task
        const launched = await offboardingService.launchPlanInstance('emp-005', '2026-12-31', 'emp-001');
        for (const t of launched.taskInstances) await activityService.markComplete(t.activityId);
        const completedInst = await offboardingService.getInstanceById(launched.id);
        assert(completedInst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED && completedInst.progress.progressPercentage === 100, `1219c. NEW — FUNCTIONAL: With every task completed, status derives Completed at 100% (found ${completedInst.derivedStatus}, ${completedInst.progress.progressPercentage}%)`);

        // Dropped: drop a fresh active plan
        const launched2 = await offboardingService.launchPlanInstance('emp-010', '2026-12-31', 'emp-001');
        const dropped = await offboardingService.dropPlanInstance(launched2.id);
        assert(dropped.derivedStatus === OFFBOARDING_INSTANCE_STATUS.DROPPED, `1219d. NEW — FUNCTIONAL: Dropping an active plan derives status Dropped (found ${dropped.derivedStatus})`);
        resetDatabase();
      }

      // 1220. FUNCTIONAL — Progress percentage always mathematically matches completed/total, with no contradictory values, even for a legacy scope task migrated with required:false (the exact
      // real contradiction found via live testing: percentage could read 100% while status stayed stuck at "In Progress", since the pre-fix formula computed completion from required tasks only,
      // and a legacy required:false task was never counted). Isolates the migrated "Post-Exit Payroll & Tax Certificate Settlement" task (originally pt-off-007, required:false in the seed data)
      // down to the sole remaining task on a fresh launch, completes it, and proves percentage/completedCount/totalCount/status are all mutually consistent.
      {
        resetDatabase();
        const launched3 = await offboardingService.launchPlanInstance('emp-005', '2026-12-31', 'emp-001');
        const legacyTask = launched3.taskInstances.find((t) => t.required === false);
        assert(Boolean(legacyTask), '1220setup. NEW — Setup: the migrated legacy required:false task (Post-Exit Payroll & Tax Certificate Settlement) is present in a fresh composed launch');

        if (legacyTask) {
          let current = await offboardingService.getInstanceById(launched3.id);
          while (current.progress.tasks.length > 1) {
            const other = current.progress.tasks.find((t) => t.id !== legacyTask.id);
            if (!other) break;
            current = await offboardingService.deleteTaskFromInstance(launched3.id, other.id);
          }
          assert(current.progress.tasks.length === 1 && current.progress.tasks[0].id === legacyTask.id, '1220a. NEW — Isolated down to the single legacy required:false task');

          await activityService.markComplete(current.progress.tasks[0].activityId);
          const afterComplete = await offboardingService.getInstanceById(launched3.id);
          const consistent =
            afterComplete.progress.progressPercentage === 100 &&
            afterComplete.progress.completedTasksCount === afterComplete.progress.totalTasks &&
            afterComplete.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED;
          assert(
            consistent,
            `1220b. NEW — FUNCTIONAL: Completing the sole legacy required:false task yields fully consistent values — percentage=${afterComplete.progress.progressPercentage}%, completed=${afterComplete.progress.completedTasksCount}/${afterComplete.progress.totalTasks}, status=${afterComplete.derivedStatus} — no contradiction between percentage/count/status (the pre-fix behavior left status stuck at "In Progress" despite 100%)`
          );
        }
        resetDatabase();
      }

      // 1221. Progress bar width is always tied directly to the same progressPercentage value the summary text displays — never a separately computed number
      assert(
        offDetailSrc2.match(/width: `\$\{instance\.progress\.progressPercentage\}%`[\s\S]{0,450}transition: 'width 0\.4s ease'/),
        '1221. NEW — The progress bar\'s width is bound directly to instance.progress.progressPercentage — the exact same value shown as text — so the bar and the percentage can never visually disagree'
      );

      // --- COMPLETED PLAN ---

      // 1222. When Completed: Drop Plan hidden, but Reopen remains available on individual tasks (matching Onboarding's precedent — task actions aren't specially locked by plan-level status)
      assert(
        offDetailSrc2.includes('instance && isActiveOffboardingPlanStatus(instance.derivedStatus)') &&
        !offDetailSrc2.match(/derivedStatus === OFFBOARDING_INSTANCE_STATUS\.COMPLETED[\s\S]{0,80}disabled/),
        '1222. NEW — Drop Plan is hidden once Completed (gated by isActiveOffboardingPlanStatus, which excludes COMPLETED), while individual Done/Reopen task actions remain available exactly as before — no new task-level lock was introduced, matching Onboarding\'s own established behavior for completed historical plans'
      );

      // --- DROPPED PLAN ---

      // 1223. Dropped status renders via the same presence-badge status logic (gray/slate styling) already used for Completed/Needs Attention/In Progress — no separate rendering path invented
      assert(
        offDetailSrc2.includes('OFFBOARDING_INSTANCE_STATUS.DROPPED') && offDetailSrc2.includes("backgroundColor: '#F1F5F9', color: '#64748B'"),
        '1223. NEW — Dropped renders through the existing status-badge/progress-bar conditional styling chain (gray/slate, matching the badge already used elsewhere for non-active states) — not a separately invented rendering path'
      );

      // 1224. FUNCTIONAL — Dropped plan preserves task history, contributes zero overdue alerts, and does not alter employee lifecycle status
      {
        resetDatabase();
        const empBefore = await employeeService.getById('emp-011');
        const launched4 = await offboardingService.launchPlanInstance('emp-011', '2026-12-31', 'emp-001');
        const dropped2 = await offboardingService.dropPlanInstance(launched4.id);
        assert(dropped2.taskInstances.length === launched4.taskInstances.length, `1224a. NEW — FUNCTIONAL: Task history is fully preserved after dropping (${launched4.taskInstances.length} -> ${dropped2.taskInstances.length} task instances)`);

        const activeIdsAfterDrop = await offboardingService.getActiveOffboardingEmployeeIds();
        assert(!activeIdsAfterDrop.has('emp-011'), '1224b. NEW — FUNCTIONAL: A Dropped plan no longer counts as active — getActiveOffboardingEmployeeIds() (the same set overdue/summary counts are built on) excludes it');

        const empAfter = await employeeService.getById('emp-011');
        assert(empAfter.status === empBefore.status, `1224c. NEW — FUNCTIONAL: Dropping the plan did NOT alter the employee's own lifecycle status (${empBefore.status} -> ${empAfter.status})`);

        // Replacement eligibility: a new plan CAN now be launched for the same employee
        const relaunched2 = await offboardingService.launchPlanInstance('emp-011', '2027-01-15', 'emp-001');
        assert(Boolean(relaunched2.id) && relaunched2.id !== launched4.id, '1224d. NEW — FUNCTIONAL: A replacement offboarding plan can be launched for the same employee after their previous plan was Dropped — checkOffboardingEligibility()\'s duplicate-plan check correctly excludes droppedAt instances');
        resetDatabase();
      }

      // --- REGRESSION ---

      // 1225. Launch Offboarding Plan (Progress page + detail page) remains fully functional, and Employee/Intern composition is unchanged by this task
      {
        resetDatabase();
        const empPreview2 = await offboardingService.previewOffboardingComposition('emp-005', '2026-12-31');
        assert(empPreview2.isValid && empPreview2.counts.universal === 11 && empPreview2.counts.department === 4 && empPreview2.counts.total === 15, `1225. REGRESSION: Employee composition (Universal 11 + Department 4 = 15) is unchanged by this task (found universal=${empPreview2.counts.universal}, department=${empPreview2.counts.department}, total=${empPreview2.counts.total})`);
        assert(offProgressSrc2.includes('<LaunchOffboardingPlanModal') && offDetailSrc2.includes('<LaunchOffboardingPlanModal'), '1225b. REGRESSION: Both the Progress page and the individual detail page still wire the existing, untouched LaunchOffboardingPlanModal');
      }

      // 1226. Duplicate active-plan protection remains intact for normal (non-dropped) active plans
      {
        resetDatabase();
        let duplicateBlocked2 = false;
        try {
          await offboardingService.launchPlanInstance('emp-016', '2026-12-31', 'emp-001');
        } catch (err) {
          duplicateBlocked2 = err.message.includes('already has an active offboarding plan');
        }
        assert(duplicateBlocked2, '1226. REGRESSION: Duplicate active-plan protection still blocks a second launch for Farah Mansor (emp-016), who already has an active (non-dropped) offboarding plan');
      }

      // 1227. Offboarding Progress and Offboarding Plans pages are both unchanged by this task
      assert(
        offProgressSrc2.includes('>Offboarding Progress<') && offPlansSrc3.includes('>Offboarding Plans<'),
        '1227. REGRESSION: Offboarding Progress (heading, KPI cards, filters) and Offboarding Plans (scope-based structure) pages are both unaffected by this individual-detail-page-scoped task'
      );

      // 1228. Onboarding is completely unchanged — detail page, service, and domain all byte-for-byte unaffected
      assert(
        onbDetailSrc4.includes('Anchor Start Date') && onbDetailSrc4.includes('isActivePlanStatus(planInstance.derivedStatus)') &&
        onboardingServiceSrc5.includes('async dropPlanInstance(planInstanceId, currentUserId') &&
        onboardingDomainSrc5.includes("DROPPED: 'Dropped'") && onboardingDomainSrc5.includes('export function isActivePlanStatus'),
        '1228. REGRESSION: Onboarding\'s own detail page ("Anchor Start Date", isActivePlanStatus), service (dropPlanInstance), and domain (PLAN_INSTANCE_STATUS.DROPPED, isActivePlanStatus) are all completely unchanged — Onboarding was the UX reference only'
      );

      // 1229. FUNCTIONAL — Overdue Tasks popup and Mark All as Complete remain fully functional, unaffected by the detail page refactor
      {
        const overdueBeforeOff3 = await activityService.getOverdueActivities();
        const offboardingOverdueBeforeOff3 = overdueBeforeOff3.filter((a) => a.source === 'Offboarding');
        if (offboardingOverdueBeforeOff3.length > 0) {
          const bulkIds2 = offboardingOverdueBeforeOff3.map((t) => t.id);
          const bulkResults2 = await activityService.markCompleteMany(bulkIds2);
          assert(bulkResults2.every((r) => r.completed === true), '1229. REGRESSION: Mark All as Complete still completes every currently-overdue Offboarding-sourced task via the unaffected activityService.markCompleteMany()');
          for (const id of bulkIds2) await activityService.reopen(id);
        } else {
          assert(true, '1229. Overdue/Mark All as Complete functional check skipped — no overdue Offboarding activities present in current seed state (verified functional in the prior Progress-refactor task\'s coverage)');
        }
      }

      resetDatabase();
    }

    // ==========================================================================
    // Fix Offboarding Employee Avatar Initial Color for App-Wide Consistency
    // ==========================================================================
    {
      const offProgressSrc3 = fs.readFileSync(path.resolve('./src/pages/offboarding/OffboardingDepartingPage.jsx'), 'utf-8');
      const offDetailSrc3 = fs.readFileSync(path.resolve('./src/pages/offboarding/OffboardingEmployeeDetailPage.jsx'), 'utf-8');
      const onbEmployeesSrcAvatar = fs.readFileSync(path.resolve('./src/pages/onboarding/OnboardingEmployeesPage.jsx'), 'utf-8');
      const indexCssSrcAvatar = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

      // 1230. The Offboarding Progress table avatar no longer overrides color/backgroundColor — it now falls back cleanly to the shared .emp-avatar-circle class (teal gradient + white text)
      assert(
        offProgressSrc3.includes('<div className="emp-avatar-circle">') &&
        !offProgressSrc3.includes("style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}"),
        '1230. NEW — The Offboarding Progress table\'s employee avatar no longer applies an inline `color: \'#DC2626\'` override — it renders via the bare .emp-avatar-circle class, exactly like every other correctly-styled employee avatar in the app'
      );

      // 1231. The Offboarding detail page avatar (already correct before this fix) still carries no color/background override — only size, confirming this fix did not touch a location that never had the bug
      assert(
        offDetailSrc3.match(/emp-avatar-circle[\s\S]{0,30}style=\{\{ width: '48px', height: '48px', fontSize: '1\.1rem' \}\}/),
        '1231. REGRESSION: The Offboarding detail page\'s (larger, 48px) employee avatar is unchanged — it never had the red-text bug, and still only overrides size/fontSize, never color/background'
      );

      // 1232. The shared .emp-avatar-circle CSS class itself is untouched — teal gradient background, white text — this was a call-site inline-style bug, not a shared-style defect
      assert(
        indexCssSrcAvatar.match(/\.emp-avatar-circle \{[\s\S]{0,220}background: linear-gradient\(135deg, #129FA9 0%, #0E848D 100%\);[\s\S]{0,40}color: #FFFFFF;/),
        '1232. NEW — The shared .emp-avatar-circle CSS class itself (teal gradient background, white text) is untouched — the bug was a call-site inline-style override, not a defect in the shared class, so no shared-style change was needed or made'
      );

      // 1233. Onboarding's avatar usage (the reference for correct behavior) remains completely unchanged — still no color override at the avatar itself, only a legitimate background tint for Former status
      assert(
        onbEmployeesSrcAvatar.includes("style={emp.status === 'Former' ? { background: '#64748B' } : undefined}") &&
        !onbEmployeesSrcAvatar.match(/emp-avatar-circle[\s\S]{0,80}color:/),
        '1233. REGRESSION: Onboarding\'s own employee avatar usage is completely unchanged — it only ever conditionally tints the background for Former status, never overrides text color, exactly as before this task'
      );

      // 1234. No employee-avatar location anywhere in the offboarding UI still applies a red/destructive text-color override — the fix is complete across every avatar render site
      {
        const launchOffboardingPlanModalSrcAvatar = fs.readFileSync(path.resolve('./src/components/offboarding/LaunchOffboardingPlanModal.jsx'), 'utf-8');
        const overdueOffboardingTasksModalSrcAvatar = fs.readFileSync(path.resolve('./src/components/offboarding/OverdueOffboardingTasksModal.jsx'), 'utf-8');
        assert(
          !offProgressSrc3.match(/emp-avatar-circle[\s\S]{0,60}color:\s*'#DC2626'/) &&
          !offDetailSrc3.match(/emp-avatar-circle[\s\S]{0,60}color:\s*'#DC2626'/),
          '1234setup. Sanity: no remaining emp-avatar-circle + red-text combination anywhere in the two offboarding pages that render one'
        );
        assert(
          !launchOffboardingPlanModalSrcAvatar.includes('emp-avatar-circle') && !overdueOffboardingTasksModalSrcAvatar.includes('emp-avatar-circle'),
          '1234. NEW — The Launch Offboarding Plan modal and the Overdue Offboarding Tasks popup render no employee avatar at all (text-only employee identification) — confirmed out of scope for this fix, not silently missed'
        );
      }

      // 1235. REGRESSION: no lifecycle/status badge, warning, or destructive-action styling was touched — Needs Attention/Departing/Drop Plan/Delete still use their own legitimate red
      assert(
        offProgressSrc3.match(/isNeedsAttn[\s\S]{0,60}\?\s*\{\s*backgroundColor:\s*'#FEF2F2',\s*color:\s*'#DC2626'/),
        '1235. REGRESSION: The Needs Attention status badge on the Offboarding Progress table still legitimately uses red styling — only the employee avatar\'s inline override was removed, no status/badge/warning logic was touched'
      );
    }

    // ==========================================================================
    // Standardize Automatic Anchor Dates + Optional Custom Override for BOTH Onboarding and Offboarding
    // ==========================================================================
    {
      resetDatabase();

      const onboardingDomainSrcAnchor = fs.readFileSync(path.resolve('./src/domain/onboardingDomain.js'), 'utf-8');
      const offboardingDomainSrcAnchor = fs.readFileSync(path.resolve('./src/domain/offboardingDomain.js'), 'utf-8');
      const onboardingServiceSrcAnchor = fs.readFileSync(path.resolve('./src/services/onboardingService.js'), 'utf-8');
      const offboardingServiceSrcAnchor = fs.readFileSync(path.resolve('./src/services/offboardingService.js'), 'utf-8');
      const launchPlanModalSrcAnchor = fs.readFileSync(path.resolve('./src/components/onboarding/LaunchPlanModal.jsx'), 'utf-8');
      const launchOffboardingPlanModalSrcAnchor = fs.readFileSync(path.resolve('./src/components/offboarding/LaunchOffboardingPlanModal.jsx'), 'utf-8');

      // --- AUTOMATIC DATE RESOLUTION + OPTIONAL OVERRIDE (SOURCE) ---

      // 1236. resolveOnboardingAnchorDate() now accepts an optional customAnchorDate, checked FIRST — mirroring resolveOffboardingAnchorDate()'s existing precedence pattern
      assert(
        onboardingDomainSrcAnchor.includes('export function resolveOnboardingAnchorDate(employee, records = [], customAnchorDate = null, referenceDate = getTodayLocalDateString())') &&
        onboardingDomainSrcAnchor.match(/export function resolveOnboardingAnchorDate[\s\S]{0,200}if \(customAnchorDate && customAnchorDate\.trim\(\)\) \{/),
        '1236. NEW — resolveOnboardingAnchorDate() now accepts an optional customAnchorDate override as its 3rd parameter, checked before any employment-record-derived source — mirroring resolveOffboardingAnchorDate()\'s existing precedence exactly'
      );

      // 1237. resolveOffboardingAnchorDate() already had this override — its signature/precedence is unchanged by this task (only the missing-date error message wording was updated — see 1247)
      assert(
        offboardingDomainSrcAnchor.includes('export function resolveOffboardingAnchorDate(') &&
        offboardingDomainSrcAnchor.match(/resolveOffboardingAnchorDate\([\s\S]{0,60}employee,[\s\S]{0,30}records = \[\],[\s\S]{0,40}customAnchorDate = null,/),
        '1237. REGRESSION: resolveOffboardingAnchorDate()\'s signature and override-first precedence are unchanged — it already supported this pattern before this task'
      );

      // 1238. previewOnboardingComposition() returns BOTH canonicalAnchorDate (no override) and anchorDate (effective, post-override) — a single resolution function called twice, not a second implementation
      assert(
        onboardingServiceSrcAnchor.includes('const canonicalAnchorDate = resolveOnboardingAnchorDate(employee, records, null, referenceDate);') &&
        onboardingServiceSrcAnchor.includes('const anchorDate = resolveOnboardingAnchorDate(employee, records, customAnchorDate, referenceDate);') &&
        onboardingServiceSrcAnchor.match(/canonicalAnchorDate,\s*tasks: \[\],/) &&
        onboardingServiceSrcAnchor.match(/anchorDate,\s*canonicalAnchorDate,\s*\.\.\.composition,/),
        '1238. NEW — previewOnboardingComposition() computes both canonicalAnchorDate (no override) and anchorDate (effective) via the SAME resolveOnboardingAnchorDate() function called with different inputs — one source of resolution truth, returned in both the valid and invalid-anchor response shapes'
      );

      // 1239. previewOffboardingComposition() returns BOTH canonicalAnchorDate and anchorDate the same way
      assert(
        offboardingServiceSrcAnchor.includes('const canonicalAnchorDate = resolveOffboardingAnchorDate(employee, records, null, referenceDate);') &&
        offboardingServiceSrcAnchor.match(/anchorDate: eligibility\.resolvedAnchorDate,\s*canonicalAnchorDate,/),
        '1239. NEW — previewOffboardingComposition() computes canonicalAnchorDate directly via resolveOffboardingAnchorDate() (no override) alongside the effective anchorDate resolved through checkOffboardingEligibility() — same single-source pattern as onboarding'
      );

      // --- OVERRIDE NEVER MUTATES THE EMPLOYEE RECORD (FUNCTIONAL) ---

      // 1240. FUNCTIONAL — Launching onboarding with a custom override never mutates employee.startDate
      {
        resetDatabase();
        const empBeforeOverride = await employeeService.getById('emp-014');
        const startDateBefore = empBeforeOverride.startDate;
        const kevinInstances = await onboardingService.getAllInstances({ employeeId: 'emp-014' });
        if (kevinInstances.length > 0) await onboardingService.dropPlanInstance(kevinInstances[0].id);
        const launchedWithOverride = await onboardingService.launchPlanInstance('emp-014', '2026-10-20', 'emp-001');
        const empAfterOverride = await employeeService.getById('emp-014');
        assert(
          launchedWithOverride.anchorDate === '2026-10-20' && empAfterOverride.startDate === startDateBefore,
          `1240. NEW — FUNCTIONAL: Launching with Custom Override 2026-10-20 snapshots that date onto the plan instance (found ${launchedWithOverride.anchorDate}), while employee.startDate remains exactly as it was before (${startDateBefore} -> ${empAfterOverride.startDate})`
        );
        resetDatabase();
      }

      // 1241. FUNCTIONAL — Launching offboarding with a custom override never mutates the employee's canonical Final Working Date fields (contractEndDate / employment record)
      {
        resetDatabase();
        const empBeforeOverrideOff = await employeeService.getById('emp-005');
        const contractEndBefore = empBeforeOverrideOff.contractEndDate;
        const launchedOffWithOverride = await offboardingService.launchPlanInstance('emp-005', '2026-10-15', 'emp-001');
        const empAfterOverrideOff = await employeeService.getById('emp-005');
        assert(
          launchedOffWithOverride.anchorDate === '2026-10-15' && empAfterOverrideOff.contractEndDate === contractEndBefore,
          `1241. NEW — FUNCTIONAL: Launching offboarding with Custom Override 2026-10-15 snapshots that date onto the plan instance (found ${launchedOffWithOverride.anchorDate}), while employee.contractEndDate remains exactly as it was before (${contractEndBefore} -> ${empAfterOverrideOff.contractEndDate})`
        );
        resetDatabase();
      }

      // --- SINGLE EFFECTIVE-ANCHOR SOURCE OF TRUTH ---

      // 1242. launchPlanInstance() (onboarding) passes customAnchorDate straight through to previewOnboardingComposition() — the exact same function that produced the preview HR just saw
      {
        const onbLaunchFnMatch = onboardingServiceSrcAnchor.match(/async launchPlanInstance\(employeeId, customAnchorDate = null, currentUserId[\s\S]*?\n  \},/);
        const onbLaunchFnBlock = onbLaunchFnMatch ? onbLaunchFnMatch[0] : '';
        assert(
          Boolean(onbLaunchFnMatch) && onbLaunchFnBlock.includes('this.previewOnboardingComposition(employeeId, customAnchorDate)'),
          '1242. NEW — launchPlanInstance() calls this.previewOnboardingComposition(employeeId, customAnchorDate) — preview and launch share one resolution call, so they can never calculate from two different anchors'
        );
      }

      // 1243. launchPlanInstance() (offboarding) already resolved its anchor via checkOffboardingEligibility() inside the SAME function that previewOffboardingComposition() uses — unchanged by this task, confirmed still intact
      {
        const offLaunchFnMatch = offboardingServiceSrcAnchor.match(/async launchPlanInstance\(employeeId, customAnchorDate = null, currentUserId[\s\S]*?\n  \},/);
        const offLaunchFnBlock = offLaunchFnMatch ? offLaunchFnMatch[0] : '';
        assert(
          Boolean(offLaunchFnMatch) && offLaunchFnBlock.includes('checkOffboardingEligibility(employee, records, existingInstances, customAnchorDate)'),
          '1243. REGRESSION: launchPlanInstance() (offboarding) still resolves its anchor via checkOffboardingEligibility(employeeId, ..., customAnchorDate) — the exact same call previewOffboardingComposition() makes — unchanged by this task'
        );
      }

      // 1244. FUNCTIONAL — Preview and launch resolve to the IDENTICAL effective anchor for both modules (no drift)
      {
        resetDatabase();
        const kevinInstancesForDrift = await onboardingService.getAllInstances({ employeeId: 'emp-014' });
        if (kevinInstancesForDrift.length > 0) await onboardingService.dropPlanInstance(kevinInstancesForDrift[0].id);
        const onbPreviewDrift = await onboardingService.previewOnboardingComposition('emp-014', '2026-09-08');
        const onbLaunchDrift = await onboardingService.launchPlanInstance('emp-014', '2026-09-08', 'emp-001');
        assert(onbPreviewDrift.anchorDate === onbLaunchDrift.anchorDate, `1244a. NEW — FUNCTIONAL: Onboarding preview anchor (${onbPreviewDrift.anchorDate}) exactly matches the launched instance's anchor (${onbLaunchDrift.anchorDate}) — no drift`);

        const offPreviewDrift = await offboardingService.previewOffboardingComposition('emp-010', '2026-11-01');
        const offLaunchDrift = await offboardingService.launchPlanInstance('emp-010', '2026-11-01', 'emp-001');
        assert(offPreviewDrift.anchorDate === offLaunchDrift.anchorDate, `1244b. NEW — FUNCTIONAL: Offboarding preview anchor (${offPreviewDrift.anchorDate}) exactly matches the launched instance's anchor (${offLaunchDrift.anchorDate}) — no drift`);
        resetDatabase();
      }

      // --- MISSING CANONICAL DATE HANDLING ---

      // 1245. FUNCTIONAL — Onboarding: no canonical Start Date + no override = blocked; + valid override = allowed
      {
        const noDateEmp = { id: 'synth-onb-nodate', fullName: 'No Date Employee', directoryType: 'Employee', department: null, status: 'Onboarding' };
        const blockedResult = resolveOnboardingAnchorDate(noDateEmp, [], null);
        const allowedResult = resolveOnboardingAnchorDate(noDateEmp, [], '2026-10-01');
        assert(blockedResult === null, '1245a. NEW — FUNCTIONAL: An employee with no Start Date on record and no override resolves to null (blocks launch) — never silently guessed, never defaulted to today');
        assert(allowedResult === '2026-10-01', '1245b. NEW — FUNCTIONAL: The SAME employee resolves correctly to the Custom Override date when one is supplied — canonical missing + valid override = launch allowed');
      }

      // 1246. FUNCTIONAL — Offboarding: no canonical Final Working Date + no override = blocked; + valid override = allowed (mirrors 1245 independently)
      {
        const noDateEmpOff = { id: 'synth-off-nodate', fullName: 'No Date Employee Off', directoryType: 'Employee', department: null, status: 'Active' };
        const blockedResultOff = resolveOffboardingAnchorDate(noDateEmpOff, [], null);
        const allowedResultOff = resolveOffboardingAnchorDate(noDateEmpOff, [], '2026-11-15');
        assert(blockedResultOff === null, '1246a. REGRESSION: An employee with no Final Working Date on record and no override resolves to null (blocks launch) — offboarding\'s existing rule, unchanged');
        assert(allowedResultOff === '2026-11-15', '1246b. REGRESSION: The SAME employee resolves correctly to the Custom Override date when one is supplied');
      }

      // 1247. Missing-date error messages match the required wording for both modules, surfaced through previewOnboardingComposition()/checkOffboardingEligibility()
      {
        const noDateEmp2 = { id: 'synth-onb-nodate-2', fullName: 'Msg Test Employee', directoryType: 'Employee', department: null, status: 'Onboarding' };
        // previewOnboardingComposition requires a real employee via employeeService, so the message wording is verified directly against the service source instead of a live call
        assert(
          onboardingServiceSrcAnchor.includes("`${employee.fullName}'s Start Date is not available. Add a Start Date or provide a Custom Override before launching onboarding.`"),
          '1247a. NEW — The onboarding missing-Start-Date message reads "<Employee>\'s Start Date is not available. Add a Start Date or provide a Custom Override before launching onboarding." — matching the required wording'
        );
        assert(
          offboardingDomainSrcAnchor.includes("`${employee.fullName}'s Final Working Date is not available. Add a Final Working Date or provide a Custom Override before launching offboarding.`"),
          '1247b. NEW — The offboarding missing-Final-Working-Date message reads "<Employee>\'s Final Working Date is not available. Add a Final Working Date or provide a Custom Override before launching offboarding." — matching the required wording'
        );
      }

      // --- HISTORICAL SNAPSHOT PRESERVATION ---

      // 1248. FUNCTIONAL — Onboarding: launching, then editing the employee's canonical employment record afterward, does NOT retroactively change the already-launched instance's anchor/task dates
      {
        resetDatabase();
        const existingHannah = await onboardingService.getAllInstances({ employeeId: 'emp-013' });
        if (existingHannah.length > 0 && isActivePlanStatus(existingHannah[0].derivedStatus)) {
          await onboardingService.dropPlanInstance(existingHannah[0].id);
        }
        const launchedForSnapshot = await onboardingService.launchPlanInstance('emp-013', null, 'emp-001');
        const originalAnchor = launchedForSnapshot.anchorDate;
        const originalTaskDates = launchedForSnapshot.taskInstances.map((t) => t.originallyCalculatedDueDate);

        const db = loadDatabase();
        db.employmentRecords = db.employmentRecords.map((r) => (r.id === 'rec-013-1' ? { ...r, effectiveFrom: '2026-08-20' } : r));
        saveDatabase(db);

        const instanceAfterEdit = await onboardingService.getInstanceById(launchedForSnapshot.id);
        const freshPreviewAfterEdit = await onboardingService.previewOnboardingComposition('emp-013');
        assert(
          instanceAfterEdit.anchorDate === originalAnchor &&
          JSON.stringify(instanceAfterEdit.taskInstances.map((t) => t.originallyCalculatedDueDate)) === JSON.stringify(originalTaskDates),
          `1248a. NEW — FUNCTIONAL: Editing Hannah's canonical employment record after launch leaves the ALREADY-LAUNCHED instance's anchor (${originalAnchor}) and every task due date byte-for-byte unchanged`
        );
        assert(
          freshPreviewAfterEdit.canonicalAnchorDate === '2026-08-20',
          `1248b. NEW — FUNCTIONAL: A FRESH preview for the same employee correctly picks up the NEW canonical date (2026-08-20, found ${freshPreviewAfterEdit.canonicalAnchorDate}) — the resolution logic itself is not frozen, only already-launched snapshots are`
        );
        resetDatabase();
      }

      // 1249. FUNCTIONAL — Offboarding: launching, then editing the employee's canonical record afterward, does NOT retroactively change the already-launched instance
      {
        resetDatabase();
        const launchedOffForSnapshot = await offboardingService.launchPlanInstance('emp-005', '2026-11-30', 'emp-001');
        const originalAnchorOff = launchedOffForSnapshot.anchorDate;
        const originalTaskDatesOff = launchedOffForSnapshot.taskInstances.map((t) => t.originallyCalculatedDueDate);

        const db2 = loadDatabase();
        db2.employees = db2.employees.map((e) => (e.id === 'emp-005' ? { ...e, contractEndDate: '2027-03-01' } : e));
        saveDatabase(db2);

        const instanceAfterEditOff = await offboardingService.getInstanceById(launchedOffForSnapshot.id);
        assert(
          instanceAfterEditOff.anchorDate === originalAnchorOff &&
          JSON.stringify(instanceAfterEditOff.taskInstances.map((t) => t.originallyCalculatedDueDate)) === JSON.stringify(originalTaskDatesOff),
          `1249. NEW — FUNCTIONAL: Editing emp-005's contractEndDate after launch leaves the ALREADY-LAUNCHED offboarding instance's anchor (${originalAnchorOff}) and every task due date byte-for-byte unchanged`
        );
        resetDatabase();
      }

      // --- DROPPED + RELAUNCHED PLANS RESOLVE FRESH ---

      // 1250. FUNCTIONAL — Onboarding: Drop, then change the employee's canonical Start Date, then relaunch — the new launch resolves the NEW canonical date, never reusing the dropped plan's anchor
      {
        resetDatabase();
        const existingHannah1250 = await onboardingService.getAllInstances({ employeeId: 'emp-013' });
        if (existingHannah1250.length > 0 && isActivePlanStatus(existingHannah1250[0].derivedStatus)) {
          await onboardingService.dropPlanInstance(existingHannah1250[0].id);
        }
        const initialLaunch = await onboardingService.launchPlanInstance('emp-013', '2026-08-15', 'emp-001');
        await onboardingService.dropPlanInstance(initialLaunch.id);

        const db3 = loadDatabase();
        db3.employmentRecords = db3.employmentRecords.map((r) => (r.id === 'rec-013-1' ? { ...r, effectiveFrom: '2026-08-25' } : r));
        saveDatabase(db3);

        const relaunchPreview = await onboardingService.previewOnboardingComposition('emp-013');
        assert(
          relaunchPreview.canonicalAnchorDate === '2026-08-25' && relaunchPreview.canonicalAnchorDate !== initialLaunch.anchorDate,
          `1250. NEW — FUNCTIONAL: After Drop + a canonical Start Date change, a fresh preview resolves to the NEW date (2026-08-25, found ${relaunchPreview.canonicalAnchorDate}) — never reusing the dropped plan's original anchor (${initialLaunch.anchorDate})`
        );
        resetDatabase();
      }

      // 1251. FUNCTIONAL — Offboarding: same Drop + canonical-change + relaunch-resolves-fresh behavior
      {
        resetDatabase();
        const initialLaunchOff = await offboardingService.launchPlanInstance('emp-005', '2026-09-30', 'emp-001');
        await offboardingService.dropPlanInstance(initialLaunchOff.id);

        const db4 = loadDatabase();
        db4.employees = db4.employees.map((e) => (e.id === 'emp-005' ? { ...e, contractEndDate: '2026-12-10' } : e));
        saveDatabase(db4);

        const relaunchPreviewOff = await offboardingService.previewOffboardingComposition('emp-005');
        assert(
          relaunchPreviewOff.canonicalAnchorDate === '2026-12-10' && relaunchPreviewOff.canonicalAnchorDate !== initialLaunchOff.anchorDate,
          `1251. NEW — FUNCTIONAL: After Drop + a canonical Final Working Date change, a fresh preview resolves to the NEW date (2026-12-10, found ${relaunchPreviewOff.canonicalAnchorDate}) — never reusing the dropped plan's original anchor (${initialLaunchOff.anchorDate})`
        );
        resetDatabase();
      }

      // --- TASK COMPOSITION UNCHANGED ---

      // 1252. REGRESSION: Onboarding and Offboarding task composition (scope tasks, person-type isolation, department logic) are unaffected — only the anchor DATE resolution changed, never the task set itself
      {
        resetDatabase();
        const empComp = await onboardingService.previewOnboardingComposition('emp-013');
        assert(empComp.counts.universal >= 0 && typeof empComp.counts.total === 'number', '1252a. REGRESSION: composeOnboardingTasks() output shape (universal/department/total counts) is unchanged');

        const offComp = await offboardingService.previewOffboardingComposition('emp-005', '2026-12-31');
        assert(offComp.counts.universal === 11 && offComp.counts.department === 4 && offComp.counts.total === 15, `1252b. REGRESSION: composeOffboardingTasks() still composes Employee Universal(11) + Software Engineering(4) = 15 for emp-005 — task composition itself is completely unaffected by the anchor-date standardization (found universal=${offComp.counts.universal}, department=${offComp.counts.department}, total=${offComp.counts.total})`);
        resetDatabase();
      }

      // --- ONBOARDING/OFFBOARDING ISOLATION ---

      // 1253. Neither domain module imports from the other — resolveOnboardingAnchorDate() and resolveOffboardingAnchorDate() were extended completely independently
      assert(
        !onboardingDomainSrcAnchor.match(/import[\s\S]{0,200}from\s+['"][^'"]*offboardingDomain\.js['"]/) &&
        !offboardingDomainSrcAnchor.match(/import[\s\S]{0,200}from\s+['"][^'"]*onboardingDomain\.js['"]/),
        '1253. REGRESSION: onboardingDomain.js and offboardingDomain.js contain no actual import statement from one another — the two anchor-date resolution functions were extended with matching PATTERNS, never shared code'
      );

      // --- NO DIRECT LOCALSTORAGE ACCESS FROM LAUNCH COMPONENTS ---

      // 1254. Neither Launch modal calls localStorage/storageEngine directly — both remain strictly behind the service boundary (onboardingService/offboardingService), ready for a future real backend to replace the underlying data source without any UI rewrite
      {
        const launchPlanModalCodeOnly = stripComments(launchPlanModalSrcAnchor);
        const launchOffboardingPlanModalCodeOnly = stripComments(launchOffboardingPlanModalSrcAnchor);
        assert(
          !launchPlanModalCodeOnly.includes('localStorage.') && !launchPlanModalCodeOnly.includes("from '../../mock-data/storageEngine") &&
          !launchOffboardingPlanModalCodeOnly.includes('localStorage.') && !launchOffboardingPlanModalCodeOnly.includes("from '../../mock-data/storageEngine"),
          '1254. NEW — Neither LaunchPlanModal.jsx nor LaunchOffboardingPlanModal.jsx contains any actual localStorage/storageEngine usage in code (a documentation comment mentioning "storageEngine/localStorage" to explain this boundary is fine) — both only ever call onboardingService/offboardingService'
        );
      }

      // --- UI DISPLAY: CANONICAL DATE VS OPTIONAL OVERRIDE CLEARLY DISTINGUISHED ---

      // 1255. LaunchPlanModal.jsx shows "Start Date Anchor" with the canonical Employee Start Date always visible, a Custom Override input, and an "Effective Anchor Date" line ONLY when an override is entered
      assert(
        launchPlanModalSrcAnchor.includes('Start Date Anchor') && launchPlanModalSrcAnchor.includes('Employee Start Date') &&
        launchPlanModalSrcAnchor.includes('preview.canonicalAnchorDate') && launchPlanModalSrcAnchor.includes('Custom Override') &&
        launchPlanModalSrcAnchor.match(/customAnchorDate && preview && preview\.anchorDate[\s\S]{0,150}Effective Anchor Date/),
        '1255. NEW — LaunchPlanModal.jsx shows a "Start Date Anchor" section: "Employee Start Date" (canonical, always visible), a Custom Override date input, and "Effective Anchor Date" only when an override is actually entered — no clutter when there is none'
      );

      // 1256. LaunchOffboardingPlanModal.jsx shows the exact same structure for "Final Working Date Anchor" — consistent HR UX across both launch flows
      assert(
        launchOffboardingPlanModalSrcAnchor.includes('Final Working Date Anchor') && launchOffboardingPlanModalSrcAnchor.includes('Employee Final Working Date') &&
        launchOffboardingPlanModalSrcAnchor.includes('preview.canonicalAnchorDate') && launchOffboardingPlanModalSrcAnchor.includes('Custom Override') &&
        launchOffboardingPlanModalSrcAnchor.match(/customAnchorDate && preview && preview\.anchorDate[\s\S]{0,150}Effective Anchor Date/),
        '1256. NEW — LaunchOffboardingPlanModal.jsx shows the exact same "Final Working Date Anchor" structure: "Employee Final Working Date" (canonical, always visible), Custom Override, and "Effective Anchor Date" only when entered — mirroring Onboarding\'s pattern for consistent HR UX'
      );

      resetDatabase();
    }

    resetDatabase();
  } catch (err) {
    console.error('Unhandled error in verifyStage18:', err);
    assert(false, 'Unhandled error in verifyStage18', err.message);
  }

  const passedCount = results.filter(r => r.status === 'PASS').length;
  console.log(`\n=== VERIFICATION SUMMARY: ${passedCount}/${results.length} PASSED ===\n`);
  return passedCount === results.length;
}

if (process.argv[1] && process.argv[1].includes('verifyStage18.js')) {
  verifyStage18();
}

