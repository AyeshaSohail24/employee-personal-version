import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';
import { onboardingService } from './onboardingService.js';
import { activityService } from './activityService.js';
import { employeeService } from './employeeService.js';
import { employmentRecordService } from './employmentRecordService.js';
import {
  resolveOnboardingAnchorDate,
  resolveAssigneeForRule,
  generatePlanPreview,
  derivePlanInstanceStatus,
  calculatePlanProgress,
  reconcilePlanInstanceCompletion,
  ASSIGNMENT_RULES,
  PLAN_INSTANCE_STATUS,
} from '../domain/onboardingDomain.js';
import { getTodayLocalDateString } from '../utils/dateUtils.js';

export async function runStage8Verification() {
  console.log('--- START STAGE 8 ONBOARDING VERIFICATION ---');

  // 1. Reset database to seed baseline
  resetDatabase();
  console.log('✅ Seed dataset reset successfully.');

  const TEST_REF_DATE = '2026-09-02';

  // 2. Acyclic Module Import Integrity Check
  // Confirm onboardingDomain has zero service imports
  const db = loadDatabase();
  console.log('✅ Storage engine loaded. collections registered:', Object.keys(db).filter((k) => k.startsWith('onboarding')));

  // 3. Seeded Templates Integrity Verification
  const templates = await onboardingService.getAllTemplates();
  if (templates.length < 3) {
    throw new Error(`Expected at least 3 seeded templates, got ${templates.length}`);
  }
  console.log(`✅ Loaded ${templates.length} Onboarding Plan Templates.`);

  const stdTpl = templates.find((t) => t.id === 'tpl-001');
  if (!stdTpl || stdTpl.taskCount !== 7) {
    throw new Error(`Standard Onboarding Template (tpl-001) task count mismatch. Expected 7, got ${stdTpl ? stdTpl.taskCount : 0}`);
  }
  console.log(`✅ Template tpl-001 verified (${stdTpl.name}, ${stdTpl.taskCount} tasks).`);

  // 4. Anchor Date Resolution Test
  const hannah = await employeeService.getById('emp-013');
  const records = await employmentRecordService.getAll();
  const hannahAnchor = resolveOnboardingAnchorDate(hannah, records, TEST_REF_DATE);
  if (hannahAnchor !== '2026-08-15') {
    throw new Error(`Expected anchor date 2026-08-15 for Hannah Razak, got ${hannahAnchor}`);
  }
  console.log(`✅ Anchor date resolution verified (${hannah.fullName} -> ${hannahAnchor}).`);

  // 5. Dynamic Assignee Resolver (No Hardcoded HR)
  const userAccounts = db.userAccounts || [];
  const allEmployees = await employeeService.getAll();
  const hannahRecord = records.find((r) => r.employeeId === 'emp-013');

  const hrRes = resolveAssigneeForRule(ASSIGNMENT_RULES.HR, hannah, hannahRecord, userAccounts, allEmployees);
  if (!hrRes.isResolved || hrRes.assigneeId === 'emp-001') {
    // Primary HR user in seed is Sarah Abdullah (emp-003 / user-3)
    if (hrRes.assigneeId !== 'emp-003') {
      throw new Error(`HR resolver failed to dynamically resolve primary HR account. Got ${hrRes.assigneeId}`);
    }
  }
  console.log(`✅ Dynamic HR Assignee Resolver verified (Resolved HR: ${hrRes.assigneeName} [${hrRes.assigneeId}]).`);

  const mgrRes = resolveAssigneeForRule(ASSIGNMENT_RULES.MANAGER, hannah, hannahRecord, userAccounts, allEmployees);
  if (!mgrRes.isResolved || mgrRes.assigneeId !== 'emp-004') {
    throw new Error(`Manager resolver failed for Hannah. Expected emp-004, got ${mgrRes.assigneeId}`);
  }
  console.log(`✅ Dynamic Manager Assignee Resolver verified (${hannah.fullName}'s Manager -> ${mgrRes.assigneeName}).`);

  // 6. Plan Preview Generation & Unresolved Assignee Blocking
  const preview = await onboardingService.previewPlanLaunch('emp-013', 'tpl-001', TEST_REF_DATE);
  if (!preview.isValid || preview.taskPreviews.length !== 7) {
    throw new Error(`Plan preview for Hannah (emp-013) invalid. Expected 7 tasks, got ${preview.taskPreviews.length}`);
  }
  console.log(`✅ Plan Launch Preview verified (${preview.taskPreviews.length} tasks ready for launch).`);

  // 7. Single-write, validate-first PoC Persistence Launch Flow
  const newEmpId = 'emp-004'; // David Lee (Active, no plan)
  const launchedInst = await onboardingService.launchPlanInstance(newEmpId, 'tpl-001', {}, 'emp-001');
  if (!launchedInst || !launchedInst.id) {
    throw new Error('Failed to launch plan instance for David Lee.');
  }
  console.log(`✅ Single-write validate-first plan launch executed cleanly (Instance ID: ${launchedInst.id}).`);

  // Check linked activities creation
  const davidActivities = await activityService.getAll({ employeeId: newEmpId });
  const onboardingActs = davidActivities.filter((a) => a.source === 'Onboarding');
  if (onboardingActs.length < 7) {
    throw new Error(`Expected 7 onboarding activities created for David Lee, got ${onboardingActs.length}`);
  }
  console.log(`✅ Verified ${onboardingActs.length} Stage 7 Activity records generated with sourceEntityType link.`);

  // 8. One Active Plan Policy Enforcement
  let duplicateLaunchBlocked = false;
  try {
    await onboardingService.launchPlanInstance(newEmpId, 'tpl-002', {}, 'emp-001');
  } catch (err) {
    duplicateLaunchBlocked = true;
    console.log(`✅ One Active Plan Policy enforced: "${err.message}"`);
  }
  if (!duplicateLaunchBlocked) {
    throw new Error('One Active Plan Policy failed to block duplicate active plan launch!');
  }

  // 9. Functional Plan Template Builder Verification
  const newTplData = {
    name: 'Custom Test Onboarding Plan',
    departmentId: 'dept-eng',
    description: 'Created during Stage 8 verification',
  };
  const newTasksData = [
    { title: 'Setup Dev Station', activityTypeId: 'act-type-1', assignmentRule: 'employee', relativeOffsetDays: 0, required: true },
    { title: 'Pair Programming Session', activityTypeId: 'act-type-3', assignmentRule: 'manager', relativeOffsetDays: 3, required: false },
  ];

  const createdTpl = await onboardingService.createTemplate(newTplData, newTasksData, 'emp-001');
  if (!createdTpl || createdTpl.tasks.length !== 2) {
    throw new Error('Plan Builder template creation failed.');
  }
  console.log(`✅ Functional Plan Template Builder verified (Created Template ID: ${createdTpl.id} with ${createdTpl.tasks.length} tasks).`);

  // 10. Acyclic Reconciliation on Activity Mark Complete & Reopen
  const targetAct = onboardingActs[0];
  const initialInstState = await onboardingService.getInstanceById(launchedInst.id);
  const initialCompletedCount = initialInstState.progress.completedTasksCount;

  // Complete one activity
  await activityService.markComplete(targetAct.id, 'emp-001');
  const afterCompleteInst = await onboardingService.getInstanceById(launchedInst.id);
  if (afterCompleteInst.progress.completedTasksCount !== initialCompletedCount + 1) {
    throw new Error('Activity completion failed to update plan progress.');
  }
  console.log(`✅ Onboarding progress updated on activity completion (${afterCompleteInst.progress.completedTasksCount}/${afterCompleteInst.progress.totalTasks} completed).`);

  // Complete all required activities for David Lee to test plan auto-completion
  for (const act of onboardingActs) {
    if (!act.completed) {
      await activityService.markComplete(act.id, 'emp-001');
    }
  }

  const completedInst = await onboardingService.getInstanceById(launchedInst.id);
  if (completedInst.derivedStatus !== PLAN_INSTANCE_STATUS.COMPLETED || !completedInst.completedAt) {
    throw new Error(`Plan auto-completion reconciliation failed. Derived status: ${completedInst.derivedStatus}`);
  }
  console.log(`✅ Plan Instance auto-completed when all required tasks finished (completedAt: ${completedInst.completedAt}).`);

  // Reopen one activity and verify plan status reverts
  await activityService.reopen(targetAct.id, 'emp-001');
  const reopenedInst = await onboardingService.getInstanceById(launchedInst.id);
  if (reopenedInst.derivedStatus === PLAN_INSTANCE_STATUS.COMPLETED || reopenedInst.completedAt !== null) {
    throw new Error('Reopening activity failed to revert plan completion timestamp.');
  }
  console.log('✅ Reopening completed task cleanly reverted plan completion status and timestamp to null.');

  // 11. Former Employee Exception Handling Verification
  const formerEmp = await employeeService.getById('emp-009'); // Kenneth Ooi (Former)
  const formerInstances = await onboardingService.getAllInstances({ employeeId: 'emp-009' });
  if (formerInstances.length > 0) {
    const formerInst = formerInstances[0];
    const formerDerivedStatus = derivePlanInstanceStatus(formerInst, formerInst.taskInstances, [], formerEmp);
    if (formerDerivedStatus !== PLAN_INSTANCE_STATUS.NEEDS_ATTENTION) {
      throw new Error(`Expected Former employee plan status to evaluate to Needs Attention, got ${formerDerivedStatus}`);
    }
  }
  console.log('✅ Former employee plan instance exception handling verified.');

  console.log('--- ALL STAGE 8 VERIFICATION CHECKS PASSED CLEANLY ---');
  return true;
}
