import { departmentService } from './departmentService.js';
import { positionService } from './positionService.js';
import { locationService } from './locationService.js';
import { orgChartService } from './orgChartService.js';
import { employeeService } from './employeeService.js';
import { seedService } from './seedService.js';
import { getCurrentWorkforce } from '../domain/employmentDomain.js';
import { loadDatabase } from '../mock-data/storageEngine.js';

export async function runStage5Verification() {
  console.log('--- START STAGE 5 VERIFICATION ---');

  // 1. Reset database
  await seedService.resetToSeedData();
  console.log('✅ Seed dataset reset.');

  const db = loadDatabase();
  const employees = db.employees || [];
  const records = db.employmentRecords || [];

  // 2. Verify current workforce count = 15 (Active=11, Onboarding=2, Departing=2)
  const currentWorkforce = getCurrentWorkforce(employees, records);
  if (currentWorkforce.length !== 15) {
    throw new Error(`Expected current workforce of 15, got ${currentWorkforce.length}`);
  }
  const activeOnly = currentWorkforce.filter((e) => e.status === 'Active');
  if (activeOnly.length !== 11) {
    throw new Error(`Expected Active lifecycle status count of 11, got ${activeOnly.length}`);
  }
  console.log(`✅ Current workforce count is 15. Actual lifecycle Active count is 11.`);

  // 3. Verify Department headcounts total 15
  const depts = await departmentService.getAll({ withCount: true });
  const totalDeptHeadcount = depts.reduce((sum, d) => sum + d.currentHeadcount, 0);
  if (totalDeptHeadcount !== 15) {
    throw new Error(`Expected total department headcount of 15, got ${totalDeptHeadcount}`);
  }
  const engDept = depts.find((d) => d.id === 'dept-3');
  if (engDept.currentHeadcount !== 4) {
    throw new Error(`Expected Software Engineering currentHeadcount of 4, got ${engDept.currentHeadcount}`);
  }
  console.log(`✅ Total Department current headcount: ${totalDeptHeadcount}. Software Engineering currentHeadcount: 4.`);

  // 4. Verify Position occupant counts total 15
  const positions = await positionService.getAll();
  const totalPosOccupants = positions.reduce((sum, p) => sum + p.currentOccupantsCount, 0);
  if (totalPosOccupants !== 15) {
    throw new Error(`Expected total position occupant count of 15, got ${totalPosOccupants}`);
  }

  // Verify emp-015 upcoming count on Senior Accountant pos-14
  const srAccountantPos = positions.find((p) => p.id === 'pos-14');
  if (srAccountantPos.currentOccupantsCount !== 0 || srAccountantPos.upcomingCount !== 1) {
    throw new Error(`Expected pos-14 Senior Accountant to have currentOccupantsCount=0 and upcomingCount=1, got occupants=${srAccountantPos.currentOccupantsCount}, upcoming=${srAccountantPos.upcomingCount}`);
  }
  console.log(`✅ Total Position occupant count: ${totalPosOccupants}. Upcoming hire emp-015 correctly isolated (occupants=0, upcoming=1).`);

  // 5. Verify Location workforce counts total 15
  const locations = await locationService.getAll();
  const totalLocWorkforce = locations.reduce((sum, l) => sum + l.currentWorkforceCount, 0);
  if (totalLocWorkforce !== 15) {
    throw new Error(`Expected total location workforce count of 15, got ${totalLocWorkforce}`);
  }
  console.log(`✅ Total Work Location assigned workforce count: ${totalLocWorkforce}`);

  // 6. Verify Org Chart Tree contains 15 nodes, root dynamically identified
  const orgChart = await orgChartService.getOrgChart();
  if (orgChart.totalAssignedCount !== 15) {
    throw new Error(`Expected orgChart.totalAssignedCount of 15, got ${orgChart.totalAssignedCount}`);
  }
  if (orgChart.roots.length !== 1 || orgChart.roots[0].employee.id !== 'emp-001') {
    throw new Error(`Expected 1 dynamic root (emp-001 CEO), got ${orgChart.roots.length} roots`);
  }

  // Count distinct employees in tree
  const treeEmpIds = new Set();
  const collectIds = (node) => {
    if (treeEmpIds.has(node.employee.id)) {
      throw new Error(`Duplicate employee node found in org chart tree: ${node.employee.id}`);
    }
    treeEmpIds.add(node.employee.id);
    node.directReports.forEach(collectIds);
  };
  orgChart.roots.forEach(collectIds);

  if (treeEmpIds.size !== 15) {
    throw new Error(`Expected 15 distinct employees in Org Chart tree, got ${treeEmpIds.size}`);
  }
  if (treeEmpIds.has('emp-009') || treeEmpIds.has('emp-018') || treeEmpIds.has('emp-015')) {
    throw new Error('Former or Upcoming employees MUST NOT appear in Org Chart tree!');
  }
  console.log(`✅ Org Chart tree contains all 15 currently assigned employees exactly once (0 duplicates). Dynamic root: ${orgChart.roots[0].employee.fullName}`);

  // 7. Verify URL drill-down query handling
  const dept3ActiveQuery = await employeeService.queryEmployees({ baseLifecycleScope: 'Active', departmentId: 'dept-3' });
  if (dept3ActiveQuery.totalFilteredCount !== 2) { // 2 Active in dept-3 (Marcus, Priyanka)
    throw new Error(`Expected 2 Active employees in Software Engineering (dept-3), got ${dept3ActiveQuery.totalFilteredCount}`);
  }

  const dept3AllQuery = await employeeService.queryEmployees({ baseLifecycleScope: 'All', departmentId: 'dept-3' });
  if (dept3AllQuery.totalFilteredCount !== 6) { // 2 Active + 2 Onboarding + 2 Former
    throw new Error(`Expected 6 total employees in Software Engineering (dept-3), got ${dept3AllQuery.totalFilteredCount}`);
  }

  const invalidDeptQuery = await employeeService.queryEmployees({ baseLifecycleScope: 'All', departmentId: 'nonexistent-id' });
  if (invalidDeptQuery.totalFilteredCount !== 0) {
    throw new Error(`Expected 0 employees for invalid departmentId, got ${invalidDeptQuery.totalFilteredCount}`);
  }
  console.log('✅ URL department filter query handled cleanly and safely.');

  console.log('--- ALL STAGE 5 VERIFICATION CHECKS PASSED CLEANLY ---');
  return true;
}
