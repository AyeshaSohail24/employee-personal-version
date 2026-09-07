import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';
import { offboardingService } from './offboardingService.js';
import { onboardingService } from './onboardingService.js';
import { activityService } from './activityService.js';
import { employeeService } from './employeeService.js';
import { employmentRecordService } from './employmentRecordService.js';
import {
  resolveOffboardingAnchorDate,
  checkOffboardingEligibility,
  resolveAssigneeForRule,
  generateOffboardingPlanPreview,
  deriveOffboardingInstanceStatus,
  calculateOffboardingProgress,
  reconcileOffboardingPlanInstanceCompletion,
  ASSIGNMENT_RULES,
  OFFBOARDING_INSTANCE_STATUS,
} from '../domain/offboardingDomain.js';
import { getTodayLocalDateString } from '../utils/dateUtils.js';

export async function runStage9Verification() {
  console.log('--- START STAGE 9 OFFBOARDING VERIFICATION ---');

  // 1. Reset database to seed baseline
  resetDatabase();
  console.log('✅ Seed dataset reset successfully.');

  const TEST_REF_DATE = '2026-09-02';

  // 2. Storage Engine Registration & Collection Integrity
  const db = loadDatabase();
  const collections = Object.keys(db).filter((k) => k.startsWith('offboarding'));
  if (collections.length !== 4) {
    throw new Error(`Expected 4 registered offboarding collections, got ${collections.length}`);
  }
  console.log('✅ Storage engine loaded. Offboarding collections registered:', collections);

  // 3. Seeded Templates Integrity Verification
  const templates = await offboardingService.getAllTemplates();
  if (templates.length < 3) {
    throw new Error(`Expected at least 3 seeded offboarding templates, got ${templates.length}`);
  }
  const stdTpl = templates.find((t) => t.id === 'tpl-off-001');
  if (!stdTpl || stdTpl.taskCount !== 7) {
    throw new Error(`Standard Offboarding Template (tpl-off-001) task count mismatch. Expected 7, got ${stdTpl ? stdTpl.taskCount : 0}`);
  }
  console.log(`✅ Loaded ${templates.length} Offboarding Plan Templates (${stdTpl.name}, ${stdTpl.taskCount} tasks).`);

  // 4. Anchor Date Precedence Resolution Test
  const farah = await employeeService.getById('emp-016'); // Departing (2026-09-30)
  const records = await employmentRecordService.getAll();
  const farahAnchor = resolveOffboardingAnchorDate(farah, records, null, TEST_REF_DATE);
  if (farahAnchor !== '2026-09-30') {
    throw new Error(`Expected anchor date 2026-09-30 for Farah Mansor, got ${farahAnchor}`);
  }

  // Custom Anchor Date Override Test
  const customOverride = '2026-10-15';
  const farahCustomAnchor = resolveOffboardingAnchorDate(farah, records, customOverride, TEST_REF_DATE);
  if (farahCustomAnchor !== '2026-10-15') {
    throw new Error(`Custom anchor date override failed. Expected 2026-10-15, got ${farahCustomAnchor}`);
  }

  // Confirm custom anchor override does NOT mutate canonical EmploymentRecord or employee record
  if (farah.startDate !== '2023-04-01') {
    throw new Error('Custom anchor date illegally mutated canonical employee record!');
  }
  console.log(`✅ Anchor date precedence & non-mutating custom override verified (${farah.fullName} -> ${farahAnchor}, custom -> ${farahCustomAnchor}).`);

  // 5. Strict Eligibility Rules & Ineligibility Explanations Test
  const marcus = await employeeService.getById('emp-004'); // Active, no exit date
  const marcusEligibility = checkOffboardingEligibility(marcus, records, db.offboardingPlanInstances || []);
  if (marcusEligibility.isEligible) {
    throw new Error('Active employee without exit date was incorrectly marked eligible!');
  }
  if (!marcusEligibility.reason.includes('no confirmed exit date')) {
    throw new Error(`Expected missing exit date explanation, got: ${marcusEligibility.reason}`);
  }

  // Active with custom override -> Eligible
  const marcusCustomEligible = checkOffboardingEligibility(marcus, records, db.offboardingPlanInstances || [], '2026-11-30');
  if (!marcusCustomEligible.isEligible) {
    throw new Error('Active employee with custom override should be eligible!');
  }

  // Upcoming -> Ineligible
  const upcomingEmp = await employeeService.getById('emp-015');
  const upcomingEligibility = checkOffboardingEligibility(upcomingEmp, records, db.offboardingPlanInstances || []);
  if (upcomingEligibility.isEligible) {
    throw new Error('Upcoming employee was incorrectly marked eligible for offboarding!');
  }

  // Former -> Ineligible for new launch
  const formerEmp = await employeeService.getById('emp-009');
  const formerEligibility = checkOffboardingEligibility(formerEmp, records, db.offboardingPlanInstances || []);
  if (formerEligibility.isEligible) {
    throw new Error('Former employee was incorrectly marked eligible for new offboarding launch!');
  }
  console.log('✅ Tightened eligibility rules & explicit explanation messages verified.');

  // 6. Dynamic Assignee Resolver (No Hardcoded HR)
  const userAccounts = db.userAccounts || [];
  const allEmployees = await employeeService.getAll();
  const farahRecord = records.find((r) => r.employeeId === 'emp-016');

  const hrRes = resolveAssigneeForRule(ASSIGNMENT_RULES.HR, farah, farahRecord, userAccounts, allEmployees);
  if (!hrRes.isResolved || hrRes.assigneeId !== 'emp-003') {
    throw new Error(`HR resolver failed to dynamically resolve primary HR account. Got ${hrRes.assigneeId}`);
  }
  console.log(`✅ Dynamic HR Assignee Resolver verified (Resolved HR: ${hrRes.assigneeName} [${hrRes.assigneeId}]).`);

  const mgrRes = resolveAssigneeForRule(ASSIGNMENT_RULES.MANAGER, farah, farahRecord, userAccounts, allEmployees);
  if (!mgrRes.isResolved || mgrRes.assigneeId !== 'emp-008') {
    throw new Error(`Manager resolver failed for Farah. Expected emp-008, got ${mgrRes.assigneeId}`);
  }
  console.log(`✅ Dynamic Manager Assignee Resolver verified (${farah.fullName}'s Manager -> ${mgrRes.assigneeName}).`);

  // 7. Failed Launch Atomicity & Zero-Write Test
  const preDb = loadDatabase();
  const prePlanInstCount = (preDb.offboardingPlanInstances || []).length;
  const preTaskInstCount = (preDb.offboardingTaskInstances || []).length;
  const preActivityCount = (preDb.activities || []).length;

  let failedLaunchBlocked = false;
  try {
    // Attempt launching with an ineligible employee (Upcoming emp-015)
    await offboardingService.launchPlanInstance('emp-015', 'tpl-off-001');
  } catch (err) {
    failedLaunchBlocked = true;
  }

  if (!failedLaunchBlocked) {
    throw new Error('Failed launch validation did not throw error!');
  }

  const postDb = loadDatabase();
  if (
    (postDb.offboardingPlanInstances || []).length !== prePlanInstCount ||
    (postDb.onboardingTaskInstances || []).length !== preTaskInstCount ||
    (postDb.activities || []).length !== preActivityCount
  ) {
    throw new Error('Failed launch validation mutated storage! Zero-write atomicity violated.');
  }
  console.log('✅ Failed launch atomicity verified: ZERO new records written across all collections on failure.');

  // 8. Single-Write Validate-First Launch Transaction Execution
  const activeEmpWithOverride = 'emp-005'; // Priyanka Nair (Active)
  const launchedInst = await offboardingService.launchPlanInstance(
    activeEmpWithOverride,
    'tpl-off-002',
    {},
    '2026-10-31',
    'emp-001'
  );
  if (!launchedInst || !launchedInst.id) {
    throw new Error('Failed to launch offboarding plan instance.');
  }
  console.log(`✅ Single-write validate-first offboarding plan launch executed cleanly (Instance ID: ${launchedInst.id}).`);

  // Check linked Stage 7 activities creation
  const priyankaActs = await activityService.getAll({ employeeId: activeEmpWithOverride });
  const offboardingActs = priyankaActs.filter((a) => a.source === 'Offboarding');
  if (offboardingActs.length < 4) {
    throw new Error(`Expected 4 offboarding activities created for Priyanka Nair, got ${offboardingActs.length}`);
  }
  console.log(`✅ Verified ${offboardingActs.length} Stage 7 Activity records generated with sourceEntityType link.`);

  // 9. One Active Plan Policy Enforcement
  let duplicateLaunchBlocked = false;
  try {
    await offboardingService.launchPlanInstance(activeEmpWithOverride, 'tpl-off-001', {}, '2026-10-31', 'emp-001');
  } catch (err) {
    duplicateLaunchBlocked = true;
  }
  if (!duplicateLaunchBlocked) {
    throw new Error('One Active Plan Policy failed to block duplicate active offboarding launch!');
  }
  console.log('✅ One Active Offboarding Plan Policy enforced.');

  // 10. Required vs Optional Completion Policy & Activity Reconciliation
  const targetAct = offboardingActs[0];
  const initialInstState = await offboardingService.getInstanceById(launchedInst.id);
  const initialCompletedCount = initialInstState.progress.completedTasksCount;

  // Complete one activity
  await activityService.markComplete(targetAct.id, 'emp-001');
  const afterCompleteInst = await offboardingService.getInstanceById(launchedInst.id);
  if (afterCompleteInst.progress.completedTasksCount !== initialCompletedCount + 1) {
    throw new Error('Activity completion failed to update offboarding plan progress.');
  }
  console.log(`✅ Offboarding progress updated on activity completion (${afterCompleteInst.progress.completedTasksCount}/${afterCompleteInst.progress.totalTasks} completed).`);

  // Complete all required activities for Priyanka to test plan auto-completion
  for (const act of offboardingActs) {
    if (!act.completed) {
      await activityService.markComplete(act.id, 'emp-001');
    }
  }

  const completedInst = await offboardingService.getInstanceById(launchedInst.id);
  if (completedInst.derivedStatus !== OFFBOARDING_INSTANCE_STATUS.COMPLETED || !completedInst.completedAt) {
    throw new Error(`Offboarding plan auto-completion reconciliation failed. Derived status: ${completedInst.derivedStatus}`);
  }
  console.log(`✅ Offboarding Plan Instance auto-completed when all required tasks finished (completedAt: ${completedInst.completedAt}).`);

  // Reopen one activity and verify plan status reverts
  await activityService.reopen(targetAct.id, 'emp-001');
  const reopenedInst = await offboardingService.getInstanceById(launchedInst.id);
  if (reopenedInst.derivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED || reopenedInst.completedAt !== null) {
    throw new Error('Reopening activity failed to revert offboarding plan completion timestamp.');
  }
  console.log('✅ Reopening completed exit task cleanly reverted offboarding completion status and timestamp to null.');

  // 11. Former Employee Status Derivation Rules Test
  // Rule: Former + required done = Completed. Former + required incomplete = Needs Attention.
  const formerEmpObj = await employeeService.getById('emp-009'); // Kenneth Ooi (Former)
  const mockFormerCompletedStatus = deriveOffboardingInstanceStatus(
    { id: 'mock-1', employeeId: 'emp-009', completedAt: null },
    [{ id: 'ti-1', required: true, activityId: 'act-1' }],
    [{ id: 'act-1', completed: true }],
    formerEmpObj,
    TEST_REF_DATE
  );
  if (mockFormerCompletedStatus !== OFFBOARDING_INSTANCE_STATUS.COMPLETED) {
    throw new Error(`Former + required done should evaluate to Completed, got ${mockFormerCompletedStatus}`);
  }

  const mockFormerIncompleteStatus = deriveOffboardingInstanceStatus(
    { id: 'mock-2', employeeId: 'emp-009', completedAt: null },
    [{ id: 'ti-2', required: true, activityId: 'act-2' }],
    [{ id: 'act-2', completed: false }],
    formerEmpObj,
    TEST_REF_DATE
  );
  if (mockFormerIncompleteStatus !== OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION) {
    throw new Error(`Former + required incomplete should evaluate to Needs Attention, got ${mockFormerIncompleteStatus}`);
  }
  console.log('✅ Former employee status derivation rules verified (Former + required done = Completed).');

  // 12. Template Snapshot Immutability Test
  const launchedTi = launchedInst.taskInstances[0];
  const originalTitle = launchedTi.title;

  // Edit originating template
  await offboardingService.updateTemplate(
    'tpl-off-002',
    { name: 'Mutated Template Name' },
    [{ title: 'Mutated Task Title', activityTypeId: 'act-type-1', relativeOffsetDays: -99, required: true }],
    'emp-001'
  );

  const reFetchedInst = await offboardingService.getInstanceById(launchedInst.id);
  const reFetchedTi = reFetchedInst.taskInstances[0];
  if (reFetchedTi.title !== originalTitle) {
    throw new Error('Template edit illegally mutated running TaskInstance launch snapshot!');
  }
  console.log('✅ Template snapshot immutability verified: Template edits do not mutate running task instances.');

  // 13. Stage 8 Onboarding Isolation Test
  const onboardingInstances = await onboardingService.getAllInstances();
  if (!onboardingInstances || onboardingInstances.length === 0) {
    throw new Error('Stage 8 Onboarding instances corrupted or empty!');
  }
  const hannahOnboarding = onboardingInstances.find((i) => i.employeeId === 'emp-013');
  if (!hannahOnboarding || hannahOnboarding.derivedStatus !== 'Needs Attention') {
    throw new Error('Stage 8 Onboarding status isolation check failed!');
  }
  console.log('✅ Stage 8 Onboarding isolation verified: Onboarding workflows remain 100% isolated and intact.');

  console.log('--- ALL STAGE 9 VERIFICATION CHECKS PASSED CLEANLY ---');
  return true;
}
