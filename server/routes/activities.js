import * as db from "../db/activities.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

export const routes = {
  "/activities": {
    async get(req, res, ctx) {
      const { limit, offset } = parseListQuery(ctx.url);
      const activities = await db.listActivities({
        employeeId: ctx.url.searchParams.get("employee_id") ?? undefined,
        assigneeId: ctx.url.searchParams.get("assignee_id") ?? undefined,
        limit,
        offset,
      });
      sendJson(res, ctx.cid, 200, { activities });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createActivity(body);
      sendJson(res, ctx.cid, 201, { activity: await db.getActivity(id) });
    },
  },
  "/activities/{id}": {
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        await db.updateActivity(ctx.params.id, body);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { activity: await db.getActivity(ctx.params.id) });
    },
  },
};
