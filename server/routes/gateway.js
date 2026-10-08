// GET /gateway/badges — read by the gateway, never by people (MICROAPP_BADGES.md §1–2,
// RIZURF_NOTIFICATION_STANDARD.md §6a). Not behind the app's sign-in: its credential is a token the
// gateway signs, checked here — signature against the gateway's JWKS, iss, aud = this service,
// token_use "access" and the gateway:badges:read scope. A browser session doesn't count (it would
// let one HR person see everyone's numbers). Anything else gets 401 and no counts.
import { verifyToken } from "../auth/verifyToken.js";
import { sendJson, sendError, NotFoundError } from "../http/errors.js";
import { GATEWAY_NOTIFY } from "../config.js";
import { gatewayBadgesAnswer } from "../db/gatewayNotify.js";
import { buildCurrentReminders } from "./employees.js";

const REQUIRED_SCOPE = "gateway:badges:read";

async function isGateway(req) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  if (!match) return false;
  try {
    const claims = await verifyToken(match[1], "access");
    return String(claims.scope ?? "").split(/\s+/).includes(REQUIRED_SCOPE);
  } catch {
    return false;
  }
}

export const routes = {
  "/gateway/badges": {
    async get(req, res, ctx) {
      // Off: the gateway sees "not served yet" and checks back later (every 10 minutes after a 404).
      if (!GATEWAY_NOTIFY.enabled) throw new NotFoundError("Gateway badges aren't switched on for this app.");
      if (!(await isGateway(req))) return sendError(res, ctx.cid, 401, "UNAUTHENTICATED", "Gateway token required.");
      const answer = await gatewayBadgesAnswer(await buildCurrentReminders());
      // Part of the feed couldn't be read: answering with it would show counts of 0. The gateway
      // keeps the numbers it last read instead.
      if (!answer) return sendError(res, ctx.cid, 503, "SOURCE_UNAVAILABLE", "Reminders couldn't be fully read right now; try again shortly.");
      sendJson(res, ctx.cid, 200, answer);
    },
  },
};
