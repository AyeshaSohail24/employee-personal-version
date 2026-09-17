# Deploying `/server` (Vercel)

The gateway can't connect to this app yet because `/server` has never run
anywhere public — only on `127.0.0.1` locally. This is the manual path to
fix that on Vercel, matching where the gateway, Interns DB, and Departments
DB already live. I can't create the Vercel project or click deploy for you;
this is what to do once you're in the dashboard.

## Why this needed code changes, not just a deploy

`server/index.js` used to be a persistent `http.createServer().listen()`
process — that shape doesn't run on Vercel, which invokes a stateless
function per request instead. The fix (already done, on `employees-final`):

- `server/requestHandler.js` — all the actual request logic, extracted so
  both entry points below can share it.
- `server/index.js` — now just wraps `handleServerlessRequest` in
  `http.createServer()`, for local dev or any host that wants a persistent
  process (Railway, Render, a VPS).
- `server/api/handler.js` — the Vercel entry point. Same
  `handleServerlessRequest`, invoked per-request by Vercel's Node runtime.
- `server/vercel.json` — rewrites every path to `/api/handler`, so the
  public API surface stays at the root (`/health`, `/employees`, ...) rather
  than under `/api/*` — matching Interns DB and Departments DB's own shape.
- `server/package.json` — its own dependency list (`mysql2`, `nodemailer`),
  separate from the root one, since this becomes its own Vercel project
  rooted at `server/`.

## Steps

1. **New Vercel project** → **Import Git Repository** → same repo
   (`AyeshaSohail24/employee-personal-version`), branch `employees-final`.
   This is a **second, separate** Vercel project from the existing
   `employee-personal-version` one (which only serves the frontend) — don't
   reuse that project.
2. In the import screen, set **Root Directory** to `server`, and
   **Framework Preset** to **Other**. Leave Build Command empty (nothing to
   build — it's plain Node).
3. **Environment Variables** — same list as before, minus anything
   host-specific:

   | Variable | Value |
   |---|---|
   | `SERVICE_ID` | `rizurf-employees-api` |
   | `GATEWAY_URL` | `https://web-omega-two-47.vercel.app` |
   | `PUBLIC_URL` | the `*.vercel.app` URL this project gets assigned (fill in **after** first deploy, then redeploy) |
   | `SESSION_SECRET` | same as local `.env`, or a fresh one |
   | `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | same values as local `.env` (the VPS MySQL instance — see below) |
   | `APPLICANTS_*` / `INTERNS_*` / `DEPARTMENTS_*` | same values as local `.env` |
   | `MAIL_*` | same values as local `.env` |

   Vercel injects `PORT` itself for its runtime, and `server/config.js`
   doesn't read it directly anyway (Vercel's Node functions don't bind a
   port the way `index.js` does locally) — nothing to set there.

4. **Verify exactly like `RIZURF_API_TEMPLATE.md` §5 says to**, against the
   real Vercel URL:
   ```bash
   curl -i https://<your-project>.vercel.app/health
   curl -i https://<your-project>.vercel.app/openapi.json
   curl https://<your-project>.vercel.app/nonexistent
   ```
   First two must be `200`. Third must be the JSON error envelope (via the
   SPA-fallback redirect for a GET — see the note in `requestHandler.js` —
   or a real `404` for a non-`GET`), not HTML.

5. **Connect it to the gateway**: gateway console → Connect a service →
   paste the Vercel URL from step 4 (not the frontend's URL — that one only
   serves the SPA). Run **Conformance** there before requesting approval.

## Database: a VPS-hosted MySQL instance

Resolved — `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` in `.env`
point at a real, network-reachable MySQL instance (`db.crevascale.com`),
not `localhost`. This is the "traditional MySQL host reachable from Vercel"
option from the tradeoff below: every `FOREIGN KEY` in
`db/schema_employees.sql` stays exactly as written — no PlanetScale
migration, no schema rework. The one caveat that comes with this choice is
connection pooling under real concurrent load (a traditional pool doesn't
behave identically across serverless invocations the way it does in a
persistent process) — manageable at this app's scale with `db/pool.js`'s
current `connectionLimit: 10`, worth revisiting only if usage grows a lot.

Verified end-to-end against it locally: `/health`'s real `SELECT 1` ping,
the dynamic `getEmployeeTypeByCode()` lookup, and a live Departments API
pull all work identically to the local MySQL setup — same `DB_*` variables
are what the Vercel deployment above should use, unchanged.

## After this works

- `PUBLIC_URL` above is what makes the human sign-in flow (`MICROAPP_AUTH.md`
  §4) real for the first time — until now it pointed at `127.0.0.1`, which
  the gateway could never redirect a real browser back to.
- The frontend (`src/services/*`) still isn't wired to call this API — that
  was paused earlier for the same reason (no way to sign in locally). Once
  this is deployed and registered, that blocker is gone.
