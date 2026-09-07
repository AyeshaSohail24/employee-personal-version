import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { employeeService } from './employeeService.js';
import { employmentRecordService } from './employmentRecordService.js';
import { auditService, AUDIT_ACTIONS } from './auditService.js';
import {
  generateOffboardingPlanPreview,
  deriveOffboardingInstanceStatus,
  calculateOffboardingProgress,
  reconcileOffboardingPlanInstanceCompletion,
  checkOffboardingEligibility,
  OFFBOARDING_INSTANCE_STATUS,
} from '../domain/offboardingDomain.js';
import { getTodayLocalDateString } from '../utils/dateUtils.js';

export const offboardingService = {
  /**
   * Fetches all Offboarding PlanTemplates with optional task count enrichment.
   */
  async getAllTemplates() {
    const db = loadDatabase();
    const templates = db.offboardingPlanTemplates || [];
    const tasks = db.offboardingPlanTasks || [];
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
   * Fetches a single Offboarding PlanTemplate with its ordered tasks.
   */
  async getTemplateById(id) {
    if (!id) return null;
    const db = loadDatabase();
    const tpl = (db.offboardingPlanTemplates || []).find((t) => t.id === id);
    if (!tpl) return null;

    const tasks = (db.offboardingPlanTasks || [])
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
   * Creates a new Offboarding PlanTemplate and its tasks (Plan Builder).
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
    const templates = db.offboardingPlanTemplates || [];
    const tasks = db.offboardingPlanTasks || [];

    const newTplId = `tpl-off-${String(templates.length + 1).padStart(3, '0')}`;
    const nowIso = new Date().toISOString();

    const newTemplate = {
      id: newTplId,
      name: templateData.name.trim(),
      type: 'Offboarding',
      departmentId: templateData.departmentId || null,
      description: (templateData.description || '').trim(),
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const newTasks = tasksData.map((t, idx) => ({
      id: `pt-off-${newTplId}-${idx + 1}`,
      planTemplateId: newTplId,
      activityTypeId: t.activityTypeId || 'act-type-1',
      title: t.title.trim(),
      description: (t.description || '').trim(),
      assignmentRule: t.assignmentRule || 'employee',
      specificAssigneeId: t.specificAssigneeId || null,
      relativeOffsetDays: parseInt(t.relativeOffsetDays || 0, 10),
      required: Boolean(t.required),
      sequence: idx + 1,
      active: true,
    }));

    db.offboardingPlanTemplates = [newTemplate, ...templates];
    db.offboardingPlanTasks = [...newTasks, ...tasks];

    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.OFFBOARDING_TEMPLATE_CREATED || 'OFFBOARDING_TEMPLATE_CREATED',
        'PlanTemplate',
        newTplId,
        `Created Offboarding Plan Template "${newTemplate.name}" with ${newTasks.length} tasks`
      );
    } catch (err) {}

    return this.getTemplateById(newTplId);
  },

  /**
   * Updates an existing Offboarding PlanTemplate and its tasks.
   */
  async updateTemplate(id, templateData, tasksData = [], currentUserId = 'emp-001') {
    const db = loadDatabase();
    const templates = db.offboardingPlanTemplates || [];
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
      const otherTasks = (db.offboardingPlanTasks || []).filter((t) => t.planTemplateId !== id);
      const newTasks = tasksData.map((t, index) => ({
        id: t.id && t.id.startsWith('pt-off-') ? t.id : `pt-off-${id}-${index + 1}-${Date.now().toString().slice(-4)}`,
        planTemplateId: id,
        activityTypeId: t.activityTypeId || 'act-type-1',
        title: t.title.trim(),
        description: (t.description || '').trim(),
        assignmentRule: t.assignmentRule || 'employee',
        specificAssigneeId: t.specificAssigneeId || null,
        relativeOffsetDays: parseInt(t.relativeOffsetDays || 0, 10),
        required: Boolean(t.required),
        sequence: index + 1,
        active: true,
      }));

      db.offboardingPlanTasks = [...otherTasks, ...newTasks];
    }

    db.offboardingPlanTemplates = templates;
    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.OFFBOARDING_TEMPLATE_UPDATED || 'OFFBOARDING_TEMPLATE_UPDATED',
        'PlanTemplate',
        id,
        `Updated Offboarding Plan Template "${updatedTemplate.name}"`
      );
    } catch (err) {}

    return this.getTemplateById(id);
  },

  /**
   * Toggles Offboarding PlanTemplate active status.
   */
  async toggleTemplateActive(id, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const templates = db.offboardingPlanTemplates || [];
    const idx = templates.findIndex((t) => t.id === id);

    if (idx === -1) {
      throw new Error(`PlanTemplate with ID "${id}" not found.`);
    }

    const newActive = !templates[idx].active;
    templates[idx].active = newActive;
    templates[idx].updatedAt = new Date().toISOString();

    db.offboardingPlanTemplates = templates;
    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.OFFBOARDING_TEMPLATE_TOGGLED || 'OFFBOARDING_TEMPLATE_TOGGLED',
        'PlanTemplate',
        id,
        `${newActive ? 'Activated' : 'Deactivated'} Offboarding Plan Template "${templates[idx].name}"`
      );
    } catch (err) {}

    return this.getTemplateById(id);
  },

  /**
   * Generates a preview for launching an offboarding plan template for an employee.
   */
  async previewPlanLaunch(employeeId, templateId, customAnchorDate = null, referenceDate = getTodayLocalDateString()) {
    const db = loadDatabase();
    const employee = await employeeService.getById(employeeId);
    if (!employee) throw new Error(`Employee with ID "${employeeId}" not found.`);

    const template = await this.getTemplateById(templateId);
    if (!template) throw new Error(`PlanTemplate with ID "${templateId}" not found.`);

    const records = await employmentRecordService.getAll();
    const userAccounts = db.userAccounts || [];
    const allEmployees = await employeeService.getAll();

    return generateOffboardingPlanPreview({
      template,
      planTasks: template.tasks || [],
      employee,
      records,
      userAccounts,
      allEmployees,
      customAnchorDate,
      referenceDate,
    });
  },

  /**
   * Single-write, validate-first PoC persistence launch transaction.
   * Performs complete in-memory validation before persisting any records.
   */
  async launchPlanInstance(employeeId, templateId, manualOverrides = {}, customAnchorDate = null, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const employee = await employeeService.getById(employeeId);
    if (!employee) throw new Error(`Employee with ID "${employeeId}" not found.`);

    const records = await employmentRecordService.getAll();
    const existingInstances = db.offboardingPlanInstances || [];
    const rawActivities = db.activities || [];
    const rawTaskInstances = db.offboardingTaskInstances || [];

    // Pre-launch eligibility check
    const eligibility = checkOffboardingEligibility(employee, records, existingInstances, customAnchorDate);
    if (!eligibility.isEligible) {
      throw new Error(`Cannot launch offboarding plan: ${eligibility.reason}`);
    }

    const preview = await this.previewPlanLaunch(employeeId, templateId, customAnchorDate);
    if (!preview.isValid && !manualOverrides.allowLaunch) {
      throw new Error(`Cannot launch offboarding plan: Required tasks contain unresolved assignees.`);
    }

    const nowIso = new Date().toISOString();
    const newInstId = `inst-off-${String(existingInstances.length + 1).padStart(3, '0')}`;

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
      const resolvedAssigneeId = manualOverrides[pt.planTaskId] || pt.resolvedAssigneeId;

      if (!resolvedAssigneeId && pt.required) {
        throw new Error(`Validation failed: Required task "${pt.title}" has no assigned employee.`);
      }

      if (!resolvedAssigneeId && !pt.required) {
        return;
      }

      const newActId = `act-off-gen-${String(existingActivityCount + index + 1).padStart(3, '0')}`;
      const newTiId = `ti-off-${newInstId}-${index + 1}`;

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
        source: 'Offboarding',
        sourceEntityType: 'OffboardingTaskInstance',
        sourceEntityId: newTiId,
        createdAt: nowIso,
        createdBy: currentUserId,
        updatedAt: nowIso,
      };

      newTaskInstances.push(taskInst);
      newActivities.push(activity);
    });

    // Validate in-memory mutations complete successfully before single persistence write
    db.offboardingPlanInstances = [newPlanInstance, ...existingInstances];
    db.offboardingTaskInstances = [...newTaskInstances, ...rawTaskInstances];
    db.activities = [...newActivities, ...rawActivities];

    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.OFFBOARDING_PLAN_LAUNCHED || 'OFFBOARDING_PLAN_LAUNCHED',
        'PlanInstance',
        newInstId,
        `Launched Offboarding Plan "${preview.template.name}" for employee ${employee.fullName} (${newTaskInstances.length} tasks)`
      );
    } catch (err) {}

    return this.getInstanceById(newInstId);
  },

  /**
   * Fetches all Offboarding PlanInstances with derived workflow status and progress.
   */
  async getAllInstances(options = {}) {
    const { referenceDate = getTodayLocalDateString(), employeeId = null } = options;
    const db = loadDatabase();
    const rawInstances = db.offboardingPlanInstances || [];
    const rawTasks = db.offboardingTaskInstances || [];
    const rawActivities = db.activities || [];
    const templates = db.offboardingPlanTemplates || [];

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

      const progress = calculateOffboardingProgress(instTasks, rawActivities);
      const derivedStatus = deriveOffboardingInstanceStatus(inst, instTasks, rawActivities, emp, referenceDate);

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
   * Fetches a single enriched Offboarding PlanInstance by ID.
   */
  async getInstanceById(id, referenceDate = getTodayLocalDateString()) {
    if (!id) return null;
    const instances = await this.getAllInstances({ referenceDate });
    return instances.find((inst) => inst.id === id) || null;
  },

  /**
   * Reconciles Offboarding PlanInstance completedAt metadata after an activity completion state change.
   * Single-write helper called from activity mutations.
   */
  async reconcileOffboardingPlanProgress(activityId, dbOverride = null) {
    const db = dbOverride || loadDatabase();
    const activities = db.activities || [];
    const targetActivity = activities.find((a) => a.id === activityId);

    if (!targetActivity || targetActivity.sourceEntityType !== 'OffboardingTaskInstance') {
      return null;
    }

    const taskInstances = db.offboardingTaskInstances || [];
    const linkedTaskInst = taskInstances.find(
      (ti) => ti.id === targetActivity.sourceEntityId || ti.activityId === activityId
    );
    if (!linkedTaskInst) return null;

    const planInstances = db.offboardingPlanInstances || [];
    const idx = planInstances.findIndex((inst) => inst.id === linkedTaskInst.planInstanceId);
    if (idx === -1) return null;

    const targetPlanInst = planInstances[idx];
    const instTasks = taskInstances.filter((ti) => ti.planInstanceId === targetPlanInst.id);

    const reconciliation = reconcileOffboardingPlanInstanceCompletion(targetPlanInst, instTasks, activities);

    if (reconciliation.shouldUpdate) {
      planInstances[idx] = {
        ...targetPlanInst,
        completedAt: reconciliation.completedAt,
      };
      db.offboardingPlanInstances = planInstances;

      if (!dbOverride) {
        saveDatabase(db);
      }

      try {
        await auditService.logAction(
          'system',
          reconciliation.transition === 'COMPLETED' ? 'OFFBOARDING_PLAN_COMPLETED' : 'OFFBOARDING_PLAN_REOPENED',
          'PlanInstance',
          targetPlanInst.id,
          `Offboarding plan ${reconciliation.transition === 'COMPLETED' ? 'completed' : 'reopened'} for employee ${targetPlanInst.employeeId}`
        );
      } catch (err) {}
    }

    return planInstances[idx];
  },
};
