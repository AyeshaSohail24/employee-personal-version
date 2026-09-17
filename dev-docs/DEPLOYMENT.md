# Deploying the backend on Vercel (same project as the frontend)

The gateway can't connect to this app yet because the backend has never run
anywhere public — only on `127.0.0.1` locally. This app's frontend and
backend now live in **one Vercel project** — the existing
`employee-personal-version` one you already have — matching how the other
microapps in this ecosystem are set up. No second project needed.

## How one deployment serves both

The frontend has page routes at `/employees`, `/upcoming`, `/onboarding`,
etc. (`src/router/index.jsx`), and the backend API lives at those **same**
root-level paths (`RIZURF_API_TEMPLATE.md`'s convention — plural nouns at
the root, no `/api/` prefix, matching Interns DB and Departments DB). Same
path, two different meanings depending on who's asking — so `vercel.json`
disambiguates using the one signal that reliably tells them apart, the
`Accept` header:

```json
{
  "rewrites": [
    { "source": "/(.*)", "has": [{ "type": "header", "key": "accept", "value": "^text/html.*" }], "destination": "/index.html" },
    { "source": "/(.*)", "destination": "/api/handler" }
  ]
}
```

- A real browser navigating or hard-refreshing any page sends
  `Accept: text/html,...` first → served `index.html`, React Router takes
  over client-side.
- Everything else — `curl` (`Accept: */*`), `fetch()`, the gateway's
  conformance checker, another service's `client_credentials` call — has no
  `text/html` preference → routed to `api/handler.js`, our actual API.
- A real static file (`/assets/index-abc123.js`, favicon, etc.) is served
  directly by Vercel before either rewrite rule is ever consulted, so this
  doesn't interfere with the built JS/CSS bundles.

This is Vercel-native routing (the `has` header condition) — I can't fully
test it without an actual Vercel deploy, so **verify step 2 below for real**
once this is live; if a browser somehow gets JSON instead of the app, or
`curl` gets HTML, that's the thing to debug first.

## What's in the repo now

- `server/requestHandler.js` — all the actual request logic (auth, routing,
  every endpoint), used by both entry points below.
- `server/index.js` — wraps it in `http.createServer()`, for local dev
  (`npm run server`) or any host that wants a persistent process.
- `api/handler.js` (repo root) — the Vercel entry point. Same
  `handleServerlessRequest`, invoked per-request by Vercel's Node runtime.
- `vercel.json` (repo root) — the header-based routing above.

## Steps

1. **Set environment variables** on the existing `employee-personal-version`
   Vercel project (Settings → Environment Variables) — everything from
   `.env.example`, with real values from local `.env`:

   | Variable | Value |
   |---|---|
   | `SERVICE_ID` | `rizurf-employees-api` |
   | `GATEWAY_URL` | `https://web-omega-two-47.vercel.app` |
   | `PUBLIC_URL` | `https://employee-personal-version.vercel.app` (the existing domain — same one, now serving both) |
   | `SESSION_SECRET` | same as local `.env`, or a fresh one |
   | `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | same values as local `.env` (the VPS MySQL instance) |
   | `APPLICANTS_*` / `INTERNS_*` / `DEPARTMENTS_*` | same values as local `.env` |
   | `MAIL_*` | same values as local `.env` |

   A missing variable here no longer crashes the deployment (see the
   `assertRequiredEnv()` fix) — it returns a clear JSON `500` naming exactly
   which one, instead of Vercel's own HTML error page.

2. **Push to `employees-final`** (already done as of this change) and let
   Vercel redeploy, then verify **both** halves work — this is the part that
   actually confirms the `Accept`-header routing is doing its job:
   ```bash
   curl -i https://employee-personal-version.vercel.app/health
   curl -i https://employee-personal-version.vercel.app/openapi.json
   curl https://employee-personal-version.vercel.app/nonexistent
   ```
   First two must be `200` JSON. Third must be the JSON error envelope, not
   HTML. Then open `https://employee-personal-version.vercel.app/dashboard`
   in an actual browser — it should still load the app normally, not JSON.

3. **Connect it to the gateway**: gateway console → Connect a service →
   paste `https://employee-personal-version.vercel.app`. Run
   **Conformance** there before requesting approval.

## Database: a VPS-hosted MySQL instance

`DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` point at a real,
network-reachable MySQL instance (`db.crevascale.com`), not `localhost` —
every `FOREIGN KEY` in `db/schema_employees.sql` stays exactly as written,
no PlanetScale migration needed. The one caveat is connection pooling under
real concurrent load (a traditional pool doesn't behave identically across
serverless invocations the way it does in a persistent process) —
manageable at this app's scale with `db/pool.js`'s current
`connectionLimit: 10`.

**Known issue, unrelated to the deployment work above:** this VPS database
is currently timing out on connection attempts (`connect ETIMEDOUT`),
consistently, not a one-off blip — worth checking whether the VPS is up or
its firewall/allowlist changed before assuming a Vercel deploy will reach
it either.

## After this works

- `PUBLIC_URL` above is what makes the human sign-in flow (`MICROAPP_AUTH.md`
  §4) real for the first time — until now it pointed at `127.0.0.1`, which
  the gateway could never redirect a real browser back to.
- The frontend (`src/services/*`) still isn't wired to call this API — that
  was paused earlier for the same reason (no way to sign in locally). Once
  this is deployed and registered, that blocker is gone.
