// MICROAPP_AUTH.md §4 — the sign-in flow, end to end. No client secret: the
// trust boundary is the one-time code itself, exchanged server-to-server.
import { GATEWAY_URL, PUBLIC_URL } from "../config.js";
import { verifyToken } from "./verifyToken.js";

export const CALLBACK_PATH = "/auth/callback";
// The frontend's actual "go sign in" trigger — a real top-level navigation
// here always has to reach this backend (see vercel.json), since Vercel's
// own Accept: text/html rewrite would otherwise just serve the SPA shell
// again instead of ever redirecting anywhere.
export const LOGIN_PATH = "/auth/login";

export function authorizeRedirectUrl() {
  const redirectUri = `${PUBLIC_URL}${CALLBACK_PATH}`;
  return `${GATEWAY_URL}/oauth/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export async function exchangeCodeForIdentity(code) {
  const redirectUri = `${PUBLIC_URL}${CALLBACK_PATH}`;
  const response = await fetch(`${GATEWAY_URL}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
  if (!response.ok) throw new Error(`Code exchange failed: ${response.status}`);
  const { token } = await response.json();
  return verifyToken(token, "identity");
}
