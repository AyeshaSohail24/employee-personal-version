import * as db from "../db/offboarding.js";
import { getEmployee } from "../db/employees.js";
import { listInternsWithOffboardingStatus, resolveOrCreateEmployeeForIntern } from "../db/internSync.js";
import { internsClient } from "../clients/internsClient.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError, ValidationError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

export const routes = {
  "/offboarding/interns": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { interns: await listInternsWithOffboardingStatus() });
    },
  },
  "/offboarding/interns/{internId}/launch": {
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
  // Offboarding History — every completed offboarding plan, including people now Former.
  "/offboarding/history": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { records: await db.listOffboardingHistory() });
    },
  },
  // Permanently deletes one completed offboarding record (plan + tasks); the person is untouched.
  "/offboarding/history/{planInstanceId}": {
    async delete(req, res, ctx) {
      try {
        await db.deleteCompletedOffboardingPlan(ctx.params.planInstanceId);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        if (error instanceof db.OffboardingHistoryError) throw new ValidationError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 204, null);
    },
  },
  "/offboarding/scope-tasks": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { tasks: await db.listScopeTasks() });
    },
    async put(req, res, ctx) {
      const body = await readJsonBody(req);
      const tasks = await db.saveScopeTasks(body);
      sendJson(res, ctx.cid, 200, { tasks });
    },
  },
  "/offboarding/templates": {
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
  "/offboarding/templates/{id}": {
    async get(req, res, ctx) {
      const template = await db.getTemplate(ctx.params.id);
      if (!template) throw new NotFoundError(`No offboarding template with id ${ctx.params.id}.`);
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
  "/offboarding/instances": {
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
  "/offboarding/instances/{id}": {
    async get(req, res, ctx) {
      const instance = await db.getInstance(ctx.params.id);
      if (!instance) throw new NotFoundError(`No offboarding instance with id ${ctx.params.id}.`);
      const employee = await getEmployee(instance.employee_id);
      sendJson(res, ctx.cid, 200, {
        instance,
        taskInstances: await db.listInstanceTasks(ctx.params.id),
        internRecord: await db.getLinkedIntern(employee), // read-through to the Interns DB, null for a non-intern
      });
    },
  },
  "/offboarding/instances/{id}/tasks": {
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      let taskInstanceId;
      try {
        taskInstanceId = await db.addTaskToInstance(ctx.params.id, body);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        if (error instanceof db.TaskInstanceValidationError) throw new ValidationError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 201, { taskInstance: await db.getTaskInstance(taskInstanceId) });
    },
  },
  "/offboarding/task-instances/{id}": {
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        if (body.title !== undefined || body.description !== undefined || body.dueDate !== undefined) {
          await db.updateTaskInstanceDetails(ctx.params.id, body);
        }
        if (body.completed !== undefined) {
          await db.setTaskInstanceCompleted(ctx.params.id, Boolean(body.completed));
        }
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        if (error instanceof db.TaskInstanceValidationError) throw new ValidationError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { taskInstance: await db.getTaskInstance(ctx.params.id) });
    },
    async delete(req, res, ctx) {
      try {
        await db.deleteTaskInstance(ctx.params.id);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 204, null);
    },
  },
};
