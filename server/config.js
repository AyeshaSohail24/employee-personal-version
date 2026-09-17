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

function externalClient(prefix, fallbackAudience) {
  return {
    baseUrl: (process.env[`${prefix}_API_BASE_URL`] ?? "").replace(/\/+$/, ""),
    audience: process.env[`${prefix}_SERVICE_ID`] ?? fallbackAudience,
    clientId: process.env[`${prefix}_CLIENT_ID`] ?? "",
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] ?? "",
  };
}

// The three external systems this app links to via API only — never a direct
// DB connection (see db/schema_employees.sql's architecture note).
export const EXTERNAL_CLIENTS = {
  applicants: externalClient("APPLICANTS", "applicants-api"),
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
