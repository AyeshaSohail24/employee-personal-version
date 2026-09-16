# Rizurf Employees App — Workspace Rules

These rules apply to every stage of the build. Read this file before writing or editing any code. If a request seems to conflict with these rules, stop and ask before proceeding.

## Prime directive

This is a **PoC frontend that will later be connected to a real backend**. The single most important constraint on this codebase: **UI components must never know whether data is mocked or real.** If that boundary is respected, swapping mock services for real API calls later should only require changes inside `/src/services/`, not inside `/src/pages/` or `/src/components/`.

## Folder structure

```
/src
  /pages          Route-level components only. One folder per major nav area
                   (dashboard, employees, departments, onboarding, offboarding,
                   activities, reporting, configuration). Pages call services —
                   never mock-data or business-logic files directly.

  /components     Reusable, presentation-only UI: tables, cards, dialogs,
                   filters, status badges, forms, activity rows, progress bars.
                   No data fetching, no business logic. Props in, JSX out.

  /services       The data access layer. One file per domain entity
                   (employeeService, departmentService, positionService,
                   onboardingService, offboardingService, presenceService,
                   activityService, auditService, etc.). Every service exposes
                   plain async functions (getAll, getById, create, update,
                   archive...) that pages call. Right now these functions read
                   from /mock-data + localStorage. Later, the same function
                   signatures will call a real API — nothing outside this
                   folder should need to change.

  /mock-data      Seed data (employees, departments, positions, plans, etc.)
                   and localStorage read/write helpers. Only /services may
                   import from here. Pages and components must not.

  /domain         Business logic and rules that are NOT simple CRUD:
                   presence calculation priority, relative-date resolution
                   for onboarding/offboarding tasks, status transition rules
                   (e.g. what happens when an employee moves to Former),
                   permission/role checks. Services call into /domain;
                   pages never contain this logic inline.

  /state          App-level state (current user/role for the permissions
                   demo, notification counts, etc.), kept separate from
                   entity data.

  /router         Route definitions, matching the sidebar nav structure
                   in the spec exactly.
```

## Hard rules

1. **No mock data imports outside `/services`.** A page or component must never `import` directly from `/mock-data`. If a page needs employee data, it calls `employeeService.getAll()`, not the seed array.
2. **No business logic in page components.** Status transitions, relative-date math, presence priority calculation, permission checks — all of it lives in `/domain`, called from `/services`. A page component should mostly be: call a service, hold local UI state, render.
3. **Services return plain data, not mock-specific shapes.** Design service function signatures as if they already hit a real REST/GraphQL API (e.g. `employeeService.create(employeeData): Promise<Employee>`), even though today they resolve from localStorage. This is what makes the later backend swap painless.
4. **Employee identity is never duplicated.** Every other domain area (onboarding instances, activities, presence, documents) stores an `employeeId` reference and looks up the employee record through `employeeService` — it does not copy name/email/etc. into its own records.
5. **Employment history is append-only.** Department/position/manager changes create a new record with an effective date rather than overwriting the current one, matching the `employment_record` pattern in the schema.
6. **Departure automation is reversible and logged.** Actions triggered by starting/completing offboarding must go through `auditService` and must not be framed as instant/irreversible in the UI.
7. **No component exceeds one clear responsibility.** If a page component is doing data-fetching orchestration, form state, AND business rules, split it.

## Build discipline

- Build in the stage order given in the prompt. Do not jump ahead to later stages.
- After each stage: run the app, fix errors, confirm earlier stages still work, then stop and summarize before continuing.
- Before any architectural change (new library, folder restructure, state management shift), explain the change and wait for confirmation — do not just make it.
- Keep components small and reusable; do not build one large monolithic component per page.

## Backend & authentication

The app now has a real backend (`/server`) and real gateway-based authentication, built to the two Rizurf platform contracts in the repo root: `RIZURF_API_TEMPLATE.md` (API shape, SS-rules) and `MICROAPP_AUTH.md` (the gateway sign-in flow). Read both before touching `/server`.

- **No local login, ever.** The gateway is the only place anyone signs in or out (SS-24). `/server/auth` implements the redirect → code exchange → signature-verified session flow — do not add a password field or a sign-out button anywhere.
- **`/server` owns the app's own database** (`db/schema_employees.sql`) exclusively (SS-13). It never queries the Applicants or Interns databases directly — those are reached only through `/server/clients/*`, which trade a `client_credentials` grant for a scoped access token per call (SS-26).
- **`src/services/*` stays the frontend's only calling convention.** Its functions now `fetch()` `/server`'s API (session cookie, `credentials: 'include'`) instead of reading `localStorage` — pages and components did not change, per the prime directive above.
- **Every operation in `/server/openapi.js` declares real `security`, enforced, not advertised** (SS-6) — a route with no token/session gets `401`, not data.

## Explicitly out of scope for this PoC

Real payroll calculation, real attendance hardware, real email sending, IP/network/surveillance-based presence detection, permanent deletion of employee records through normal UI flows.
