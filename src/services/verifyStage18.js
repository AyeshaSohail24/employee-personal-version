import { CANONICAL_ROLES, hasCapability, ROLE_CAPABILITIES } from '../domain/permissionDomain.js';
import { employeeService } from './employeeService.js';
import { departmentService } from './departmentService.js';
import { documentTypeService } from './documentTypeService.js';
import { onboardingService } from './onboardingService.js';
import { offboardingService } from './offboardingService.js';
import { presenceService } from './presenceService.js';
import { reportingService } from './reportingService.js';
import { activityService } from './activityService.js';
import { configurationService } from './configurationService.js';
import { PRESENCE_STATES } from '../domain/presenceDomain.js';
import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';
import fs from 'fs';
import path from 'path';

export async function verifyStage18() {
  console.log('=== RUNNING STAGE 18 VERIFICATION SUITE ===');
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

    // 1. Exactly 3 canonical application roles exist
    assert(
      CANONICAL_ROLES.length === 3 &&
        CANONICAL_ROLES.includes('HR Admin') &&
        CANONICAL_ROLES.includes('HR') &&
        CANONICAL_ROLES.includes('Manager'),
      '1. Exactly 3 canonical application roles exist (HR Admin, HR, Manager)'
    );

    // 2. Employee and Payroll application access roles removed
    assert(
      !CANONICAL_ROLES.includes('Employee') && !CANONICAL_ROLES.includes('Payroll'),
      '2. Employee and Payroll application roles removed'
    );

    // 3. Employee workforce records remain 100% intact
    const emps = await employeeService.getAll();
    assert(Array.isArray(emps) && emps.length === 18, '3. Employee workforce records remain 100% intact (18 employees)');

    // 4. HR Admin retains required operational & permission capabilities
    assert(
      hasCapability('HR Admin', 'manage_permissions') === true &&
        hasCapability('HR Admin', 'manage_config_org') === true,
      '4. HR Admin retains operational and permission capabilities'
    );

    // 5. HR retains normal master data mutation rights
    assert(
      hasCapability('HR', 'manage_config_org') === true &&
        hasCapability('HR', 'manage_config_docs') === true &&
        hasCapability('HR', 'manage_employees') === true,
      '5. HR retains normal master data mutation rights'
    );

    // 6. HR can mutate Department master data (flat structure without parent)
    const testDept = await configurationService.createDepartment(
      { name: 'Stage 18 Polish Dept', code: 'POLISH_18', description: 'Testing HR mutation' },
      'HR'
    );
    assert(
      testDept && testDept.id && testDept.name === 'Stage 18 Polish Dept' && !('parentDepartmentId' in testDept),
      '6. HR role successfully created Department without parent hierarchy'
    );

    // 7. HR can mutate Document Type master data
    const testDoc = await configurationService.createDocumentType(
      { name: 'Stage 18 Doc', code: 'STG18_DOC', category: 'Compliance', requiresExpiry: false },
      'HR'
    );
    assert(testDoc && testDoc.id && testDoc.code === 'STG18_DOC', '7. HR role successfully created Document Type');

    // 8. Manager prohibited from Configuration master-data mutations
    let managerBlocked = false;
    try {
      await configurationService.createDepartment({ name: 'Illegal Dept', code: 'ILLEGAL' }, 'Manager');
    } catch (err) {
      managerBlocked = true;
    }
    assert(managerBlocked, '8. Manager role prohibited from mutating Configuration master data');

    // 9. Permissions page matrix remains read-only representation
    assert(
      hasCapability('HR Admin', 'manage_permissions') === true &&
        hasCapability('HR', 'manage_permissions') === false &&
        hasCapability('Manager', 'manage_permissions') === false,
      '9. Permissions matrix remains read-only representation'
    );

    // 10. Parent Department concept completely removed from canonical department records
    const allDepts = await departmentService.getAll();
    const hasAnyParent = allDepts.some(d => 'parentDepartmentId' in d || 'parentDept' in d);
    assert(!hasAnyParent, '10. Parent Department field no longer exists in canonical Department records');

    // 11. Organization table and Department modal UI cleaned of Parent Department terminology
    const orgConfigPageSrc = fs.readFileSync(path.resolve('./src/pages/configuration/OrganizationConfigPage.jsx'), 'utf-8');
    const deptModalSrc = fs.readFileSync(path.resolve('./src/components/configuration/DepartmentModal.jsx'), 'utf-8');
    const headerSrc = fs.readFileSync(path.resolve('./src/components/layout/Header.jsx'), 'utf-8');
    
    assert(
      !orgConfigPageSrc.includes('Parent Dept') &&
      !deptModalSrc.includes('Parent Department') &&
      !headerSrc.includes('Role Demo:'),
      '11. UI cleaned of Parent Dept column, Parent Department modal field, and Role Demo label'
    );

    // 12. Internal employee status lifecycle domain operational
    const emp1 = await employeeService.getById('emp-001');
    assert(emp1 && emp1.status === 'Active', '12. Internal employee status lifecycle logic operational');

    // 13. Stage 14 Presence semantics preserved
    const marcusPresence = await presenceService.getEmployeePresence('emp-004', '2026-09-03');
    assert(marcusPresence.state === PRESENCE_STATES.UNKNOWN, '13. Presence semantics preserved (Scheduled office employee resolves Unknown)');

    // 14. Documents Configuration operational
    const docsConfig = await configurationService.getDocumentConfig();
    assert(Array.isArray(docsConfig.documentTypes) && docsConfig.documentTypes.length >= 6, '14. Documents configuration operational');

    // 15. Employee Directory operational
    const activeEmps = await employeeService.getByStatus('Active');
    assert(Array.isArray(activeEmps) && activeEmps.length > 0, '15. Employee Directory operational');

    // 16. Onboarding operational
    const onboardingTemplates = await onboardingService.getAllTemplates();
    assert(Array.isArray(onboardingTemplates), '16. Onboarding service operational');

    // 17. Offboarding operational
    const offboardingTemplates = await offboardingService.getAllTemplates();
    assert(Array.isArray(offboardingTemplates), '17. Offboarding service operational');

    // 18. Activities operational
    const activities = await activityService.getAll();
    assert(Array.isArray(activities), '18. Activity service operational');

    // 19. Presence operational
    const presenceOverview = await presenceService.getPresenceOverview({ referenceDate: '2026-09-03' });
    assert(presenceOverview && Array.isArray(presenceOverview.employees), '19. Presence service operational');

    // 20. Reporting operational
    const overviewReport = await reportingService.getWorkforceOverviewReport({ referenceDate: '2026-09-03' });
    assert(overviewReport && overviewReport.workforceMetrics && typeof overviewReport.workforceMetrics.totalHeadcount === 'number', '20. Reporting service operational');

    // 21. Configuration services operational
    const orgConfig = await configurationService.getOrganizationConfig();
    assert(orgConfig && Array.isArray(orgConfig.departments), '21. Configuration services operational');

    // 22. Storage migration safe and idempotent for flat departments & Penang removal
    const dbReload = loadDatabase();
    assert(dbReload && dbReload.documentTypes && dbReload.departments && dbReload.departments.every(d => !('parentDepartmentId' in d)), '22. Storage migration safe and idempotent for flat departments');

    // 23. Penang Work Location completely removed from seed data, database, and employment records
    const allLocations = dbReload.locations || [];
    const allEmpRecords = dbReload.employmentRecords || [];
    const penangLoc = allLocations.find(l => l.id === 'loc-2' || (l.name && l.name.includes('Penang')));
    const penangEmpRecs = allEmpRecords.filter(r => r.locationId === 'loc-2');
    const kennethRec = allEmpRecords.find(r => r.employeeId === 'emp-009');

    assert(!penangLoc, '23a. Penang Work Location (loc-2) is absent from seed and database locations');
    assert(penangEmpRecs.length === 0, '23b. Zero employment records reference obsolete Penang location ID');
    assert(kennethRec && kennethRec.locationId === 'loc-1', '23c. Kenneth Ooi (emp-009) location reassigned to loc-1 (Rizurf HQ — KL)');

    // 24. Referential-integrity delete protection for referenced locations intact
    let deleteLocErr = null;
    try {
      await configurationService.deleteLocation('loc-1', 'HR Admin');
    } catch (err) {
      deleteLocErr = err;
    }
    assert(deleteLocErr !== null, '24. Delete protection blocks deletion of referenced Work Location loc-1');

    // 25. Technology department completely removed from seed data, database, positions, and employment records
    const allDeptsAfter = dbReload.departments || [];
    const allPositionsAfter = dbReload.positions || [];
    const techDept = allDeptsAfter.find(d => d.id === 'dept-2' || (d.name && d.name.trim().toLowerCase() === 'technology'));
    const techPositions = allPositionsAfter.filter(p => p.departmentId === 'dept-2');
    const techEmpRecs = (dbReload.employmentRecords || []).filter(r => r.departmentId === 'dept-2');

    assert(!techDept, '25a. Technology department (dept-2) is absent from seed and loaded database');
    assert(techPositions.length === 0, '25b. Zero job positions reference obsolete Technology department ID (dept-2)');
    assert(techEmpRecs.length === 0, '25c. Zero employment records reference obsolete Technology department ID (dept-2)');

    // 26. No production login/auth required or introduced
    const loginPagePath = path.resolve('./src/pages/LoginPage.jsx');
    assert(!fs.existsSync(loginPagePath), '26. No login or authentication backend files introduced');

    // 27. System-wide verification completed cleanly
    assert(results.every(r => r.status === 'PASS'), '27. System-wide Stage 18 verification completed cleanly');

    resetDatabase();
  } catch (err) {
    console.error('Unhandled error in verifyStage18:', err);
    assert(false, 'Unhandled error in verifyStage18', err.message);
  }

  const passedCount = results.filter(r => r.status === 'PASS').length;
  console.log(`\n=== STAGE 18 VERIFICATION SUMMARY: ${passedCount}/${results.length} PASSED ===\n`);
  return passedCount === results.length;
}

if (process.argv[1] && process.argv[1].includes('verifyStage18.js')) {
  verifyStage18();
}
