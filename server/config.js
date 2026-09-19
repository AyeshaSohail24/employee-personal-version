import { ConfigurationError } from "./http/errors.js";

const REQUIRED = [
  "GATEWAY_URL",
  "PUBLIC_URL",
  "SESSION_SECRET",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
];

// Never throws at import time — a Vercel serverless function has no boot
// phase separate from the first request, so a throw here would crash the
// whole function before requestHandler.js's own try/catch ever runs,
// producing Vercel's generic HTML error page instead of our JSON envelope.
// index.js (the persistent-server entry point) calls this explicitly and
// exits the process itself, which is where "fail loud at boot" (SS-20)
// actually belongs for that shape.
export function assertRequiredEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new ConfigurationError(`Missing required environment variable(s): ${missing.join(", ")} (see .env.example)`);
  }
}

export const SERVICE_ID = process.env.SERVICE_ID ?? "rizurf-employees-api";
export const VERSION = "1.0.0";
export const PORT = Number(process.env.PORT ?? 3420);
export const GATEWAY_URL = (process.env.GATEWAY_URL ?? "").replace(/\/+$/, "");
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? "").replace(/\/+$/, "");
export const SESSION_SECRET = process.env.SESSION_SECRET ?? "";
export const SESSION_TTL_SECONDS = 15 * 60;

export const DB = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

// This app has exactly one gateway-registered API client, granted access to
// every external audience it calls — client_credentials' own `audience`
// parameter (see clients/gatewayClientCredentials.js) is what selects which
// service's token comes back, not a separate client per service. Per-prefix
// CLIENT_ID/SECRET vars still work as an override (e.g. GATEWAY_CLIENT_ID
// unset locally but INTERNS_CLIENT_ID set), but there's no need to ever
// duplicate the same secret into three differently-prefixed vars again —
// falling back to whatever's already set for Interns means a newly-granted
// audience (like Applicants) needs no new Vercel var at all.
// `??` only skips a truly-unset (null/undefined) var — Vercel dashboards
// commonly leave an unfilled env var present but set to an empty string,
// which `??` would treat as "set" and never fall through. `||` here is
// deliberate: empty string and unset should behave identically for every
// one of these.
function firstNonEmpty(...values) {
  return values.find((v) => v) ?? "";
}

function sharedClientId() {
  return firstNonEmpty(process.env.GATEWAY_CLIENT_ID, process.env.INTERNS_CLIENT_ID);
}
function sharedClientSecret() {
  return firstNonEmpty(process.env.GATEWAY_CLIENT_SECRET, process.env.INTERNS_CLIENT_SECRET);
}

function externalClient(prefix, fallbackAudience) {
  return {
    baseUrl: firstNonEmpty(process.env[`${prefix}_API_BASE_URL`]).replace(/\/+$/, ""),
    audience: firstNonEmpty(process.env[`${prefix}_SERVICE_ID`], fallbackAudience),
    clientId: firstNonEmpty(process.env[`${prefix}_CLIENT_ID`], sharedClientId()),
    clientSecret: firstNonEmpty(process.env[`${prefix}_CLIENT_SECRET`], sharedClientSecret()),
  };
}

// The three external systems this app links to via API only — never a direct
// DB connection (see db/schema_employees.sql's architecture note).
export const EXTERNAL_CLIENTS = {
  applicants: externalClient("APPLICANTS", "recruitment-api"),
  interns: externalClient("INTERNS", "intern-database"),
  departments: externalClient("DEPARTMENTS", "department-api"),
};

// Not required at startup (like EXTERNAL_CLIENTS above) — server/messaging/
// emailProvider.js throws its own clear error if this is asked to send
// without being configured, same pattern as the external API clients.
export const MAIL = {
  host: process.env.MAIL_HOST ?? "",
  port: Number(process.env.MAIL_PORT ?? 465),
  username: process.env.MAIL_USERNAME ?? "",
  password: process.env.MAIL_PASSWORD ?? "",
  fromAddress: process.env.MAIL_FROM_ADDRESS ?? "",
  fromName: process.env.MAIL_FROM_NAME ?? "",
};
