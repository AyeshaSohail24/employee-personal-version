import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';
import { reportingService } from './reportingService.js';
import {
  calculateWorkforceMetrics,
  calculateHeadcountBreakdowns,
  calculatePresenceAnalytics,
  calculateActivityAnalytics,
  calculateOnboardingAnalytics,
  calculateOffboardingAnalytics,
  applyCanonicalManagerScoping,
} from '../domain/reportingDomain.js';

export async function runStage10Verification() {
  console.log('--- START STAGE 10 REPORTING VERIFICATION ---');

  // 1. Reset dataset to baseline seed
  resetDatabase();
  console.log('✅ Seed dataset reset successfully.');

  const TEST_REF_DATE = '2026-09-03';
  const db = loadDatabase();

  // 2. Secondary Persistence Check: Assert NO reporting collections added to storageEngine
  const reportingKeys = Object.keys(db).filter((k) => k.toLowerCase().includes('report') || k.toLowerCase().includes('analytic'));
  if (reportingKeys.length > 0) {
    throw new Error(`Violation: Found secondary reporting collections in database: ${reportingKeys.join(', ')}`);
  }
  console.log('✅ Storage engine verified: ZERO secondary reporting persistence collections found.');

  // 3. Headcount Definition Integrity: Excludes Former & Upcoming
  const workforce = calculateWorkforceMetrics(db.employees, db.employmentRecords, TEST_REF_DATE);
  console.log('✅ Calculated Workforce Metrics:', workforce);

  if (workforce.totalHeadcount !== 15) {
    throw new Error(`Expected Current Headcount of 15, got ${workforce.totalHeadcount}`);
  }
  if (workforce.activeCount !== 11) {
    throw new Error(`Expected Active count of 11, got ${workforce.activeCount}`);
  }
  if (workforce.onboardingCount !== 2) {
    throw new Error(`Expected Onboarding count of 2, got ${workforce.onboardingCount}`);
  }
  if (workforce.departingCount !== 2) {
    throw new Error(`Expected Departing count of 2, got ${workforce.departingCount}`);
  }
  if (workforce.upcomingCount !== 1) {
    throw new Error(`Expected Upcoming pipeline count of 1, got ${workforce.upcomingCount}`);
  }
  if (workforce.formerCount !== 2) {
    throw new Error(`Expected Former count of 2, got ${workforce.formerCount}`);
  }
  console.log('✅ Headcount integrity verified: Upcoming (1) & Former (2) strictly excluded from Current Headcount (15).');

  // 4. Headcount Report Data Verification
  const headcountReport = await reportingService.getHeadcountReport({
    referenceDate: TEST_REF_DATE,
    roleContext: { isHRAdmin: true },
  });

  if (headcountReport.employees.length !== 15) {
    throw new Error(`Expected Headcount roster count of 15, got ${headcountReport.employees.length}`);
  }
  console.log(`✅ Active Workforce Roster count strictly matches Current Headcount (15).`);

  // Verify resolution of Department, Position, Location on Headcount Roster
  const sampleEmp = headcountReport.employees.find((e) => e.id === 'emp-001'); // Tariq Ibrahim
  if (!sampleEmp || sampleEmp.departmentName === '—' || sampleEmp.positionTitle === '—' || sampleEmp.locationName === '—') {
    throw new Error(`Metadata resolution failed for Tariq Ibrahim: Dept=${sampleEmp?.departmentName}, Pos=${sampleEmp?.positionTitle}, Loc=${sampleEmp?.locationName}`);
  }
  console.log(`✅ Metadata resolution verified for Tariq Ibrahim: ${sampleEmp.departmentName} · ${sampleEmp.positionTitle} · ${sampleEmp.locationName}`);

  // 5. Hires Report Data & Metadata Verification
  const hiresReport = await reportingService.getHiresReport({
    referenceDate: TEST_REF_DATE,
    roleContext: { isHRAdmin: true },
  });
  if (hiresReport.newJoiners.length !== 3) {
    throw new Error(`Expected New Joiners roster count of 3, got ${hiresReport.newJoiners.length}`);
  }

  const hannah = hiresReport.newJoiners.find((e) => e.id === 'emp-013');
  const benjamin = hiresReport.newJoiners.find((e) => e.id === 'emp-015');
  if (!hannah || hannah.departmentName === '—' || hannah.positionTitle === '—') {
    throw new Error(`New Joiner metadata resolution failed for Hannah Razak: Dept=${hannah?.departmentName}, Pos=${hannah?.positionTitle}`);
  }
  if (!benjamin || benjamin.departmentName === '—' || benjamin.positionTitle === '—') {
    throw new Error(`Upcoming hire metadata resolution failed for Benjamin Teoh: Dept=${benjamin?.departmentName}, Pos=${benjamin?.positionTitle}`);
  }
  console.log(`✅ New Joiners metadata resolution verified: Hannah Razak (${hannah.departmentName} · ${hannah.positionTitle}), Benjamin Teoh (${benjamin.departmentName} · ${benjamin.positionTitle})`);

  // 6. Departures Report & Canonical Exit Date Verification
  const departuresReport = await reportingService.getDeparturesReport({
    referenceDate: TEST_REF_DATE,
    roleContext: { isHRAdmin: true },
  });
  if (departuresReport.departingEmployees.length !== 4) {
    throw new Error(`Expected Departing & Former roster count of 4, got ${departuresReport.departingEmployees.length}`);
  }

  const farah = departuresReport.departingEmployees.find((e) => e.id === 'emp-016');
  const aaron = departuresReport.departingEmployees.find((e) => e.id === 'emp-017');
  if (!farah || farah.departmentName === '—' || farah.positionTitle === '—' || farah.finalWorkingDate !== '2026-09-30') {
    throw new Error(`Departing metadata/exit date resolution failed for Farah Mansor: Dept=${farah?.departmentName}, Pos=${farah?.positionTitle}, FinalDate=${farah?.finalWorkingDate}`);
  }
  if (!aaron || aaron.departmentName === '—' || aaron.positionTitle === '—' || aaron.finalWorkingDate !== '2026-09-15') {
    throw new Error(`Departing metadata/exit date resolution failed for Aaron Kumar: Dept=${aaron?.departmentName}, Pos=${aaron?.positionTitle}, FinalDate=${aaron?.finalWorkingDate}`);
  }
  console.log(`✅ Departing exit dates verified: Farah Mansor (${farah.finalWorkingDate}), Aaron Kumar (${aaron.finalWorkingDate})`);

  // Verify missing Work Mode handling: Must evaluate to '—' (never default to 'On-site')
  const { enrichReportingEmployee } = await import('../domain/reportingDomain.js');
  const dummyEmpWithoutWorkMode = { id: 'test-emp', fullName: 'Test Emp', effectiveEmploymentRecord: {} };
  const enrichedDummy = enrichReportingEmployee(dummyEmpWithoutWorkMode);
  if (enrichedDummy.workMode !== '—') {
    throw new Error(`Violation: Missing workMode evaluated to '${enrichedDummy.workMode}' instead of '—'`);
  }
  console.log('✅ Missing Work Mode safety verified: missing workMode resolves to "—" (not "On-site").');

  // 7. Canonical Manager Scoping Verification
  const managerEmployeeId = 'emp-004'; // Marcus Tan (Manager)
  const scopedEmployees = applyCanonicalManagerScoping(db.employees, db.employmentRecords, managerEmployeeId, TEST_REF_DATE);
  console.log(`✅ Manager ${managerEmployeeId} canonical scoping returned ${scopedEmployees.length} permitted records.`);
  if (scopedEmployees.length === 0 || scopedEmployees.length >= db.employees.length) {
    throw new Error(`Canonical manager scoping failed or returned un-scoped full employee list.`);
  }

  // 8. Role Scoping Service Layer Verification
  // HR Admin role -> Full access
  const hrReport = await reportingService.getWorkforceOverviewReport({
    referenceDate: TEST_REF_DATE,
    roleContext: { isHRAdmin: true },
  });
  if (hrReport.isRestricted || !hrReport.workforceMetrics) {
    throw new Error('HR Admin role report retrieval failed or was restricted.');
  }
  console.log('✅ HR Admin role full access verified.');

  // Employee role -> Restricted access
  const empReport = await reportingService.getWorkforceOverviewReport({
    referenceDate: TEST_REF_DATE,
    roleContext: { isEmployee: true },
  });
  if (!empReport.isRestricted) {
    throw new Error('Employee role was improperly granted access to organization-wide reporting analytics.');
  }
  console.log('✅ Employee role restricted access verified.');

  // 9. Operational Health Report & Retention Route Compatibility
  const healthReport = await reportingService.getOperationalHealthReport({
    referenceDate: TEST_REF_DATE,
    roleContext: { isHR: true },
  });
  if (healthReport.isRestricted || !healthReport.presenceMetrics || !healthReport.activityMetrics) {
    throw new Error('Operational Health report failed to compile presence or activity metrics.');
  }
  console.log('✅ Operational Health report metrics compiled cleanly:', {
    signalCoverageRate: healthReport.presenceMetrics.signalCoverageRate,
    overdueCount: healthReport.activityMetrics.overdueCount,
  });

  console.log('--- ALL STAGE 10 VERIFICATION CHECKS PASSED CLEANLY ---');
  return true;
}
