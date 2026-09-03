import { employeeService } from './employeeService.js';
import { seedService } from './seedService.js';

export async function runStage4Verification() {
  console.log('--- START STAGE 4 VERIFICATION ---');

  // 1. Reset database
  await seedService.resetToSeedData();
  console.log('✅ Seed dataset reset.');

  // 2. Query All route (18)
  const allRes = await employeeService.queryEmployees({ baseLifecycleScope: 'All' });
  if (allRes.baseCount !== 18 || allRes.totalFilteredCount !== 18) {
    throw new Error(`Expected 18 employees on All route, got baseCount=${allRes.baseCount}, total=${allRes.totalFilteredCount}`);
  }
  console.log('✅ All employees route query returned 18 employees.');

  // 3. Query Active route (11)
  const activeRes = await employeeService.queryEmployees({ baseLifecycleScope: 'Active' });
  if (activeRes.baseCount !== 11 || activeRes.totalFilteredCount !== 11) {
    throw new Error(`Expected 11 employees on Active route, got baseCount=${activeRes.baseCount}, total=${activeRes.totalFilteredCount}`);
  }
  console.log('✅ Active employees route query returned 11 employees.');

  // 4. Query New Joiners route (3)
  const newJoinersRes = await employeeService.queryEmployees({ baseLifecycleScope: 'NewJoiners' });
  if (newJoinersRes.baseCount !== 3 || newJoinersRes.totalFilteredCount !== 3) {
    throw new Error(`Expected 3 employees on NewJoiners route, got baseCount=${newJoinersRes.baseCount}, total=${newJoinersRes.totalFilteredCount}`);
  }
  console.log('✅ New Joiners route query returned 3 employees (2 Onboarding + 1 Upcoming).');

  // 5. Query Departing route (2)
  const departingRes = await employeeService.queryEmployees({ baseLifecycleScope: 'Departing' });
  if (departingRes.baseCount !== 2 || departingRes.totalFilteredCount !== 2) {
    throw new Error(`Expected 2 employees on Departing route, got baseCount=${departingRes.baseCount}, total=${departingRes.totalFilteredCount}`);
  }
  console.log('✅ Departing employees route query returned 2 employees.');

  // 6. Query Former route (2)
  const formerRes = await employeeService.queryEmployees({ baseLifecycleScope: 'Former' });
  if (formerRes.baseCount !== 2 || formerRes.totalFilteredCount !== 2) {
    throw new Error(`Expected 2 employees on Former route, got baseCount=${formerRes.baseCount}, total=${formerRes.totalFilteredCount}`);
  }
  console.log('✅ Former employees route query returned 2 employees.');

  // 7. Verify Former employee currentEmploymentRecord is NULL and historical record is populated
  const emp009 = formerRes.employees.find((e) => e.id === 'emp-009');
  if (emp009.currentEmploymentRecord !== null) {
    throw new Error('Former employee emp-009 currentEmploymentRecord MUST be null!');
  }
  if (!emp009.historicalEmploymentRecord || !emp009.department || !emp009.position) {
    throw new Error('Former employee emp-009 MUST have historicalEmploymentRecord, department, and position populated!');
  }
  console.log(`✅ Former employee emp-009 currentRecord is NULL, historical position: ${emp009.position.name}`);

  // 8. Verify emp-015 currentEmploymentRecord is NULL and future record is populated
  const emp015 = newJoinersRes.employees.find((e) => e.id === 'emp-015');
  if (emp015.currentEmploymentRecord !== null) {
    throw new Error('Upcoming employee emp-015 currentEmploymentRecord MUST be null!');
  }
  if (!emp015.futureEmploymentRecord || emp015.department?.name !== 'Corporate Finance') {
    throw new Error('Upcoming employee emp-015 MUST have futureEmploymentRecord and department Corporate Finance!');
  }
  console.log(`✅ Upcoming employee emp-015 currentRecord is NULL, future department: ${emp015.department.name}`);

  // 9. Verify route scope persistence after filter reset
  const activeFiltered = await employeeService.queryEmployees({
    baseLifecycleScope: 'Active',
    search: 'Marcus', // Search filter applied
  });
  if (activeFiltered.baseCount !== 11 || activeFiltered.totalFilteredCount !== 1) {
    throw new Error(`Expected filtered active search to be 1 of 11, got baseCount=${activeFiltered.baseCount}, total=${activeFiltered.totalFilteredCount}`);
  }

  // Simulating Reset Filters on Active route
  const activeReset = await employeeService.queryEmployees({
    baseLifecycleScope: 'Active',
    search: '', // Cleared search
  });
  if (activeReset.baseCount !== 11 || activeReset.totalFilteredCount !== 11) {
    throw new Error(`Reset filters on Active route MUST return to 11 employees, got ${activeReset.totalFilteredCount}`);
  }
  console.log('✅ Resetting filters on route-specific page preserves route baseLifecycleScope (Active=11).');

  // 10. Verify searching Former employee's historical data
  const formerSearch = await employeeService.queryEmployees({
    baseLifecycleScope: 'Former',
    search: 'Kenneth',
  });
  if (formerSearch.totalFilteredCount !== 1 || formerSearch.employees[0].id !== 'emp-009') {
    throw new Error('Searching Kenneth on Former route failed to find emp-009!');
  }
  console.log('✅ Searching Former employee historical data works cleanly.');

  console.log('--- ALL STAGE 4 VERIFICATION CHECKS PASSED CLEANLY ---');
  return true;
}
