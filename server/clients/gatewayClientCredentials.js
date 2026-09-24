// RIZURF_API_TEMPLATE.md SS-26 — this app calling ANOTHER service (a program,
// not a person), so it has no browser and no session: it trades an API
// client's id/secret for a scoped access token, and caches that token until
// it expires rather than fetching one per call.
import { GATEWAY_URL } from "../config.js";

const tokenCache = new Map(); // `${audience}:${scope}` -> { accessToken, expiresAt }

export async function getServiceAccessToken({ clientId, clientSecret, audience, scope }) {
  const cacheKey = `${audience}:${scope ?? ""}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 5000) return cached.accessToken;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = { grant_type: "client_credentials", audience };
  if (scope) body.scope = scope;

  const response = await fetch(`${GATEWAY_URL}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${basicAuth}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000), // MICROAPP_PERFORMANCE.md §9
  });
  if (!response.ok) throw new Error(`client_credentials grant for "${audience}" failed: ${response.status}`);

  const { access_token, expires_in } = await response.json();
  tokenCache.set(cacheKey, { accessToken: access_token, expiresAt: Date.now() + expires_in * 1000 });
  return access_token;
}
