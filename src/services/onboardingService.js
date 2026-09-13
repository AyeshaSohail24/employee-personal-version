import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { employeeService } from './employeeService.js';
import { employmentRecordService } from './employmentRecordService.js';
import { auditService, AUDIT_ACTIONS } from './auditService.js';
import {
  generatePlanPreview,
  derivePlanInstanceStatus,
  calculatePlanProgress,
  reconcilePlanInstanceCompletion,
  resolveAssigneeForRule,
  resolveOnboardingAnchorDate,
  composeOnboardingTasks,
  PLAN_INSTANCE_STATUS,
} from '../domain/onboardingDomain.js';
import { departmentService } from './departmentService.js';
import { resolveCurrentRecord, resolveNextRecord } from '../domain/employmentDomain.js';
import { addDaysToLocalDate, getTodayLocalDateString } from '../utils/dateUtils.js';

export const onboardingService = {
  /**
   * Fetches all Onboarding PlanTemplates with optional task count enrichment.
   */
  async getAllTemplates() {
    const db = loadDatabase();
    const templates = db.onboardingPlanTemplates || [];
    const tasks = db.onboardingPlanTasks || [];
    const departments = db.departments || [];

    return templates.map((tpl) => {
      const tplTasks = tasks.filter((t) => t.planTemplateId === tpl.id && t.active !== false);
      const dept = departments.find((d) => d.id === tpl.departmentId) || null;
      return {
        ...tpl,
        taskCount: tplTasks.length,
        requiredTaskCount: tplTasks.filter((t) => t.required).length,
        department: dept,
      };
    });
  },

  /**
   * Fetches a single PlanTemplate with its ordered tasks.
   */
  async getTemplateById(id) {
    if (!id) return null;
    const db = loadDatabase();
    const tpl = (db.onboardingPlanTemplates || []).find((t) => t.id === id);
    if (!tpl) return null;

    const tasks = (db.onboardingPlanTasks || [])
      .filter((t) => t.planTemplateId === id && t.active !== false)
      .sort((a, b) => a.sequence - b.sequence);

    const departments = db.departments || [];
    const dept = departments.find((d) => d.id === tpl.departmentId) || null;

    return {
      ...tpl,
      department: dept,
      tasks,
    };
  },

  /**
   * Creates a new PlanTemplate and its tasks (Plan Builder).
   */
  async createTemplate(templateData, tasksData = [], currentUserId = 'emp-001') {
    if (!templateData.name || !templateData.name.trim()) {
      throw new Error('Template name is required.');
    }

    if (!Array.isArray(tasksData) || tasksData.length === 0) {
      throw new Error('Template must contain at least 1 task.');
    }

    const hasRequired = tasksData.some((t) => t.required);
    if (!hasRequired) {
      throw new Error('Template must contain at least 1 required task.');
    }

    const db = loadDatabase();
    const templates = db.onboardingPlanTemplates || [];
    const tasks = db.onboardingPlanTasks || [];

    const newTplId = `tpl-${String(templates.length + 1).padStart(3, '0')}`;
    const nowIso = new Date().toISOString();

    const newTemplate = {
      id: newTplId,
      name: templateData.name.trim(),
      type: 'Onboarding',
      departmentId: templateData.departmentId || null,
      description: (templateData.description || '').trim(),
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const newTasks = tasksData.map((t, idx) => ({
      id: `pt-${newTplId}-${idx + 1}`,
      planTemplateId: newTplId,
      activityTypeId: t.activityTypeId || 'act-type-1',
      title: t.title.trim(),
      description: (t.description || '').trim(),
      // PlanEditor no longer collects an assignment rule — a falsy value is the existing
      // neutral path resolveAssigneeForRule() already understands (resolves to Unassigned),
      // not a newly invented default like 'employee'.
      assignmentRule: t.assignmentRule || null,
      specificAssigneeId: t.specificAssigneeId || null,
      relativeOffsetDays: parseInt(t.relativeOffsetDays || 0, 10),
      required: Boolean(t.required),
      sequence: idx + 1,
      active: true,
    }));

    db.onboardingPlanTemplates = [newTemplate, ...templates];
    db.onboardingPlanTasks = [...newTasks, ...tasks];

    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.ONBOARDING_TEMPLATE_CREATED || 'ONBOARDING_TEMPLATE_CREATED',
        'PlanTemplate',
        newTplId,
        `Created Onboarding Plan Template "${newTemplate.name}" with ${newTasks.length} tasks`
      );
    } catch (err) {}

    return this.getTemplateById(newTplId);
  },

  /**
   * Updates an existing PlanTemplate and its tasks.
   */
  async updateTemplate(id, templateData, tasksData = [], currentUserId = 'emp-001') {
    const db = loadDatabase();
    const templates = db.onboardingPlanTemplates || [];
    const idx = templates.findIndex((t) => t.id === id);

    if (idx === -1) {
      throw new Error(`PlanTemplate with ID "${id}" not found.`);
    }

    if (tasksData.length > 0 && !tasksData.some((t) => t.required)) {
      throw new Error('Template must contain at least 1 required task.');
    }

    const nowIso = new Date().toISOString();
    const updatedTemplate = {
      ...templates[idx],
      ...templateData,
      name: templateData.name ? templateData.name.trim() : templates[idx].name,
      description: templateData.description !== undefined ? templateData.description.trim() : templates[idx].description,
      updatedAt: nowIso,
    };

    templates[idx] = updatedTemplate;

    if (Array.isArray(tasksData) && tasksData.length > 0) {
      // Soft-deactivate existing tasks for this template
      const otherTasks = (db.onboardingPlanTasks || []).filter((t) => t.planTemplateId !== id);
      const newTasks = tasksData.map((t, index) => ({
        id: t.id && t.id.startsWith('pt-') ? t.id : `pt-${id}-${index + 1}-${Date.now().toString().slice(-4)}`,
        planTemplateId: id,
        activityTypeId: t.activityTypeId || 'act-type-1',
        title: t.title.trim(),
        description: (t.description || '').trim(),
        // Same neutral fallback as createTemplate() — see comment there.
        assignmentRule: t.assignmentRule || null,
        specificAssigneeId: t.specificAssigneeId || null,
        relativeOffsetDays: parseInt(t.relativeOffsetDays || 0, 10),
        required: Boolean(t.required),
        sequence: index + 1,
        active: true,
      }));

      db.onboardingPlanTasks = [...otherTasks, ...newTasks];
    }

    db.onboardingPlanTemplates = templates;
    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.ONBOARDING_TEMPLATE_UPDATED || 'ONBOARDING_TEMPLATE_UPDATED',
        'PlanTemplate',
        id,
        `Updated Onboarding Plan Template "${updatedTemplate.name}"`
      );
    } catch (err) {}

    return this.getTemplateById(id);
  },

  /**
   * Toggles PlanTemplate active status.
   */
  async toggleTemplateActive(id, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const templates = db.onboardingPlanTemplates || [];
    const idx = templates.findIndex((t) => t.id === id);

    if (idx === -1) {
      throw new Error(`PlanTemplate with ID "${id}" not found.`);
    }

    const newActive = !templates[idx].active;
    templates[idx].active = newActive;
    templates[idx].updatedAt = new Date().toISOString();

    db.onboardingPlanTemplates = templates;
    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.ONBOARDING_TEMPLATE_TOGGLED || 'ONBOARDING_TEMPLATE_TOGGLED',
        'PlanTemplate',
        id,
        `${newActive ? 'Activated' : 'Deactivated'} Onboarding Plan Template "${templates[idx].name}"`
      );
    } catch (err) {}

    return this.getTemplateById(id);
  },

  /**
   * Fetches all active, scope-tagged onboarding task definitions — each carrying both a
   * scopeType ('universal' | 'department') and a personType ('employee' | 'intern') — the raw
   * building blocks composeOnboardingTasks() combines per employee. Legacy tasks without a
   * scopeType/personType (pre-migration) are excluded here; the storageEngine migrations
   * backfill both fields on every load so this should not occur.
   */
  async getScopeTaskDefinitions() {
    const db = loadDatabase();
    return (db.onboardingPlanTasks || []).filter((t) => t.active !== false && t.scopeType && t.personType);
  },

  /**
   * Fetches summary counts (task count) AND the actual ordered task list for the given person
   * type's Universal scope and every real Department (dynamically sourced — never hardcoded),
   * i.e. exactly the 2 scope categories that remain after the onboarding Plans refactor
   * (Universal + Department-Specific), scoped entirely to ONE personType at a time — an
   * Employee Universal task and an Intern Universal task are never mixed together here, and
   * likewise for a department's tasks. Backs the Plans page's per-filter view (switching the
   * Employees/Interns segmented control just calls this again with the other personType), plus
   * each card's inline read-only task-list preview. The `tasks` array here is sorted by the
   * exact same `sequence` field (ascending) as getScopeTasks() (the editor's data source) — a
   * single read path, not a second composition/ordering implementation.
   */
  async getScopesSummary(personType = 'employee') {
    const tasks = await this.getScopeTaskDefinitions();
    const departments = await departmentService.getAll({ withCount: false });
    const bySequence = (a, b) => (a.sequence || 0) - (b.sequence || 0);

    const universalScoped = tasks.filter((t) => t.scopeType === 'universal' && t.personType === personType).sort(bySequence);

    const departmentSummaries = departments.map((dept) => {
      const scoped = tasks
        .filter((t) => t.scopeType === 'department' && t.personType === personType && t.scopeDepartmentId === dept.id)
        .sort(bySequence);
      return {
        department: dept,
        taskCount: scoped.length,
        tasks: scoped,
      };
    });

    return {
      personType,
      universal: { taskCount: universalScoped.length, tasks: universalScoped },
      departments: departmentSummaries,
    };
  },

  /**
   * Fetches the ordered task list for ONE (personType, scopeType[, departmentId]) combination
   * (used by the "Manage Tasks" editor). `scopeType` is 'universal' or 'department' only — the
   * old bare 'employee'/'intern' scopeType values were retired; that distinction is now the
   * required `personType` parameter.
   */
  async getScopeTasks(scopeType, personType, departmentId = null) {
    const tasks = await this.getScopeTaskDefinitions();
    return tasks
      .filter((t) => t.scopeType === scopeType && t.personType === personType && (scopeType !== 'department' || t.scopeDepartmentId === departmentId))
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  },

  /**
   * Replaces the task set for ONE (personType, scopeType[, departmentId]) combination. Mirrors
   * updateTemplate()'s existing soft-replace-by-key pattern (every other scope/personType
   * combination's tasks are left untouched) — saving Employee Universal, for example, can never
   * affect Intern Universal or any Department scope. No minimum-task-count validation — a scope
   * may legitimately be empty (e.g. a brand-new department, or Universal before HR configures
   * it). New tasks are never given an assignmentRule — they use the established neutral/
   * unassigned path (resolveAssigneeForRule(null, ...)), same as every other
   * post-assignment-removal task.
   */
  async saveScopeTasks(scopeType, personType, departmentId = null, tasksData = [], currentUserId = 'emp-001') {
    const db = loadDatabase();
    const allTasks = db.onboardingPlanTasks || [];

    const isSameScope = (t) => t.scopeType === scopeType && t.personType === personType && (scopeType !== 'department' || t.scopeDepartmentId === departmentId);
    const otherTasks = allTasks.filter((t) => !isSameScope(t));

    const newTasks = (tasksData || []).map((t, index) => ({
      id: t.id && String(t.id).startsWith('pt-') ? t.id : `pt-scope-${personType}-${scopeType}${departmentId ? `-${departmentId}` : ''}-${index + 1}-${Date.now().toString().slice(-4)}`,
      planTemplateId: null,
      scopeType,
      personType,
      scopeDepartmentId: scopeType === 'department' ? departmentId : null,
      activityTypeId: t.activityTypeId || 'act-type-1',
      title: (t.title || '').trim(),
      description: (t.description || '').trim(),
      assignmentRule: null,
      specificAssigneeId: null,
      relativeOffsetDays: parseInt(t.relativeOffsetDays || 0, 10),
      // Required Task is no longer collected by the scope editor — this is an internal
      // compatibility field only (all tasks now count equally toward progress; see
      // calculatePlanProgress()). Defaults to true unless a caller explicitly passes false, so
      // brand-new tasks are never silently marked required: false.
      required: t.required !== false,
      sequence: index + 1,
      active: true,
    }));

    db.onboardingPlanTasks = [...otherTasks, ...newTasks];
    saveDatabase(db);

    try {
      const scopeLabel = `${personType}-${scopeType}`;
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.ONBOARDING_TEMPLATE_UPDATED || 'ONBOARDING_TEMPLATE_UPDATED',
        'OnboardingTaskScope',
        departmentId ? `${scopeLabel}:${departmentId}` : scopeLabel,
        `Updated ${scopeLabel} onboarding task scope${departmentId ? ` (${departmentId})` : ''} with ${newTasks.length} tasks`
      );
    } catch (err) {}

    return this.getScopeTasks(scopeType, personType, departmentId);
  },

  /**
   * Composes an employee's full applicable onboarding task set (Universal + Employee/Intern +
   * Department) via the centralized composeOnboardingTasks() domain function, calculating due
   * dates off the same anchor-date resolution used everywhere else in onboarding. This is the
   * SAME function launchPlanInstance() calls below — the preview and the actual launch can
   * never drift apart because they share one code path and one set of inputs.
   */
  async previewOnboardingComposition(employeeId, referenceDate = getTodayLocalDateString()) {
    const employee = await employeeService.getById(employeeId);
    if (!employee) throw new Error(`Employee with ID "${employeeId}" not found.`);

    const records = await employmentRecordService.getAll();
    const anchorDate = resolveOnboardingAnchorDate(employee, records, referenceDate);

    if (!anchorDate) {
      return {
        isValid: false,
        error: `Employee ${employee.fullName} does not have a valid start date.`,
        employee,
        anchorDate: null,
        tasks: [],
        personType: employee.directoryType === 'Intern' ? 'intern' : 'employee',
        typeScope: employee.directoryType === 'Intern' ? 'intern' : 'employee',
        departmentId: (employee.department && employee.department.id) || null,
        counts: { universal: 0, typeSpecific: 0, department: 0, total: 0, required: 0 },
      };
    }

    const taskDefinitions = await this.getScopeTaskDefinitions();
    const composition = composeOnboardingTasks(employee, taskDefinitions, anchorDate);

    return {
      isValid: composition.counts.total > 0,
      error: composition.counts.total === 0 ? 'No onboarding tasks are configured for this employee.' : null,
      employee,
      anchorDate,
      ...composition,
    };
  },

  /**
   * Generates a preview for launching a plan template for an employee.
   * LEGACY — kept for historical templates (getAllTemplates/getTemplateById remain available
   * for getAllInstances()'s template-name lookup); the Launch Onboarding Plan UI no longer
   * calls this, use previewOnboardingComposition() instead.
   */
  async previewPlanLaunch(employeeId, templateId, referenceDate = getTodayLocalDateString()) {
    const db = loadDatabase();
    const employee = await employeeService.getById(employeeId);
    if (!employee) throw new Error(`Employee with ID "${employeeId}" not found.`);

    const template = await this.getTemplateById(templateId);
    if (!template) throw new Error(`PlanTemplate with ID "${templateId}" not found.`);

    const records = await employmentRecordService.getAll();
    const userAccounts = db.userAccounts || [];
    const allEmployees = await employeeService.getAll();

    return generatePlanPreview({
      template,
      planTasks: template.tasks || [],
      employee,
      records,
      userAccounts,
      allEmployees,
      referenceDate,
    });
  },

  /**
   * Single-write, validate-first PoC persistence launch transaction. Composed from reusable
   * scope-based task definitions (Universal + Employee/Intern + Department) via the same
   * previewOnboardingComposition() used by the Launch modal's preview panel, so the launched
   * instance's task set always exactly matches what HR was shown before clicking Launch.
   * Creates a full SNAPSHOT of the currently-applicable tasks: later edits to Universal or
   * Department scopes never retroactively change an already-launched instance, because these
   * task-instance records are plain field-copies, never re-read live from onboardingPlanTasks.
   */
  async launchPlanInstance(employeeId, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const employee = await employeeService.getById(employeeId);
    if (!employee) throw new Error(`Employee with ID "${employeeId}" not found.`);

    const existingInstances = db.onboardingPlanInstances || [];
    const rawActivities = db.activities || [];
    const rawTaskInstances = db.onboardingTaskInstances || [];

    // Duplicate-plan guard — reuses the exact same active-instance definition as
    // getActiveOnboardingEmployeeIds()/getLaunchEligibleEmployees() (the Launch modal
    // dropdown's data source), so the UI filter and this final check can never disagree. This
    // is NOT made redundant by the modal hiding ineligible people — it remains the
    // authoritative last line of defense (e.g. a stale/bypassed UI selection), and is the seam
    // where a future real backend would enforce the same rule server-side.
    const activeOnboardingEmployeeIds = await this.getActiveOnboardingEmployeeIds();
    if (activeOnboardingEmployeeIds.has(employeeId)) {
      throw new Error(`Employee ${employee.fullName} already has an active onboarding plan (In Progress / Needs Attention).`);
    }

    const preview = await this.previewOnboardingComposition(employeeId);
    if (!preview.isValid || preview.counts.total === 0) {
      throw new Error(preview.error || 'No onboarding tasks are configured for this employee.');
    }

    const nowIso = new Date().toISOString();
    const newInstId = `inst-${String(existingInstances.length + 1).padStart(3, '0')}`;

    const newPlanInstance = {
      id: newInstId,
      planTemplateId: null,
      employeeId,
      startedAt: preview.anchorDate,
      anchorDate: preview.anchorDate,
      completedAt: null,
      createdBy: currentUserId,
      createdAt: nowIso,
    };

    const newTaskInstances = [];
    const newActivities = [];
    const existingActivityCount = rawActivities.length;

    // No assignee is ever resolved here — composable scope tasks never carry an assignmentRule
    // (they use the same neutral/unassigned architecture as manually-added employee tasks), so
    // every task instance below is created with assigneeId: null, exactly like addTaskToInstance().
    preview.tasks.forEach((pt, index) => {
      const newActId = `act-onb-gen-${String(existingActivityCount + index + 1).padStart(3, '0')}`;
      const newTiId = `ti-${newInstId}-${index + 1}`;

      const taskInst = {
        id: newTiId,
        planInstanceId: newInstId,
        planTaskId: pt.id,
        activityId: newActId,
        title: pt.title,
        description: pt.description,
        activityTypeId: pt.activityTypeId,
        assignmentRule: null,
        originallyResolvedAssigneeId: null,
        relativeOffsetDays: pt.relativeOffsetDays,
        originallyCalculatedDueDate: pt.calculatedDueDate,
        required: pt.required,
        sequence: pt.sequence,
        scopeType: pt.scopeType,
        scopeDepartmentId: pt.scopeDepartmentId || null,
        createdAt: nowIso,
      };

      const activity = {
        id: newActId,
        typeId: pt.activityTypeId,
        title: pt.title,
        description: pt.description,
        employeeId,
        assigneeId: null,
        dueDate: pt.calculatedDueDate,
        completed: false,
        completedAt: null,
        completedBy: null,
        source: 'Onboarding',
        sourceEntityType: 'OnboardingTaskInstance',
        sourceEntityId: newTiId,
        createdAt: nowIso,
        createdBy: currentUserId,
        updatedAt: nowIso,
      };

      newTaskInstances.push(taskInst);
      newActivities.push(activity);
    });

    // Validate in-memory mutations complete successfully before single persistence write
    db.onboardingPlanInstances = [newPlanInstance, ...existingInstances];
    db.onboardingTaskInstances = [...newTaskInstances, ...rawTaskInstances];
    db.activities = [...newActivities, ...rawActivities];

    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.ONBOARDING_PLAN_LAUNCHED || 'ONBOARDING_PLAN_LAUNCHED',
        'PlanInstance',
        newInstId,
        `Launched composed Onboarding Plan for employee ${employee.fullName} (${newTaskInstances.length} tasks: ${preview.counts.universal} universal, ${preview.counts.typeSpecific} ${preview.typeScope}, ${preview.counts.department} department)`
      );
    } catch (err) {}

    return this.getInstanceById(newInstId);
  },

  /**
   * Adds a single task to ONE employee's already-launched onboarding PlanInstance.
   * Employee-specific only — never touches onboardingPlanTasks/onboardingPlanTemplates,
   * so the reusable template and every other employee's plan instance are unaffected.
   * Due date reuses the same anchorDate + relativeOffsetDays math as launchPlanInstance
   * (via addDaysToLocalDate), and assignee resolution reuses resolveAssigneeForRule() —
   * both centralized in onboardingDomain.js rather than recalculated here.
   */
  async addTaskToInstance(planInstanceId, taskData = {}, currentUserId = 'emp-001') {
    if (!taskData.title || !taskData.title.trim()) {
      throw new Error('Task title is required.');
    }

    const db = loadDatabase();
    const planInstances = db.onboardingPlanInstances || [];
    const planInstance = planInstances.find((inst) => inst.id === planInstanceId);
    if (!planInstance) {
      throw new Error(`PlanInstance with ID "${planInstanceId}" not found.`);
    }

    const employee = await employeeService.getById(planInstance.employeeId);
    if (!employee) {
      throw new Error(`Employee for plan instance "${planInstanceId}" not found.`);
    }

    const records = await employmentRecordService.getAll();
    const userAccounts = db.userAccounts || [];
    const allEmployees = await employeeService.getAll();
    const referenceDate = getTodayLocalDateString();
    const currentRecord = resolveCurrentRecord(employee.id, records, referenceDate);
    const futureRecord = resolveNextRecord(employee.id, records, referenceDate);
    const effectiveRecord = currentRecord || futureRecord;

    const relativeOffsetDays = parseInt(taskData.relativeOffsetDays || 0, 10);
    // Manually-added employee-specific tasks don't collect an assignee rule in the UI — a
    // falsy rule is the existing neutral default resolveAssigneeForRule() already understands
    // (short-circuits to { assigneeId: null, assigneeName: 'Unassigned', isResolved: false }
    // before touching any assignment logic), so no new enum/value is introduced here.
    const assignmentRule = taskData.assignmentRule || null;
    const specificAssigneeId = taskData.specificAssigneeId || null;

    const resolution = resolveAssigneeForRule(
      assignmentRule,
      employee,
      effectiveRecord,
      userAccounts,
      allEmployees,
      specificAssigneeId
    );

    const calculatedDueDate = addDaysToLocalDate(planInstance.anchorDate, relativeOffsetDays);

    const rawTaskInstances = db.onboardingTaskInstances || [];
    const rawActivities = db.activities || [];
    const existingInstTasks = rawTaskInstances.filter((t) => t.planInstanceId === planInstanceId);
    const nextSequence = existingInstTasks.length > 0
      ? Math.max(...existingInstTasks.map((t) => t.sequence || 0)) + 1
      : 1;

    const nowIso = new Date().toISOString();
    const uniqueSuffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
    const newTiId = `ti-${planInstanceId}-manual-${uniqueSuffix}`;
    const newActId = `act-onb-manual-${uniqueSuffix}`;

    const taskInst = {
      id: newTiId,
      planInstanceId,
      planTaskId: null, // manually added — not tied to a reusable plan template task
      activityId: newActId,
      title: taskData.title.trim(),
      description: (taskData.description || '').trim(),
      activityTypeId: taskData.activityTypeId || 'act-type-1',
      assignmentRule,
      originallyResolvedAssigneeId: resolution.assigneeId,
      relativeOffsetDays,
      originallyCalculatedDueDate: calculatedDueDate,
      required: Boolean(taskData.required),
      sequence: nextSequence,
      createdAt: nowIso,
      manuallyAdded: true,
    };

    const activity = {
      id: newActId,
      typeId: taskInst.activityTypeId,
      title: taskInst.title,
      description: taskInst.description,
      employeeId: employee.id,
      assigneeId: resolution.assigneeId,
      dueDate: calculatedDueDate,
      completed: false,
      completedAt: null,
      completedBy: null,
      source: 'Onboarding',
      sourceEntityType: 'OnboardingTaskInstance',
      sourceEntityId: newTiId,
      createdAt: nowIso,
      createdBy: currentUserId,
      updatedAt: nowIso,
    };

    db.onboardingTaskInstances = [taskInst, ...rawTaskInstances];
    db.activities = [activity, ...rawActivities];

    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.ONBOARDING_TASK_ADDED || 'ONBOARDING_TASK_ADDED',
        'PlanInstance',
        planInstanceId,
        `Added task "${taskInst.title}" to ${employee.fullName}'s onboarding plan instance`
      );
    } catch (err) {}

    return this.getInstanceById(planInstanceId);
  },

  /**
   * Fetches all PlanInstances with derived workflow status and progress.
   */
  async getAllInstances(options = {}) {
    const { referenceDate = getTodayLocalDateString(), employeeId = null } = options;
    const db = loadDatabase();
    const rawInstances = db.onboardingPlanInstances || [];
    const rawTasks = db.onboardingTaskInstances || [];
    const rawActivities = db.activities || [];
    const templates = db.onboardingPlanTemplates || [];

    const allEmployees = await employeeService.getAll();
    const employeeMap = new Map(allEmployees.map((e) => [e.id, e]));
    const templateMap = new Map(templates.map((t) => [t.id, t]));

    let filtered = rawInstances;
    if (employeeId) {
      filtered = filtered.filter((inst) => inst.employeeId === employeeId);
    }

    return filtered.map((inst) => {
      const emp = employeeMap.get(inst.employeeId) || null;
      const tpl = templateMap.get(inst.planTemplateId) || null;
      const instTasks = rawTasks.filter((t) => t.planInstanceId === inst.id);

      const progress = calculatePlanProgress(instTasks, rawActivities);
      const derivedStatus = derivePlanInstanceStatus(inst, instTasks, rawActivities, emp, referenceDate);

      return {
        ...inst,
        employee: emp,
        template: tpl,
        progress,
        derivedStatus,
        taskInstances: instTasks,
      };
    });
  },

  /**
   * Fetches a single enriched PlanInstance by ID.
   */
  async getInstanceById(id, referenceDate = getTodayLocalDateString()) {
    if (!id) return null;
    const instances = await this.getAllInstances({ referenceDate });
    return instances.find((inst) => inst.id === id) || null;
  },

  /**
   * Returns the Set of employeeIds that currently have an ACTIVE (derivedStatus !== Completed)
   * onboarding plan instance — the single source of truth for "already has an active onboarding
   * plan," built on the exact same derivedStatus this module already computes everywhere else
   * (getAllInstances() / derivePlanInstanceStatus()). Reused by BOTH getLaunchEligibleEmployees()
   * (the Launch modal's dropdown source) and launchPlanInstance()'s final duplicate-plan guard
   * below, so the two can never drift apart. A person whose only instance(s) are COMPLETED is
   * NOT included — completing a plan makes them eligible to be launched into a new one again.
   */
  async getActiveOnboardingEmployeeIds() {
    const instances = await this.getAllInstances();
    return new Set(
      instances
        .filter((inst) => inst.derivedStatus !== PLAN_INSTANCE_STATUS.COMPLETED)
        .map((inst) => inst.employeeId)
    );
  },

  /**
   * Resolves employees/interns eligible to have onboarding launched right now: current
   * lifecycle status 'Onboarding' AND no existing active onboarding plan instance. This is the
   * single service-boundary source the Launch Onboarding Plan modal reads (it never inspects
   * storageEngine/localStorage directly), so when a real backend replaces this method's
   * internals later, the modal needs no changes. Reuses getActiveOnboardingEmployeeIds() — the
   * exact same active-plan definition launchPlanInstance() enforces as its final safety check.
   */
  async getLaunchEligibleEmployees() {
    const allEmployees = await employeeService.getAll();
    const onboardingStatusEmployees = allEmployees.filter((e) => e.status === 'Onboarding');
    const activeOnboardingEmployeeIds = await this.getActiveOnboardingEmployeeIds();
    return onboardingStatusEmployees.filter((e) => !activeOnboardingEmployeeIds.has(e.id));
  },

  /**
   * Reconciles PlanInstance completedAt metadata after an activity completion state change.
   * Single-write helper called from activity mutations or service sync.
   */
  async reconcileOnboardingPlanProgress(activityId, dbOverride = null) {
    const db = dbOverride || loadDatabase();
    const activities = db.activities || [];
    const targetActivity = activities.find((a) => a.id === activityId);

    if (!targetActivity || targetActivity.sourceEntityType !== 'OnboardingTaskInstance') {
      return null;
    }

    const taskInstances = db.onboardingTaskInstances || [];
    const linkedTaskInst = taskInstances.find((ti) => ti.id === targetActivity.sourceEntityId || ti.activityId === activityId);
    if (!linkedTaskInst) return null;

    const planInstances = db.onboardingPlanInstances || [];
    const idx = planInstances.findIndex((inst) => inst.id === linkedTaskInst.planInstanceId);
    if (idx === -1) return null;

    const targetPlanInst = planInstances[idx];
    const instTasks = taskInstances.filter((ti) => ti.planInstanceId === targetPlanInst.id);

    const reconciliation = reconcilePlanInstanceCompletion(targetPlanInst, instTasks, activities);

    if (reconciliation.shouldUpdate) {
      planInstances[idx] = {
        ...targetPlanInst,
        completedAt: reconciliation.completedAt,
      };
      db.onboardingPlanInstances = planInstances;

      if (!dbOverride) {
        saveDatabase(db);
      }

      try {
        await auditService.logAction(
          'system',
          reconciliation.transition === 'COMPLETED' ? 'ONBOARDING_PLAN_COMPLETED' : 'ONBOARDING_PLAN_REOPENED',
          'PlanInstance',
          targetPlanInst.id,
          `Onboarding plan ${reconciliation.transition === 'COMPLETED' ? 'completed' : 'reopened'} for employee ${targetPlanInst.employeeId}`
        );
      } catch (err) {}
    }

    return planInstances[idx];
  },
};
