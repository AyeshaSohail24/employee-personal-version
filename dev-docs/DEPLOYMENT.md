# Deploying `/server` (Railway)

The gateway can't connect to this app yet because `/server` has never run
anywhere public — only on `127.0.0.1` locally. This is the manual path to
fix that. I can't create the Railway account or click deploy for you; this
is what to do once you're signed in.

## Why Railway specifically

Render doesn't offer managed MySQL (only Postgres) — you'd need a separate
third-party MySQL host either way. Railway can host the Node service *and*
a MySQL database in the same project, with the app reading the database's
connection details through Railway's own variable references, so this is
one deployment instead of two.

## Steps

1. **New Railway project** → **Deploy from GitHub repo** → pick
   `AyeshaSohail24/employee-personal-version`, branch `employees-final`.
   Railway auto-detects Node via Nixpacks and will run `npm install` then
   `npm start` (`node server/index.js` — see `package.json`).

2. **Add a MySQL database**: in the same project, **+ New** → **Database**
   → **MySQL**. Railway provisions it and exposes `MYSQLHOST`, `MYSQLPORT`,
   `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` on that plugin.

3. **Load the schema into it once**, from your machine, pointed at Railway's
   MySQL instead of local — Railway's MySQL plugin page has a "Connect"
   tab with a ready-made `mysql` command; run `db/schema_employees.sql`
   through it the same way you loaded it locally.

4. **Set environment variables on the Node service** (not the MySQL
   plugin) — Settings → Variables:

   | Variable | Value |
   |---|---|
   | `DB_HOST` | `${{MySQL.MYSQLHOST}}` (Railway's reference syntax) |
   | `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
   | `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
   | `DB_USER` | `${{MySQL.MYSQLUSER}}` |
   | `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
   | `SERVICE_ID` | `rizurf-employees-api` |
   | `GATEWAY_URL` | `https://web-omega-two-47.vercel.app` |
   | `PUBLIC_URL` | the `*.up.railway.app` URL Railway assigns this service (fill in **after** first deploy, then redeploy) |
   | `SESSION_SECRET` | same value as local `.env`, or a freshly generated one |
   | `APPLICANTS_*` / `INTERNS_*` / `DEPARTMENTS_*` | same values as local `.env` |
   | `MAIL_*` | same values as local `.env` |

   Do **not** set `PORT` — Railway injects its own and `server/config.js`
   already reads `process.env.PORT`.

5. **Verify it exactly like `RIZURF_API_TEMPLATE.md` §5 says to**, against
   the real Railway URL:
   ```bash
   curl -i https://<your-service>.up.railway.app/health
   curl -i https://<your-service>.up.railway.app/openapi.json
   curl https://<your-service>.up.railway.app/nonexistent
   ```
   First two must be `200`. Third must be the JSON error envelope, not HTML.

6. **Connect it to the gateway**: gateway console → Connect a service →
   paste the Railway URL (not the Vercel frontend URL — that one still only
   serves the SPA, see `vercel.json`). Run **Conformance** there before
   requesting approval.

## After this works

- `PUBLIC_URL` above is what makes the human sign-in flow (`MICROAPP_AUTH.md`
  §4) real for the first time — until now it pointed at `127.0.0.1`, which
  the gateway could never redirect a real browser back to.
- The frontend (`src/services/*`) still isn't wired to call this API — that
  was paused earlier for the same reason (no way to sign in locally). Once
  this is deployed and registered, that blocker is gone.
