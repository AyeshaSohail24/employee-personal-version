import { resetDatabase } from '../mock-data/storageEngine.js';
import { activityService } from './activityService.js';
import { resolveDueState, filterActivities, validateActivity, ACTIVITY_DUE_STATES } from '../domain/activityDomain.js';
import { getTodayLocalDateString, getDaysDifference } from '../utils/dateUtils.js';

export async function runStage7Verification() {
  console.log('--- START STAGE 7 VERIFICATION ---');

  // 1. Reset database to seed baseline
  resetDatabase();
  console.log('✅ Seed dataset reset successfully.');

  const TEST_REF_DATE = '2026-09-02';

  // 2. Date Utility Boundary Verification
  const localToday = getTodayLocalDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localToday)) {
    throw new Error(`getTodayLocalDateString returned invalid format: "${localToday}"`);
  }
  console.log(`✅ Local date utility validated (${localToday}). Test reference date set to ${TEST_REF_DATE}.`);

  // 3. Activity Types Verification
  const types = await activityService.getAllTypes();
  if (!types || types.length === 0) {
    throw new Error('Activity types seed data is empty.');
  }
  console.log(`✅ Loaded ${types.length} ActivityTypes.`);

  // 4. All Activities Query & Enrichment Verification
  const allActivities = await activityService.getAll({ referenceDate: TEST_REF_DATE });
  if (allActivities.length === 0) {
    throw new Error('Activity seed dataset is empty.');
  }

  // Check enrichment of related employee, assignee, and type
  const firstAct = allActivities[0];
  if (!firstAct.relatedEmployee || !firstAct.assigneeEmployee || !firstAct.type) {
    throw new Error('Activity enrichment failed: missing relatedEmployee, assigneeEmployee, or type object.');
  }
  console.log(`✅ Loaded and enriched ${allActivities.length} seed activities.`);

  // 5. Due State Resolution & Precedence Verification
  // Test Completed precedence
  const completedState = resolveDueState({ dueDate: '2026-08-01', completed: true }, TEST_REF_DATE);
  if (completedState !== ACTIVITY_DUE_STATES.COMPLETED) {
    throw new Error(`Expected Completed state precedence, got "${completedState}"`);
  }

  // Test Due Today
  const dueTodayState = resolveDueState({ dueDate: '2026-09-02', completed: false }, TEST_REF_DATE);
  if (dueTodayState !== ACTIVITY_DUE_STATES.DUE_TODAY) {
    throw new Error(`Expected Due Today state, got "${dueTodayState}"`);
  }

  // Test Overdue
  const overdueState = resolveDueState({ dueDate: '2026-08-25', completed: false }, TEST_REF_DATE);
  if (overdueState !== ACTIVITY_DUE_STATES.OVERDUE) {
    throw new Error(`Expected Overdue state, got "${overdueState}"`);
  }

  // Test Upcoming
  const upcomingState = resolveDueState({ dueDate: '2026-09-15', completed: false }, TEST_REF_DATE);
  if (upcomingState !== ACTIVITY_DUE_STATES.UPCOMING) {
    throw new Error(`Expected Upcoming state, got "${upcomingState}"`);
  }
  console.log('✅ Dynamic due-state resolution priority engine verified.');

  // 6. Query Scopes Verification
  // My Activities scope (Tariq Ibrahim - emp-001)
  const myActivities = await activityService.getMyActivities('emp-001', { referenceDate: TEST_REF_DATE });
  const allEmp1Assigned = myActivities.every((a) => a.assigneeId === 'emp-001');
  if (!allEmp1Assigned) {
    throw new Error('My Activities query contained activities assigned to other users.');
  }
  console.log(`✅ My Activities query verified (${myActivities.length} tasks assigned to emp-001).`);

  // Overdue scope
  const overdueList = await activityService.getOverdueActivities(TEST_REF_DATE);
  const allOverdue = overdueList.every((a) => resolveDueState(a, TEST_REF_DATE) === ACTIVITY_DUE_STATES.OVERDUE);
  if (!allOverdue) {
    throw new Error('Overdue activities query included non-overdue or completed items.');
  }
  console.log(`✅ Overdue activities query verified (${overdueList.length} overdue tasks).`);

  // 7. Activity Creation & Persistence Verification
  const newActivityData = {
    title: 'Verification Test Task',
    typeId: 'act-type-1',
    employeeId: 'emp-004',
    assigneeId: 'emp-001',
    dueDate: '2026-09-10',
    description: 'Created during Stage 7 verification run',
  };

  const created = await activityService.create(newActivityData, 'emp-001');
  if (!created || created.title !== 'Verification Test Task') {
    throw new Error('Failed to create new activity.');
  }

  const fetchedCreated = await activityService.getById(created.id);
  if (!fetchedCreated || fetchedCreated.description !== 'Created during Stage 7 verification run') {
    throw new Error('Created activity was not persisted in storageEngine.');
  }
  console.log(`✅ Activity creation & persistence verified (ID: ${created.id}).`);

  // 8. Mark Complete & Reopen State Transition Verification
  const completedAct = await activityService.markComplete(created.id, 'emp-001');
  if (!completedAct.completed || !completedAct.completedAt) {
    throw new Error('markComplete failed to update completion status and timestamp.');
  }

  const reopenedAct = await activityService.reopen(created.id, 'emp-001');
  if (reopenedAct.completed || reopenedAct.completedAt !== null) {
    throw new Error('reopen failed to reset completion status and timestamp.');
  }
  console.log('✅ Activity completion and reopening state transitions verified cleanly.');

  // 9. Former Employee Historical Activity Preservation
  const formerAct = allActivities.find((a) => a.relatedEmployee && a.relatedEmployee.status === 'Former');
  if (!formerAct) {
    throw new Error('No activity found related to Former employee (emp-009/Kenneth Ooi).');
  }
  if (formerAct.relatedEmployee.fullName !== 'Kenneth Ooi') {
    throw new Error(`Expected Former employee Kenneth Ooi, got ${formerAct.relatedEmployee.fullName}`);
  }
  console.log(`✅ Former employee historical activity preservation verified (Task for ${formerAct.relatedEmployee.fullName} [Former]).`);

  // 10. Fallback for Broken References
  const invalidData = {
    title: 'Invalid Ref Task',
    typeId: 'invalid-type-999',
    employeeId: 'invalid-emp-999',
    assigneeId: 'invalid-emp-999',
    dueDate: '2026-09-02',
  };

  const invalidCreated = await activityService.create(invalidData, 'emp-001');
  if (invalidCreated.relatedEmployee.fullName !== 'Unknown Employee' || invalidCreated.type.name !== 'General Task') {
    throw new Error('Broken reference fallback failed.');
  }
  console.log('✅ Graceful fallback for broken/invalid employee and type references verified.');

  console.log('--- ALL STAGE 7 VERIFICATION CHECKS PASSED CLEANLY ---');
  return true;
}
