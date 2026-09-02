# Rizurf Employees App — Implementation Plan (v2)

*Updated from v1 spec with data model, revised phasing, privacy/legal flags, permission matrix, and edge-case handling.*

---

## 1. What Changed From v1

| Area | v1 | v2 |
|---|---|---|
| Data model | Conceptual boxes only | Explicit entity list with keys & relationships |
| Phase 1 | One large bundle | Split into 1a (walking skeleton) and 1b (org setup) |
| Presence tracking | Listed as a feature | Flagged for PDPA/legal review before build |
| Departure automation | Instant execution | Reversible, audited, review-gated |
| Roles | Prose description | Explicit permission matrix |
| Edge cases | Not addressed | Rehire, conversion, transfer, dual-reporting called out |
| Workflow engine | Implied inside Onboarding phase | Called out as its own build-or-reuse decision |

---

## 2. Entity Model (Conceptual Schema)

This is the required precursor to database design and screen design. Each entity below should become a real table with proper keys before any UI work starts.

### Core entities

- **Employee** — `employee_id (PK)`, name fields, employee_type_id (FK), status (Upcoming/Onboarding/Active/Departing/Former), start_date, contract_end_date, photo, tags[]
- **Department** — `department_id (PK)`, name, parent_department_id (FK, self-referencing), manager_employee_id (FK), color, active
- **JobPosition** — `position_id (PK)`, name, department_id (FK), default_manager_id (FK), default_schedule_id (FK), default_location_id (FK)
- **WorkLocation** — `location_id (PK)`, name, type (Office/Remote/Client Site/Branch), address, active
- **WorkingSchedule** — `schedule_id (PK)`, name, working_days[], start_time, end_time, weekly_hours
- **EmploymentRecord** — `employment_id (PK)`, employee_id (FK), department_id (FK), position_id (FK), manager_id (FK), supervisor_id (FK), schedule_id (FK), location_id (FK), effective_from, effective_to *(this is what lets you track history of role/department changes rather than overwriting a single row — critical for reporting and for the transfer edge case)*
- **PrivateInfo** — `employee_id (FK/PK)`, personal contact, emergency contact, ID/passport, visa/permit — access-restricted table, separate from EmploymentRecord
- **BankingInfo** — `employee_id (FK/PK)` — separate table, most restricted access tier
- **UserAccount** — `user_id (PK)`, employee_id (FK, nullable), status (Active/Disabled/None) — kept distinct from Employee per v1's own correct instinct

### Skills & experience

- **SkillCategory**, **Skill** (FK to category), **EmployeeSkill** (employee_id, skill_id, proficiency_level)
- **ExperienceEntry** — employee_id (FK), type (Employment/Education/Certification/Other), title, start_date, end_date, description
- **Certification** — employee_id (FK), name, issuer, issue_date, expiry_date, attachment

### Documents

- **Document** — employee_id (FK), category, name, uploaded_date, expiry_date, visibility_level, attachment

### Lifecycle / workflow engine (shared by Onboarding & Offboarding)

- **PlanTemplate** — plan_id (PK), type (Onboarding/Offboarding), department_id (FK, nullable = general), name
- **PlanTask** — task_id (PK), plan_id (FK), title, activity_type, assignment_rule, relative_offset (n, unit, before/after, anchor_date), required (bool)
- **PlanInstance** — instance_id (PK), employee_id (FK), plan_id (FK), start_date, status, progress %
- **TaskInstance** — instance_task_id (PK), plan_instance_id (FK), assignee_id (FK), due_date, status, notes

### Presence

- **PresenceState** — employee_id (FK), work_mode (Office/Remote/External/Time Off), presence_state (Active/Idle/Outside Hours), computed_at
- **PresenceOverride** — employee_id (FK), old_status, new_status, reason, changed_by (FK), timestamp *(audit table, append-only, never edited)*

### Departure

- **DepartureRecord** — employee_id (FK), departure_type, last_working_day, contract_end_date, reason, offboarding_plan_instance_id (FK), archived_date

### Activity engine

- **ActivityType** — type_id (PK), name, category
- **Activity** — activity_id (PK), employee_id (FK), type_id (FK), assigned_to (FK), due_date, status, source (Manual/Onboarding/Offboarding/Certification/Appraisal), notes

### Audit

- **AuditLog** — log_id (PK), entity, entity_id, action, field, old_value, new_value, changed_by (FK), timestamp — append-only, no deletes

**Key design rule carried over from v1 and reinforced:** other apps (Attendance, Leave, Payroll, etc.) never duplicate employee identity fields — they hold `employee_id` and app-specific data only.

---

## 3. Edge Cases to Design For Now

These are cheap to handle at schema-design time and expensive to retrofit later.

| Case | Handling |
|---|---|
| **Rehire** | Former employee re-enters via Recruitment or manual creation; system should detect matching prior record (by IC/passport number) and offer to reactivate history rather than create a duplicate `Employee` row. |
| **Contract → FTE conversion** | Change of `employee_type_id` and possibly `position_id`, logged as a new `EmploymentRecord` row with `effective_from` = conversion date, not an overwrite. |
| **Mid-onboarding department transfer** | `EmploymentRecord` history handles this; onboarding plan instance should re-evaluate department-specific tasks or flag for HR review rather than silently continue the old plan. |
| **Dual/matrix reporting** | v1's single `manager_id` field won't hold this. Decide explicitly: either (a) keep single manager as source of truth for approvals and add a non-authoritative "dotted-line" field for org chart display, or (b) support multiple `EmploymentRecord`-linked reporting lines. Recommend (a) for v1 simplicity. |
| **Last-day date changes after offboarding starts** | `DepartureRecord` last_working_day must be editable, and any already-fired automation (§67 in v1) tied to the old date needs to be reversible or re-triggerable — see §5 below. |

---

## 4. Revised Phasing

### Phase 1a — Walking Skeleton (true MVP)
- Employee entity + minimal fields (name, ID, photo, status, email)
- Employee Directory (list view only, no cards/filters yet)
- Employee Profile (Overview tab only)
- Add/Edit Employee (manual creation only, no Recruitment conversion yet)
- Basic auth: Employee / HR roles only (Manager, HR Admin, Payroll deferred)

**Goal:** something HR can put one real employee into and view, end to end, as fast as possible — to validate the schema against real Rizurf data before building further.

### Phase 1b — Organization Setup
- Department, JobPosition, WorkLocation, WorkingSchedule entities + config screens
- EmploymentRecord (with history) wired to Employee Profile → Work tab
- Manager/Supervisor assignment
- Full role matrix (§6 below) implemented

### Phase 2 — Presence *(legal review gate before build — see §5)*
- Work mode + presence state model
- Weekly work-location schedule
- Presence calculation priority chain (as in v1 §46)
- Presence override + audit trail
- Filters/grouping on directory

### Phase 3 — Skills & Employee Information
- Skills, Experience, Education, Certifications
- Private Info tab (restricted)
- Banking (most restricted, separate table + separate permission)
- Visa/permit tracking
- Documents tab

### Phase 4 — Activity & Workflow Engine
- ActivityType, Activity
- **Explicit build-vs-reuse decision point** (see §5) before writing the relative-scheduling / assignment-rule engine, since this is the same engine Onboarding and Offboarding both depend on.

### Phase 5 — Onboarding
- PlanTemplate, PlanTask, PlanInstance, TaskInstance (general engine from Phase 4, onboarding-specific templates)
- Launch flow, task preview, progress tracking, dashboard

### Phase 6 — Offboarding
- Departure reasons, DepartureRecord
- Offboarding plan instances (reuse Phase 4/5 engine)
- Clearance checklist, archive flow
- Departure automation — **review-gated, not instant** (see §5)

### Phase 7 — Reporting
- Headcount, Hires, Departures, Retention
- Period comparisons, drill-down
- Only once Phases 1–3 data has been used in production long enough to trust it

### Phase 8 — Advanced Integrations
- Recruitment, Attendance, Leave, Payroll, Expenses, Timesheets, Appraisals, Planning, Asset Management, e-Signatures

---

## 5. Flags That Need a Decision Before Building

1. **Presence via System Activity / Company Network monitoring (v1 §45)** — this is employee monitoring and likely touches Malaysia's PDPA. Before Phase 2 starts: get a legal/compliance read, and design an explicit disclosure/consent mechanism. Attendance- and schedule-based presence can proceed without this; the monitoring-based signals should be held back until cleared.
2. **Workflow engine build-vs-reuse** — the relative-scheduling + assignment-rule engine (v1 §51–53) is a non-trivial piece of infrastructure shared by Onboarding and Offboarding. Decide before Phase 4 whether to build in-house or adapt an existing library/module — this choice affects the schema above.
3. **Departure automation execution model (v1 §67)** — auto-disabling logins, cancelling activities, ending contracts should not fire instantly on status change. Recommend: automation stages actions on `DepartureRecord.last_working_day`, executes on that date (not on record creation), and every action is logged to `AuditLog` and reversible if the date changes.
4. **Dual reporting lines** — pick single-manager-with-dotted-line (simple) vs. true multi-line (complex) before building `EmploymentRecord`. Recommend simple for v1.

---

## 6. Permission Matrix (replaces prose role descriptions)

| Data / Action | Employee (self) | Manager | HR | HR Admin | Payroll |
|---|:---:|:---:|:---:|:---:|:---:|
| View own Overview/Work | ✅ | — | — | — | — |
| View team Overview/Work | ❌ | ✅ | ✅ | ✅ | ❌ |
| Edit own permitted fields | ✅ | — | — | — | — |
| Edit any employee's Overview/Work | ❌ | ❌ | ✅ | ✅ | ❌ |
| View Private Info (own) | ✅ | — | — | — | — |
| View Private Info (others) | ❌ | ❌ | ✅ | ✅ | ❌ |
| View Banking | ❌ | ❌ | ❌ | ❌* | ✅ |
| View Payroll | ❌ | ❌ | ❌ | ❌* | ✅ |
| Correct Presence | ❌ | ✅ (team only) | ✅ | ✅ | ❌ |
| Launch Onboarding / Start Offboarding | ❌ | ❌ | ✅ | ✅ | ❌ |
| Configure Plans, Departure Reasons, Locations, Schedules | ❌ | ❌ | ❌ | ✅ | ❌ |
| Manage Roles & Permissions | ❌ | ❌ | ❌ | ✅ | ❌ |
| View HR Reports | ❌ | Team-scoped | ✅ | ✅ | ❌ |

\* HR Admin has configuration access but not necessarily Banking/Payroll visibility — confirm with stakeholders whether HR Admin needs an explicit override, or whether Payroll role should remain fully separate even from HR Admin. This is a policy decision, not a technical one — flag for sign-off before Phase 1b permission build.

---

## 7. Immediate Next Steps

1. Sign off on the entity model (§2) — this blocks database design.
2. Validate Department/JobPosition hierarchy against Rizurf's actual current org chart (v1 left this open at §39).
3. Get a legal/compliance answer on presence monitoring (§5.1) before Phase 2 starts.
4. Decide single vs. dual reporting lines (§5.4) before EmploymentRecord is finalized.
5. Confirm the Permission Matrix (§6) with stakeholders, especially the HR Admin / Payroll boundary.
6. Begin Phase 1a build.
