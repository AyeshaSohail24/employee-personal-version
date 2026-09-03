import { presenceService } from './presenceService.js';
import { seedService } from './seedService.js';
import { PRESENCE_STATES, PRESENCE_SOURCES } from '../domain/presenceDomain.js';
import { loadDatabase } from '../mock-data/storageEngine.js';

export async function runStage6Verification() {
  console.log('--- START STAGE 6 VERIFICATION ---');

  // 1. Reset dataset
  await seedService.resetToSeedData();
  console.log('✅ Seed dataset reset.');

  // 2. Fetch presence overview
  const overview = await presenceService.getPresenceOverview({ referenceDate: '2026-09-03' });

  // Check total workforce count = 15
  if (overview.totalCount !== 15) {
    throw new Error(`Expected current workforce count of 15 in presence overview, got ${overview.totalCount}`);
  }
  if (overview.employees.length !== 15) {
    throw new Error(`Expected 15 employees in default presence list, got ${overview.employees.length}`);
  }

  // Verify Former & Upcoming employees excluded
  const empIds = new Set(overview.employees.map((e) => e.id));
  if (empIds.has('emp-009') || empIds.has('emp-018')) {
    throw new Error('Former employees (emp-009, emp-018) MUST NOT appear in current presence list!');
  }
  if (empIds.has('emp-015')) {
    throw new Error('Unstarted Upcoming hire (emp-015) MUST NOT appear in current presence list!');
  }
  console.log('✅ Current workforce count is 15. Former and unstarted Upcoming employees strictly excluded.');

  // 3. Verify Priority Order Resolution & Corrected Unknown Fallback
  const harith = overview.employees.find((e) => e.id === 'emp-008'); // Seed Manual Override
  if (harith.presenceState !== PRESENCE_STATES.PRESENT || harith.presenceSource !== PRESENCE_SOURCES.MANUAL_OVERRIDE) {
    throw new Error(`Expected emp-008 to resolve Present via Manual Override, got state=${harith.presenceState}, source=${harith.presenceSource}`);
  }

  const chloe = overview.employees.find((e) => e.id === 'emp-007'); // Approved Leave
  if (chloe.presenceState !== PRESENCE_STATES.ON_LEAVE || chloe.presenceSource !== PRESENCE_SOURCES.APPROVED_LEAVE) {
    throw new Error(`Expected emp-007 to resolve On Leave via Approved Leave, got state=${chloe.presenceState}, source=${chloe.presenceSource}`);
  }

  const priyanka = overview.employees.find((e) => e.id === 'emp-005'); // Remote Attendance
  if (priyanka.presenceState !== PRESENCE_STATES.REMOTE || priyanka.presenceSource !== PRESENCE_SOURCES.ATTENDANCE) {
    throw new Error(`Expected emp-005 to resolve Remote via Attendance Check-In, got state=${priyanka.presenceState}, source=${priyanka.presenceSource}`);
  }

  const farah = overview.employees.find((e) => e.id === 'emp-016'); // Explicit Absent
  if (farah.presenceState !== PRESENCE_STATES.ABSENT || farah.presenceSource !== PRESENCE_SOURCES.ATTENDANCE) {
    throw new Error(`Expected emp-016 to resolve Absent via Attendance Check-In, got state=${farah.presenceState}, source=${farah.presenceSource}`);
  }

  const aaron = overview.employees.find((e) => e.id === 'emp-017'); // Missing checkin on scheduled working day -> UNKNOWN
  if (aaron.presenceState !== PRESENCE_STATES.UNKNOWN || aaron.presenceSource !== PRESENCE_SOURCES.WORK_SCHEDULE) {
    throw new Error(`Expected emp-017 to resolve UNKNOWN via Work Schedule, got state=${aaron.presenceState}, source=${aaron.presenceSource}`);
  }
  console.log('✅ Priority order verified: Override > Leave > Attendance > Work Schedule. Missing check-in correctly resolves to UNKNOWN (not Absent!).');

  // 4. Verify Work Mode vs Presence State distinction
  const marcus = overview.employees.find((e) => e.id === 'emp-004'); // Marcus Tan (Hybrid Work Mode, Office Check-In)
  if (marcus.workMode !== 'Hybrid' || marcus.presenceState !== PRESENCE_STATES.PRESENT) {
    throw new Error(`Expected emp-004 Work Mode=Hybrid and Presence State=Present, got mode=${marcus.workMode}, state=${marcus.presenceState}`);
  }
  console.log('✅ Work Mode (Hybrid) and Presence State (Present) confirmed as separate independent concepts.');

  // 5. Verify Override Creation, Clearing, and Audit Trail Preservation
  const createdOverride = await presenceService.createPresenceOverride({
    employeeId: 'emp-005',
    overrideState: PRESENCE_STATES.ON_LEAVE,
    reason: 'Emergency personal leave request',
    createdBy: 'Ayesha Z. (HR Admin)',
  });

  const updatedPriyanka = await presenceService.getEmployeePresence('emp-005', '2026-09-03');
  if (updatedPriyanka.state !== PRESENCE_STATES.ON_LEAVE || updatedPriyanka.source !== PRESENCE_SOURCES.MANUAL_OVERRIDE) {
    throw new Error(`Expected emp-005 presence to update to On Leave via Manual Override, got state=${updatedPriyanka.state}, source=${updatedPriyanka.source}`);
  }

  // Clear override
  await presenceService.clearPresenceOverride('emp-005', 'Ayesha Z. (HR Admin)');

  const restoredPriyanka = await presenceService.getEmployeePresence('emp-005', '2026-09-03');
  if (restoredPriyanka.state !== PRESENCE_STATES.REMOTE || restoredPriyanka.source !== PRESENCE_SOURCES.ATTENDANCE) {
    throw new Error(`Expected emp-005 presence to restore to derived Remote, got state=${restoredPriyanka.state}, source=${restoredPriyanka.source}`);
  }

  // Verify Audit History preserved
  const priyankaHistory = await presenceService.getPresenceOverrideHistory('emp-005');
  if (priyankaHistory.length !== 1 || priyankaHistory[0].active !== false || !priyankaHistory[0].endedAt) {
    throw new Error(`Expected 1 preserved audit history record for emp-005 with active=false, got count=${priyankaHistory.length}`);
  }
  console.log('✅ Manual override creation, status update, clearing, and audit trail preservation verified cleanly.');

  // 6. Verify Search & Filter functions
  const searchRes = await presenceService.getPresenceOverview({ search: 'Priyanka' });
  if (searchRes.filteredCount !== 1 || searchRes.employees[0].id !== 'emp-005') {
    throw new Error(`Expected 1 search result for Priyanka, got ${searchRes.filteredCount}`);
  }

  const dept3Res = await presenceService.getPresenceOverview({ departmentId: 'dept-3' });
  if (dept3Res.filteredCount !== 4) {
    throw new Error(`Expected 4 Software Engineering employees in presence overview, got ${dept3Res.filteredCount}`);
  }
  console.log('✅ Search and filter query capabilities verified cleanly.');

  console.log('--- ALL STAGE 6 VERIFICATION CHECKS PASSED CLEANLY ---');
  return true;
}
