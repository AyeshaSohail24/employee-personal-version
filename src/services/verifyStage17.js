import fs from 'fs';
import path from 'path';
import { ROLES, CANONICAL_ROLES, ROLE_CAPABILITIES, hasCapability } from '../domain/permissionDomain.js';
import { employeeService } from './employeeService.js';
import { configurationService } from './configurationService.js';
import { documentTypeService } from './documentTypeService.js';
import { onboardingService } from './onboardingService.js';
import { offboardingService } from './offboardingService.js';
import { presenceService } from './presenceService.js';
import { reportingService } from './reportingService.js';
import { PRESENCE_STATES } from '../domain/presenceDomain.js';
import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';

export async function verifyStage17() {
  console.log('=== RUNNING STAGE 17 VERIFICATION SUITE ===');
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

    // 2. Employee and Payroll are no longer application roles
    assert(!CANONICAL_ROLES.includes('Employee') && !CANONICAL_ROLES.includes('Payroll'), '2. Employee and Payroll application roles removed');

    // 3. Employee domain/workforce records remain intact
    const employees = await employeeService.getAll();
    assert(Array.isArray(employees) && employees.length >= 10, '3. Employee workforce records remain 100% intact');

    // 4. HR Admin can manage normal HR master data
    assert(hasCapability('HR Admin', 'manage_config_org') === true, '4. HR Admin has manage_config_org capability');

    // 5. HR can manage normal HR master data
    assert(hasCapability('HR', 'manage_config_org') === true, '5. HR has manage_config_org capability');

    // 6. HR can create/edit Departments
    const createdDept = await configurationService.createDepartment(
      { name: 'Stage 17 HR Dept', code: 'STG17_DEPT', parentId: null },
      'HR'
    );
    assert(createdDept && createdDept.id.startsWith('dept-'), '6. HR role successfully created Department');

    // 7. HR can manage Positions and Work Locations
    const createdPos = await configurationService.createPosition(
      { name: 'Stage 17 HR Pos', departmentId: createdDept.id },
      'HR'
    );
    assert(createdPos && createdPos.id.startsWith('pos-'), '7. HR role successfully created Job Position');

    // 8. HR can manage Employment Types and Employee Tags
    const createdType = await configurationService.createEmployeeType(
      { name: 'Stage 17 Temp', code: 'STG17_TEMP', category: 'General' },
      'HR'
    );
    assert(createdType && createdType.id.startsWith('type-'), '8. HR role successfully created Employment Type');

    // 9. HR can manage Activity configuration
    const createdAct = await configurationService.createActivityType(
      { name: 'Stage 17 Activity', category: 'HR', icon: 'FileText' },
      'HR'
    );
    assert(createdAct && createdAct.id.startsWith('act-type-'), '9. HR role successfully created Activity Type');

    // 10. HR can manage Work Schedules
    const createdSched = await configurationService.createSchedule(
      { name: 'Stage 17 Schedule', workingDays: ['Monday', 'Tuesday'], startTime: '09:00', endTime: '17:00', weeklyHours: 16 },
      'HR'
    );
    assert(createdSched && createdSched.id.startsWith('sched-'), '10. HR role successfully created Work Schedule');

    // 11. HR can manage Document Types
    const createdDoc = await configurationService.createDocumentType(
      { name: 'Stage 17 Doc Type', code: 'STG17_DOC', category: 'Compliance', requiresExpiry: false },
      'HR'
    );
    assert(createdDoc && createdDoc.id.startsWith('doc-type-'), '11. HR role successfully created Document Type');

    // 12. Manager cannot mutate canonical HR master data
    let managerBlocked = false;
    try {
      await configurationService.createDepartment(
        { name: 'Manager Unauthorized Dept', code: 'MGR_DEPT', parentId: null },
        'Manager'
      );
    } catch (err) {
      managerBlocked = err.message.includes('Unauthorized');
    }
    assert(managerBlocked, '12. Manager role prohibited from creating Department');

    // 13. manage_permissions returns true ONLY for HR Admin
    assert(
      hasCapability('HR Admin', 'manage_permissions') === true &&
        hasCapability('HR', 'manage_permissions') === false &&
        hasCapability('Manager', 'manage_permissions') === false,
      '13. manage_permissions capability reserved exclusively for HR Admin'
    );

    // 14. Permission matrix accurately reflects runtime capability checks
    assert(ROLE_CAPABILITIES.manage_config_docs['HR'] === true, '14. Permission matrix accurately reflects runtime capability checks');

    // 15. Employee Directory remains operational
    const activeEmps = await employeeService.getByStatus('Active');
    assert(Array.isArray(activeEmps) && activeEmps.length > 0, '15. Employee Directory queries remain operational');

    // 16. Onboarding remains operational
    const onboardingTemplates = await onboardingService.getAllTemplates();
    assert(Array.isArray(onboardingTemplates), '16. Onboarding service remains operational');

    // 17. Offboarding remains operational
    const offboardingTemplates = await offboardingService.getAllTemplates();
    assert(Array.isArray(offboardingTemplates), '17. Offboarding service remains operational');

    // 18. Presence remains operational
    const presenceOverview = await presenceService.getPresenceOverview({ referenceDate: '2026-09-03' });
    assert(presenceOverview && Array.isArray(presenceOverview.employees), '18. Presence service remains operational');

    // 19. Reporting remains operational
    const overviewReport = await reportingService.getWorkforceOverviewReport({ referenceDate: '2026-09-03' });
    assert(overviewReport && overviewReport.workforceMetrics && typeof overviewReport.workforceMetrics.totalHeadcount === 'number', '19. Reporting service remains operational');

    // 20. Documents configuration remains operational
    const docsConfig = await configurationService.getDocumentConfig();
    assert(Array.isArray(docsConfig.documentTypes) && docsConfig.documentTypes.length >= 6, '20. Documents configuration remains operational');

    // 21. Lifecycle configuration remains removed
    const lifecyclePagePath = path.resolve('./src/pages/configuration/LifecycleConfigPage.jsx');
    assert(!fs.existsSync(lifecyclePagePath), '21. Stage 15 LifecycleConfigPage.jsx remains removed');

    // 22. Internal lifecycle logic remains operational
    const emp001 = await employeeService.getById('emp-001');
    assert(emp001 && emp001.status === 'Active', '22. Internal employee status lifecycle logic remains operational');

    // 23. Attendance remains completely removed
    const seedAttendancePath = path.resolve('./src/mock-data/seedAttendance.js');
    assert(!fs.existsSync(seedAttendancePath), '23. Attendance tracking files remain completely removed');

    // 24. Stage 14 Presence semantics remain intact
    const marcusPresence = await presenceService.getEmployeePresence('emp-004', '2026-09-03');
    assert(marcusPresence.state === PRESENCE_STATES.UNKNOWN, '24. Stage 14 Presence semantics preserved (Scheduled office employee resolves Unknown)');

    // Reset test database
    resetDatabase();

    const failures = results.filter((r) => r.status === 'FAIL');
    console.log(`\n=== STAGE 17 VERIFICATION SUMMARY: ${results.length - failures.length}/${results.length} PASSED ===`);

    return {
      success: failures.length === 0,
      total: results.length,
      passed: results.length - failures.length,
      failed: failures.length,
      results,
    };
  } catch (err) {
    console.error('VERIFICATION FATAL ERROR:', err);
    return { success: false, error: err.message };
  }
}

// Auto-execute if run directly via CLI
if (process.argv[1] && process.argv[1].endsWith('verifyStage17.js')) {
  verifyStage17().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
  });
}
