// MICROAPP_AUTH.md §3 / RIZURF_API_TEMPLATE.md SS-25 — verify a gateway token
// ourselves, against the gateway's own published key. Never trust that a
// request merely arrived looking legitimate.
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import { GATEWAY_URL, SERVICE_ID } from "../config.js";
import { getGatewayJwks } from "./jwks.js";

function base64UrlDecode(segment) {
  return Buffer.from(segment, "base64url");
}

/**
 * Throws on anything wrong — an unverifiable token is not a token with less
 * information, it is not a token at all. `expectedUse` is not optional: the
 * gateway signs both a 5-minute "identity" assertion (human sign-in) and a
 * scoped "access" token (client_credentials) with the same key, so checking
 * token_use is what stops one being replayed where the other is expected.
 */
export async function verifyToken(token, expectedUse) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token.");
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
  if (header.alg !== "RS256") throw new Error(`Unexpected algorithm "${header.alg}".`);

  const jwks = await getGatewayJwks();
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error(`No key "${header.kid}" in the gateway's JWKS.`);
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });

  const signingInput = `${headerB64}.${payloadB64}`;
  const ok = cryptoVerify("RSA-SHA256", Buffer.from(signingInput), publicKey, base64UrlDecode(sigB64));
  if (!ok) throw new Error("Signature does not verify.");

  const claims = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));

  if (claims.token_use !== expectedUse) {
    throw new Error(`Expected a "${expectedUse}" token, got "${claims.token_use ?? "none"}".`);
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) {
    throw new Error("Token has expired.");
  }
  if (claims.iss !== GATEWAY_URL) {
    throw new Error(`Token issuer "${claims.iss}" is not this app's configured gateway.`);
  }
  if (claims.aud !== SERVICE_ID) {
    throw new Error(`Token audience "${claims.aud}" was not minted for this service.`);
  }

  return claims;
}
