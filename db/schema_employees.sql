-- ============================================================================
-- Rizurf Employees — HR / Interns Management Database
-- MySQL 5.7+ / 8.0+ Compatible
-- ============================================================================
--
-- FOUR-SYSTEM ARCHITECTURE
-- ----------------------------------------------------------------------------
-- This app talks to three EXTERNAL systems and owns exactly one database
-- of its own (this file):
--
--   1. Applicants DB (MySQL, external — "TalentPulse", see schema_applicants.sql)
--      Owned by the recruitment platform. jobs / stages / applicants /
--      applicant_notes / survey_templates / interview_templates all live
--      there. This app's "Upcoming" page reads shortlisted applicants from
--      it via API and writes nothing back except (eventually) a stage/status
--      update when a candidate is accepted or rejected.
--
--   2. Interns DB (PostgreSQL / Supabase, external — see the Intern_Database
--      project's schema.sql). Owned by a separate intern-management service.
--      Its `interns` table is the system of record for accepted INTERNS
--      specifically (ic_passport_number, internship_start_date/end_date,
--      contact details, a soft `department_id` text reference, `role_id`,
--      `mode`, `allowance`).
--
--   3. Department Management service (external, API-only — no schema of its
--      own lives in this repo). It owns the department directory: id, name,
--      code, color, manager. Both the Interns DB's `department_id` comment
--      ("Not a foreign key — that service owns departments") and this app
--      refer to the SAME external service — this app is a *consumer* of
--      departments, not the owner, exactly like Applicants DB and Interns DB.
--      Every `department_id` column in this schema is therefore a soft
--      reference (VARCHAR, no FK) holding that service's department id
--      (e.g. "dept-3"), fetched/cached via API, never joined in-database.
--
--   4. THIS database (below) — the only one this app owns. It is the actual
--      HR system of record for everything that isn't applicants, interns,
--      or departments: Positions/Locations/Schedules, the full Employee
--      lifecycle (Active/Onboarding/Offboarding/Former of every
--      employee_type), Onboarding/Offboarding plans and progress, Notes,
--      the candidate-messaging/email-drafts feature built for Upcoming,
--      Leaves, Presence, User accounts, and an audit trail.
--
-- LINKING THE EXTERNAL SYSTEMS
-- ----------------------------------------------------------------------------
-- Applicants DB, Interns DB, and the Department service each run as separate
-- services (different engines, different deployments) — there is no way to
-- declare a real FOREIGN KEY across any of them from here, and this app
-- should not assume direct database access to them at all (API calls only,
-- per the brief). So instead:
--
--   - `employees.source_applicant_id` is a soft reference (plain INT, no FK)
--     to `applicants.id` in the Applicants DB — set the moment an applicant
--     is accepted from Upcoming and an employee record is created here.
--   - `employees.intern_external_id` / `employees.intern_ref_number` are
--     soft references (no FK) to `interns.id` (uuid) / `interns.ref_number`
--     in the Interns DB — set once that employee (an Intern-type hire) has
--     actually been pushed there and the Interns DB has confirmed creation.
--   - `applicant_conversions` is the append-only audit trail of that whole
--     hand-off: which applicant, which local employee record it became,
--     what was pushed to the Interns DB, whether it succeeded, and who
--     triggered it — so a failed/retried push is never silently lost.
--   - Every `department_id` / `scope_department_id` column (on `positions`,
--     `employment_records`, `onboarding_plan_templates`,
--     `onboarding_plan_tasks`, `offboarding_plan_templates`,
--     `offboarding_plan_tasks`) is a soft VARCHAR(50) reference to the
--     Department service's id — never an FK, since there is no local
--     `departments` table to reference.
--
-- Everything else below (positions, onboarding/offboarding, notes,
-- candidate messaging, etc.) is this app's own first-class data, modeled
-- directly off what employeeService/onboardingService/offboardingService/
-- notesService/candidateEmailService already manage.
-- ============================================================================

DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `notes`;
DROP TABLE IF EXISTS `candidate_documents`;
DROP TABLE IF EXISTS `candidate_messages`;
DROP TABLE IF EXISTS `applicant_conversions`;
DROP TABLE IF EXISTS `email_templates`;
DROP TABLE IF EXISTS `email_placeholders`;
DROP TABLE IF EXISTS `upcoming_candidates_seen`;
DROP TABLE IF EXISTS `department_aliases`;
DROP TABLE IF EXISTS `offboarding_task_instances`;
DROP TABLE IF EXISTS `offboarding_plan_instances`;
DROP TABLE IF EXISTS `offboarding_plan_tasks`;
DROP TABLE IF EXISTS `offboarding_plan_templates`;
DROP TABLE IF EXISTS `onboarding_task_instances`;
DROP TABLE IF EXISTS `onboarding_plan_instances`;
DROP TABLE IF EXISTS `onboarding_plan_tasks`;
DROP TABLE IF EXISTS `onboarding_plan_templates`;
DROP TABLE IF EXISTS `activities`;
DROP TABLE IF EXISTS `activity_types`;
DROP TABLE IF EXISTS `presence_overrides`;
DROP TABLE IF EXISTS `leaves`;
DROP TABLE IF EXISTS `user_accounts`;
DROP TABLE IF EXISTS `employment_records`;
DROP TABLE IF EXISTS `employee_tag_assignments`;
DROP TABLE IF EXISTS `positions`;
DROP TABLE IF EXISTS `employees`;
DROP TABLE IF EXISTS `document_types`;
DROP TABLE IF EXISTS `schedules`;
DROP TABLE IF EXISTS `locations`;
DROP TABLE IF EXISTS `employee_tags`;
DROP TABLE IF EXISTS `employee_types`;

-- ----------------------------------------------------------------------------
-- Reference / catalog tables (no dependencies)
-- ----------------------------------------------------------------------------

-- 1. EMPLOYEE_TYPES — Full-Time Permanent, Fixed-Term Contract, Intern/Apprentice, etc.
CREATE TABLE IF NOT EXISTS `employee_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_employee_types_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. EMPLOYEE_TAGS — free-form directory tags ("Tech Lead", "Alumni", "New Joiner", ...)
CREATE TABLE IF NOT EXISTS `employee_tags` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(50) NOT NULL DEFAULT 'General',
    `color` VARCHAR(7) NULL,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_employee_tags_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. LOCATIONS — work sites (Office / Remote / Client Site / Branch)
CREATE TABLE IF NOT EXISTS `locations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(30) NOT NULL DEFAULT 'Office',
    `address` VARCHAR(500) NULL,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. SCHEDULES — named working-hours patterns
CREATE TABLE IF NOT EXISTS `schedules` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `working_days` JSON NOT NULL, -- e.g. ["Monday","Tuesday","Wednesday","Thursday","Friday"]
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `weekly_hours` INT NOT NULL DEFAULT 40,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. DOCUMENT_TYPES — catalog of expected employee document categories
CREATE TABLE IF NOT EXISTS `document_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `requires_expiry` BOOLEAN NOT NULL DEFAULT FALSE,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY `uq_document_types_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Core people data
-- ----------------------------------------------------------------------------

-- 6. EMPLOYEES — every person this app manages day-to-day, regardless of
--    whether they also have a canonical record in the external Interns DB.
--    `source_applicant_id` / `intern_external_id` / `intern_ref_number` are
--    the soft cross-database links described above — see `applicant_conversions`
--    for the full hand-off audit trail.
CREATE TABLE IF NOT EXISTS `employees` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_code` VARCHAR(20) NOT NULL, -- display ID, e.g. "RZ-1017"
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `full_name` VARCHAR(201) GENERATED ALWAYS AS (CONCAT(`first_name`, ' ', `last_name`)) STORED,
    `work_email` VARCHAR(255) NOT NULL,
    `work_phone` VARCHAR(50) NULL,
    `photo_initials` VARCHAR(4) NULL,
    `ic_passport_number` VARCHAR(100) NULL,
    `home_address` VARCHAR(500) NULL,
    `employee_type_id` INT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Active', -- Upcoming | Onboarding | Active | Departing | Former
    `work_mode` VARCHAR(20) NOT NULL DEFAULT 'On-site', -- On-site | Remote | Hybrid
    `allowance` VARCHAR(20) NOT NULL DEFAULT 'Paid', -- Paid | Unpaid
    `start_date` DATE NOT NULL,
    `contract_end_date` DATE NULL,
    `intake_notes` TEXT NULL, -- free-text notes captured at creation time (Create Personnel form)
    -- Soft link back to the Applicants DB (different MySQL database/service — no FK)
    `source_applicant_id` INT NULL,
    -- Soft link out to the Interns DB (PostgreSQL/Supabase, different service — no FK)
    `intern_external_id` CHAR(36) NULL,
    `intern_ref_number` VARCHAR(20) NULL, -- denormalized copy of interns.ref_number, e.g. "INT-0004"
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_employees_code` (`employee_code`),
    UNIQUE KEY `uq_employees_email` (`work_email`),
    FOREIGN KEY (`employee_type_id`) REFERENCES `employee_types`(`id`),
    INDEX `idx_employees_status` (`status`),
    INDEX `idx_employees_source_applicant` (`source_applicant_id`),
    INDEX `idx_employees_intern_external` (`intern_external_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. POSITIONS — job titles. `department_id` is a soft reference (no FK) to
--    the external Department service's id (e.g. "dept-3") — see the
--    architecture note at the top of this file.
CREATE TABLE IF NOT EXISTS `positions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `department_id` VARCHAR(50) NOT NULL,
    `default_manager_id` INT NULL,
    `default_schedule_id` INT NULL,
    `default_location_id` INT NULL,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`default_manager_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`default_schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`default_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL,
    INDEX `idx_positions_department` (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. EMPLOYEE_TAG_ASSIGNMENTS — many-to-many pivot
CREATE TABLE IF NOT EXISTS `employee_tag_assignments` (
    `employee_id` INT NOT NULL,
    `tag_id` INT NOT NULL,
    PRIMARY KEY (`employee_id`, `tag_id`),
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`tag_id`) REFERENCES `employee_tags`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. EMPLOYMENT_RECORDS — append-only history of department/position/manager
--    changes. `department_id` is a soft reference (no FK) to the external
--    Department service's id.
CREATE TABLE IF NOT EXISTS `employment_records` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `department_id` VARCHAR(50) NULL,
    `position_id` INT NULL,
    `manager_id` INT NULL,
    `supervisor_id` INT NULL,
    `schedule_id` INT NULL,
    `location_id` INT NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL, -- NULL = current record
    `change_reason` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`manager_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`supervisor_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL,
    INDEX `idx_employment_records_employee` (`employee_id`),
    INDEX `idx_employment_records_current` (`employee_id`, `effective_to`),
    INDEX `idx_employment_records_department` (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. USER_ACCOUNTS — login/role identity, kept distinct from Employee
CREATE TABLE IF NOT EXISTS `user_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NULL,
    `username` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'Employee', -- Employee | Manager | HR | HR Admin | Payroll
    `status` VARCHAR(20) NOT NULL DEFAULT 'Active', -- Active | Disabled
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_user_accounts_username` (`username`),
    UNIQUE KEY `uq_user_accounts_email` (`email`),
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. LEAVES
CREATE TABLE IF NOT EXISTS `leaves` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `leave_type` VARCHAR(50) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending | Approved | Rejected
    `reason` TEXT NULL,
    `applied_at` DATE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
    INDEX `idx_leaves_employee` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. PRESENCE_OVERRIDES — append-only manual presence corrections
CREATE TABLE IF NOT EXISTS `presence_overrides` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `override_state` VARCHAR(30) NOT NULL,
    `reason` TEXT NULL,
    `created_by` VARCHAR(255) NULL,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `ended_at` TIMESTAMP NULL,
    `ended_by` VARCHAR(255) NULL,
    `reason_ended` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
    INDEX `idx_presence_overrides_employee` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Activity engine (shared infrastructure behind Onboarding & Offboarding)
-- ----------------------------------------------------------------------------

-- 13. ACTIVITY_TYPES
CREATE TABLE IF NOT EXISTS `activity_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `icon` VARCHAR(50) NULL,
    `active` BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. ACTIVITIES — the actual trackable task/todo instances behind onboarding &
--     offboarding task progress (Done/Reopen state, overdue calculation, etc.)
CREATE TABLE IF NOT EXISTS `activities` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `type_id` INT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `employee_id` INT NOT NULL, -- who this activity is ABOUT
    `assignee_id` INT NULL, -- who is responsible for completing it
    `due_date` DATE NULL,
    `completed` BOOLEAN NOT NULL DEFAULT FALSE,
    `completed_at` TIMESTAMP NULL,
    `completed_by` INT NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'Manual', -- Manual | System | Onboarding | Offboarding
    `source_entity_type` VARCHAR(50) NULL, -- e.g. "OnboardingTaskInstance" (polymorphic, no FK)
    `source_entity_id` INT NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`type_id`) REFERENCES `activity_types`(`id`),
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`assignee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`completed_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    INDEX `idx_activities_employee` (`employee_id`),
    INDEX `idx_activities_assignee` (`assignee_id`),
    INDEX `idx_activities_source` (`source_entity_type`, `source_entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Onboarding workflow engine
-- ----------------------------------------------------------------------------

-- 15. ONBOARDING_PLAN_TEMPLATES — `department_id` is a soft reference (no FK)
--     to the external Department service's id; NULL = general/legacy grouping
--     with live scoping done on the tasks below instead.
CREATE TABLE IF NOT EXISTS `onboarding_plan_templates` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `department_id` VARCHAR(50) NULL,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_onboarding_templates_department` (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. ONBOARDING_PLAN_TASKS — composable per person-type/department scope.
--     `scope_department_id` is a soft reference (no FK) to the external
--     Department service's id, set only when scope_type = 'department'.
CREATE TABLE IF NOT EXISTS `onboarding_plan_tasks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `plan_template_id` INT NULL, -- NULL for a scope-based (Universal/Department) task or instance, not tied to a reusable named template
    `activity_type_id` INT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `assignment_rule` VARCHAR(20) NOT NULL DEFAULT 'hr', -- manager | hr | employee
    `specific_assignee_id` INT NULL,
    `relative_offset_days` INT NOT NULL DEFAULT 0, -- signed offset from the anchor (start) date
    `required` BOOLEAN NOT NULL DEFAULT TRUE,
    `sequence` INT NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `scope_type` VARCHAR(20) NOT NULL DEFAULT 'universal', -- universal | department
    `person_type` VARCHAR(20) NOT NULL DEFAULT 'employee', -- employee | intern
    `scope_department_id` VARCHAR(50) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`plan_template_id`) REFERENCES `onboarding_plan_templates`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`activity_type_id`) REFERENCES `activity_types`(`id`),
    FOREIGN KEY (`specific_assignee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    INDEX `idx_onboarding_tasks_template` (`plan_template_id`),
    INDEX `idx_onboarding_tasks_scope` (`scope_type`, `person_type`, `scope_department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. ONBOARDING_PLAN_INSTANCES — one launched plan per employee
CREATE TABLE IF NOT EXISTS `onboarding_plan_instances` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `plan_template_id` INT NULL, -- NULL for a scope-based (Universal/Department) task or instance, not tied to a reusable named template
    `employee_id` INT NOT NULL,
    `started_at` DATE NOT NULL,
    `anchor_date` DATE NOT NULL,
    `completed_at` DATE NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`plan_template_id`) REFERENCES `onboarding_plan_templates`(`id`),
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    INDEX `idx_onboarding_instances_employee` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. ONBOARDING_TASK_INSTANCES — a snapshot of each task at launch time, so
--     later edits to the template never rewrite history for people already
--     mid-plan (title/description/assignee are copied, not looked up live).
CREATE TABLE IF NOT EXISTS `onboarding_task_instances` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `plan_instance_id` INT NOT NULL,
    `plan_task_id` INT NULL,
    `activity_id` INT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `activity_type_id` INT NOT NULL,
    `assignment_rule` VARCHAR(20) NOT NULL,
    `originally_resolved_assignee_id` INT NULL,
    `relative_offset_days` INT NOT NULL DEFAULT 0,
    `originally_calculated_due_date` DATE NULL,
    `required` BOOLEAN NOT NULL DEFAULT TRUE,
    `sequence` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`plan_instance_id`) REFERENCES `onboarding_plan_instances`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`plan_task_id`) REFERENCES `onboarding_plan_tasks`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`activity_type_id`) REFERENCES `activity_types`(`id`),
    FOREIGN KEY (`originally_resolved_assignee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    INDEX `idx_onboarding_task_instances_plan` (`plan_instance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Offboarding workflow engine (mirrors Onboarding's shape exactly)
-- ----------------------------------------------------------------------------

-- 19. OFFBOARDING_PLAN_TEMPLATES — `department_id` is a soft reference (no FK)
--     to the external Department service's id.
CREATE TABLE IF NOT EXISTS `offboarding_plan_templates` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `department_id` VARCHAR(50) NULL,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_offboarding_templates_department` (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. OFFBOARDING_PLAN_TASKS — `scope_department_id` is a soft reference (no
--     FK) to the external Department service's id.
CREATE TABLE IF NOT EXISTS `offboarding_plan_tasks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `plan_template_id` INT NULL, -- NULL for a scope-based (Universal/Department) task or instance, not tied to a reusable named template
    `activity_type_id` INT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `assignment_rule` VARCHAR(20) NOT NULL DEFAULT 'hr',
    `specific_assignee_id` INT NULL,
    `relative_offset_days` INT NOT NULL DEFAULT 0, -- relative to last working day
    `required` BOOLEAN NOT NULL DEFAULT TRUE,
    `sequence` INT NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT TRUE,
    `scope_type` VARCHAR(20) NOT NULL DEFAULT 'universal',
    `person_type` VARCHAR(20) NOT NULL DEFAULT 'employee',
    `scope_department_id` VARCHAR(50) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`plan_template_id`) REFERENCES `offboarding_plan_templates`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`activity_type_id`) REFERENCES `activity_types`(`id`),
    FOREIGN KEY (`specific_assignee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    INDEX `idx_offboarding_tasks_template` (`plan_template_id`),
    INDEX `idx_offboarding_tasks_scope` (`scope_type`, `person_type`, `scope_department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. OFFBOARDING_PLAN_INSTANCES
CREATE TABLE IF NOT EXISTS `offboarding_plan_instances` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `plan_template_id` INT NULL, -- NULL for a scope-based (Universal/Department) task or instance, not tied to a reusable named template
    `employee_id` INT NOT NULL,
    `started_at` DATE NOT NULL,
    `anchor_date` DATE NOT NULL, -- the departing employee's last working day
    `completed_at` DATE NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`plan_template_id`) REFERENCES `offboarding_plan_templates`(`id`),
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    INDEX `idx_offboarding_instances_employee` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. OFFBOARDING_TASK_INSTANCES
CREATE TABLE IF NOT EXISTS `offboarding_task_instances` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `plan_instance_id` INT NOT NULL,
    `plan_task_id` INT NULL,
    `activity_id` INT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `activity_type_id` INT NOT NULL,
    `assignment_rule` VARCHAR(20) NOT NULL,
    `originally_resolved_assignee_id` INT NULL,
    `relative_offset_days` INT NOT NULL DEFAULT 0,
    `originally_calculated_due_date` DATE NULL,
    `required` BOOLEAN NOT NULL DEFAULT TRUE,
    `sequence` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`plan_instance_id`) REFERENCES `offboarding_plan_instances`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`plan_task_id`) REFERENCES `offboarding_plan_tasks`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`activity_type_id`) REFERENCES `activity_types`(`id`),
    FOREIGN KEY (`originally_resolved_assignee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    INDEX `idx_offboarding_task_instances_plan` (`plan_instance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Upcoming: candidate messaging + email drafts (built for the Upcoming page)
-- ----------------------------------------------------------------------------

-- 23. EMAIL_TEMPLATES — reusable offer-email drafts, editable via Email Drafts.
--     The single source of truth for drafts (the UI reads/writes them through
--     /email-templates). The default Paid/Unpaid drafts are inserted by
--     `npm run seed-email-templates` (server/scripts/seedEmailTemplates.js),
--     not here, so their wording lives in one place. At least one Paid and
--     one Unpaid draft must always exist; the API refuses to delete the last.
CREATE TABLE IF NOT EXISTS `email_templates` (
    `id` VARCHAR(100) PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `offer_type` VARCHAR(20) NOT NULL DEFAULT 'Paid', -- Paid | Unpaid
    `subject` VARCHAR(500) NOT NULL DEFAULT '',
    `body` LONGTEXT NULL, -- may contain {{ApplicantName}} / {{PositionName}} / {{HiringEmployeeName}}
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23b. EMAIL_PLACEHOLDERS — HR-created {{Tokens}} for email drafts, shared by
--      every user. `source` names one value the app can resolve for a
--      candidate when an email is prepared (see src/domain/emailPlaceholders.js);
--      `fixed_value` is only used when source = 'fixedText'. Created on an
--      existing database by `npm run create-email-placeholders-table`.
CREATE TABLE IF NOT EXISTS `email_placeholders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `token` VARCHAR(40) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `source` VARCHAR(40) NOT NULL,
    `fixed_value` VARCHAR(500) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_email_placeholders_token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. APPLICANT_CONVERSIONS — the append-only hand-off audit trail: an
--     applicant accepted from Upcoming becomes a local `employees` row, and
--     (for Intern-type hires) gets pushed to the external Interns DB. Every
--     push attempt gets a row here, success or failure, so a retry is never
--     a silent guess about what already happened.
CREATE TABLE IF NOT EXISTS `applicant_conversions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `applicant_id` INT NOT NULL, -- soft ref -> applicants.id (Applicants DB, external)
    `employee_id` INT NOT NULL, -- the local employee record created for this person
    `target_system` VARCHAR(30) NOT NULL DEFAULT 'interns_db',
    `external_id` CHAR(36) NULL, -- interns.id (uuid) once the push succeeds
    `external_ref_number` VARCHAR(20) NULL, -- interns.ref_number, e.g. "INT-0004"
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | success | failed
    `request_payload` JSON NULL,
    `response_message` TEXT NULL,
    `pushed_by` INT NULL,
    `pushed_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`pushed_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    INDEX `idx_applicant_conversions_applicant` (`applicant_id`),
    INDEX `idx_applicant_conversions_employee` (`employee_id`),
    INDEX `idx_applicant_conversions_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24c. DEPARTMENT_ALIASES — HR's mappings from a Recruitment job's free-text
--      department (e.g. "Engineering") to a real department in the
--      Departments service, used when the names don't already match.
--      `alias_key` is the name lower-cased with spaces collapsed, so matching
--      ignores case and spacing. Created on an existing database by
--      `npm run create-department-aliases-table`.
CREATE TABLE IF NOT EXISTS `department_aliases` (
    `alias_key` VARCHAR(255) PRIMARY KEY,
    `alias` VARCHAR(255) NOT NULL, -- as HR entered it, for display
    `department_id` VARCHAR(64) NOT NULL, -- soft ref -> Departments service id
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24b. UPCOMING_CANDIDATES_SEEN — the date each applicant first appeared in
--      Upcoming (shown as "Shortlisted"). The Recruitment API records no
--      shortlisted/phase-change time, so this app notes it the first time
--      GET /candidates returns them (server/db/upcomingCandidates.js).
--      Created on an existing database by
--      `npm run create-upcoming-candidates-seen-table`.
CREATE TABLE IF NOT EXISTS `upcoming_candidates_seen` (
    `applicant_id` VARCHAR(64) PRIMARY KEY, -- soft ref -> applicants.id (Applicants DB, external)
    `first_seen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. CANDIDATE_MESSAGES — the full message thread (sent + received) for a
--     still-in-pipeline applicant, powering the Upcoming page's Candidate
--     Thread view. `applicant_id` is a soft ref (no FK) into the Applicants
--     DB — this table exists here because message history is specific to
--     THIS app's outreach workflow, not something the Applicants DB models.
--     `channel` picks which provider a "sent" message goes out through
--     (server/messaging/*) — `to_email`/`cc_email` apply to 'email',
--     `to_phone` to 'whatsapp'. No real provider is wired in yet either way.
CREATE TABLE IF NOT EXISTS `candidate_messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `applicant_id` INT NOT NULL, -- soft ref -> applicants.id (Applicants DB, external)
    `direction` VARCHAR(10) NOT NULL, -- sent | received
    `channel` VARCHAR(20) NOT NULL DEFAULT 'email', -- email | whatsapp
    `to_email` VARCHAR(255) NULL,
    `cc_email` VARCHAR(255) NULL,
    `to_phone` VARCHAR(50) NULL,
    `subject` VARCHAR(500) NOT NULL DEFAULT '',
    `body` LONGTEXT NULL,
    `is_seen` BOOLEAN NOT NULL DEFAULT FALSE, -- relevant for direction = 'received' only
    `sent_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_candidate_messages_applicant` (`applicant_id`),
    INDEX `idx_candidate_messages_unseen` (`applicant_id`, `direction`, `is_seen`),
    INDEX `idx_candidate_messages_channel` (`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. CANDIDATE_DOCUMENTS — the file-gathering step of the Upcoming pipeline:
--     which documents have been requested from / submitted by a still-in-
--     pipeline applicant, before they're accepted and converted. This is our
--     own data (files WE gather), not something pushed back into the
--     Applicants DB — see the architecture note at the top of this file on
--     why that boundary matters. `applicant_id` is a soft ref, same as
--     candidate_messages above.
CREATE TABLE IF NOT EXISTS `candidate_documents` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `applicant_id` INT NOT NULL, -- soft ref -> applicants.id (Applicants DB, external)
    `document_type_id` INT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'requested', -- requested | received | verified | rejected
    `file_url` VARCHAR(500) NULL,
    `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `received_at` TIMESTAMP NULL,
    `verified_at` TIMESTAMP NULL,
    `verified_by` INT NULL,
    `notes` TEXT NULL,
    FOREIGN KEY (`document_type_id`) REFERENCES `document_types`(`id`),
    FOREIGN KEY (`verified_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    INDEX `idx_candidate_documents_applicant` (`applicant_id`),
    INDEX `idx_candidate_documents_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Notes, notifications, audit trail
-- ----------------------------------------------------------------------------

-- 27. NOTES — personal HR notepad (replaces the old Activities-as-notepad module)
CREATE TABLE IF NOT EXISTS `notes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(255) NOT NULL,
    `content` LONGTEXT NULL,
    `category` VARCHAR(50) NOT NULL DEFAULT 'General',
    `tags` JSON NULL,
    `is_pinned` BOOLEAN NOT NULL DEFAULT FALSE,
    `is_archived` BOOLEAN NOT NULL DEFAULT FALSE,
    `color_accent` VARCHAR(20) NOT NULL DEFAULT 'default',
    `owner_id` INT NULL,
    `reminder_at` TIMESTAMP NULL,
    `reminder_notification_generated_for` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`owner_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
    INDEX `idx_notes_owner` (`owner_id`),
    INDEX `idx_notes_pinned` (`is_pinned`),
    INDEX `idx_notes_archived` (`is_archived`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 28. NOTIFICATIONS — in-app notification center (currently only note reminders)
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `type` VARCHAR(50) NOT NULL DEFAULT 'note_reminder',
    `note_id` INT NULL,
    `title` VARCHAR(255) NULL,
    `message` TEXT NULL,
    `due_at` TIMESTAMP NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE CASCADE,
    INDEX `idx_notifications_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 29. AUDIT_LOGS — append-only trail (presence overrides, activity completion,
--     departure automation, applicant→employee conversions, etc.). `user_id`
--     is intentionally a plain string (not an FK) so a logging call can never
--     itself fail on a referential-integrity error — this table is meant to
--     never lose a write. `entity_id` is polymorphic (no FK) for the same reason
--     `activities.source_entity_id` is.
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(100) NOT NULL DEFAULT 'system',
    `action` VARCHAR(50) NOT NULL,
    `entity` VARCHAR(50) NOT NULL,
    `entity_id` VARCHAR(100) NOT NULL,
    `details` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_logs_entity` (`entity`, `entity_id`),
    INDEX `idx_audit_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Reference/catalog seed data (static lookup values, safe to load every time —
-- transactional data such as employees/departments/onboarding progress is
-- intentionally NOT seeded here; that lives in this app's own mock data /
-- future API layer, not in the schema itself).
-- ============================================================================

INSERT INTO `employee_types` (`code`, `name`) VALUES
    ('FTE', 'Full-Time Permanent'),
    ('CONTRACT', 'Fixed-Term Contract'),
    ('INTERN', 'Intern / Apprentice'),
    ('PART_TIME', 'Part-Time'),
    ('EXEC', 'Executive');

INSERT INTO `activity_types` (`name`, `category`, `icon`) VALUES
    ('To Do', 'General', 'CheckSquare'),
    ('Call', 'General', 'PhoneCall'),
    ('Meeting', 'General', 'Calendar'),
    ('Document', 'Compliance', 'FileText'),
    ('Review', 'HR', 'ClipboardCheck'),
    ('Follow-up', 'General', 'Clock');

INSERT INTO `document_types` (`code`, `name`, `category`, `requires_expiry`, `description`) VALUES
    ('CONTRACT', 'Employment Contract', 'Employment', FALSE, 'Standard employment agreement or letter of engagement.'),
    ('ID_PASSPORT', 'Identity Verification / Passport', 'Identity', TRUE, 'Government identification card, passport, or birth certificate.'),
    ('NDA', 'NDA & Confidentiality Agreement', 'Compliance', FALSE, 'Non-disclosure and intellectual property protection agreement.'),
    ('ACADEMIC_CERT', 'Academic Certificate', 'Qualifications', FALSE, 'Higher education degree, diploma, or academic transcript.'),
    ('PROF_CERT', 'Professional Certification', 'Qualifications', TRUE, 'Industry license, professional accreditation, or technical cert.'),
    ('EXIT_CLEARANCE', 'Exit Clearance Form', 'Offboarding', FALSE, 'Employee departure handoff and clearance documentation.');
