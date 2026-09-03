import { employeeService } from './employeeService.js';
import { employmentRecordService } from './employmentRecordService.js';
import { departmentService } from './departmentService.js';
import { positionService } from './positionService.js';
import { locationService } from './locationService.js';
import { scheduleService } from './scheduleService.js';
import { seedService } from './seedService.js';
import { resolveCurrentRecord } from '../domain/employmentDomain.js';

export async function runStage2Verification() {
  console.log('--- START STAGE 2 VERIFICATION ---');

  // 1. Reset dataset to initial seed
  await seedService.resetToSeedData();
  console.log('✅ Seed dataset reset successfully.');

  // 2. Test Employee retrieval
  const employees = await employeeService.getAll({ hydrate: true });
  console.log(`✅ Loaded ${employees.length} employees.`);
  if (employees.length !== 18) {
    throw new Error(`Expected 18 employees, got ${employees.length}`);
  }

  // 3. Test Lifecycle status distribution (11 Active, 2 Onboarding, 1 Upcoming, 2 Departing, 2 Former)
  const statusCounts = employees.reduce((acc, emp) => {
    acc[emp.status] = (acc[emp.status] || 0) + 1;
    return acc;
  }, {});
  console.log('✅ Lifecycle status counts:', statusCounts);
  if (
    statusCounts.Active !== 11 ||
    statusCounts.Onboarding !== 2 ||
    statusCounts.Upcoming !== 1 ||
    statusCounts.Departing !== 2 ||
    statusCounts.Former !== 2
  ) {
    throw new Error(`Unexpected status distribution: ${JSON.stringify(statusCounts)}`);
  }

  // 4. Test Effective-Date Aware History Resolution & Former Employee handling
  const refDate = new Date('2026-09-02');

  // Marcus Tan (emp-004) has 2 history records: initial in 2022, promoted 2024
  const marcusRecs = await employmentRecordService.getHistoryByEmployeeId('emp-004');
  console.log(`✅ emp-004 history record count: ${marcusRecs.length}`);
  if (marcusRecs.length !== 2) {
    throw new Error(`Expected 2 records for emp-004, got ${marcusRecs.length}`);
  }

  const marcusActive = await employmentRecordService.getCurrentRecord('emp-004', refDate);
  if (marcusActive.positionId !== 'pos-4') {
    throw new Error(`Expected emp-004 position to resolve to pos-4 (Manager), got ${marcusActive.positionId}`);
  }

  // Former Employees (emp-009 & emp-018) both have closed effectiveTo dates
  const formerActive1 = await employmentRecordService.getCurrentRecord('emp-009', refDate);
  const formerActive2 = await employmentRecordService.getCurrentRecord('emp-018', refDate);
  console.log('✅ Former employee emp-009 current active record on 2026-09-02:', formerActive1);
  console.log('✅ Former employee emp-018 current active record on 2026-09-02:', formerActive2);
  if (formerActive1 !== null || formerActive2 !== null) {
    throw new Error('Former employees with closed effectiveTo must NOT resolve to active employment records!');
  }

  // Future Hire (emp-015 Benjamin Teoh) starts 2026-10-01
  const futureActive = await employmentRecordService.getCurrentRecord('emp-015', refDate);
  console.log('✅ Future hire (emp-015) active record on 2026-09-02:', futureActive);
  if (futureActive !== null) {
    throw new Error('Future hire should NOT resolve as active before effectiveFrom date!');
  }

  // 5. Test Departments & Hierarchy
  const departments = await departmentService.getAll();
  const hierarchy = await departmentService.getHierarchy();
  console.log(`✅ Loaded ${departments.length} departments, top-level root count: ${hierarchy.length}`);

  // 6. Test Positions, Locations, Schedules
  const positions = await positionService.getAll();
  const locations = await locationService.getAll();
  const schedules = await scheduleService.getAll();
  console.log(`✅ Loaded ${positions.length} positions, ${locations.length} locations, ${schedules.length} schedules.`);

  console.log('--- ALL STAGE 2 VERIFICATION CHECKS PASSED CLEANLY ---');
  return true;
}
