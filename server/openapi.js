// RIZURF_API_TEMPLATE.md SS-3/SS-23/SS-27 — the single source of truth for
// what this service does. The router (http/router.js) matches requests
// against these `paths` keys, and index.js reads each operation's required
// `security` scope straight from here (SS-6) — nothing is hardcoded beside a
// handler, so what's declared and what's enforced cannot drift apart.
import { SERVICE_ID, VERSION } from "./config.js";

const bearerAuth = { bearerAuth: [] };
function scoped(...scopes) {
  return [{ bearerAuth: scopes }];
}

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Rizurf Employees API",
    version: VERSION,
    description:
      "Owns employee lifecycle, onboarding/offboarding, leaves, notes, and the candidate-messaging/offer-drafts workflow, and bridges accepted applicants into the Interns database.",
    "x-rizurf": {
      domain: "Human Resources",
      owner: "employees-app-team",
      app_url: "/",
      category: "Customer Management",
      industries: ["Human Resources", "Operations"],
      use_cases: [
        "Manage an employee's record through their whole lifecycle",
        "Run onboarding and offboarding checklists for a new or departing employee",
        "Track leave requests and manual presence overrides",
        "Message a shortlisted candidate and send them an offer",
        "Convert an accepted applicant into an employee and push intern hires to the Interns database",
        "Keep HR notes and reminders",
      ],
      capabilities: [
        {
          name: "Manage Employees",
          icon: "🧑‍💼",
          description: "The core employee record and its department/position/manager history.",
          does: ["List employees", "Create an employee", "Update an employee", "View employment history"],
          best_for: "Any app that needs to look up or maintain who works here.",
          endpoints: ["GET /employees", "POST /employees", "GET /employees/{id}", "PATCH /employees/{id}", "GET /employees/{id}/employment-records", "POST /employees/{id}/employment-records"],
        },
        {
          name: "Org Structure",
          icon: "🏢",
          description: "Positions, work locations, and schedules employees are assigned to.",
          does: ["List and create positions", "List and create locations", "List and create schedules", "List employee types and document types", "Resolve a department or intern role from the external directories"],
          best_for: "Setting up or looking up the shape of the organisation.",
          endpoints: ["GET /positions", "POST /positions", "GET /positions/{id}", "PATCH /positions/{id}", "GET /locations", "POST /locations", "GET /schedules", "POST /schedules", "GET /employee-types", "GET /document-types", "GET /departments", "GET /roles"],
        },
        {
          name: "Run Onboarding",
          icon: "🚀",
          description: "Launch and track an onboarding checklist for a new employee — and, for an intern, see their live Interns DB record alongside it.",
          does: ["List onboarding templates", "Create a template", "Launch a plan for an employee", "Mark a task done or reopen it"],
          best_for: "HR bringing a new hire through their first-days checklist.",
          endpoints: ["GET /onboarding/templates", "POST /onboarding/templates", "GET /onboarding/templates/{id}", "PATCH /onboarding/templates/{id}", "POST /onboarding/instances", "GET /onboarding/instances/{id}", "PATCH /onboarding/task-instances/{id}"],
        },
        {
          name: "Run Offboarding",
          icon: "🚪",
          description: "Launch and track a departure checklist for a leaving employee — for an intern, this also sets their real internship_end_date in the Interns DB.",
          does: ["List offboarding templates", "Create a template", "Launch a plan for an employee (syncs the departure date to the Interns DB for an intern)", "Mark a task done or reopen it"],
          best_for: "HR taking a departing employee through clearance.",
          endpoints: ["GET /offboarding/templates", "POST /offboarding/templates", "GET /offboarding/templates/{id}", "PATCH /offboarding/templates/{id}", "POST /offboarding/instances", "GET /offboarding/instances/{id}", "PATCH /offboarding/task-instances/{id}"],
        },
        {
          name: "Track Activities",
          icon: "✅",
          description: "Ad-hoc and system-generated to-dos tied to an employee.",
          does: ["List activities", "Create an activity", "Complete or reopen an activity"],
          best_for: "A manager or HR keeping a task list tied to a specific person.",
          endpoints: ["GET /activities", "POST /activities", "PATCH /activities/{id}"],
        },
        {
          name: "Leaves & Presence",
          icon: "🌴",
          description: "Leave requests and manual corrections to today's presence view.",
          does: ["List and request leave", "Approve or reject a leave", "List and create a presence override"],
          best_for: "HR processing time-off and correcting an attendance edge case.",
          endpoints: ["GET /leaves", "POST /leaves", "PATCH /leaves/{id}", "GET /presence-overrides", "POST /presence-overrides"],
        },
        {
          name: "Message Candidates",
          icon: "✉️",
          description: "The conversation with a shortlisted applicant — over email or WhatsApp — and the reusable offer drafts behind it.",
          does: ["Read a candidate's message thread", "Send a message to a candidate on email or WhatsApp", "List, create and edit email drafts"],
          best_for: "HR corresponding with candidates in the Upcoming pipeline before they're hired.",
          endpoints: ["GET /candidates/{applicantId}/messages", "POST /candidates/{applicantId}/messages", "GET /email-templates", "POST /email-templates", "PATCH /email-templates/{id}"],
        },
        {
          name: "Gather Candidate Documents",
          icon: "📎",
          description: "Request and track documents a candidate needs to submit before they're accepted.",
          does: ["List a candidate's requested/submitted documents", "Request a new document", "Mark a document received, verified, or rejected"],
          best_for: "The file-gathering phase between first-contact messaging and sending an offer.",
          endpoints: ["GET /candidates/{applicantId}/documents", "POST /candidates/{applicantId}/documents", "PATCH /candidate-documents/{id}"],
        },
        {
          name: "Convert Applicants",
          icon: "🔁",
          description: "Turn an accepted applicant into a local employee and, for interns, push them into the Interns database.",
          does: ["Accept an applicant and create their employee record"],
          best_for: "The one moment this app hands a person off from the Applicants DB to the Interns DB.",
          endpoints: ["POST /applicants/{applicantId}/convert"],
        },
        {
          name: "Notes & Notifications",
          icon: "🗒️",
          description: "A personal HR notepad with reminders, and the notification feed those reminders generate.",
          does: ["List, create, edit and delete notes", "List notifications", "Mark a notification read"],
          best_for: "HR keeping their own working notes and reminders.",
          endpoints: ["GET /notes", "POST /notes", "PATCH /notes/{id}", "DELETE /notes/{id}", "GET /notifications", "PATCH /notifications/{id}"],
        },
        {
          name: "Admin & Audit",
          icon: "🛡️",
          description: "Local user-role assignments and the append-only audit trail.",
          does: ["List local user accounts", "Read the audit log"],
          best_for: "An administrator reviewing who did what, or who has access.",
          endpoints: ["GET /user-accounts", "GET /audit-logs"],
        },
      ],
      workflows: [
        {
          name: "Onboard a new hire",
          steps: ["POST /employees", "POST /onboarding/instances", "PATCH /onboarding/task-instances/{id}"],
        },
        {
          name: "Offboard a departing employee",
          steps: ["POST /offboarding/instances", "PATCH /offboarding/task-instances/{id}", "PATCH /employees/{id}"],
        },
        {
          name: "Message and hire a candidate",
          steps: ["GET /candidates/{applicantId}/messages", "POST /candidates/{applicantId}/messages", "POST /candidates/{applicantId}/documents", "PATCH /candidate-documents/{id}", "POST /applicants/{applicantId}/convert"],
        },
      ],
      // Real ids confirmed against each service's own /health — except
      // applicants-api, which is not live yet (no confirmed id to use).
      related_services: ["applicants-api", "intern-database", "department-api"],
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Liveness and dependency checks",
        "x-rizurf": {
          name: "Health Check", purpose: "Report whether this service and its database are reachable",
          use_when: ["Monitoring the service", "Before routing traffic to it"],
          do_not_use_when: ["You need actual HR data — use the relevant resource endpoint instead"],
          inputs: [], outputs: ["status", "service", "version", "uptime_seconds", "checks"], requires: [],
          related_endpoints: ["GET /openapi.json"], tags: ["health", "status", "liveness", "monitoring", "uptime"],
        },
      },
    },
    "/openapi.json": {
      get: {
        summary: "This document",
        "x-rizurf": {
          name: "API Document", purpose: "Describe every endpoint this service exposes",
          use_when: ["Discovering the API", "Generating a client", "Gateway conformance checks"],
          do_not_use_when: ["You need actual HR data — use the relevant resource endpoint instead"],
          inputs: [], outputs: ["openapi", "info", "paths"], requires: [],
          related_endpoints: ["GET /health"], tags: ["openapi", "schema", "spec", "discovery", "docs"],
        },
      },
    },
    "/session": {
      get: {
        summary: "Who the current session belongs to.",
        security: scoped("session:read"),
        "x-rizurf": {
          name: "Get Session", purpose: "Check whether the caller is signed in, and as whom",
          use_when: ["The SPA needs to know on load whether to redirect to sign-in"],
          do_not_use_when: ["Calling from another service — this is for the browser's own session cookie, not a client_credentials caller"],
          inputs: [], outputs: ["sub", "email", "name", "role"], requires: [],
          related_endpoints: ["GET /health"], tags: ["session", "auth", "who am i", "sign in"],
        },
      },
    },

    "/employees": {
      get: {
        summary: "List employees, optionally filtered by status or department.",
        security: scoped("employees:read"),
        "x-rizurf": {
          name: "List Employees", purpose: "Browse or search the employee roster",
          use_when: ["Populating the employee directory", "Looking up an employee by status or department"],
          do_not_use_when: ["Looking up one employee you already have the id for — use GET /employees/{id}"],
          inputs: ["status", "department_id", "limit", "offset"], outputs: ["employees[]"],
          requires: [], related_endpoints: ["POST /employees", "GET /employees/{id}"],
          tags: ["employees", "roster", "directory", "staff"],
        },
      },
      post: {
        summary: "Create an employee record.",
        security: scoped("employees:write"),
        "x-rizurf": {
          name: "Create Employee", purpose: "Add a new person to the roster",
          use_when: ["Onboarding a new hire", "Converting an accepted applicant — see POST /applicants/{applicantId}/convert instead"],
          do_not_use_when: ["The person came from Upcoming — use the applicant conversion endpoint so the soft links are set correctly"],
          inputs: ["firstName", "lastName", "workEmail", "employeeTypeId", "startDate"], outputs: ["employee"],
          requires: [], related_endpoints: ["POST /onboarding/instances", "GET /employees/{id}"],
          tags: ["employees", "hire", "create", "new employee"],
        },
      },
    },
    "/employees/{id}": {
      get: {
        summary: "Fetch one employee by id.",
        security: scoped("employees:read"),
        "x-rizurf": {
          name: "Get Employee", purpose: "Read a single employee's full record",
          use_when: ["Opening an employee's profile page"],
          do_not_use_when: ["Listing many employees — use GET /employees"],
          inputs: ["id"], outputs: ["employee"], requires: [],
          related_endpoints: ["PATCH /employees/{id}", "GET /employees/{id}/employment-records"],
          tags: ["employee", "profile", "lookup"],
        },
      },
      patch: {
        summary: "Update fields on an employee (status, allowance, contact details, etc).",
        security: scoped("employees:write"),
        "x-rizurf": {
          name: "Update Employee", purpose: "Change an employee's own fields",
          use_when: ["Correcting contact details", "Moving status to Departing/Former as offboarding completes"],
          do_not_use_when: ["Changing department, position, manager or schedule — post a new POST /employees/{id}/employment-records instead, since that history is append-only"],
          inputs: ["status", "workEmail", "workPhone", "allowance", "contractEndDate"], outputs: ["employee"],
          requires: ["Employee exists"], related_endpoints: ["GET /employees/{id}"],
          tags: ["employee", "update", "edit"],
        },
      },
    },
    "/employees/{id}/employment-records": {
      get: {
        summary: "List an employee's department/position/manager history.",
        security: scoped("employees:read"),
        "x-rizurf": {
          name: "List Employment Records", purpose: "See how an employee's placement has changed over time",
          use_when: ["Viewing an employee's history tab"], do_not_use_when: [],
          inputs: ["id"], outputs: ["employmentRecords[]"], requires: [],
          related_endpoints: ["POST /employees/{id}/employment-records"], tags: ["employment history", "department", "position", "manager"],
        },
      },
      post: {
        summary: "Append a new employment record (department/position/manager change).",
        security: scoped("employees:write"),
        "x-rizurf": {
          name: "Change Employment", purpose: "Record a department, position, manager or schedule change",
          use_when: ["An employee transfers department", "An employee gets a new manager or schedule"],
          do_not_use_when: ["Nothing about placement changed — use PATCH /employees/{id} instead"],
          inputs: ["departmentId", "positionId", "managerId", "scheduleId", "locationId", "effectiveFrom"], outputs: ["employmentRecord"],
          requires: ["Employee exists"], related_endpoints: ["GET /employees/{id}/employment-records"],
          tags: ["transfer", "promotion", "department change", "manager change"],
        },
      },
    },

    "/positions": {
      get: { summary: "List positions.", security: scoped("org-structure:read"),
        "x-rizurf": { name: "List Positions", purpose: "Browse job titles", use_when: ["Populating a position picker"], do_not_use_when: [], inputs: ["department_id"], outputs: ["positions[]"], requires: [], related_endpoints: ["POST /positions"], tags: ["positions", "job titles"] } },
      post: { summary: "Create a position.", security: scoped("org-structure:write"),
        "x-rizurf": { name: "Create Position", purpose: "Add a new job title", use_when: ["Setting up a new role"], do_not_use_when: [], inputs: ["name", "departmentId"], outputs: ["position"], requires: [], related_endpoints: ["GET /positions"], tags: ["positions", "create"] } },
    },
    "/positions/{id}": {
      get: { summary: "Fetch one position.", security: scoped("org-structure:read"),
        "x-rizurf": { name: "Get Position", purpose: "Read one position's defaults", use_when: ["Opening a position's settings"], do_not_use_when: [], inputs: ["id"], outputs: ["position"], requires: [], related_endpoints: ["PATCH /positions/{id}"], tags: ["position", "lookup"] } },
      patch: { summary: "Update a position.", security: scoped("org-structure:write"),
        "x-rizurf": { name: "Update Position", purpose: "Change a position's name or defaults", use_when: ["Renaming a role", "Changing its default manager/schedule/location"], do_not_use_when: [], inputs: ["name", "defaultManagerId", "defaultScheduleId", "defaultLocationId", "active"], outputs: ["position"], requires: ["Position exists"], related_endpoints: ["GET /positions/{id}"], tags: ["position", "update"] } },
    },
    "/locations": {
      get: { summary: "List work locations.", security: scoped("org-structure:read"),
        "x-rizurf": { name: "List Locations", purpose: "Browse work sites", use_when: ["Populating a location picker"], do_not_use_when: [], inputs: [], outputs: ["locations[]"], requires: [], related_endpoints: [], tags: ["locations", "sites", "offices"] } },
      post: { summary: "Create a work location.", security: scoped("org-structure:write"),
        "x-rizurf": { name: "Create Location", purpose: "Add a new work site", use_when: ["Opening a new office or remote pool"], do_not_use_when: [], inputs: ["name", "type", "address"], outputs: ["location"], requires: [], related_endpoints: [], tags: ["locations", "create"] } },
    },
    "/schedules": {
      get: { summary: "List working-hours schedules.", security: scoped("org-structure:read"),
        "x-rizurf": { name: "List Schedules", purpose: "Browse named working-hours patterns", use_when: ["Populating a schedule picker"], do_not_use_when: [], inputs: [], outputs: ["schedules[]"], requires: [], related_endpoints: [], tags: ["schedules", "working hours"] } },
      post: { summary: "Create a working-hours schedule.", security: scoped("org-structure:write"),
        "x-rizurf": { name: "Create Schedule", purpose: "Define a new working-hours pattern", use_when: ["Adding a shift pattern"], do_not_use_when: [], inputs: ["name", "workingDays", "startTime", "endTime"], outputs: ["schedule"], requires: [], related_endpoints: [], tags: ["schedules", "create"] } },
    },
    "/employee-types": {
      get: { summary: "List employee type catalog entries.", security: scoped("org-structure:read"),
        "x-rizurf": { name: "List Employee Types", purpose: "Read the fixed catalog of employment types", use_when: ["Populating an employee-type picker"], do_not_use_when: [], inputs: [], outputs: ["employeeTypes[]"], requires: [], related_endpoints: [], tags: ["employee types", "catalog"] } },
    },
    "/document-types": {
      get: { summary: "List document type catalog entries.", security: scoped("org-structure:read"),
        "x-rizurf": { name: "List Document Types", purpose: "Read the fixed catalog of expected employee documents", use_when: ["Building a document checklist"], do_not_use_when: [], inputs: [], outputs: ["documentTypes[]"], requires: [], related_endpoints: [], tags: ["documents", "catalog"] } },
    },
    "/departments": {
      get: { summary: "Read-through list of departments from the external Department directory.", security: scoped("org-structure:read"),
        "x-rizurf": { name: "List Departments", purpose: "Resolve department ids to names, or populate a department picker", use_when: ["Showing a department name next to an employee/position", "Populating a department filter or picker"], do_not_use_when: ["Creating or editing a department — that service is owned by the Department Management team, not this app"], inputs: ["search"], outputs: ["departments[]"], requires: [], related_endpoints: ["GET /positions", "POST /applicants/{applicantId}/convert"], tags: ["departments", "directory", "external"] } },
    },
    "/roles": {
      get: { summary: "Read-through list of assignable intern roles from the Interns database.", security: scoped("org-structure:read"),
        "x-rizurf": { name: "List Intern Roles", purpose: "Resolve a role_id to a name, or populate a role picker", use_when: ["Converting an applicant into an intern and choosing their role"], do_not_use_when: [], inputs: [], outputs: ["roles[]"], requires: [], related_endpoints: ["POST /applicants/{applicantId}/convert"], tags: ["roles", "interns", "external"] } },
    },

    "/onboarding/templates": {
      get: { summary: "List onboarding plan templates.", security: scoped("onboarding:read"),
        "x-rizurf": { name: "List Onboarding Templates", purpose: "Browse reusable onboarding checklists", use_when: ["Choosing a template to launch"], do_not_use_when: [], inputs: ["department_id"], outputs: ["templates[]"], requires: [], related_endpoints: ["POST /onboarding/instances"], tags: ["onboarding", "templates", "checklist"] } },
      post: { summary: "Create an onboarding plan template.", security: scoped("onboarding:write"),
        "x-rizurf": { name: "Create Onboarding Template", purpose: "Define a new onboarding checklist", use_when: ["Setting up onboarding for a new department or role"], do_not_use_when: [], inputs: ["name", "departmentId", "description"], outputs: ["template"], requires: [], related_endpoints: ["GET /onboarding/templates"], tags: ["onboarding", "create"] } },
    },
    "/onboarding/templates/{id}": {
      get: { summary: "Fetch one onboarding template with its tasks.", security: scoped("onboarding:read"),
        "x-rizurf": { name: "Get Onboarding Template", purpose: "Read a template's task list", use_when: ["Editing a template"], do_not_use_when: [], inputs: ["id"], outputs: ["template", "tasks[]"], requires: [], related_endpoints: ["PATCH /onboarding/templates/{id}"], tags: ["onboarding", "template"] } },
      patch: { summary: "Update an onboarding template.", security: scoped("onboarding:write"),
        "x-rizurf": { name: "Update Onboarding Template", purpose: "Change a template's name, description or active state", use_when: ["Retiring or renaming a checklist"], do_not_use_when: ["Changing which tasks a launched plan has — task instances are a snapshot and don't change"], inputs: ["name", "description", "active"], outputs: ["template"], requires: ["Template exists"], related_endpoints: ["GET /onboarding/templates/{id}"], tags: ["onboarding", "update"] } },
    },
    "/onboarding/instances": {
      post: { summary: "Launch an onboarding plan for an employee.", security: scoped("onboarding:write"),
        "x-rizurf": { name: "Launch Onboarding", purpose: "Start a new hire's onboarding checklist", use_when: ["An employee's start date has arrived or is confirmed"], do_not_use_when: ["The employee already has an active onboarding plan"], inputs: ["planTemplateId", "employeeId", "anchorDate"], outputs: ["instance", "taskInstances[]"], requires: ["Employee exists", "Template exists"], related_endpoints: ["GET /onboarding/instances/{id}", "PATCH /onboarding/task-instances/{id}"], tags: ["onboarding", "launch", "start"] } },
    },
    "/onboarding/instances/{id}": {
      get: { summary: "Fetch one onboarding instance with its task instances.", security: scoped("onboarding:read"),
        "x-rizurf": { name: "Get Onboarding Instance", purpose: "See a launched plan's progress, and the employee's live Interns DB record if they're an intern", use_when: ["Viewing an employee's onboarding progress"], do_not_use_when: [], inputs: ["id"], outputs: ["instance", "taskInstances[]", "internRecord"], requires: [], related_endpoints: ["PATCH /onboarding/task-instances/{id}"], tags: ["onboarding", "progress", "interns"] } },
    },
    "/onboarding/task-instances/{id}": {
      patch: { summary: "Mark an onboarding task done or reopen it.", security: scoped("onboarding:write"),
        "x-rizurf": { name: "Update Onboarding Task", purpose: "Complete or reopen a single onboarding task", use_when: ["A step in the checklist is finished", "A step was marked done by mistake"], do_not_use_when: [], inputs: ["completed"], outputs: ["taskInstance"], requires: ["Task instance exists"], related_endpoints: ["GET /onboarding/instances/{id}"], tags: ["onboarding", "task", "complete"] } },
    },

    "/offboarding/templates": {
      get: { summary: "List offboarding plan templates.", security: scoped("offboarding:read"),
        "x-rizurf": { name: "List Offboarding Templates", purpose: "Browse reusable departure checklists", use_when: ["Choosing a template to launch"], do_not_use_when: [], inputs: ["department_id"], outputs: ["templates[]"], requires: [], related_endpoints: ["POST /offboarding/instances"], tags: ["offboarding", "templates", "checklist"] } },
      post: { summary: "Create an offboarding plan template.", security: scoped("offboarding:write"),
        "x-rizurf": { name: "Create Offboarding Template", purpose: "Define a new departure checklist", use_when: ["Setting up offboarding for a department or role"], do_not_use_when: [], inputs: ["name", "departmentId", "description"], outputs: ["template"], requires: [], related_endpoints: ["GET /offboarding/templates"], tags: ["offboarding", "create"] } },
    },
    "/offboarding/templates/{id}": {
      get: { summary: "Fetch one offboarding template with its tasks.", security: scoped("offboarding:read"),
        "x-rizurf": { name: "Get Offboarding Template", purpose: "Read a template's task list", use_when: ["Editing a template"], do_not_use_when: [], inputs: ["id"], outputs: ["template", "tasks[]"], requires: [], related_endpoints: ["PATCH /offboarding/templates/{id}"], tags: ["offboarding", "template"] } },
      patch: { summary: "Update an offboarding template.", security: scoped("offboarding:write"),
        "x-rizurf": { name: "Update Offboarding Template", purpose: "Change a template's name, description or active state", use_when: ["Retiring or renaming a checklist"], do_not_use_when: [], inputs: ["name", "description", "active"], outputs: ["template"], requires: ["Template exists"], related_endpoints: ["GET /offboarding/templates/{id}"], tags: ["offboarding", "update"] } },
    },
    "/offboarding/instances": {
      post: { summary: "Launch an offboarding plan for an employee.", security: scoped("offboarding:write"),
        "x-rizurf": { name: "Launch Offboarding", purpose: "Start a departing employee's clearance checklist", use_when: ["An employee's departure has been confirmed"], do_not_use_when: ["The employee already has an active offboarding plan"], inputs: ["planTemplateId", "employeeId", "anchorDate"], outputs: ["instance", "taskInstances[]"], requires: ["Employee exists", "Template exists", "For an intern (intern_external_id set): sets internship_end_date to anchorDate in the Interns DB, logged to audit_logs either way — see server/db/internSync.js"], related_endpoints: ["GET /offboarding/instances/{id}", "PATCH /offboarding/task-instances/{id}", "GET /audit-logs"], tags: ["offboarding", "launch", "departure", "interns"] } },
    },
    "/offboarding/instances/{id}": {
      get: { summary: "Fetch one offboarding instance with its task instances.", security: scoped("offboarding:read"),
        "x-rizurf": { name: "Get Offboarding Instance", purpose: "See a launched plan's progress, and the employee's live Interns DB record if they're an intern", use_when: ["Viewing an employee's offboarding progress"], do_not_use_when: [], inputs: ["id"], outputs: ["instance", "taskInstances[]", "internRecord"], requires: [], related_endpoints: ["PATCH /offboarding/task-instances/{id}"], tags: ["offboarding", "progress", "interns"] } },
    },
    "/offboarding/task-instances/{id}": {
      patch: { summary: "Mark an offboarding task done or reopen it.", security: scoped("offboarding:write"),
        "x-rizurf": { name: "Update Offboarding Task", purpose: "Complete or reopen a single offboarding task", use_when: ["A clearance step is finished", "A step was marked done by mistake"], do_not_use_when: [], inputs: ["completed"], outputs: ["taskInstance"], requires: ["Task instance exists"], related_endpoints: ["GET /offboarding/instances/{id}"], tags: ["offboarding", "task", "complete"] } },
    },

    "/activities": {
      get: { summary: "List activities, optionally filtered by employee or assignee.", security: scoped("activities:read"),
        "x-rizurf": { name: "List Activities", purpose: "Browse to-dos tied to employees", use_when: ["Viewing someone's task list"], do_not_use_when: [], inputs: ["employee_id", "assignee_id"], outputs: ["activities[]"], requires: [], related_endpoints: ["POST /activities"], tags: ["activities", "tasks", "todos"] } },
      post: { summary: "Create an activity.", security: scoped("activities:write"),
        "x-rizurf": { name: "Create Activity", purpose: "Add a to-do tied to an employee", use_when: ["A manager needs to track a follow-up"], do_not_use_when: [], inputs: ["employeeId", "assigneeId", "title", "dueDate"], outputs: ["activity"], requires: ["Employee exists"], related_endpoints: ["GET /activities"], tags: ["activities", "create", "todo"] } },
    },
    "/activities/{id}": {
      patch: { summary: "Complete, reopen, or edit an activity.", security: scoped("activities:write"),
        "x-rizurf": { name: "Update Activity", purpose: "Change an activity's completion state or details", use_when: ["Marking a to-do done"], do_not_use_when: [], inputs: ["completed", "title", "dueDate"], outputs: ["activity"], requires: ["Activity exists"], related_endpoints: ["GET /activities"], tags: ["activities", "complete", "update"] } },
    },

    "/leaves": {
      get: { summary: "List leave requests.", security: scoped("leaves:read"),
        "x-rizurf": { name: "List Leaves", purpose: "Browse leave requests", use_when: ["Reviewing pending leave"], do_not_use_when: [], inputs: ["employee_id", "status"], outputs: ["leaves[]"], requires: [], related_endpoints: ["POST /leaves"], tags: ["leave", "time off", "vacation"] } },
      post: { summary: "Submit a leave request.", security: scoped("leaves:write"),
        "x-rizurf": { name: "Request Leave", purpose: "File a new leave request", use_when: ["An employee is requesting time off"], do_not_use_when: [], inputs: ["employeeId", "leaveType", "startDate", "endDate", "reason"], outputs: ["leave"], requires: ["Employee exists"], related_endpoints: ["PATCH /leaves/{id}"], tags: ["leave", "request", "time off"] } },
    },
    "/leaves/{id}": {
      patch: { summary: "Approve, reject, or edit a leave request.", security: scoped("leaves:write"),
        "x-rizurf": { name: "Update Leave", purpose: "Decide or amend a leave request", use_when: ["Approving or rejecting a request"], do_not_use_when: [], inputs: ["status"], outputs: ["leave"], requires: ["Leave exists"], related_endpoints: ["GET /leaves"], tags: ["leave", "approve", "reject"] } },
    },
    "/presence-overrides": {
      get: { summary: "List manual presence overrides.", security: scoped("presence:read"),
        "x-rizurf": { name: "List Presence Overrides", purpose: "See active manual presence corrections", use_when: ["Auditing why someone's presence looks wrong"], do_not_use_when: [], inputs: ["employee_id"], outputs: ["overrides[]"], requires: [], related_endpoints: ["POST /presence-overrides"], tags: ["presence", "attendance", "override"] } },
      post: { summary: "Create a manual presence override.", security: scoped("presence:write"),
        "x-rizurf": { name: "Create Presence Override", purpose: "Manually correct today's presence view for one employee", use_when: ["The automatic presence calculation is wrong for a known reason"], do_not_use_when: [], inputs: ["employeeId", "overrideState", "reason"], outputs: ["override"], requires: ["Employee exists"], related_endpoints: ["GET /presence-overrides"], tags: ["presence", "attendance", "correction"] } },
    },

    "/candidates/{applicantId}/messages": {
      get: { summary: "Read a candidate's full message thread.", security: scoped("candidate-messaging:read"),
        "x-rizurf": { name: "Get Candidate Thread", purpose: "Read the sent/received messages for one applicant", use_when: ["Opening a candidate's conversation view"], do_not_use_when: [], inputs: ["applicantId"], outputs: ["messages[]"], requires: [], related_endpoints: ["POST /candidates/{applicantId}/messages"], tags: ["candidate", "messages", "email", "thread"] } },
      post: { summary: "Send a message to a candidate.", security: scoped("candidate-messaging:write"),
        "x-rizurf": { name: "Send Candidate Message", purpose: "Message a shortlisted applicant on email or WhatsApp", use_when: ["Replying to a candidate", "Sending an offer"], do_not_use_when: [], inputs: ["applicantId", "channel", "toEmail", "ccEmail", "toPhone", "subject", "body"], outputs: ["message"], requires: ["No real email/WhatsApp provider is wired in yet — this records the message but doesn't deliver it"], related_endpoints: ["GET /email-templates"], tags: ["candidate", "email", "whatsapp", "send", "offer", "channel"] } },
    },
    "/email-templates": {
      get: { summary: "List offer-email drafts.", security: scoped("candidate-messaging:read"),
        "x-rizurf": { name: "List Email Drafts", purpose: "Browse reusable offer-email templates", use_when: ["Picking a draft to send"], do_not_use_when: [], inputs: [], outputs: ["templates[]"], requires: [], related_endpoints: ["POST /candidates/{applicantId}/messages"], tags: ["email drafts", "templates", "offer letter"] } },
      post: { summary: "Create an email draft.", security: scoped("candidate-messaging:write"),
        "x-rizurf": { name: "Create Email Draft", purpose: "Add a new reusable offer-email template", use_when: ["A new offer type or wording is needed"], do_not_use_when: [], inputs: ["name", "offerType", "subject", "body"], outputs: ["template"], requires: [], related_endpoints: ["PATCH /email-templates/{id}"], tags: ["email drafts", "create"] } },
    },
    "/email-templates/{id}": {
      patch: { summary: "Edit an email draft.", security: scoped("candidate-messaging:write"),
        "x-rizurf": { name: "Update Email Draft", purpose: "Change a template's subject, body or offer type", use_when: ["Editing wording"], do_not_use_when: [], inputs: ["name", "offerType", "subject", "body"], outputs: ["template"], requires: ["Template exists"], related_endpoints: ["GET /email-templates"], tags: ["email drafts", "edit"] } },
    },
    "/candidates/{applicantId}/documents": {
      get: { summary: "List a candidate's requested and submitted documents.", security: scoped("candidate-documents:read"),
        "x-rizurf": { name: "List Candidate Documents", purpose: "See what's been requested from / submitted by a candidate", use_when: ["Opening the file-gathering tab of a candidate's thread"], do_not_use_when: [], inputs: ["applicantId"], outputs: ["documents[]"], requires: [], related_endpoints: ["POST /candidates/{applicantId}/documents"], tags: ["documents", "candidate", "file gathering"] } },
      post: { summary: "Request a document from a candidate.", security: scoped("candidate-documents:write"),
        "x-rizurf": { name: "Request Candidate Document", purpose: "Ask a candidate to submit a specific document", use_when: ["A candidate has passed messaging and needs to submit ID/contract documents"], do_not_use_when: [], inputs: ["applicantId", "documentTypeId"], outputs: ["document"], requires: [], related_endpoints: ["GET /candidates/{applicantId}/documents"], tags: ["documents", "request", "file gathering"] } },
    },
    "/candidate-documents/{id}": {
      patch: { summary: "Mark a candidate document received, verified, or rejected.", security: scoped("candidate-documents:write"),
        "x-rizurf": { name: "Update Candidate Document", purpose: "Record a document's submission or review outcome", use_when: ["A candidate uploads the requested file", "HR reviews a submitted document"], do_not_use_when: [], inputs: ["status", "fileUrl", "notes"], outputs: ["document"], requires: ["Document exists"], related_endpoints: ["GET /candidates/{applicantId}/documents", "POST /applicants/{applicantId}/convert"], tags: ["documents", "verify", "review"] } },
    },
    "/applicants/{applicantId}/convert": {
      post: { summary: "Accept an applicant: create their employee record and (for interns) push them to the Interns database.", security: scoped("applicant-conversion:write"),
        "x-rizurf": { name: "Convert Applicant", purpose: "Turn an accepted applicant into an employee", use_when: ["A candidate in Upcoming is accepted"], do_not_use_when: ["The person isn't from Upcoming — use POST /employees directly"], inputs: ["applicantId", "employeeTypeId", "startDate", "icPassportNumber", "internshipEndDate", "departmentId", "roleId", "mode", "allowance", "photoUrl"], outputs: ["employee", "conversion"], requires: ["Applicant exists in the Applicants DB", "icPassportNumber/departmentId/roleId for an Intern hire — the Applicants DB has no columns for these"], related_endpoints: ["POST /employees", "GET /employees/{id}", "GET /positions"], tags: ["applicant", "convert", "hire", "accept"] } },
    },

    "/notes": {
      get: { summary: "List notes.", security: scoped("notes:read"),
        "x-rizurf": { name: "List Notes", purpose: "Browse the HR notepad", use_when: ["Opening the Notes page"], do_not_use_when: [], inputs: ["owner_id", "is_pinned"], outputs: ["notes[]"], requires: [], related_endpoints: ["POST /notes"], tags: ["notes", "notepad", "reminders"] } },
      post: { summary: "Create a note.", security: scoped("notes:write"),
        "x-rizurf": { name: "Create Note", purpose: "Add a note, with an optional reminder", use_when: ["Jotting something down for later"], do_not_use_when: [], inputs: ["title", "content", "category", "reminderAt"], outputs: ["note"], requires: [], related_endpoints: ["GET /notes"], tags: ["notes", "create", "reminder"] } },
    },
    "/notes/{id}": {
      patch: { summary: "Edit, pin, or archive a note.", security: scoped("notes:write"),
        "x-rizurf": { name: "Update Note", purpose: "Change a note's content or state", use_when: ["Editing a note", "Pinning or archiving it"], do_not_use_when: [], inputs: ["title", "content", "isPinned", "isArchived"], outputs: ["note"], requires: ["Note exists"], related_endpoints: ["GET /notes"], tags: ["notes", "edit", "pin", "archive"] } },
      delete: { summary: "Delete a note.", security: scoped("notes:write"),
        "x-rizurf": { name: "Delete Note", purpose: "Permanently remove a note", use_when: ["The note is no longer needed"], do_not_use_when: [], inputs: ["id"], outputs: [], requires: ["Note exists"], related_endpoints: ["GET /notes"], tags: ["notes", "delete"] } },
    },
    "/notifications": {
      get: { summary: "List notifications.", security: scoped("notes:read"),
        "x-rizurf": { name: "List Notifications", purpose: "Read the notification feed", use_when: ["Opening the notification bell"], do_not_use_when: [], inputs: ["is_read"], outputs: ["notifications[]"], requires: [], related_endpoints: ["PATCH /notifications/{id}"], tags: ["notifications", "reminders"] } },
    },
    "/notifications/{id}": {
      patch: { summary: "Mark a notification read.", security: scoped("notes:write"),
        "x-rizurf": { name: "Mark Notification Read", purpose: "Dismiss a notification", use_when: ["The user has seen it"], do_not_use_when: [], inputs: ["isRead"], outputs: ["notification"], requires: ["Notification exists"], related_endpoints: ["GET /notifications"], tags: ["notifications", "read", "dismiss"] } },
    },

    "/user-accounts": {
      get: { summary: "List local user accounts.", security: scoped("users:read"),
        "x-rizurf": { name: "List User Accounts", purpose: "See local role assignments keyed to gateway identities", use_when: ["Reviewing who has HR/admin access in this app"], do_not_use_when: [], inputs: [], outputs: ["userAccounts[]"], requires: [], related_endpoints: [], tags: ["users", "accounts", "roles", "admin"] } },
    },
    "/audit-logs": {
      get: { summary: "Read the audit log.", security: scoped("audit:read"),
        "x-rizurf": { name: "List Audit Logs", purpose: "See a trail of who changed what", use_when: ["Investigating an unexpected change"], do_not_use_when: [], inputs: ["entity", "entity_id"], outputs: ["auditLogs[]"], requires: [], related_endpoints: [], tags: ["audit", "log", "history", "trail"] } },
    },
  },
};

export function requiredScopesFor(routeKey, method) {
  const operation = openapi.paths[routeKey]?.[method.toLowerCase()];
  const requirement = operation?.security?.[0];
  if (!requirement) return [];
  return Object.values(requirement).flat();
}

export function isPublicRoute(routeKey) {
  return routeKey === "/health" || routeKey === "/openapi.json";
}

export { SERVICE_ID };
