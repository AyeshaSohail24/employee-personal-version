import { dashboardService } from './dashboardService.js';
import { employeeService } from './employeeService.js';
import { employmentRecordService } from './employmentRecordService.js';
import { resolveCurrentRecord, resolveNextRecord } from '../domain/employmentDomain.js';
import { seedService } from './seedService.js';

export async function runStage3Verification() {
  console.log('--- START STAGE 3 VERIFICATION ---');

  // 1. Reset dataset to seed
  await seedService.resetToSeedData();
  console.log('✅ Seed dataset reset.');

  // 2. Fetch Dashboard summary
  const summary = await dashboardService.getDashboardSummary();
  console.log('✅ Fetched dashboard summary:', summary.metrics);

  // 3. Verify total & lifecycle metrics
  const { metrics } = summary;
  if (metrics.totalEmployees !== 18) throw new Error(`Expected total 18, got ${metrics.totalEmployees}`);
  if (metrics.activeCount !== 11) throw new Error(`Expected 11 active, got ${metrics.activeCount}`);
  if (metrics.onboardingCount !== 2) throw new Error(`Expected 2 onboarding, got ${metrics.onboardingCount}`);
  if (metrics.upcomingCount !== 1) throw new Error(`Expected 1 upcoming, got ${metrics.upcomingCount}`);
  if (metrics.newJoinersGroupCount !== 3) throw new Error(`Expected 3 new joiners group, got ${metrics.newJoinersGroupCount}`);
  if (metrics.departingCount !== 2) throw new Error(`Expected 2 departing, got ${metrics.departingCount}`);
  if (metrics.formerCount !== 2) throw new Error(`Expected 2 former, got ${metrics.formerCount}`);

  // 4. Verify emp-015 effective-date resolution
  const refDate = new Date('2026-09-02');
  const emp015 = await employeeService.getById('emp-015', { hydrate: true });

  // emp-015 current record MUST be null before start date!
  if (emp015.currentEmploymentRecord !== null) {
    throw new Error('emp-015 currentEmploymentRecord MUST resolve to null before start date 2026-10-01!');
  }
  // emp-015 future record MUST be populated explicitly!
  if (!emp015.futureEmploymentRecord) {
    throw new Error('emp-015 futureEmploymentRecord MUST be populated for Upcoming hire!');
  }
  if (!emp015.department || emp015.department.name !== 'Corporate Finance') {
    throw new Error(`Expected emp-015 future department to be Corporate Finance, got ${emp015.department?.name}`);
  }
  console.log('✅ emp-015 currentRecord is NULL and futureRecord resolves Corporate Finance position!');

  // 5. Verify Department Snapshot headcount rules (Active + Onboarding + Departing = 15)
  const totalHeadcount = summary.departmentSnapshot.reduce((sum, d) => sum + d.currentHeadcount, 0);
  console.log(`✅ Total department snapshot currentHeadcount: ${totalHeadcount}`);
  if (totalHeadcount !== 15) {
    throw new Error(`Expected 15 department currentHeadcount (11 Active + 2 Onboarding + 2 Departing), got ${totalHeadcount}`);
  }

  // 6. Verify Former employees excluded from department snapshot
  const formerEmp009 = await employeeService.getById('emp-009', { hydrate: true });
  const formerEmp018 = await employeeService.getById('emp-018', { hydrate: true });
  if (formerEmp009.currentEmploymentRecord !== null || formerEmp018.currentEmploymentRecord !== null) {
    throw new Error('Former employees must resolve to null active record!');
  }
  console.log('✅ Former employees emp-009 & emp-018 resolve to null active record and are excluded from department headcount.');

  console.log('--- ALL STAGE 3 VERIFICATION CHECKS PASSED CLEANLY ---');
  return true;
}
