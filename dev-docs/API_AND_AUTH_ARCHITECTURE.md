# API & Auth Architecture

What `/server` implements, built to `MICROAPP_AUTH.md` (gateway sign-in) and
`RIZURF_API_TEMPLATE.md` (API shape, SS-rules) — both in the repo root. Read
those first; this doc is the map of how this codebase applies them, not a
restatement of the rules themselves.

## Running it

```bash
npm install
npm run server     # http://127.0.0.1:3420 — needs .env (see .env.example)
```

`GET /health` and `GET /openapi.json` work immediately. Everything else needs
a running gateway at `GATEWAY_URL` — there isn't one in this repo, so the
sign-in flow and any authenticated call can only be exercised once this
service is registered with a real Rizurf gateway (`RIZURF_API_TEMPLATE.md` §4).

`npm run dev` (Vite, port 5173) is still the fast path for UI-only iteration
and does not go through auth at all yet — `src/services/*` has not been
switched over from `localStorage` to calling `/server`'s API. That switch is
the next real step once a gateway exists to sign into.

## Layout

```
/server
  config.js              Env vars, fails loudly at startup if one's missing (SS-20)
  openapi.js              The OpenAPI doc — paths, scopes, SS-23/27 catalog metadata.
                           The router and the scope-enforcement both read FROM this
                           file, so declared and enforced can't drift apart (SS-6).
  index.js                 HTTP entry: correlation id, routing, auth, error envelope.

  /auth                   MICROAPP_AUTH.md, implemented once, used everywhere below.
    jwks.js                 Fetches + caches the gateway's public key.
    verifyToken.js           §3 — signature/iss/aud/exp/token_use check.
    session.js                §6 — this app's own HMAC-signed session cookie.
    introspect.js             §5 — the no-cache gateway liveness check.
    signin.js                  §4 — authorize redirect + code exchange.

  /clients                RIZURF_API_TEMPLATE.md SS-26 — calling ANOTHER service.
    gatewayClientCredentials.js   Generic client_credentials grant + token cache.
    applicantsClient.js            Applicants DB (external, MySQL — TalentPulse).
    internsClient.js                Interns DB (external, Postgres/Supabase).
    departmentsClient.js             Department directory (external, API-only).

  /db                     SS-15 — the data access layer. No web-framework
                           import; every query parameterised; one file per
                           capability group, mirroring db/schema_employees.sql.
    pool.js, crud.js, employees.js, orgStructure.js, onboarding.js,
    offboarding.js, activities.js, leaves.js, candidateMessaging.js,
    applicantConversion.js, notes.js, admin.js

  /http                   Framework-free HTTP plumbing (SS-1/4/5/9-12).
    router.js               Matches a request path against openapi.json's own
                             `paths` keys — the document IS the route table.
    authenticate.js           Resolves EITHER a session cookie OR a bearer
                               token to a principal (see below).
    errors.js, util.js, staticSite.js

  /routes                 HTTP-shaping only — reads the request, calls /db,
                           shapes the response. One file per capability group.
```

## Two callers, one API

Every endpoint answers two different kinds of caller, and `authenticate.js`
resolves whichever one shows up:

- **This app's own browser (the SPA)** — a session cookie, set by the
  `MICROAPP_AUTH.md` §4 flow. Gated on the gateway's own `role`
  (`admin`/`hr` may write, everyone signed in may read) — no parallel scope
  system for the UI, per that doc's own recommendation.
- **Another service or script** (SS-26) — a real `Authorization: Bearer`
  access token, gated on the scope `openapi.js` declares for that operation
  (SS-6/SS-7). This is what lets another Rizurf microapp — or a scheduled
  job — call this API directly, the same way this app itself calls
  Applicants/Interns/Departments.

## The applicant → employee → intern hand-off

`POST /applicants/{applicantId}/convert` (`db/applicantConversion.js`) is the
one place all three external-system boundaries meet in a single call:

1. `applicantsClient.getApplicant()` — reads the applicant from the
   Applicants DB via its API.
2. `createEmployee(...)` — writes the new employee into *this app's own*
   database, with `source_applicant_id` set (a soft reference, no FK).
3. An `applicant_conversions` row is opened (`status: 'pending'`).
4. For an Intern-type hire, `internsClient.createIntern()` pushes the person
   to the Interns DB; success or failure, the conversion row is closed out
   with the result — never silently lost, per that table's own comment in
   `db/schema_employees.sql`.
5. `applicantsClient.markApplicantHired()` closes the loop on the Applicants
   side.

## Known trade-off: SPA fallback vs. strict 404

`RIZURF_API_TEMPLATE.md`'s own conformance check expects an unrouted path to
answer `404` with the error envelope. This service also serves the built SPA
(`dist/`) at `PUBLIC_URL`, and an SPA needs a catch-all so a hard refresh on
a client-side route (`/upcoming/123`) doesn't 404 — so any unmatched `GET`
falls back to `index.html` (session-gated) instead of a 404. A non-`GET`
request to an unmatched path still gets a real `404`. If this service is
ever run through the gateway's conformance checker, this is the one rule
worth revisiting — the conventional fix is hosting the built SPA separately
(a static host/CDN) and letting this service answer only its documented API
paths, which is what `RIZURF_API_TEMPLATE.md` implicitly assumes a "micro
app" looks like.

## Not yet done

- `src/services/*` still reads `localStorage` — swapping its bodies to
  `fetch('/…', { credentials: 'include' })` against this API is the next
  step, once there's a gateway to sign into.
- No automated tests against this service yet — `RIZURF_API_TEMPLATE.md` §3
  says write-path behaviour (`POST`/`PATCH`/`DELETE`) needs to be verified
  by hand or by test, since the gateway's own conformance checker won't
  mutate a live service to test it.
