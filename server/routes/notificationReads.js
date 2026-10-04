import * as reads from "../db/notificationReads.js";
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
      sendJson(res, ctx.cid, 200, await reads.listReadKeys(account(ctx)));
    },
    async put(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        sendJson(res, ctx.cid, 200, { marked: await reads.markKeysRead(account(ctx), body.keys) });
      } catch (error) {
        if (error instanceof reads.NotificationReadError) throw new ValidationError(error.message);
        throw error;
      }
    },
  },
};
