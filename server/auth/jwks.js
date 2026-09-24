import { GATEWAY_URL } from "../config.js";

// Fetched once and kept for the process lifetime — the key only changes on a
// gateway redeploy, which restarts this process too in any real deploy.
let jwksCache = null;

export async function getGatewayJwks() {
  if (!jwksCache) {
    const response = await fetch(`${GATEWAY_URL}/.well-known/jwks.json`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`);
    jwksCache = await response.json();
  }
  return jwksCache;
}
