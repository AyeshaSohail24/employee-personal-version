import { listConfirmationCandidates } from "../db/upcomingCandidates.js";
import { sendJson } from "../http/errors.js";

export const routes = {
  "/candidates": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { candidates: await listConfirmationCandidates() });
    },
  },
};
