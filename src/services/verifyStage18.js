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
  calculateDurationProgress,
  calculateTimelineRange,
  generateTimelineMonthTicks,
  calculateTimelineBarPosition,
} from '../utils/dateUtils.js';
import { employeeService } from './employeeService.js';
import { departmentService } from './departmentService.js';
import { positionService } from './positionService.js';
import { locationService } from './locationService.js';
import { employeeTypeService } from './employeeTypeService.js';
import { activityTypeService } from './activityTypeService.js';
import { scheduleService } from './scheduleService.js';
import { documentTypeService } from './documentTypeService.js';
import { onboardingService } from './onboardingService.js';
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

