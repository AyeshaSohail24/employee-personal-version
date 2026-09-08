import { presenceService } from './presenceService.js';
import { scheduleService } from './scheduleService.js';
import { configurationService } from './configurationService.js';
import { reportingService } from './reportingService.js';
import {
  resolvePresenceState,
  PRESENCE_STATES,
  PRESENCE_SOURCES,
} from '../domain/presenceDomain.js';
import { calculatePresenceAnalytics } from '../domain/reportingDomain.js';
import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';

export async function verifyStage14() {
  console.log('=== RUNNING STAGE 14 VERIFICATION SUITE ===');
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

    // 1. Storage & Collection Cleanup Verification
    assert(!('attendance' in db), '1. db.attendance collection completely removed from storage engine');
    assert(PRESENCE_SOURCES.ATTENDANCE === undefined, '2. PRESENCE_SOURCES.ATTENDANCE source is completely eliminated');
    assert(PRESENCE_SOURCES.WORK_LOCATION === undefined, '3. PRESENCE_SOURCES.WORK_LOCATION state source removed (location is display context only)');

    // 2. Truthful Presence Semantics Verification
    // Rule: Scheduled working day + Office location MUST NOT derive Present -> Must resolve Unknown
    const marcusPresence = await presenceService.getEmployeePresence('emp-004', '2026-09-03');
    assert(
      marcusPresence.state === PRESENCE_STATES.UNKNOWN,
      '4. Scheduled office employee (emp-004) without override resolves to Unknown (NOT Present)'
    );
    assert(
      marcusPresence.source === PRESENCE_SOURCES.SYSTEM,
      '5. Scheduled office employee without override uses System Fallback source'
    );
    assert(
      marcusPresence.details?.note === 'No current presence signal',
      '6. Unknown state provides explicit tooltip detail: "No current presence signal"'
    );

    // Rule: Missing data does NOT derive Absent
    const farahPresence = await presenceService.getEmployeePresence('emp-016', '2026-09-03');
    assert(
      farahPresence.state === PRESENCE_STATES.UNKNOWN,
      '7. Missing check-in / unreported employee (emp-016) resolves to Unknown (NOT Absent)'
    );

    // Rule: Default Remote Work Location alone does NOT prove Remote presence
    const priyankaPresence = await presenceService.getEmployeePresence('emp-005', '2026-09-03');
    assert(
      priyankaPresence.state === PRESENCE_STATES.UNKNOWN,
      '8. Default Remote location employee (emp-005) without explicit request/override resolves to Unknown'
    );

    // Rule: Approved Leave resolves On Leave
    const chloePresence = await presenceService.getEmployeePresence('emp-007', '2026-09-03');
    assert(
      chloePresence.state === PRESENCE_STATES.ON_LEAVE && chloePresence.source === PRESENCE_SOURCES.APPROVED_LEAVE,
      '9. Approved Leave (emp-007) resolves On Leave via Approved Leave source'
    );

    // Rule: HR Manual Override is required to assert Present or Absent
    const harithPresence = await presenceService.getEmployeePresence('emp-008', '2026-09-03');
    assert(
      harithPresence.state === PRESENCE_STATES.PRESENT && harithPresence.source === PRESENCE_SOURCES.MANUAL_OVERRIDE,
      '10. Present state (emp-008) is asserted exclusively via HR Manual Override'
    );

    // Create Absent Override
    await presenceService.createPresenceOverride({
      employeeId: 'emp-001',
      overrideState: PRESENCE_STATES.ABSENT,
      reason: 'Confirmed unexcused absence by HR',
      createdBy: 'Ayesha Z. (HR Admin)',
    });
    const tariqPresence = await presenceService.getEmployeePresence('emp-001', '2026-09-03');
    assert(
      tariqPresence.state === PRESENCE_STATES.ABSENT && tariqPresence.source === PRESENCE_SOURCES.MANUAL_OVERRIDE,
      '11. Absent state can be explicitly asserted via HR Manual Override'
    );

    // Clear Override for emp-001
    await presenceService.clearPresenceOverride('emp-001', 'Ayesha Z. (HR Admin)');

    // Rule: Non-Working Day resolves Not Scheduled
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
    assert(
      sundayPresence.state === PRESENCE_STATES.NOT_SCHEDULED && sundayPresence.source === PRESENCE_SOURCES.WORK_SCHEDULE,
      '12. Non-working day (Sunday 2026-09-06) resolves Not Scheduled via Work Schedule'
    );

    // 3. Reporting Integration & Truthful Presence Metrics
    const reportData = await reportingService.getWorkforceOverviewReport({
      referenceDate: '2026-09-03',
      roleContext: { isHRAdmin: true },
    });
    assert(!reportData.isRestricted && reportData.presenceMetrics !== undefined, '13. Reporting overview computes presence metrics cleanly without db.attendance');
    assert(typeof reportData.presenceMetrics.knownSignalCount === 'number', '14. Reporting presenceMetrics provides knownSignalCount metric');
    assert(typeof reportData.presenceMetrics.signalCoverageRate === 'number', '15. Reporting presenceMetrics provides signalCoverageRate metric (no attendance health rate)');
    assert(reportData.presenceMetrics.unknownCount > 0, '16. Truthful Unknown count is properly contributed to reporting distribution');
    assert(reportData.presenceMetrics.presentCount === 1, '17. HR Override Present for emp-008 accurately contributes to Present count (1)');
    assert(reportData.presenceMetrics.leaveCount === 2, '18. Approved Leave for emp-007 and emp-010 accurately contributes to On Leave count (2)');

    // 4. Stage 13 Configuration → Presence Preservation
    const presenceConfig = await configurationService.getPresenceConfig();
    assert(Array.isArray(presenceConfig.schedules) && presenceConfig.schedules.length >= 4, '19. Stage 13 Work Schedule configuration remains 100% operational');

    const failures = results.filter((r) => r.status === 'FAIL');
    console.log(`=== STAGE 14 VERIFICATION COMPLETE: ${results.length - failures.length}/${results.length} PASSED ===`);

    if (failures.length > 0) {
      throw new Error(`Stage 14 Verification Failed with ${failures.length} failure(s).`);
    }

    return { success: true, results };
  } catch (err) {
    console.error('❌ Stage 14 Verification Fatal Error:', err);
    return { success: false, error: err.message, results };
  }
}
