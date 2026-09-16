import * as db from "../db/leaves.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

export const routes = {
  "/leaves": {
    async get(req, res, ctx) {
      const { limit, offset } = parseListQuery(ctx.url);
      const leaves = await db.listLeaves({
        employeeId: ctx.url.searchParams.get("employee_id") ?? undefined,
        status: ctx.url.searchParams.get("status") ?? undefined,
        limit,
        offset,
      });
      sendJson(res, ctx.cid, 200, { leaves });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createLeave(body);
      sendJson(res, ctx.cid, 201, { leave: await db.getLeave(id) });
    },
  },
  "/leaves/{id}": {
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        await db.updateLeave(ctx.params.id, body);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { leave: await db.getLeave(ctx.params.id) });
    },
  },
  "/presence-overrides": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { overrides: await db.listPresenceOverrides(ctx.url.searchParams.get("employee_id") ?? undefined) });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createPresenceOverride(body);
      sendJson(res, ctx.cid, 201, { override: { id, ...body } });
    },
  },
};
