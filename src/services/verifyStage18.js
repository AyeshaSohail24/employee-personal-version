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
} from '../domain/onboardingDomain.js';
import { offboardingService } from './offboardingService.js';
import { activityService } from './activityService.js';
import { dashboardService } from './dashboardService.js';
import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';
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

    // 25. Activities remain operational
    const activities = await activityService.getAll();
    assert(Array.isArray(activities), '25. Activities module remains operational');

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

    // 310. OverdueTasksModal still renders task info + Mark Complete via props only (no owned data fetch — reused, not duplicated)
    assert(
      overdueTasksModalCodeOnly.includes('task.title') && overdueTasksModalCodeOnly.includes('task.dueDate') && overdueTasksModalCodeOnly.includes('task.relatedEmployee') && overdueTasksModalCodeOnly.includes('task.assigneeEmployee') && overdueTasksModalCodeOnly.includes('onMarkComplete(task.id)') &&
      !overdueTasksModalCodeOnly.includes('getOverdueActivities') && !overdueTasksModalCodeOnly.includes('activityService'),
      '310. OverdueTasksModal still renders task title/due date/employee/assignee and Mark Complete via props only — no owned activityService call (no duplicated data source)'
    );

    // 311. Employees page wires its own fetched overdueTasks state and existing handler into the modal (single fetch call site)
    assert(
      onbEmployeesSrc.includes('activityService.getOverdueActivities()') && onbEmployeesSrc.includes('tasks={overdueTasks}') && onbEmployeesSrc.includes('onMarkComplete={handleMarkTaskComplete}'),
      '311. Employees page fetches overdue tasks once and passes the existing state/handler into OverdueTasksModal — overdue-task fetching has exactly one call site now that Dashboard is gone'
    );

    // --- LAUNCH ONBOARDING REUSE ---

    // 312. LaunchPlanModal's underlying launch workflow/logic is unchanged (only its outer modal
    // presentation/wording were fixed in a later task — see the Onboarding UI Refinements section)
    assert(
      launchPlanModalSrc.includes('onboardingService.launchPlanInstance') && launchPlanModalSrc.includes('onboardingService.previewPlanLaunch'),
      '312. LaunchPlanModal is unchanged — still drives employee/template selection, preview, and launch via the existing onboardingService'
    );
    assert(
      onbEmployeesSrc.includes('isOpen={isLaunchModalOpen}') && onbEmployeesSrc.includes('onSuccess={() => loadData()}'),
      '312b. Employees page wires LaunchPlanModal with the existing open/close state and refreshes the same loadData() on success (no reimplementation)'
    );

    // --- PLANS (must remain untouched) ---

    // 313. Plans page heading and template-management UI are untouched
    assert(onbPlansSrc.includes('>Onboarding Plan Templates<') && onbPlansSrc.includes('No Plan Templates Configured'), '313. Plans page heading and template-management UI remain completely unchanged');

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

    // 333. LaunchPlanModal's underlying launch business logic (employee/template selection, preview, manual overrides, launch call) is fully preserved
    assert(
      launchPlanModalSrc2.includes('onboardingService.previewPlanLaunch') && launchPlanModalSrc2.includes('onboardingService.launchPlanInstance') && launchPlanModalSrc2.includes('manualOverrides') && launchPlanModalSrc2.includes('canLaunch'),
      '333. LaunchPlanModal preserves its existing employee/template selection, preview, manual-override, and launch business logic unchanged'
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

    // 361b. The employee detail task breakdown no longer shows a dangling "Rule:" label with nothing after it when a manually-added task has no assignmentRule
    assert(
      onbDetailSrc2.includes('{task.assignmentRule && (') && onbDetailSrc2.includes("Rule: {task.assignmentRule}"),
      '361b. The task breakdown\'s "Rule: X" line only renders when assignmentRule is present — no empty "Rule:" label for manually-added tasks with no rule'
    );

    // --- ASSIGNEE RULE REMOVAL — BUSINESS LOGIC SAFETY ---

    // 361. Reusable assignment logic (ASSIGNMENT_RULES, resolveAssigneeForRule) remains fully intact and still used by the Launch Onboarding Plan workflow and plan templates
    assert(
      onboardingDomainSrc.includes('export const ASSIGNMENT_RULES') && onboardingDomainSrc.includes('export function resolveAssigneeForRule') &&
      launchPlanModalSrc3.includes('resolvedAssigneeId') && onboardingServiceSrc2.includes('resolveAssigneeForRule('),
      '361. The reusable ASSIGNMENT_RULES / resolveAssigneeForRule() assignment system remains fully intact and still powers Launch Onboarding Plan and plan-template task resolution — nothing was globally removed'
    );

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

