import * as db from "../db/onboarding.js";
import { getEmployee } from "../db/employees.js";
import { resolveOrCreateEmployeeForIntern } from "../db/internSync.js";
import { internsClient } from "../clients/internsClient.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError, ValidationError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

export const routes = {
  "/onboarding/interns": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { interns: await db.listInternsWithAutoLaunchedOnboarding() });
    },
  },
  "/onboarding/interns/{internId}/launch": {
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const intern = await internsClient.getIntern(ctx.params.internId);
      const employee = await resolveOrCreateEmployeeForIntern(ctx.params.internId);
      const instanceId = await db.launchInstance({
        employeeId: employee.id,
        personType: "intern",
        departmentId: intern.department_id,
        anchorDate: body.anchorDate,
      });
      sendJson(res, ctx.cid, 201, {
        instance: await db.getInstance(instanceId),
        taskInstances: await db.listInstanceTasks(instanceId),
      });
    },
  },
  "/onboarding/scope-tasks": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { tasks: await db.listScopeTasks() });
    },
    async put(req, res, ctx) {
      const body = await readJsonBody(req);
      const tasks = await db.saveScopeTasks(body);
      sendJson(res, ctx.cid, 200, { tasks });
    },
  },
  "/onboarding/templates": {
    async get(req, res, ctx) {
      const templates = await db.listTemplates(ctx.url.searchParams.get("department_id") ?? undefined, parseListQuery(ctx.url));
      sendJson(res, ctx.cid, 200, { templates });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createTemplate(body);
      sendJson(res, ctx.cid, 201, { template: await db.getTemplate(id) });
    },
  },
  "/onboarding/templates/{id}": {
    async get(req, res, ctx) {
      const template = await db.getTemplate(ctx.params.id);
      if (!template) throw new NotFoundError(`No onboarding template with id ${ctx.params.id}.`);
      sendJson(res, ctx.cid, 200, { template });
    },
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        await db.updateTemplate(ctx.params.id, body);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { template: await db.getTemplate(ctx.params.id) });
    },
  },
  "/onboarding/instances": {
    async get(req, res, ctx) {
      const employeeId = ctx.url.searchParams.get("employee_id");
      if (!employeeId) throw new ValidationError("`employee_id` is required.");
      const instance = await db.getLatestInstanceForEmployee(employeeId);
      sendJson(res, ctx.cid, 200, {
        instance,
        taskInstances: instance ? await db.listInstanceTasks(instance.id) : [],
      });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.launchInstance(body);
      sendJson(res, ctx.cid, 201, {
        instance: await db.getInstance(id),
        taskInstances: await db.listInstanceTasks(id),
      });
    },
  },
  "/onboarding/instances/{id}": {
    async get(req, res, ctx) {
      const instance = await db.getInstance(ctx.params.id);
      if (!instance) throw new NotFoundError(`No onboarding instance with id ${ctx.params.id}.`);
      const employee = await getEmployee(instance.employee_id);
      sendJson(res, ctx.cid, 200, {
        instance,
        taskInstances: await db.listInstanceTasks(ctx.params.id),
        internRecord: await db.getLinkedIntern(employee), // read-through to the Interns DB, null for a non-intern
      });
    },
  },
  "/onboarding/task-instances/{id}": {
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        await db.setTaskInstanceCompleted(ctx.params.id, Boolean(body.completed));
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { taskInstance: await db.getTaskInstance(ctx.params.id) });
    },
  },
};
