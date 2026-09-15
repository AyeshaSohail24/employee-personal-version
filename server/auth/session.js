// MICROAPP_AUTH.md §6 — this app's own session cookie. HMAC-signed, HttpOnly,
// short-lived. The TTL here is a backstop for a gateway that stays down, not
// the sign-out mechanism itself — see introspect.js (§5) for that.
import { createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_SECRET, SESSION_TTL_SECONDS } from "../config.js";

export const SESSION_COOKIE_NAME = "rizurf_employees_session";

function sign(payload) {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

export function serializeSessionCookie(identityClaims) {
  const session = {
    sid: identityClaims.sid,
    sub: identityClaims.sub,
    email: identityClaims.email,
    name: identityClaims.name,
    role: identityClaims.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = sign(payload);
  return `${SESSION_COOKIE_NAME}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSession(cookieHeader) {
  if (!cookieHeader) return null;
  const raw = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!raw) return null;

  const value = raw.slice(SESSION_COOKIE_NAME.length + 1);
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);

  const expected = sign(payload);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  let session;
  try {
    session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  // An expired session is treated as absent — otherwise a gateway sign-out
  // that happens while this app stays unreachable never reaches this app.
  if (typeof session.exp !== "number" || session.exp * 1000 < Date.now()) return null;
  return session;
}
