// GET /health and GET /openapi.json — routed through the same matched-route
// pipeline as every other operation (see requestHandler.js), instead of
// being special-cased ahead of it. That's what makes a wrong method on
// either of them a real 405 rather than silently succeeding (SS-5) — the
// same `allowed.includes(method)` check every other endpoint gets.
import { sendJson } from "../http/errors.js";
import { openapi } from "../openapi.js";
import { SERVICE_ID, VERSION } from "../config.js";
import { pool } from "../db/pool.js";

const started = Date.now();

export const routes = {
  "/health": {
    async get(req, res, ctx) {
      // SS-2 — report `degraded` when the service is up but a dependency
      // isn't; a hardcoded `true` here would make this endpoint worthless.
      let databaseOk = true;
      try {
        await pool.query("SELECT 1");
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
      sendJson(res, ctx.cid, 200, openapi);
    },
  },
};
