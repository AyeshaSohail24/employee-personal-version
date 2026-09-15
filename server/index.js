import http from "node:http";
import { randomUUID } from "node:crypto";
import { PORT, SERVICE_ID, VERSION } from "./config.js";
import { openapi, requiredScopesFor, isPublicRoute } from "./openapi.js";
import { buildRouteMatcher } from "./http/router.js";
import { sendJson, sendError, NotFoundError, ValidationError, CORRELATION_HEADER, NO_STORE } from "./http/errors.js";
import { authenticate, principalMayWrite } from "./http/authenticate.js";
import { authorizeRedirectUrl, exchangeCodeForIdentity, CALLBACK_PATH } from "./auth/signin.js";
import { serializeSessionCookie, readSession } from "./auth/session.js";
import { gatewaySessionIsLive } from "./auth/introspect.js";
import { distExists, serveIndexHtml, serveStaticAsset } from "./http/staticSite.js";

import { routes as employeeRoutes } from "./routes/employees.js";
import { routes as orgStructureRoutes } from "./routes/orgStructure.js";
import { routes as onboardingRoutes } from "./routes/onboarding.js";
import { routes as offboardingRoutes } from "./routes/offboarding.js";
import { routes as activityRoutes } from "./routes/activities.js";
import { routes as leaveRoutes } from "./routes/leaves.js";
import { routes as candidateMessagingRoutes } from "./routes/candidateMessaging.js";
import { routes as noteRoutes } from "./routes/notes.js";
import { routes as adminRoutes } from "./routes/admin.js";

const routes = {
  ...employeeRoutes,
  ...orgStructureRoutes,
  ...onboardingRoutes,
  ...offboardingRoutes,
  ...activityRoutes,
  ...leaveRoutes,
  ...candidateMessagingRoutes,
  ...noteRoutes,
  ...adminRoutes,
};

const matchRoute = buildRouteMatcher(openapi);
const started = Date.now();

http
  .createServer(async (req, res) => {
    const supplied = req.headers[CORRELATION_HEADER];
    const cid = typeof supplied === "string" && supplied.trim() ? supplied : randomUUID();

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const method = (req.method ?? "GET").toUpperCase();

    try {
      // MICROAPP_AUTH.md §4 step 4 — the code exchange, server-to-server only.
      if (pathname === CALLBACK_PATH && method === "GET") {
        const code = url.searchParams.get("code");
        if (!code) return sendError(res, cid, 400, "VALIDATION_ERROR", "Missing `code`.");
        const identity = await exchangeCodeForIdentity(code);
        res.writeHead(302, {
          location: "/",
          "set-cookie": serializeSessionCookie(identity),
          ...NO_STORE,
        });
        return res.end();
      }

      if (pathname === "/health") {
        return sendJson(res, cid, 200, {
          status: "ok",
          service: SERVICE_ID,
          version: VERSION,
          uptime_seconds: Math.floor((Date.now() - started) / 1000),
          checks: { database: true },
        });
      }
      if (pathname === "/openapi.json") return sendJson(res, cid, 200, openapi);

      const matched = matchRoute(pathname);

      // No API route matched — this is the SPA shell (or one of its
      // client-side routes). Gate it on a live session (§4 step 1 / §5),
      // same as any other authenticated page, then serve the built app.
      if (!matched && method === "GET") {
        const session = readSession(req.headers.cookie);
        const live = session && (await gatewaySessionIsLive(session));
        if (!live) {
          res.writeHead(302, { location: authorizeRedirectUrl(), ...NO_STORE });
          return res.end();
        }
        if (!distExists()) {
          res.writeHead(200, { "content-type": "text/plain", ...NO_STORE });
          return res.end("Signed in. Run `npm run build` to serve the app from this server, or use `npm run dev` for UI iteration.");
        }
        if (pathname !== "/" && serveStaticAsset(pathname, res)) return;
        return serveIndexHtml(res, NO_STORE);
      }

      if (!matched) {
        return sendError(res, cid, 404, "RESOURCE_NOT_FOUND", `No route for ${pathname}.`);
      }

      const { routeKey, params } = matched;
      const allowed = Object.keys(openapi.paths[routeKey]).map((m) => m.toUpperCase());
      if (!allowed.includes(method)) {
        res.setHeader("allow", allowed.join(", "));
        return sendError(res, cid, 405, "METHOD_NOT_ALLOWED", `${method} is not allowed on ${pathname}.`);
      }

      if (!isPublicRoute(routeKey)) {
        const requiredScopes = requiredScopesFor(routeKey, method);
        const auth = await authenticate(req, requiredScopes);
        if (!auth.ok) return sendError(res, cid, auth.status, auth.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED", auth.message);

        const isWrite = method !== "GET";
        if (isWrite && !principalMayWrite(auth.principal)) {
          return sendError(res, cid, 403, "FORBIDDEN", "Your role does not permit write access.");
        }
      }

      const handler = routes[routeKey]?.[method.toLowerCase()];
      if (!handler) return sendError(res, cid, 501, "NOT_IMPLEMENTED", "Not implemented.");

      await handler(req, res, { cid, url, params });
    } catch (error) {
      if (error instanceof NotFoundError) return sendError(res, cid, 404, "RESOURCE_NOT_FOUND", error.message);
      if (error instanceof ValidationError) return sendError(res, cid, 422, "VALIDATION_ERROR", error.message);
      console.error(error);
      // SS-5 — never leak SQL, stack traces, or connection strings to the caller.
      return sendError(res, cid, 500, "INTERNAL_ERROR", "Unexpected error.");
    }
  })
  .listen(PORT, () => {
    console.log(`${SERVICE_ID} listening on http://127.0.0.1:${PORT}`);
  });
