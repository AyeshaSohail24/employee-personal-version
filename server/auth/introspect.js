// MICROAPP_AUTH.md §5 — checked on every authenticated request, never cached.
// A cache is exactly the window in which this app and the gateway could
// disagree about whether someone still has access.
import { GATEWAY_URL } from "../config.js";

export async function gatewaySessionIsLive(session) {
  if (!session?.sid) return false;

  try {
    const response = await fetch(`${GATEWAY_URL}/oauth/introspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sid: session.sid, sub: session.sub }),
    });
    if (!response.ok) return true; // see "fail open," below
    const { active } = await response.json();
    return Boolean(active);
  } catch {
    // Fail open, deliberately. A gateway that is briefly unreachable must not
    // sign everyone out of every app at once. The session's own TTL (§6) is
    // the backstop for a gateway that stays down.
    return true;
  }
}
