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
  PLAN_INSTANCE_STATUS,
} from '../domain/onboardingDomain.js';
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
   * Generates a preview for launching a plan template for an employee.
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
   * Single-write, validate-first PoC persistence launch transaction.
   */
  async launchPlanInstance(employeeId, templateId, manualOverrides = {}, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const employee = await employeeService.getById(employeeId);
    if (!employee) throw new Error(`Employee with ID "${employeeId}" not found.`);

    // Check one active primary plan policy
    const existingInstances = db.onboardingPlanInstances || [];
    const rawActivities = db.activities || [];
    const rawTaskInstances = db.onboardingTaskInstances || [];

    const activeInstanceForEmp = existingInstances.find((inst) => {
      if (inst.employeeId !== employeeId) return false;
      const instTasks = rawTaskInstances.filter((ti) => ti.planInstanceId === inst.id);
      const derivedStatus = derivePlanInstanceStatus(inst, instTasks, rawActivities, employee);
      return derivedStatus !== PLAN_INSTANCE_STATUS.COMPLETED;
    });

    if (activeInstanceForEmp) {
      throw new Error(`Employee ${employee.fullName} already has an active onboarding plan (In Progress / Needs Attention).`);
    }

    // Assignment is no longer a concept in the onboarding UI (Launch Onboarding Plan only
    // collects employee + template), so launching is never blocked on unresolved assignees —
    // every previewed task is created below regardless of whether it resolved an assignee.
    const preview = await this.previewPlanLaunch(employeeId, templateId);

    const nowIso = new Date().toISOString();
    const newInstId = `inst-${String(existingInstances.length + 1).padStart(3, '0')}`;

    const newPlanInstance = {
      id: newInstId,
      planTemplateId: templateId,
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

    preview.taskPreviews.forEach((pt, index) => {
      // manualOverrides is always {} now that the Launch modal no longer collects per-task
      // assignees; pt.resolvedAssigneeId naturally stays null for assignment-rule-free tasks
      // and every task is still created — it simply renders with no assignee, exactly like
      // the existing neutral/unassigned path already used by manually-added employee tasks.
      const resolvedAssigneeId = manualOverrides[pt.planTaskId] || pt.resolvedAssigneeId;

      const newActId = `act-onb-gen-${String(existingActivityCount + index + 1).padStart(3, '0')}`;
      const newTiId = `ti-${newInstId}-${index + 1}`;

      const taskInst = {
        id: newTiId,
        planInstanceId: newInstId,
        planTaskId: pt.planTaskId,
        activityId: newActId,
        title: pt.title,
        description: pt.description,
        activityTypeId: pt.activityTypeId,
        assignmentRule: pt.assignmentRule,
        originallyResolvedAssigneeId: resolvedAssigneeId,
        relativeOffsetDays: pt.relativeOffsetDays,
        originallyCalculatedDueDate: pt.calculatedDueDate,
        required: pt.required,
        sequence: pt.sequence,
        createdAt: nowIso,
      };

      const activity = {
        id: newActId,
        typeId: pt.activityTypeId,
        title: pt.title,
        description: pt.description,
        employeeId,
        assigneeId: resolvedAssigneeId,
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
        `Launched Onboarding Plan "${preview.template.name}" for employee ${employee.fullName} (${newTaskInstances.length} tasks)`
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
