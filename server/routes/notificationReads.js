import * as reads from "../db/notificationReads.js";
import { rememberAccount, nudgeGateway } from "../db/gatewayNotify.js";
import { sendJson, ValidationError } from "../http/errors.js";
import { readJsonBody } from "../http/util.js";

function account(ctx) {
  try {
    return reads.accountKeyFor(ctx.principal);
  } catch (error) {
    throw new ValidationError(error.message);
  }
}

export const routes = {
  // The signed-in account's read notifications (server/db/notificationReads.js): GET lists the
  // keys it has read, PUT { keys } marks more read. Another account's state is never visible.
  "/notification-reads": {
    async get(req, res, ctx) {
      const key = account(ctx);
      await rememberAccount(key, ctx.principal);
      sendJson(res, ctx.cid, 200, await reads.listReadKeys(key));
    },
    async put(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        const key = account(ctx);
        const marked = await reads.markKeysRead(key, body.keys);
        await rememberAccount(key, ctx.principal);
        // Reading lowers this account's unread count: the gateway re-reads it now (§6b).
        await nudgeGateway();
        sendJson(res, ctx.cid, 200, { marked });
      } catch (error) {
        if (error instanceof reads.NotificationReadError) throw new ValidationError(error.message);
        throw error;
      }
    },
  },
};
