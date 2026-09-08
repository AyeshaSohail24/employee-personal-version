import fs from 'fs';
import path from 'path';
import { employeeService } from './employeeService.js';
import { presenceService } from './presenceService.js';
import { configurationService } from './configurationService.js';
import {
  LIFECYCLE_STATUSES,
  filterEmployeesByStatus,
} from '../domain/lifecycleDomain.js';
import {
  PRESENCE_STATES,
  PRESENCE_SOURCES,
  resolvePresenceState,
} from '../domain/presenceDomain.js';
import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';

export async function verifyStage15() {
  console.log('=== RUNNING STAGE 15 VERIFICATION SUITE ===');
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

    // 1. Configuration Route & File Cleanup Verification
    const lifecyclePagePath = path.resolve('./src/pages/configuration/LifecycleConfigPage.jsx');
    assert(!fs.existsSync(lifecyclePagePath), '1. LifecycleConfigPage.jsx is completely removed from filesystem');

    const routerFileContent = fs.readFileSync('./src/router/index.jsx', 'utf8');
    assert(!routerFileContent.includes("path: 'lifecycle'"), '2. Router configuration contains no lifecycle route');

    const sidebarFileContent = fs.readFileSync('./src/components/layout/Sidebar.jsx', 'utf8');
    assert(!sidebarFileContent.includes("to=\"/configuration/lifecycle\""), '3. Sidebar navigation contains no Lifecycle entry');
    assert(
      sidebarFileContent.includes("to=\"/configuration/organization\"") &&
        sidebarFileContent.includes("to=\"/configuration/employees\"") &&
        sidebarFileContent.includes("to=\"/configuration/activities\"") &&
        sidebarFileContent.includes("to=\"/configuration/presence\"") &&
        sidebarFileContent.includes("to=\"/configuration/documents\"") &&
        sidebarFileContent.includes("to=\"/configuration/permissions\""),
      '4. Sidebar configuration sublist includes all 6 approved modules (Organization, Employees, Activities, Presence, Documents, Permissions)'
    );

    // 2. Underlying System Lifecycle Domain & Operations Preservation
    assert(
      LIFECYCLE_STATUSES.UPCOMING === 'Upcoming' &&
        LIFECYCLE_STATUSES.ONBOARDING === 'Onboarding' &&
        LIFECYCLE_STATUSES.ACTIVE === 'Active' &&
        LIFECYCLE_STATUSES.DEPARTING === 'Departing' &&
        LIFECYCLE_STATUSES.FORMER === 'Former',
      '5. System lifecycle status enum intact across all 5 statuses'
    );

    const activeEmps = filterEmployeesByStatus(db.employees, 'Active');
    const onboardingEmps = filterEmployeesByStatus(db.employees, 'Onboarding');
    assert(activeEmps.length === 11 && onboardingEmps.length === 2, '6. Lifecycle filtering by status produces truthful counts (11 Active, 2 Onboarding)');

    // 3. Attendance Elimination Audit Confirmation
    const seedAttendancePath = path.resolve('./src/mock-data/seedAttendance.js');
    assert(!fs.existsSync(seedAttendancePath), '7. seedAttendance.js does not exist');
    assert(!('attendance' in db), '8. db.attendance collection does not exist');
    assert(PRESENCE_SOURCES.ATTENDANCE === undefined, '9. PRESENCE_SOURCES.ATTENDANCE source is completely eliminated');

    // 4. Stage 14 Truthful Presence Semantics Preservation
    const marcusPresence = await presenceService.getEmployeePresence('emp-004', '2026-09-03');
    assert(marcusPresence.state === PRESENCE_STATES.UNKNOWN, '10. Scheduled office employee without override resolves to Unknown (NOT Present)');

    const chloePresence = await presenceService.getEmployeePresence('emp-007', '2026-09-03');
    assert(chloePresence.state === PRESENCE_STATES.ON_LEAVE, '11. Approved Leave resolves to On Leave');

    const harithPresence = await presenceService.getEmployeePresence('emp-008', '2026-09-03');
    assert(harithPresence.state === PRESENCE_STATES.PRESENT, '12. Present state requires explicit HR Manual Override');

    const sundayPresence = resolvePresenceState(
      'emp-001',
      db.employees,
      db.employmentRecords,
      db.leaves,
      [],
      db.schedules,
      [],
      '2026-09-06'
    );
    assert(sundayPresence.state === PRESENCE_STATES.NOT_SCHEDULED, '13. Non-working day resolves to Not Scheduled');

    // 5. Service & Configuration Authorization Preservation
    const hrConfig = await configurationService.getPresenceConfig({ roleContext: { isHRAdmin: true } });
    assert(Array.isArray(hrConfig.schedules) && hrConfig.schedules.length >= 4, '14. HR Admin access to configuration modules permitted');

    let managerBlocked = false;
    try {
      await configurationService.createSchedule(
        { name: 'Illegal Sched', workingDays: ['Monday'], startTime: '09:00', endTime: '17:00', weeklyHours: 8 },
        'Manager'
      );
    } catch (err) {
      managerBlocked = err.message.includes('Unauthorized');
    }
    assert(managerBlocked, '15. Manager role prohibited from configuration mutations');

    const failures = results.filter((r) => r.status === 'FAIL');
    console.log(`=== STAGE 15 VERIFICATION COMPLETE: ${results.length - failures.length}/${results.length} PASSED ===`);

    if (failures.length > 0) {
      throw new Error(`Stage 15 Verification Failed with ${failures.length} failure(s).`);
    }

    return { success: true, results };
  } catch (err) {
    console.error('❌ Stage 15 Verification Fatal Error:', err);
    throw err;
  }
}
