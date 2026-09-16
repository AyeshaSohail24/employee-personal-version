import * as db from "../db/onboarding.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { readJsonBody } from "../http/util.js";

export const routes = {
  "/onboarding/templates": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { templates: await db.listTemplates(ctx.url.searchParams.get("department_id") ?? undefined) });
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
      sendJson(res, ctx.cid, 200, { instance, taskInstances: await db.listInstanceTasks(ctx.params.id) });
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
