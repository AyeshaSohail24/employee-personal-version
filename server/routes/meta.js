// GET /health and GET /openapi.json — routed through the same matched-route
// pipeline as every other operation (see requestHandler.js), instead of
// being special-cased ahead of it. That's what makes a wrong method on
// either of them a real 405 rather than silently succeeding (SS-5) — the
// same `allowed.includes(method)` check every other endpoint gets.
import { sendJson } from "../http/errors.js";
import { openapi } from "../openapi.js";
import { SERVICE_ID, VERSION } from "../config.js";
import { pool } from "../db/pool.js";
import { getPhotoUrlForEmail } from "../db/internSync.js";

const started = Date.now();

// MICROAPP_PERFORMANCE.md §3 — time-box the one check /health does, so a hanging database
// (this app's VPS-hosted MySQL has had real connect timeouts before — see dev-docs/DEPLOYMENT.md)
// reports `degraded` quickly instead of hanging the whole endpoint until the platform kills it.
// The gateway polls this every ~15s; it must answer fast every time, not just when things are fine.
async function withTimeout(fn, ms = 800) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export const routes = {
  "/health": {
    async get(req, res, ctx) {
      // SS-2 — report `degraded` when the service is up but a dependency
      // isn't; a hardcoded `true` here would make this endpoint worthless.
      let databaseOk = true;
      try {
        await withTimeout(() => pool.query("SELECT 1"));
      } catch {
        databaseOk = false;
      }
      sendJson(res, ctx.cid, 200, {
        status: databaseOk ? "ok" : "degraded",
        service: SERVICE_ID,
        version: VERSION,
        uptime_seconds: Math.floor((Date.now() - started) / 1000),
        checks: { database: databaseOk },
      });
    },
  },
  "/openapi.json": {
    async get(req, res, ctx) {
      // MICROAPP_PERFORMANCE.md §4/§8 — public, identical for every caller, and only changes on
      // deploy: safe to let the CDN and browser cache it briefly instead of NO_STORE (sendJson's
      // default, correct everywhere else — every other response here can depend on who's asking).
      sendJson(res, ctx.cid, 200, openapi, { "cache-control": "public, max-age=60" });
    },
  },
  // Not part of the public API catalog (SS-8) in spirit — it's how the SPA
  // itself finds out whether its session is still live, since Vercel's own
  // static rewrite for a real page load bypasses the backend entirely (see
  // requestHandler.js's comment on the acceptsHtml branch). A 401 here is
  // the frontend's actual signal to redirect to sign-in.
  "/session": {
    async get(req, res, ctx) {
      // The identity token itself carries no picture claim — resolved
      // separately (see getPhotoUrlForEmail's own doc comment). Never lets
      // a broken photo lookup fail the session check that gates the whole
      // app: falls back to null exactly like a person with no linked intern.
      let photoUrl = null;
      try {
        photoUrl = await getPhotoUrlForEmail(ctx.principal.email);
      } catch {
        photoUrl = null;
      }
      sendJson(res, ctx.cid, 200, {
        sub: ctx.principal.sub,
        email: ctx.principal.email ?? null,
        name: ctx.principal.name ?? null,
        role: ctx.principal.role ?? null,
        photoUrl,
      });
    },
  },
};
