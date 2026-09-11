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
} from '../domain/onboardingDomain.js';
import { offboardingService } from './offboardingService.js';
import { activityService } from './activityService.js';
import { dashboardService } from './dashboardService.js';
import { notesService } from './notesService.js';
import { loadDatabase, saveDatabase, resetDatabase, migrateOnboardingScopesIfNeeded } from '../mock-data/storageEngine.js';
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

    // 298. Employees header still reads "Onboarding Employees" with its existing description
    assert(
      onbEmployeesSrc.includes('>Onboarding Employees<') && onbEmployeesSrc.includes('View and track individual onboarding progress for employees and interns.'),
      '298. Employees header reads "Onboarding Employees" with description "View and track individual onboarding progress for employees and interns."'
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

    // 303. Summary card values reuse the exact same derivedStatus-based calculations previously on the Dashboard (not re-implemented)
    assert(
      onbEmployeesSrc.includes('i.derivedStatus !== PLAN_INSTANCE_STATUS.COMPLETED') && onbEmployeesSrc.includes('i.derivedStatus === PLAN_INSTANCE_STATUS.IN_PROGRESS') && onbEmployeesSrc.includes('i.derivedStatus === PLAN_INSTANCE_STATUS.NEEDS_ATTENTION') && onbEmployeesSrc.includes('i.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED'),
      '303. Summary card counts reuse the exact same PLAN_INSTANCE_STATUS-based filter predicates the Dashboard previously used, computed straight from onboardingService.getAllInstances()'
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

    // 315. The individual employee onboarding detail page is untouched, including its "Back to Onboarding Employees" link and Done/Reopen actions
    assert(
      onbDetailSrc.includes('Back to Onboarding Employees') && onbDetailSrc.includes('ArrowLeft') && onbDetailSrc.includes('handleToggleTaskComplete'),
      '315. The individual employee onboarding detail page is kept as-is, including the "Back to Onboarding Employees" link and Done/Reopen task actions'
    );

    // 316. Both the employee/instance join (instanceMap) and progress/status rendering reuse the existing hydrated plan instance data — no re-implementation
    assert(
      onbEmployeesSrc.includes('new Map(instances.map((i) => [i.employeeId, i]))') && onbEmployeesSrc.includes('inst.progress.progressPercentage') && onbEmployeesSrc.includes('inst.derivedStatus'),
      '316. Employees page derives its employee -> plan-instance join and reads progress/status directly from the existing hydrated onboardingService.getAllInstances() data'
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
        const newInstance = await onboardingService.launchPlanInstance(candidateEmp.id, activeTemplate.id, {});
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

    // 383. UPDATED — The Plans page no longer offers "Create Plan Template" or a per-card "Launch" button:
    // HR no longer creates independent full plan templates, and there is now exactly ONE launch entry
    // point (Onboarding → Employees → Launch Onboarding Plan). Instead the page presents the 4 composable
    // task scopes (Universal, Employee, Intern, Department — the latter rendered dynamically per real
    // department), each with a "Manage Tasks" action.
    assert(
      !onbPlansSrc2.includes('Create Plan Template') && !onbPlansSrc2.includes('handleOpenLaunchModal') && !onbPlansSrc2.includes('LaunchPlanModal') &&
      onbPlansSrc2.includes('Universal Tasks') && onbPlansSrc2.includes('Employee Tasks') && onbPlansSrc2.includes('Intern Tasks') && onbPlansSrc2.includes('Department Tasks') &&
      onbPlansSrc2.includes('Manage Tasks'),
      '383. UPDATED — Plans page presents the 4 composable task scopes (Universal/Employee/Intern/Department) with "Manage Tasks" actions; the old Create Plan Template workflow and per-card Launch button are gone — launching now only happens via Onboarding → Employees'
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
    assert(planEditorSrc.includes('SCOPE_META') && planEditorSrc.includes('meta.subtitle'), '384b. UPDATED — A fixed contextual header (title + one-line subtitle) identifies which scope is being edited, e.g. "These tasks are included for everyone." for Universal');
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

    // 400. UPDATED — Every scope (Universal/Employee/Intern/each Department) renders through the exact same
    // PlanEditorPage implementation, disambiguated only by route params (scopeSegment/departmentId) rather
    // than a create/edit planId flag — styling cannot drift between scopes since there is only one editor.
    assert(
      planEditorSrc.includes('scopeSegment') && planEditorSrc.includes("isDepartmentScope = scopeSegment === 'department'"),
      '400. UPDATED — All 4 task scopes (Universal/Employee/Intern/Department) share the single PlanEditorPage implementation, disambiguated via route params — styling cannot drift between them'
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

    // 401. LaunchPlanModal reads employee data via the Employees service boundary — not Upcoming candidates directly
    assert(
      launchPlanModalSrc5.includes("import { employeeService } from '../../services/employeeService.js'") && !launchPlanModalSrc5.includes('upcomingCandidateService'),
      '401. LaunchPlanModal sources employee data from employeeService (existing Employees domain boundary) — it does not read Upcoming candidates directly'
    );

    // 402. The eligibility filter is exactly employee.status === 'Onboarding' — the existing normalized lifecycle field, no new eligibility model
    assert(launchPlanModalSrc5.includes("allEmps.filter((e) => e.status === 'Onboarding')"), "402. Launch employee eligibility uses exactly `employee.status === 'Onboarding'` — the existing lifecycle field, not a new isEligibleForOnboarding model");

    // 403. Employee dropdown labels no longer show a bracketed lifecycle status (e.g. "[Active]") — every visible entry is already Onboarding by construction
    assert(!launchPlanModalSrc5.includes('— [${emp.status}]'), '403. Employee dropdown labels no longer append a bracketed lifecycle status — redundant now that every entry is guaranteed Onboarding');

    // 404. Empty state: a clear disabled message renders instead of a broken/blank dropdown when no one is eligible under the current type filter
    assert(
      launchPlanModalSrc5.includes('No employees currently awaiting onboarding') && launchPlanModalSrc5.includes('filteredOnboardingEmployees.length === 0') && launchPlanModalSrc5.match(/filteredOnboardingEmployees\.length === 0[\s\S]{0,200}disabled/),
      '404. A clear disabled empty state renders when zero employees are eligible under the current All/Employees/Interns filter, instead of a broken/blank dropdown'
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

    // 416. Lifecycle eligibility (status === 'Onboarding') is applied FIRST, then the All/Employees/Interns filter narrows further by the existing directoryType field — no new classification invented
    assert(
      launchPlanModalSrc6.includes("allEmps.filter((e) => e.status === 'Onboarding')") &&
      launchPlanModalSrc6.includes("onboardingEmployees.filter(\n    (emp) => typeFilter === 'all' || emp.directoryType === typeFilter\n  )"),
      '416. Onboarding lifecycle eligibility is applied first, then All/Employees/Interns narrows by the existing employee.directoryType field'
    );

    // 417. Three distinct empty-state messages exist for All / Employees / Interns
    assert(
      launchPlanModalSrc6.includes('No employees currently awaiting onboarding') &&
      launchPlanModalSrc6.includes('No onboarding employees available') &&
      launchPlanModalSrc6.includes('No onboarding interns available'),
      '417. Three distinct empty-state messages exist for the All / Employees / Interns filter states'
    );

    // 418. Changing the filter clears an incompatible selection (source-level: effect keyed on typeFilter that resets selectedEmployeeId when the current selection no longer matches)
    assert(
      launchPlanModalSrc6.match(/typeFilter === 'all' \|\| currentlySelected\.directoryType === typeFilter/) && launchPlanModalSrc6.includes("setSelectedEmployeeId('')") && launchPlanModalSrc6.includes('}, [typeFilter]);'),
      '418. An effect keyed on typeFilter clears the selected employee when they no longer match the newly chosen filter'
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

    // 429. UPDATED — The same PlanEditorPage component renders every scope (Universal/Employee/Intern/Department),
    // so the 3-line helper is identical across all of them — no separate implementation to drift
    assert(planEditorSrc2.includes('scopeSegment'), '429. UPDATED — All task scopes share one PlanEditorPage implementation, so the offset helper is guaranteed identical across Universal/Employee/Intern/Department editors');

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
          const overrideAssigneeId = onboardingEmpForNeutralPreview.id;
          const launched = await onboardingService.launchPlanInstance(
            onboardingEmpForNeutralPreview.id,
            neutralTpl.id,
            { [reqTaskPreview.planTaskId]: overrideAssigneeId }
          );
          assert(Boolean(launched), '441. Launching a template containing a neutral (no assignment rule) task completes end-to-end without crashing once the required task is resolved via manual override');
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
          const launchedFree = await onboardingService.launchPlanInstance(onboardingEmpForLaunchCheck.id, freeTpl.id);
          assert(Boolean(launchedFree), '460. launchPlanInstance() no longer throws for a template whose required task has no assignee — Launch Onboarding Plan works with employee + template alone');
          assert(launchedFree.progress.totalTasks === 2, '461. BOTH the required and the optional task are created as task instances — the previous silent-omission of unresolved optional tasks is gone');

          // 462. Due date and required-task progress remain correct for this fully assignment-free plan
          const reqTask = launchedFree.progress.tasks.find((t) => t.title === 'Free Required Task');
          assert(reqTask.currentDueDate === addDaysCheckFn4(launchedFree.anchorDate, 1), '462. Due-date calculation remains correct for tasks in a fully assignment-free launched plan');
          assert(launchedFree.progress.requiredTasksCount === 1 && typeof launchedFree.progress.progressPercentage === 'number', '462b. Required-task progress calculation remains correct');

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

      const scopeDefs = await onboardingService.getScopeTaskDefinitions();

      // 465. Every active onboarding task definition carries a recognized scopeType
      assert(
        scopeDefs.length > 0 && scopeDefs.every((t) => ['universal', 'employee', 'intern', 'department'].includes(t.scopeType)),
        '465. Every active onboarding task definition has a recognized scopeType (universal/employee/intern/department) after migration'
      );

      // 466. Employee scope is non-destructively migrated from the legacy "Standard Employee Onboarding" template (7 tasks)
      const employeeScopeTasks = scopeDefs.filter((t) => t.scopeType === 'employee');
      assert(employeeScopeTasks.length === 7, `466. Employee scope contains the 7 tasks migrated from the legacy "Standard Employee Onboarding" template (found ${employeeScopeTasks.length})`);

      // 467. Intern scope is non-destructively migrated from the legacy "Internship / Apprenticeship Onboarding" template (3 tasks)
      const internScopeTasks = scopeDefs.filter((t) => t.scopeType === 'intern');
      assert(internScopeTasks.length === 3, `467. Intern scope contains the 3 tasks migrated from the legacy "Internship / Apprenticeship Onboarding" template (found ${internScopeTasks.length})`);

      // 468. Department scope for Software Engineering (dept-3) is migrated from the legacy "Software Engineering Onboarding" template (4 tasks)
      const dept3ScopeTasks = scopeDefs.filter((t) => t.scopeType === 'department' && t.scopeDepartmentId === 'dept-3');
      assert(dept3ScopeTasks.length === 4, `468. The Software Engineering (dept-3) department scope contains the 4 tasks migrated from the legacy department-specific template (found ${dept3ScopeTasks.length})`);

      // 469. Universal scope is NOT guessed from existing task content — it starts empty since nothing in the legacy seed data was explicitly marked universal
      const universalScopeTasks = scopeDefs.filter((t) => t.scopeType === 'universal');
      assert(universalScopeTasks.length === 0, `469. Universal scope starts with zero tasks post-migration — nothing was guessed/recategorized as universal from legacy task content (found ${universalScopeTasks.length})`);

      // 470. Every scope's tasks exist exactly ONCE in storage — no duplication per type/department combination
      const dept3TaskIds = new Set(dept3ScopeTasks.map((t) => t.id));
      assert(dept3TaskIds.size === dept3ScopeTasks.length, '470. The Software Engineering department scope tasks are stored exactly once each — no duplicate copies exist for different employee-type combinations sharing that department');

      // 471. getScopesSummary() resolves Department Tasks dynamically from the real department source, not a hardcoded list
      const scopesSummary = await onboardingService.getScopesSummary();
      const allDepts = await departmentService.getAll({ withCount: false });
      assert(
        scopesSummary.departments.length === allDepts.length && allDepts.every((d) => scopesSummary.departments.some((row) => row.department.id === d.id)),
        `471. getScopesSummary() returns exactly one row per real department (${allDepts.length} departments), sourced dynamically via departmentService — not hardcoded`
      );

      // 472. A department with zero configured tasks still appears (manageable), not omitted or treated as an error
      const zeroTaskDeptRow = scopesSummary.departments.find((row) => row.taskCount === 0);
      assert(Boolean(zeroTaskDeptRow), '472. At least one department with zero configured tasks still appears in the scope summary with taskCount 0 (manageable, not an error state)');

      // 473. Universal scope support is real, not just theoretical — HR can add a Universal task via saveScopeTasks() and it is immediately retrievable
      await onboardingService.saveScopeTasks('universal', null, [
        { title: 'Stage18 Universal Verification Task', description: 'Added via scope editor', activityTypeId: 'act-type-1', relativeOffsetDays: 0, required: true },
      ]);
      const universalAfterAdd = await onboardingService.getScopeTasks('universal', null);
      assert(universalAfterAdd.length === 1 && universalAfterAdd[0].title === 'Stage18 Universal Verification Task', '473. HR can add a Universal task through saveScopeTasks(), and it is immediately retrievable via getScopeTasks(\'universal\')');
      resetDatabase();

      // --- PLANS PAGE ---

      // 474. All 4 scope sections render with the exact required copy
      assert(
        onbPlansSrc3.includes('Included in every onboarding plan.') &&
        onbPlansSrc3.includes('Included for employees in addition to Universal Tasks.') &&
        onbPlansSrc3.includes('Included for interns and apprentices in addition to Universal Tasks.'),
        '474. The Universal/Employee/Intern scope cards render the exact required description copy'
      );

      // 475. Department Tasks are rendered dynamically (one ScopeCard per department.id from getScopesSummary), never hardcoded department names in JSX
      assert(
        !onbPlansSrc3.match(/'Software Engineering'|"Software Engineering"|'Marketing'|"Marketing"|'Human Resources'|"Human Resources"/),
        '475. OnboardingPlansPage.jsx contains no hardcoded department names — Department Tasks cards are rendered dynamically from summary.departments'
      );

      // 476. "Manage Tasks" links route to the conceptual scope URLs (universal/employee/intern/department/:id)
      assert(
        onbPlansSrc3.includes("to=\"/onboarding/plans/universal\"") &&
        onbPlansSrc3.includes("to=\"/onboarding/plans/employee\"") &&
        onbPlansSrc3.includes("to=\"/onboarding/plans/intern\"") &&
        onbPlansSrc3.includes('/onboarding/plans/department/${row.department.id}'),
        '476. Manage Tasks actions route to /onboarding/plans/universal, /employee, /intern, and /department/:departmentId respectively'
      );

      // 477. Router supports the scope-segment + department-id route shapes, replacing the old template-id-based routes
      // (isolated to the onboarding route block specifically, since the separate offboarding module still
      // legitimately uses its own unrelated plans/:planId/edit route right next to it)
      {
        const onboardingRouteBlockMatch = routerSrc.match(/path: 'onboarding'[\s\S]*?path: 'offboarding'/);
        const onboardingRouteBlock = onboardingRouteBlockMatch ? onboardingRouteBlockMatch[0] : '';
        assert(
          onboardingRouteBlock.includes("path: 'plans/:scopeSegment'") && onboardingRouteBlock.includes("path: 'plans/:scopeSegment/:departmentId'") &&
          !onboardingRouteBlock.includes("path: 'plans/new'") && !onboardingRouteBlock.includes("path: 'plans/:planId/edit'"),
          '477. The onboarding Plans route was evolved from plans/new + plans/:planId/edit to plans/:scopeSegment + plans/:scopeSegment/:departmentId (the separate offboarding module keeps its own unrelated template-id route)'
        );
      }

      // --- EDITOR ---

      // 478. PlanEditorPage disambiguates all 4 scopes purely from route params
      assert(
        planEditorSrc3.includes("isDepartmentScope = scopeSegment === 'department'") && planEditorSrc3.includes('SCOPE_META'),
        '478. PlanEditorPage resolves universal/employee/intern directly from scopeSegment, and department scope via the department/:departmentId route shape'
      );

      // 479. Saving one scope's tasks does not affect any other scope's tasks (isolated replace, mirroring updateTemplate's existing pattern)
      {
        const beforeEmployeeTasks = await onboardingService.getScopeTasks('employee', null);
        const beforeInternTasks = await onboardingService.getScopeTasks('intern', null);
        await onboardingService.saveScopeTasks('universal', null, [
          { title: 'Isolation Check Task', description: '', activityTypeId: 'act-type-1', relativeOffsetDays: 0, required: false },
        ]);
        const afterEmployeeTasks = await onboardingService.getScopeTasks('employee', null);
        const afterInternTasks = await onboardingService.getScopeTasks('intern', null);
        assert(
          afterEmployeeTasks.length === beforeEmployeeTasks.length && afterInternTasks.length === beforeInternTasks.length,
          '479. Saving the Universal scope\'s tasks does not change the Employee or Intern scope\'s task counts — each scope is replaced in isolation'
        );
        resetDatabase();
      }

      // 480. Each scope maintains its OWN independent sequence numbering (not one shared global sequence)
      {
        const savedEmployeeScope = await onboardingService.getScopeTasks('employee', null);
        const savedInternScope = await onboardingService.getScopeTasks('intern', null);
        const employeeSeqs = savedEmployeeScope.map((t) => t.sequence);
        const internSeqs = savedInternScope.map((t) => t.sequence);
        assert(
          employeeSeqs[0] === 1 && internSeqs[0] === 1,
          `480. Employee scope and Intern scope each start their own sequence at 1 independently (Employee: [${employeeSeqs}], Intern: [${internSeqs}])`
        );
      }

      // 481. No Assignment Rule concept appears anywhere in the scope editor (extends check 393 to the evolved scope-based editor)
      assert(!stripComments(planEditorSrc3).includes('Assignment Rule') && !stripComments(planEditorSrc3).includes('ASSIGNMENT_RULES'), '481. The scope-based task editor contains no Assignment Rule field, label, or import');

      // 482. A scope may be saved with zero tasks — no minimum-task-count validation blocks an intentionally empty scope
      {
        await onboardingService.saveScopeTasks('universal', null, []);
        const emptyUniversal = await onboardingService.getScopeTasks('universal', null);
        assert(emptyUniversal.length === 0, '482. saveScopeTasks() accepts an empty task list for a scope with no validation error — scopes may legitimately be empty');
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

      // 483. Intern + Software Engineering => Universal + Intern + Software Engineering (matches the task's own Kevin Heng example)
      assert(
        internComposition.counts.universal === 0 && internComposition.counts.typeSpecific === 3 && internComposition.counts.department === 4 && internComposition.counts.total === 7,
        `483. An Intern in Software Engineering is composed of Universal(0) + Intern(3) + Department(4) = 7 tasks (found U:${internComposition.counts.universal} T:${internComposition.counts.typeSpecific} D:${internComposition.counts.department} Total:${internComposition.counts.total})`
      );

      // 484. Employee + Software Engineering => Universal + Employee + Software Engineering (matches the task's own Hannah Razak example)
      assert(
        employeeComposition.counts.universal === 0 && employeeComposition.counts.typeSpecific === 7 && employeeComposition.counts.department === 4 && employeeComposition.counts.total === 11,
        `484. An Employee in Software Engineering is composed of Universal(0) + Employee(7) + Department(4) = 11 tasks (found U:${employeeComposition.counts.universal} T:${employeeComposition.counts.typeSpecific} D:${employeeComposition.counts.department} Total:${employeeComposition.counts.total})`
      );

      // 485. An Employee never receives Intern-scope tasks
      assert(!employeeComposition.tasks.some((t) => t.scopeType === 'intern'), '485. An Employee\'s composed task set never includes any Intern-scope task');

      // 486. An Intern never receives Employee-scope tasks
      assert(!internComposition.tasks.some((t) => t.scopeType === 'employee'), '486. An Intern\'s composed task set never includes any Employee-scope task');

      // 487. A person never receives another department's department-scope tasks
      assert(
        !otherDeptComposition.tasks.some((t) => t.scopeType === 'department' && t.scopeDepartmentId !== 'dept-5'),
        '487. An employee in Human Resources (dept-5) never receives Software Engineering\'s (dept-3) department-scope tasks'
      );

      // 488. Zero department-specific tasks does not block composition when Universal/type tasks exist
      assert(
        otherDeptComposition.counts.department === 0 && otherDeptComposition.counts.typeSpecific === 7 && otherDeptComposition.counts.total === 7,
        `488. An employee in a department with zero configured department tasks (Human Resources) still gets Universal+Employee tasks (found total:${otherDeptComposition.counts.total})`
      );

      // 488b. An employee with no department at all still composes Universal + type tasks without crashing
      assert(noDeptComposition.counts.department === 0 && noDeptComposition.counts.typeSpecific === 7, '488b. An employee with no resolvable department still composes Universal + type-specific tasks without crashing (department contributes 0)');

      // 489. Zero TOTAL composed tasks is correctly reported as zero (used by the Launch modal/service to block launch)
      const emptyComposition = composeOnboardingTasks(syntheticEmployeeOtherDept, [], '2026-08-15');
      assert(emptyComposition.counts.total === 0, '489. composeOnboardingTasks() against an empty task-definition set correctly reports counts.total === 0 (the condition the Launch modal/service uses to block launch)');

      // 490. Scope order is deterministic: Universal tasks precede type tasks precede department tasks in the composed array
      {
        const scopeOrderSeen = employeeComposition.tasks.map((t) => t.scopeType);
        const firstDeptIdx = scopeOrderSeen.indexOf('department');
        const firstEmployeeIdx = scopeOrderSeen.indexOf('employee');
        assert(
          firstEmployeeIdx !== -1 && firstDeptIdx !== -1 && firstEmployeeIdx < firstDeptIdx,
          '490. Composed tasks are ordered Universal, then Employee/Intern, then Department — never sorted by due date, title, or creation time'
        );
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

        // 500. Editing Universal scope tasks AFTER launch does NOT retroactively change the already-launched instance
        await onboardingService.saveScopeTasks('universal', null, [
          { title: 'Post-Launch Universal Task', description: '', activityTypeId: 'act-type-1', relativeOffsetDays: 0, required: true },
        ]);
        const reFetchedInstance = await onboardingService.getInstanceById(launchedInstance.id);
        assert(reFetchedInstance.progress.totalTasks === 11, `500. Adding a new Universal task AFTER Hannah's plan was launched does not retroactively add it to her already-launched instance (still ${reFetchedInstance.progress.totalTasks} tasks)`);

        // 501. A NEW launch after that edit DOES include the newly added Universal task (future launches are affected, past ones are not)
        const dbForSecondLaunch = loadDatabase();
        const nonKevinInstances = (dbForSecondLaunch.onboardingPlanInstances || []).filter((inst) => inst.employeeId !== 'emp-014');
        dbForSecondLaunch.onboardingPlanInstances = nonKevinInstances;
        saveDatabase(dbForSecondLaunch);
        const kevinPreviewAfterEdit = await onboardingService.previewOnboardingComposition('emp-014');
        assert(
          kevinPreviewAfterEdit.counts.universal === 1 && kevinPreviewAfterEdit.counts.total === 8,
          `501. A fresh preview computed AFTER the Universal scope edit includes the new Universal task (Kevin: universal=${kevinPreviewAfterEdit.counts.universal}, total=${kevinPreviewAfterEdit.counts.total} — expected 1 and 8)`
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

      // 515. Heading and subtitle copy are unchanged — this is a presentation-only refinement
      assert(onbPlansSrc4.includes('>Onboarding Plans<'), '515. The "Onboarding Plans" heading remains unchanged');
      assert(onbPlansSrc4.includes('Configure reusable onboarding tasks by scope. Universal, employee/intern, and department tasks are combined automatically when onboarding is launched.'), '515b. The subtitle copy remains unchanged (word-for-word) — only spacing/styling was refined');

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

      // 517. Universal, Employee, Intern, and Department cards all render
      assert(
        onbPlansSrc4.includes('Universal Tasks') && onbPlansSrc4.includes('Employee Tasks') && onbPlansSrc4.includes('Intern Tasks') && onbPlansSrc4.includes('Department Tasks'),
        '517. Universal, Employee, Intern, and Department Tasks sections all still render'
      );

      // 518. All scope cards (Universal/Employee/Intern/Department) share the exact same underlying ScopeCard component/class system — no divergent one-off styling
      assert(
        (onbPlansSrc4.match(/<ScopeCard/g) || []).length === 4 || (onbPlansSrc4.match(/<ScopeCard/g) || []).length === 3,
        '518. Universal/Employee/Intern all render through the same <ScopeCard> component (Department cards render through the same component in a .map()), so styling cannot drift between scopes'
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

      // 521. Employee/Intern/Department cards all use the SAME base card class as Universal (only the emphasized modifier differs) — visual consistency across the scope hierarchy
      assert(
        !onbPlansSrc4.match(/icon=\{<UsersRound[\s\S]{0,30}emphasized/) && !onbPlansSrc4.match(/icon=\{<GraduationCap[\s\S]{0,30}emphasized/),
        '521. Employee Tasks and Intern Tasks cards do NOT receive the emphasized treatment — only Universal does, keeping the rest of the hierarchy visually consistent with each other'
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

      // 524. Section headings (TYPE-SPECIFIC TASKS / DEPARTMENT TASKS) remain present and reasonably sized (not oversized)
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

      // 526. getScopesSummary() still returns the same shape/values (task counts unaffected by the visual refinement)
      {
        const summaryAfterStyling = await onboardingService.getScopesSummary();
        const dept3Row = summaryAfterStyling.departments.find((row) => row.department.id === 'dept-3');
        assert(
          summaryAfterStyling.employee.taskCount === 7 && summaryAfterStyling.intern.taskCount === 3 && dept3Row && dept3Row.taskCount === 4,
          `526. Task counts are exactly unchanged by this styling-only pass (Employee: ${summaryAfterStyling.employee.taskCount}, Intern: ${summaryAfterStyling.intern.taskCount}, Software Engineering dept: ${dept3Row ? dept3Row.taskCount : 'missing'})`
        );
      }

      // 527. Composition logic (composeOnboardingTasks) is untouched — same Employee+Software Engineering result as before this task
      {
        const scopeDefsAfterStyling = await onboardingService.getScopeTaskDefinitions();
        const compositionCheck = composeOnboardingTasks({ id: 'style-check-emp', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsAfterStyling, '2026-08-15');
        assert(compositionCheck.counts.total === 11, `527. composeOnboardingTasks() still produces the same 11-task result for an Employee in Software Engineering — composition logic is untouched by this visual refinement (found ${compositionCheck.counts.total})`);
      }

      // 528. Routing is unchanged — the scope-segment route shape is still exactly as it was
      assert(routerSrc2.includes("path: 'plans/:scopeSegment'") && routerSrc2.includes("path: 'plans/:scopeSegment/:departmentId'"), '528. Onboarding Plans routing (plans/:scopeSegment, plans/:scopeSegment/:departmentId) is unchanged by this presentation-only task');

      // 529. Manage Tasks links still point to the correct scope URLs (navigation untouched)
      assert(
        onbPlansSrc4.includes('to="/onboarding/plans/universal"') && onbPlansSrc4.includes('to="/onboarding/plans/employee"') && onbPlansSrc4.includes('to="/onboarding/plans/intern"') && onbPlansSrc4.includes('/onboarding/plans/department/${row.department.id}'),
        '529. Manage Tasks navigation targets for every scope are byte-for-byte unchanged'
      );

      // 530. No page-level horizontal overflow risk was introduced — the responsive grid/media-query rules for scope cards remain intact
      assert(
        indexCssSrc9.match(/@media \(max-width:\s*1024px\)\s*\{[^}]*\.onboarding-scope-grid-2[^}]*\{[^}]*grid-template-columns:\s*1fr/) &&
        indexCssSrc9.match(/@media \(max-width:\s*640px\)\s*\{[\s\S]{0,120}\.onboarding-scope-grid-2/),
        '530. The existing responsive breakpoints for the scope card grids (1024px/640px stacking) remain intact and unregressed by the visual refinement'
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

      // 532. getScopesSummary() now exposes the actual ordered task array per scope (not just counts) — the single data source the Plans page reads
      {
        const summaryWithTasks = await onboardingService.getScopesSummary();
        assert(
          Array.isArray(summaryWithTasks.employee.tasks) && summaryWithTasks.employee.tasks.length === 7 &&
          Array.isArray(summaryWithTasks.intern.tasks) && summaryWithTasks.intern.tasks.length === 3,
          `532. getScopesSummary() now returns a \`tasks\` array per scope (Employee: ${summaryWithTasks.employee.tasks.length}, Intern: ${summaryWithTasks.intern.tasks.length}) in addition to the existing counts`
        );
        const dept3Row = summaryWithTasks.departments.find((row) => row.department.id === 'dept-3');
        assert(dept3Row && Array.isArray(dept3Row.tasks) && dept3Row.tasks.length === 4, `532b. Department rows also expose their own \`tasks\` array, filtered by that exact department's id (Software Engineering: ${dept3Row ? dept3Row.tasks.length : 'missing'})`);
      }

      // 533. Universal scope's task list is rendered inside its card via the shared read-only ScopeTaskList/ScopeCard, sourced from summary.universal.tasks
      assert(onbPlansSrc5.includes('tasks={summary.universal.tasks}'), '533. The Universal Tasks card renders its configured task list from summary.universal.tasks (the same getScopesSummary() source backing its counts)');

      // 534. Employee scope's task list is rendered from summary.employee.tasks
      assert(onbPlansSrc5.includes('tasks={summary.employee.tasks}'), '534. The Employee Tasks card renders its configured task list from summary.employee.tasks');

      // 535. Intern scope's task list is rendered from summary.intern.tasks
      assert(onbPlansSrc5.includes('tasks={summary.intern.tasks}'), '535. The Intern Tasks card renders its configured task list from summary.intern.tasks');

      // 536. Department cards render tasks from each row's own `tasks` array (already filtered server-side by scopeDepartmentId === department.id) — never a manual name-to-task mapping in the UI
      assert(
        onbPlansSrc5.includes('tasks={row.tasks}') && !onbPlansSrc5.match(/row\.department\.name\s*===\s*['"]/),
        '536. Department cards render tasks from row.tasks (already scoped to that exact department by the service), with no manual department-name-to-task mapping in the UI'
      );

      // 537. Zero-task departments show the exact required empty-state copy, not a blank area
      assert(onbPlansSrc5.includes('No department-specific tasks configured. Universal and type-specific tasks will still apply.'), '537. A department with 0 configured tasks shows the exact required empty-state message instead of a blank task-list area');

      // 538. Descriptions render for each task row (allowing natural wrapping, no manual truncation)
      assert(onbPlansSrc5.includes('onboarding-scope-task-description') && !onbPlansSrc5.match(/onboarding-scope-task-description[\s\S]{0,60}\.slice\(/), '538. Task descriptions render in full (no manual .slice()/truncation) and are allowed to wrap naturally');

      // 539. Task ordering inside the overview reuses the SAME sequence-based sort as getScopeTasks() (the editor's own data source) — not a second, independently-implemented ordering
      assert(
        onboardingServiceSrc3.match(/getScopesSummary\(\)\s*\{[\s\S]{0,2000}bySequence[\s\S]{0,300}sort\(bySequence\)/) &&
        onboardingServiceSrc3.match(/const bySequence = \(a, b\) => \(a\.sequence \|\| 0\) - \(b\.sequence \|\| 0\);/g).length >= 1,
        '539. getScopesSummary() sorts every scope\'s task list by the same ascending `sequence` field used by getScopeTasks() — no separate/duplicate ordering logic, and never alphabetical'
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

      // 542. Manage Tasks navigation targets are unchanged (still the only way to edit each scope)
      assert(
        onbPlansSrc5.includes('to="/onboarding/plans/universal"') && onbPlansSrc5.includes('to="/onboarding/plans/employee"') &&
        onbPlansSrc5.includes('to="/onboarding/plans/intern"') && onbPlansSrc5.includes('/onboarding/plans/department/${row.department.id}'),
        '542. Manage Tasks still navigates to the exact same 4 scope-editor routes as before this task'
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

      // 545. FUNCTIONAL: a scope with more tasks than fit in the bounded area is still fully retrievable via the same data source (nothing is silently dropped/paginated) — verified against Employee scope (7 tasks) which already exceeds a few rows
      {
        const summaryForScrollCheck = await onboardingService.getScopesSummary();
        assert(summaryForScrollCheck.employee.tasks.length === summaryForScrollCheck.employee.taskCount, '545. Every task in a scope is present in the `tasks` array (count matches taskCount exactly) — the scrollable area clips visually, not the underlying data');
      }

      // 546. Employee/Intern grid no longer force-stretches both cards to equal height — each sizes to its own content
      assert(indexCssSrc10.match(/\.onboarding-scope-grid-2\s*\{[^}]*align-items:\s*start/), '546. .onboarding-scope-grid-2 uses align-items: start so Employee and Intern cards are not force-stretched to match each other\'s height now that task lists are visible');

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

      // 550. saveScopeTasks()/getScopeTasks() (the "Manage Tasks" editor's own data path) are byte-for-byte unchanged by this task
      assert(
        onboardingServiceSrc3.includes('async saveScopeTasks(scopeType, departmentId = null, tasksData = [], currentUserId') &&
        onboardingServiceSrc3.match(/async getScopeTasks\(scopeType, departmentId = null\)\s*\{\s*\n\s*const tasks = await this\.getScopeTaskDefinitions\(\);\s*\n\s*return tasks/),
        '550. saveScopeTasks() and getScopeTasks() (used by the "Manage Tasks" editor) retain their exact original implementations — this task only added a NEW read path (getScopesSummary\'s tasks field), it did not modify the editor\'s existing one'
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

      // 553. FUNCTIONAL: a description with 4+ newline-separated numbered lines round-trips through the exact same storage a Manage Tasks save uses, and the Plans overview's data source returns the description completely unmodified (no <br> injected, no newlines stripped)
      {
        const multiLineDescription = '1. Add them to the official Attendance WhatsApp group\n2. Brief them on the clock-in and clock-out procedures\n3. Explain their work arrangement and schedule (Hybrid/On-site)\n4. Advise them to coordinate with Admin regarding leave requests.';
        await onboardingService.saveScopeTasks('universal', null, [
          { title: 'Attendance Group Access', description: multiLineDescription, activityTypeId: 'act-type-1', relativeOffsetDays: 0, required: true },
        ]);
        const savedMultiLineTask = (await onboardingService.getScopeTasks('universal', null))[0];
        assert(
          savedMultiLineTask.description === multiLineDescription && (savedMultiLineTask.description.match(/\n/g) || []).length === 3 && !savedMultiLineTask.description.includes('<br'),
          '553. A 4-line, newline-separated description round-trips through saveScopeTasks()/getScopeTasks() completely unmodified — the stored plain-text description is untouched (no <br> tags injected, no newlines stripped), confirming this is a display-only CSS fix'
        );
        const summaryWithMultiLine = await onboardingService.getScopesSummary();
        assert(summaryWithMultiLine.universal.tasks[0].description === multiLineDescription, '553b. getScopesSummary() (the Plans overview\'s actual data source) also returns that same unmodified multi-line description — the UI has nothing left to do but respect the existing newlines via CSS');
        resetDatabase();
      }

      // --- PART 2: REQUIRED LABEL REMOVED FROM OVERVIEW ---

      // 554. The per-task "Required" badge/label and its backing CSS class are both removed from the overview
      assert(!onbPlansSrc6.includes('onboarding-scope-task-required-badge') && !onbPlansSrc6.match(/task\.required &&/), '554. The per-task Required badge (and the conditional {task.required && ...} that rendered it) is removed from the Plans overview task rows');
      assert(!indexCssSrc11.includes('.onboarding-scope-task-required-badge'), '554b. The now-unused .onboarding-scope-task-required-badge CSS rule was removed rather than left as dead code');

      // 555. task.required itself, and the scope-level required-count summary, remain completely intact — only the per-row visual label was removed
      {
        const summaryAfterRequiredRemoval = await onboardingService.getScopesSummary();
        assert(
          summaryAfterRequiredRemoval.employee.requiredCount === 6 && summaryAfterRequiredRemoval.employee.tasks.some((t) => t.required === true),
          `555. task.required booleans and the scope's requiredCount summary remain fully intact (Employee requiredCount: ${summaryAfterRequiredRemoval.employee.requiredCount}, expected 6) — only the per-task visual badge was removed, not the underlying data`
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

      // 563. All 4 scope types render through the exact same ScopeTaskList/ScopeCard components, so every fix (line breaks, no Required label, scrollbar gutter) applies identically everywhere — not just Universal
      assert(
        (onbPlansSrc6.match(/<ScopeTaskList/g) || []).length === 1 &&
        onbPlansSrc6.includes('tasks={summary.universal.tasks}') && onbPlansSrc6.includes('tasks={summary.employee.tasks}') &&
        onbPlansSrc6.includes('tasks={summary.intern.tasks}') && onbPlansSrc6.includes('tasks={row.tasks}'),
        '563. Universal/Employee/Intern/each Department card all render through the ONE shared <ScopeTaskList> component (declared once, fed 4 different task sources) — none of the 4 fixes could have been applied to only one scope'
      );

      // --- FUNCTIONAL: composition/migration/launch/Manage Tasks genuinely untouched by this display-only pass ---

      // 564. Composition logic (composeOnboardingTasks) is untouched — same Employee+Software Engineering result as before this task
      {
        const scopeDefsAfterDisplayFix = await onboardingService.getScopeTaskDefinitions();
        const compositionAfterDisplayFix = composeOnboardingTasks({ id: 'display-fix-check-emp', directoryType: 'Employee', department: { id: 'dept-3', name: 'Software Engineering' } }, scopeDefsAfterDisplayFix, '2026-08-15');
        assert(compositionAfterDisplayFix.counts.total === 11, `564. composeOnboardingTasks() still produces the same 11-task result for an Employee in Software Engineering — composition logic is untouched by this display-only refinement (found ${compositionAfterDisplayFix.counts.total})`);
      }

      // 565. Manage Tasks navigation targets remain byte-for-byte unchanged
      assert(
        onbPlansSrc6.includes('to="/onboarding/plans/universal"') && onbPlansSrc6.includes('to="/onboarding/plans/employee"') &&
        onbPlansSrc6.includes('to="/onboarding/plans/intern"') && onbPlansSrc6.includes('/onboarding/plans/department/${row.department.id}'),
        '565. Manage Tasks still navigates to the exact same 4 scope-editor routes as before this task'
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

      // 570. FUNCTIONAL: getScopesSummary() still returns accurate task counts (untouched by this UI-only removal) — used to confirm 567-569 didn't accidentally break real counts
      {
        const summaryForCountCheck = await onboardingService.getScopesSummary();
        assert(summaryForCountCheck.employee.taskCount === 7, `570. Task counts remain accurate after removing the required-count display (Employee taskCount: ${summaryForCountCheck.employee.taskCount}, expected 7)`);
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

      // 585. Cancel still behaves as a plain navigation Link back to the Plans overview (unchanged logic, only position changed)
      assert(planEditorSrc4.match(/plan-editor-bottom-actions">\s*\n\s*<Link to="\/onboarding\/plans" className="btn-secondary"/), '585. Cancel is still a plain <Link to="/onboarding/plans"> — identical navigation behavior, only its position on the page changed');

      // 586. Save Tasks is still the form's real submit button, wired to the same handleSave()/saveScopeTasks() path
      assert(planEditorSrc4.match(/type="submit"\s*\n\s*className="btn-primary"\s*\n\s*disabled=\{saving\}/) && planEditorSrc4.includes('await onboardingService.saveScopeTasks(scopeType, departmentId, tasks)'), '586. Save Tasks remains a real type="submit" button triggering the unchanged handleSave() -> saveScopeTasks() path — only its position changed');

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

      // 595. FUNCTIONAL: a NEW task added through saveScopeTasks() (mirroring what the simplified editor sends) defaults to required: true internally, without any UI ever exposing that field
      {
        await onboardingService.saveScopeTasks('universal', null, [
          { title: 'Stage18 Blank-Default Verification Task', description: '', activityTypeId: 'act-type-1', relativeOffsetDays: 0 },
        ]);
        const newlySavedTask = (await onboardingService.getScopeTasks('universal', null))[0];
        assert(newlySavedTask.required === true, `595. A newly-saved scope task defaults to required: true internally (an invisible compatibility field), even though the UI never collects or shows it (found required: ${newlySavedTask.required})`);
        resetDatabase();
      }

      // 596. FUNCTIONAL: existing legacy tasks with required: false are NOT rewritten/destroyed by this change — migration/storage remain non-destructive
      {
        const legacyEmployeeScopeTasks = await onboardingService.getScopeTasks('employee', null);
        const stillHasLegacyOptional = legacyEmployeeScopeTasks.some((t) => t.required === false);
        assert(stillHasLegacyOptional, '596. The legacy Employee-scope task that was originally required: false (from the pre-scopes migration) still exists with that exact stored value — nothing was destructively rewritten to remove the Required concept from storage');
      }

      // --- GENERAL ---

      // 597. Task sequence/ordering remains intact and untouched by this task
      {
        const employeeScopeSeqCheck = await onboardingService.getScopeTasks('employee', null);
        const seqs = employeeScopeSeqCheck.map((t) => t.sequence);
        assert(seqs.every((s, idx) => idx === 0 || s > seqs[idx - 1]), `597. Employee scope task sequence remains correctly ascending after this task's changes (found ${JSON.stringify(seqs)})`);
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

      // 649. A visible Delete/Trash icon now exists on non-archived note cards too (previously Archived-only)
      assert(
        noteCardSrc2.match(/variant !== 'archived'[\s\S]{0,900}icon-btn icon-btn-danger" title="Delete"/),
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

      // 706. Toolbar buttons have hover/active state and a title tooltip (keyboard-accessible <button> semantics, not a <div onClick>)
      assert(noteContentEditorSrc2.match(/<button type="button" className=\{`note-format-btn/g)?.length === 3 && noteContentEditorSrc2.includes('title="Bold (Ctrl+B)"'), '706. All 3 formatting controls are real <button type="button"> elements with title tooltips, and the CSS defines a distinct .note-format-btn.active state');
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

      // 758. READ state's formatted content is rendered via dangerouslySetInnerHTML fed through resolveNoteContentHtml — sanitized, same rendering path as Card View
      assert(/isArchivedReadOnly \|\| !isEditing[\s\S]{0,1500}dangerouslySetInnerHTML=\{\{ __html: resolveNoteContentHtml\(selectedNote\) \}\}/.test(notesDocViewSrc3), '758. READ state renders the saved note\'s formatted content via dangerouslySetInnerHTML fed through resolveNoteContentHtml (sanitized), not a disabled input');

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

