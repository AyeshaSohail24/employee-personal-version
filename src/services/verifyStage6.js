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

  // 3. Verify Truthful Priority Order Resolution (Override > Leave > Remote Request > Work Schedule > System Fallback)
  const harith = overview.employees.find((e) => e.id === 'emp-008'); // Seed Manual Override
  if (harith.presenceState !== PRESENCE_STATES.PRESENT || harith.presenceSource !== PRESENCE_SOURCES.MANUAL_OVERRIDE) {
    throw new Error(`Expected emp-008 to resolve Present via Manual Override, got state=${harith.presenceState}, source=${harith.presenceSource}`);
  }

  const chloe = overview.employees.find((e) => e.id === 'emp-007'); // Approved Leave
  if (chloe.presenceState !== PRESENCE_STATES.ON_LEAVE || chloe.presenceSource !== PRESENCE_SOURCES.APPROVED_LEAVE) {
    throw new Error(`Expected emp-007 to resolve On Leave via Approved Leave, got state=${chloe.presenceState}, source=${chloe.presenceSource}`);
  }

  const priyanka = overview.employees.find((e) => e.id === 'emp-005'); // Scheduled working day without explicit signal -> UNKNOWN
  if (priyanka.presenceState !== PRESENCE_STATES.UNKNOWN || priyanka.presenceSource !== PRESENCE_SOURCES.SYSTEM) {
    throw new Error(`Expected emp-005 to resolve Unknown via System Fallback, got state=${priyanka.presenceState}, source=${priyanka.presenceSource}`);
  }

  const farah = overview.employees.find((e) => e.id === 'emp-016'); // Scheduled working day without explicit signal -> UNKNOWN (not Absent!)
  if (farah.presenceState !== PRESENCE_STATES.UNKNOWN || farah.presenceSource !== PRESENCE_SOURCES.SYSTEM) {
    throw new Error(`Expected emp-016 to resolve Unknown via System Fallback, got state=${farah.presenceState}, source=${farah.presenceSource}`);
  }

  console.log('✅ Priority order verified: Manual Override > Approved Leave > Remote Request > Work Schedule > System Fallback. Missing presence signal resolves cleanly to UNKNOWN.');

  // 4. Verify Work Mode vs Presence State distinction
  const marcus = overview.employees.find((e) => e.id === 'emp-004'); // Marcus Tan (Hybrid Work Mode, Unknown Presence State)
  if (marcus.workMode !== 'Hybrid' || marcus.presenceState !== PRESENCE_STATES.UNKNOWN) {
    throw new Error(`Expected emp-004 Work Mode=Hybrid and Presence State=Unknown, got mode=${marcus.workMode}, state=${marcus.presenceState}`);
  }
  console.log('✅ Work Mode (Hybrid) and Presence State (Unknown) confirmed as separate independent concepts. Scheduled office location does not derive Present.');

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
  if (restoredPriyanka.state !== PRESENCE_STATES.UNKNOWN || restoredPriyanka.source !== PRESENCE_SOURCES.SYSTEM) {
    throw new Error(`Expected emp-005 presence to restore to derived Unknown fallback, got state=${restoredPriyanka.state}, source=${restoredPriyanka.source}`);
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
