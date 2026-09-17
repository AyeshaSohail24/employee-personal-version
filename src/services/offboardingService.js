import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { apiClient } from './apiClient.js';
import { employeeService } from './employeeService.js';
import { employmentRecordService } from './employmentRecordService.js';
import { departmentService } from './departmentService.js';
import { auditService, AUDIT_ACTIONS } from './auditService.js';
import {
  generateOffboardingPlanPreview,
  deriveOffboardingInstanceStatus,
  calculateOffboardingProgress,
  reconcileOffboardingPlanInstanceCompletion,
  checkOffboardingEligibility,
  resolveOffboardingAnchorDate,
  composeOffboardingTasks,
  isActiveOffboardingPlanStatus,
  OFFBOARDING_INSTANCE_STATUS,
} from '../domain/offboardingDomain.js';
import { addDaysToLocalDate, getTodayLocalDateString } from '../utils/dateUtils.js';

export const offboardingService = {
  /**
   * The real intern roster (Interns DB) with each person's offboarding plan
   * status, if one exists locally — mirrors onboardingService.getInternsProgress().
   * @returns {Promise<Array<Object>>}
   */
  async getInternsProgress() {
    const { interns } = await apiClient.get('/offboarding/interns');
    return interns;
  },

  /**
   * The real offboarding plan instance already running for one (real) employee, plus its task
   * instances — mirrors onboardingService.getRealInstanceForEmployee() exactly.
   */
  async getRealInstanceForEmployee(employeeId) {
    return apiClient.get(`/offboarding/instances?employee_id=${encodeURIComponent(employeeId)}`);
  },

  /**
   * Marks one real offboarding task instance done or reopens it — mirrors
   * onboardingService.setRealTaskInstanceCompleted() exactly.
   */
  async setRealTaskInstanceCompleted(taskInstanceId, completed) {
    const { taskInstance } = await apiClient.patch(`/offboarding/task-instances/${taskInstanceId}`, { completed });
    return taskInstance;
  },

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
   * LEGACY — kept for historical templates (getAllTemplates()/getTemplateById() remain available
   * for getAllInstances()'s template-name lookup on pre-refactor instances); the Launch
   * Offboarding Plan UI no longer calls this, use previewOffboardingComposition() instead.
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
   * Fetches all active, scope-tagged offboarding task definitions — each carrying both a
   * scopeType ('universal' | 'department') and a personType ('employee' | 'intern') — the raw
   * building blocks composeOffboardingTasks() combines per departing person. Legacy tasks without
   * a scopeType/personType (pre-migration) are excluded here; the storageEngine migration
   * backfills both fields on every load so this should not occur. Entirely independent from
   * onboardingPlanTasks — offboarding scope tasks are never mixed with onboarding's.
   */
  async getScopeTaskDefinitions() {
    const { tasks } = await apiClient.get('/offboarding/scope-tasks');
    return tasks.map((t) => ({
      id: t.id,
      activityTypeId: t.activity_type_id,
      title: t.title,
      description: t.description || '',
      assignmentRule: t.assignment_rule,
      specificAssigneeId: t.specific_assignee_id,
      relativeOffsetDays: t.relative_offset_days || 0,
      required: Boolean(t.required),
      sequence: t.sequence,
      active: Boolean(t.active),
      scopeType: t.scope_type,
      personType: t.person_type,
      scopeDepartmentId: t.scope_department_id,
    }));
  },

  /**
   * Fetches summary counts (task count) AND the actual ordered task list for the given person
   * type's Universal scope and every real Department (dynamically sourced — never hardcoded),
   * scoped entirely to ONE personType at a time — an Employee Universal offboarding task and an
   * Intern Universal offboarding task are never mixed together here, and likewise for a
   * department's tasks. Backs the Plans page's per-filter view (switching the Employees/Interns
   * segmented control just calls this again with the other personType), plus each card's inline
   * read-only task-list preview.
   */
  async getScopesSummary(personType = 'employee') {
    const tasks = await this.getScopeTaskDefinitions();
    // Departments are owned by the external Department Management service, not
    // this app's own mock data (departmentService.js) — read through the real
    // API so a department-scoped plan can only ever be configured for a
    // department that actually exists there. See db/schema_employees.sql's
    // architecture note.
    const { departments } = await apiClient.get('/departments');
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
   * (used by the "Manage Tasks" editor). `scopeType` is 'universal' or 'department' only.
   */
  async getScopeTasks(scopeType, personType, departmentId = null) {
    const tasks = await this.getScopeTaskDefinitions();
    return tasks
      .filter((t) => t.scopeType === scopeType && t.personType === personType && (scopeType !== 'department' || t.scopeDepartmentId === departmentId))
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  },

  /**
   * Replaces the task set for ONE (personType, scopeType[, departmentId]) combination. Every
   * other scope/personType combination's tasks are left untouched — saving Employee Universal,
   * for example, can never affect Intern Universal or any Department scope. No minimum-task-count
   * validation — a scope may legitimately be empty (e.g. a brand-new department, or Universal
   * before HR configures it). New tasks are never given an assignmentRule — offboarding launches
   * no longer resolve an assignee at all (every launched task instance is created unassigned).
   */
  async saveScopeTasks(scopeType, personType, departmentId = null, tasksData = []) {
    await apiClient.put('/offboarding/scope-tasks', {
      scopeType,
      personType,
      scopeDepartmentId: scopeType === 'department' ? departmentId : null,
      tasks: (tasksData || []).map((t) => ({
        activityTypeId: Number(t.activityTypeId),
        title: (t.title || '').trim(),
        description: (t.description || '').trim(),
        relativeOffsetDays: parseInt(t.relativeOffsetDays || 0, 10),
        // Required Task is no longer collected by the scope editor — internal compatibility
        // field only (all tasks now count equally toward progress; see
        // calculateOffboardingProgress()).
        required: t.required !== false,
      })),
    });

    return this.getScopeTasks(scopeType, personType, departmentId);
  },

  /**
   * Composes a departing person's full applicable offboarding task set (Universal + Department)
   * via the centralized composeOffboardingTasks() domain function, calculating due dates off the
   * departure/Final Working Date anchor — resolved via the SAME checkOffboardingEligibility()
   * precedence (customAnchorDate override -> current employment record -> contractEndDate ->
   * historical record) every other offboarding entry point already uses. This is the SAME
   * function launchPlanInstance() calls below — the preview and the actual launch can never drift
   * apart because they share one code path and one set of inputs.
   * UPDATED — also returns the employee's own canonical Final Working Date (canonicalAnchorDate,
   * resolved with no override — display-only, never used for date math), alongside the effective
   * anchor actually used to compose task due dates (anchorDate, the override when one is
   * supplied). Both come from the ONE resolveOffboardingAnchorDate() function (called once
   * directly for canonical, once indirectly via checkOffboardingEligibility() for effective) —
   * a single source of resolution truth, not a second calculation path.
   */
  async previewOffboardingComposition(employeeId, customAnchorDate = null, referenceDate = getTodayLocalDateString()) {
    const db = loadDatabase();
    const employee = await employeeService.getById(employeeId);
    if (!employee) throw new Error(`Employee with ID "${employeeId}" not found.`);

    const records = await employmentRecordService.getAll();
    const existingInstances = db.offboardingPlanInstances || [];
    const canonicalAnchorDate = resolveOffboardingAnchorDate(employee, records, null, referenceDate);
    const eligibility = checkOffboardingEligibility(employee, records, existingInstances, customAnchorDate, referenceDate);

    if (!eligibility.isEligible) {
      return {
        isValid: false,
        error: eligibility.reason,
        employee,
        anchorDate: null,
        canonicalAnchorDate,
        tasks: [],
        personType: employee.directoryType === 'Intern' ? 'intern' : 'employee',
        typeScope: employee.directoryType === 'Intern' ? 'intern' : 'employee',
        departmentId: (employee.department && employee.department.id) || null,
        counts: { universal: 0, typeSpecific: 0, department: 0, total: 0, required: 0 },
      };
    }

    const taskDefinitions = await this.getScopeTaskDefinitions();
    const composition = composeOffboardingTasks(employee, taskDefinitions, eligibility.resolvedAnchorDate);

    return {
      isValid: composition.counts.total > 0,
      error: composition.counts.total === 0 ? 'No offboarding tasks are configured for this employee.' : null,
      employee,
      anchorDate: eligibility.resolvedAnchorDate,
      canonicalAnchorDate,
      ...composition,
    };
  },

  /**
   * Returns the Set of employeeIds that currently have an ACTIVE offboarding plan instance — the
   * single source of truth for "already has an active offboarding plan," built on the exact same
   * derivedStatus this module already computes everywhere else. UPDATED — now uses
   * isActiveOffboardingPlanStatus() (excludes both COMPLETED and DROPPED) instead of a bare
   * `!== COMPLETED` check, so a Dropped plan correctly stops counting as active — mirroring
   * onboarding's isActivePlanStatus() reuse pattern, via offboarding's own independent helper.
   * Reused by BOTH getLaunchEligibleEmployees() (the Launch modal's dropdown source) and
   * launchPlanInstance()'s final duplicate-plan guard below, so the two can never drift apart.
   */
  async getActiveOffboardingEmployeeIds() {
    const instances = await this.getAllInstances();
    return new Set(
      instances
        .filter((inst) => isActiveOffboardingPlanStatus(inst.derivedStatus))
        .map((inst) => inst.employeeId)
    );
  },

  /**
   * Resolves employees/interns eligible to have offboarding launched right now: current lifecycle
   * status 'Active' or 'Departing' (mirroring checkOffboardingEligibility()'s own status rule —
   * Upcoming/Onboarding/Former are excluded) AND no existing active offboarding plan instance.
   * Deliberately does NOT require a pre-resolved Final Working Date anchor here — unlike
   * Onboarding, the Launch modal still offers a Custom Anchor Date override for people without one
   * on record, so excluding them from this list would incorrectly hide a legitimately-launchable
   * person. This is the single service-boundary source the Launch Offboarding Plan modal reads.
   */
  async getLaunchEligibleEmployees() {
    const allEmployees = await employeeService.getAll();
    const eligibleStatusEmployees = allEmployees.filter((e) => e.status === 'Active' || e.status === 'Departing');
    const activeOffboardingEmployeeIds = await this.getActiveOffboardingEmployeeIds();
    return eligibleStatusEmployees.filter((e) => !activeOffboardingEmployeeIds.has(e.id));
  },

  /**
   * Single-write, validate-first PoC persistence launch transaction. Composed from reusable
   * scope-based task definitions (Universal + Department) via the same
   * previewOffboardingComposition() used by the Launch modal's preview panel, so the launched
   * instance's task set always exactly matches what HR was shown before clicking Launch. Creates
   * a full SNAPSHOT of the currently-applicable tasks: later edits to Universal or Department
   * scopes never retroactively change an already-launched instance, because these task-instance
   * records are plain field-copies, never re-read live from offboardingPlanTasks. No assignee is
   * ever resolved (every task instance is created with assigneeId: null) — composable scope tasks
   * never carry an assignmentRule.
   */
  async launchPlanInstance(employeeId, customAnchorDate = null, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const employee = await employeeService.getById(employeeId);
    if (!employee) throw new Error(`Employee with ID "${employeeId}" not found.`);

    const records = await employmentRecordService.getAll();
    const existingInstances = db.offboardingPlanInstances || [];
    const rawActivities = db.activities || [];
    const rawTaskInstances = db.offboardingTaskInstances || [];

    // Pre-launch eligibility check (status + duplicate active-plan protection + anchor-date
    // resolution) — the exact same authoritative gate previewOffboardingComposition() uses, so
    // this final service-level check can never disagree with what the Launch modal already
    // showed. Reused as-is from before this refactor — offboarding's own eligibility rules were
    // not touched by the Plans architecture change.
    const eligibility = checkOffboardingEligibility(employee, records, existingInstances, customAnchorDate);
    if (!eligibility.isEligible) {
      throw new Error(`Cannot launch offboarding plan: ${eligibility.reason}`);
    }

    const taskDefinitions = await this.getScopeTaskDefinitions();
    const composition = composeOffboardingTasks(employee, taskDefinitions, eligibility.resolvedAnchorDate);

    if (composition.counts.total === 0) {
      throw new Error(`Cannot launch offboarding plan: No offboarding tasks are configured for ${employee.fullName}.`);
    }

    const nowIso = new Date().toISOString();
    const newInstId = `inst-off-${String(existingInstances.length + 1).padStart(3, '0')}`;

    const newPlanInstance = {
      id: newInstId,
      planTemplateId: null,
      employeeId,
      startedAt: eligibility.resolvedAnchorDate,
      anchorDate: eligibility.resolvedAnchorDate,
      completedAt: null,
      createdBy: currentUserId,
      createdAt: nowIso,
    };

    const newTaskInstances = [];
    const newActivities = [];
    const existingActivityCount = rawActivities.length;

    composition.tasks.forEach((pt, index) => {
      const newActId = `act-off-gen-${String(existingActivityCount + index + 1).padStart(3, '0')}`;
      const newTiId = `ti-off-${newInstId}-${index + 1}`;

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
        `Launched composed Offboarding Plan for employee ${employee.fullName} (${newTaskInstances.length} tasks: ${composition.counts.universal} universal, ${composition.counts.department} department)`
      );
    } catch (err) {}

    return this.getInstanceById(newInstId);
  },

  /**
   * Adds a single task to ONE departing person's already-launched offboarding plan instance.
   * Employee-specific only — never touches offboardingPlanTasks (the reusable Universal/
   * Department Plans configuration under Offboarding > Plans), so other people's launched
   * instances and all future launches are completely unaffected. Simpler than onboarding's
   * addTaskToInstance(): offboarding's launch architecture no longer resolves an assignee at all
   * (every composed task is created with assigneeId: null — see launchPlanInstance() above), so a
   * manually-added instance task follows the exact same neutral/unassigned convention rather than
   * re-introducing assignment-rule resolution just for this one path.
   */
  async addTaskToInstance(planInstanceId, taskData = {}, currentUserId = 'emp-001') {
    if (!taskData.title || !taskData.title.trim()) {
      throw new Error('Task title is required.');
    }

    const db = loadDatabase();
    const planInstances = db.offboardingPlanInstances || [];
    const planInstance = planInstances.find((inst) => inst.id === planInstanceId);
    if (!planInstance) {
      throw new Error(`PlanInstance with ID "${planInstanceId}" not found.`);
    }
    // droppedAt is the SAME field deriveOffboardingInstanceStatus() checks first (ahead of every
    // other rule) to derive OFFBOARDING_INSTANCE_STATUS.DROPPED — checking it directly here is
    // equivalent to "derivedStatus === DROPPED" without needing to load taskInstances/activities
    // just to derive it. A Dropped plan is a permanent historical record: this guard runs before
    // any mutation, so a caller that bypasses the UI (a direct service call) is blocked exactly
    // like the UI is.
    if (planInstance.droppedAt) {
      throw new Error('This plan has been dropped and is read-only.');
    }

    const employee = await employeeService.getById(planInstance.employeeId);
    if (!employee) {
      throw new Error(`Employee for plan instance "${planInstanceId}" not found.`);
    }

    const relativeOffsetDays = parseInt(taskData.relativeOffsetDays || 0, 10);
    const calculatedDueDate = addDaysToLocalDate(planInstance.anchorDate, relativeOffsetDays);

    const rawTaskInstances = db.offboardingTaskInstances || [];
    const rawActivities = db.activities || [];
    const existingInstTasks = rawTaskInstances.filter((t) => t.planInstanceId === planInstanceId);
    const nextSequence = existingInstTasks.length > 0
      ? Math.max(...existingInstTasks.map((t) => t.sequence || 0)) + 1
      : 1;

    const nowIso = new Date().toISOString();
    const uniqueSuffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
    const newTiId = `ti-off-${planInstanceId}-manual-${uniqueSuffix}`;
    const newActId = `act-off-manual-${uniqueSuffix}`;

    const taskInst = {
      id: newTiId,
      planInstanceId,
      planTaskId: null, // manually added — not tied to a reusable scope task
      activityId: newActId,
      title: taskData.title.trim(),
      description: (taskData.description || '').trim(),
      activityTypeId: taskData.activityTypeId || 'act-type-1',
      assignmentRule: null,
      originallyResolvedAssigneeId: null,
      relativeOffsetDays,
      originallyCalculatedDueDate: calculatedDueDate,
      // Required Task is not collected by the instance Add Task modal — internal compatibility
      // field only, defaults true so every launched/added task counts equally toward progress.
      required: true,
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
      assigneeId: null,
      dueDate: calculatedDueDate,
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

    db.offboardingTaskInstances = [taskInst, ...rawTaskInstances];
    db.activities = [activity, ...rawActivities];

    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.OFFBOARDING_TASK_ADDED || 'OFFBOARDING_TASK_ADDED',
        'PlanInstance',
        planInstanceId,
        `Added task "${taskInst.title}" to ${employee.fullName}'s offboarding plan instance`
      );
    } catch (err) {}

    return this.getInstanceById(planInstanceId);
  },

  /**
   * Edits ONE task already on ONE departing person's already-launched offboarding PlanInstance.
   * Employee-specific only — mirrors addTaskToInstance()'s boundary: this only ever touches THIS
   * task instance and its linked activity, and NEVER touches offboardingPlanTasks (the reusable
   * Plans configuration), another person's plan instance, or the employee's own canonical Final
   * Working Date. The Due Date is never accepted as direct input — only relativeOffsetDays is
   * editable, and the new Due Date is always recalculated from THIS instance's own already-
   * snapshotted anchorDate (planInstance.anchorDate), never a freshly resolved employee canonical
   * date — so an edit here can never disagree with the anchor the rest of this plan was launched
   * against, even if the employee's canonical Final Working Date has since changed. Completion
   * state (completed/completedAt/completedBy) on the linked activity is never touched — editing
   * task details is a distinct operation from Done/Reopen. The task's id, planInstanceId,
   * activityId, planTaskId, assignmentRule/originallyResolvedAssigneeId, required, sequence and
   * createdAt all stay exactly as they were — no new task/activity record is ever created.
   */
  async updateTaskInInstance(planInstanceId, taskInstanceId, taskData = {}, currentUserId = 'emp-001') {
    if (!taskData.title || !taskData.title.trim()) {
      throw new Error('Task title is required.');
    }

    const relativeOffsetDays = parseInt(taskData.relativeOffsetDays, 10);
    if (Number.isNaN(relativeOffsetDays)) {
      throw new Error('Relative Offset (Days) must be a valid number.');
    }

    const db = loadDatabase();
    const planInstance = (db.offboardingPlanInstances || []).find((inst) => inst.id === planInstanceId);
    if (!planInstance) {
      throw new Error(`PlanInstance with ID "${planInstanceId}" not found.`);
    }
    // See addTaskToInstance()'s identical guard for why droppedAt is checked directly. Runs
    // before any read/parse of the target task, so a Dropped plan's task is never even located
    // for mutation, let alone partially updated.
    if (planInstance.droppedAt) {
      throw new Error('This plan has been dropped and is read-only.');
    }

    const rawTaskInstances = db.offboardingTaskInstances || [];
    const targetTask = rawTaskInstances.find((ti) => ti.id === taskInstanceId && ti.planInstanceId === planInstanceId);
    if (!targetTask) {
      throw new Error(`Task with ID "${taskInstanceId}" was not found on this offboarding plan instance.`);
    }

    // Recalculated from THIS instance's own snapshotted anchor — never a freshly resolved
    // employee canonical date, and the anchor itself is never modified by this operation.
    const newDueDate = addDaysToLocalDate(planInstance.anchorDate, relativeOffsetDays);
    const nowIso = new Date().toISOString();

    const updatedTitle = taskData.title.trim();
    const updatedDescription = (taskData.description || '').trim();
    const updatedActivityTypeId = taskData.activityTypeId || targetTask.activityTypeId || 'act-type-1';

    db.offboardingTaskInstances = rawTaskInstances.map((ti) =>
      ti.id === taskInstanceId
        ? {
            ...ti,
            title: updatedTitle,
            description: updatedDescription,
            activityTypeId: updatedActivityTypeId,
            relativeOffsetDays,
            originallyCalculatedDueDate: newDueDate,
          }
        : ti
    );

    // Only title/description/typeId/dueDate/updatedAt are touched — completed/completedAt/
    // completedBy are deliberately left exactly as they were, so an edit can never silently
    // complete or reopen a task.
    db.activities = (db.activities || []).map((a) =>
      a.id === targetTask.activityId
        ? {
            ...a,
            title: updatedTitle,
            description: updatedDescription,
            typeId: updatedActivityTypeId,
            dueDate: newDueDate,
            updatedAt: nowIso,
          }
        : a
    );

    saveDatabase(db);

    const employee = await employeeService.getById(planInstance.employeeId);
    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.OFFBOARDING_TASK_UPDATED || 'OFFBOARDING_TASK_UPDATED',
        'PlanInstance',
        planInstanceId,
        `Edited task "${updatedTitle}" on ${employee ? employee.fullName : planInstance.employeeId}'s offboarding plan instance (reusable Plans configuration untouched)`
      );
    } catch (err) {}

    return this.getInstanceById(planInstanceId);
  },

  /**
   * Deletes ONE task from ONE departing person's already-launched offboarding PlanInstance.
   * Employee-specific only — mirrors addTaskToInstance()'s boundary: this only ever touches
   * offboardingTaskInstances/activities for this one instance, and NEVER touches
   * offboardingPlanTasks (the reusable Plans configuration). Progress/percentage/derivedStatus
   * are never stored — they are recalculated fresh from the remaining task instances the next
   * time this instance is read, so no separate recalculation step is needed here.
   */
  async deleteTaskFromInstance(planInstanceId, taskInstanceId, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const planInstance = (db.offboardingPlanInstances || []).find((inst) => inst.id === planInstanceId);
    if (!planInstance) {
      throw new Error(`PlanInstance with ID "${planInstanceId}" not found.`);
    }
    // See addTaskToInstance()'s identical guard for why droppedAt is checked directly.
    if (planInstance.droppedAt) {
      throw new Error('This plan has been dropped and is read-only.');
    }

    const rawTaskInstances = db.offboardingTaskInstances || [];
    const instanceTaskInstances = rawTaskInstances.filter((ti) => ti.planInstanceId === planInstanceId);
    const targetTask = instanceTaskInstances.find((ti) => ti.id === taskInstanceId);
    if (!targetTask) {
      throw new Error(`Task with ID "${taskInstanceId}" was not found on this offboarding plan instance.`);
    }

    // An offboarding plan instance must always retain at least 1 task — deleting the final
    // remaining task would leave 0 tasks, which calculateOffboardingProgress()/
    // deriveOffboardingInstanceStatus() would otherwise have to treat as a degenerate 0/0 case.
    // Blocking here is the cleanest rule compatible with the existing domain model, mirroring
    // onboarding's exact equivalent guard.
    if (instanceTaskInstances.length <= 1) {
      throw new Error('An offboarding plan must contain at least one task. Add another task before deleting this one.');
    }

    db.offboardingTaskInstances = rawTaskInstances.filter((ti) => ti.id !== taskInstanceId);
    db.activities = (db.activities || []).filter((a) => a.id !== targetTask.activityId);
    saveDatabase(db);

    const employee = await employeeService.getById(planInstance.employeeId);
    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.OFFBOARDING_TASK_DELETED || 'OFFBOARDING_TASK_DELETED',
        'PlanInstance',
        planInstanceId,
        `Deleted task "${targetTask.title}" from ${employee ? employee.fullName : planInstance.employeeId}'s offboarding plan instance (reusable Plans configuration untouched)`
      );
    } catch (err) {}

    return this.getInstanceById(planInstanceId);
  },

  /**
   * Drops (cancels) an active offboarding PlanInstance — an intentional stop before successful
   * completion, distinct from COMPLETED. Sets `droppedAt`/`droppedBy`, the field
   * deriveOffboardingInstanceStatus() checks (ahead of every other rule) to permanently derive
   * OFFBOARDING_INSTANCE_STATUS.DROPPED going forward. Nothing is deleted: all task instances,
   * activities (completed and incomplete), titles/descriptions, the Final Working Date/launch
   * dates, and the plan name remain exactly as they were — the instance stays fully readable as
   * historical information. Dropped is non-active (see isActiveOffboardingPlanStatus()), so
   * getActiveOffboardingEmployeeIds()/getLaunchEligibleEmployees() automatically stop counting it,
   * and checkOffboardingEligibility()'s duplicate-plan check now also recognizes droppedAt — no
   * separate eligibility rule is introduced. The employee/intern's own lifecycle `status` field is
   * intentionally never touched here; that transition stays a separate, later decision, exactly
   * mirroring onboarding's own dropPlanInstance().
   */
  async dropPlanInstance(planInstanceId, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const planInstances = db.offboardingPlanInstances || [];
    const idx = planInstances.findIndex((inst) => inst.id === planInstanceId);
    if (idx === -1) {
      throw new Error(`PlanInstance with ID "${planInstanceId}" not found.`);
    }

    const planInstance = planInstances[idx];
    const employee = await employeeService.getById(planInstance.employeeId);
    const instTasks = (db.offboardingTaskInstances || []).filter((ti) => ti.planInstanceId === planInstanceId);
    const rawActivities = db.activities || [];
    const currentDerivedStatus = deriveOffboardingInstanceStatus(planInstance, instTasks, rawActivities, employee);

    if (currentDerivedStatus === OFFBOARDING_INSTANCE_STATUS.COMPLETED) {
      throw new Error('A completed offboarding plan cannot be dropped — it remains a historical record of successful completion.');
    }
    if (currentDerivedStatus === OFFBOARDING_INSTANCE_STATUS.DROPPED) {
      throw new Error('This offboarding plan has already been dropped.');
    }

    // Built via .map() into a brand-new array (never `planInstances[idx] = ...` in place) — the
    // Node/no-localStorage storage fallback can hand back a live reference to the seed module's
    // own array, and an in-place index write would permanently corrupt that shared singleton for
    // the rest of the process.
    const nowIso = new Date().toISOString();
    db.offboardingPlanInstances = planInstances.map((inst) =>
      inst.id === planInstanceId ? { ...inst, droppedAt: nowIso, droppedBy: currentUserId } : inst
    );
    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.OFFBOARDING_PLAN_DROPPED || 'OFFBOARDING_PLAN_DROPPED',
        'PlanInstance',
        planInstanceId,
        `Dropped offboarding plan for ${employee ? employee.fullName : planInstance.employeeId} — completed task history retained, employee lifecycle status unchanged`
      );
    } catch (err) {}

    return this.getInstanceById(planInstanceId);
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
