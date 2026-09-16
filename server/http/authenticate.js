// Two distinct callers reach this API, over two distinct channels:
//
//  - This app's OWN browser (the SPA) — authenticated by the session cookie
//    MICROAPP_AUTH.md's sign-in flow sets. A signed-in session is gated on
//    the gateway's own `role` (admin/hr/supervisor/user) for the common case,
//    exactly as that doc recommends — no parallel scope system for our own UI.
//  - ANOTHER service or script (RIZURF_API_TEMPLATE.md SS-26) — authenticated
//    by a real Bearer access token, gated on the scope the operation declares
//    (SS-6/SS-7). It has no "role" here, only what it was granted.
import { verifyToken } from "../auth/verifyToken.js";
import { readSession } from "../auth/session.js";
import { gatewaySessionIsLive } from "../auth/introspect.js";

const WRITE_ROLES = new Set(["admin", "hr"]);

export async function authenticate(req, requiredScopes) {
  const session = readSession(req.headers.cookie);
  if (session) {
    // No caching this answer (§5) — checked on every request that reaches here.
    const live = await gatewaySessionIsLive(session);
    if (!live) return { ok: false, status: 401, message: "Gateway session is no longer active." };
    return { ok: true, principal: { type: "session", ...session } };
  }

  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  if (!match) return { ok: false, status: 401, message: "A signed-in session or bearer token is required." };

  let claims;
  try {
    claims = await verifyToken(match[1], "access");
  } catch (error) {
    return { ok: false, status: 401, message: String(error.message ?? error) };
  }

  const held = new Set(String(claims.scope ?? "").split(/\s+/).filter(Boolean));
  const missing = requiredScopes.filter((scope) => !held.has(scope));
  if (missing.length > 0) {
    return { ok: false, status: 403, message: `This endpoint needs ${missing.join(", ")}.` };
  }
  return { ok: true, principal: { type: "access", sub: claims.sub, scope: held } };
}

// For a session-cookie principal only — an access-token caller already had
// its scope checked in authenticate() above, so this always passes for one.
export function principalMayWrite(principal) {
  return principal.type === "access" || WRITE_ROLES.has(principal.role);
}
