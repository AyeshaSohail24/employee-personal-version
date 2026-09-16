import * as db from "../db/admin.js";
import { sendJson } from "../http/errors.js";
import { parseListQuery } from "../http/util.js";

export const routes = {
  "/user-accounts": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { userAccounts: await db.listUserAccounts() });
    },
  },
  "/audit-logs": {
    async get(req, res, ctx) {
      const { limit, offset } = parseListQuery(ctx.url);
      const auditLogs = await db.listAuditLogs({
        entity: ctx.url.searchParams.get("entity") ?? undefined,
        entityId: ctx.url.searchParams.get("entity_id") ?? undefined,
        limit,
        offset,
      });
      sendJson(res, ctx.cid, 200, { auditLogs });
    },
  },
};
