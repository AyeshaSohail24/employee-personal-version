export const seedOnboardingPlanTemplates = [
  {
    id: 'tpl-001',
    name: 'Standard Employee Onboarding',
    type: 'Onboarding',
    departmentId: null, // General / All Departments
    description: 'Standard orientation plan for all new Rizurf hires covering HR, IT, and Manager introductions.',
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'tpl-002',
    name: 'Software Engineering Onboarding',
    type: 'Onboarding',
    departmentId: 'dept-3', // Software Engineering
    description: 'Technical onboarding workflow including dev environment setup, repo access, and architecture briefing.',
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'tpl-003',
    name: 'Internship / Apprenticeship Onboarding',
    type: 'Onboarding',
    departmentId: null, // General
    description: 'Tailored onboarding plan for apprentices and interns focusing on mentorship and learning objectives.',
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

export const seedOnboardingPlanTasks = [
  // Template 1: Standard Employee Onboarding
  {
    id: 'pt-001',
    planTemplateId: 'tpl-001',
    activityTypeId: 'act-type-4', // Document
    title: 'Prepare workstation and access credentials',
    description: 'Setup laptop, email account, internal portal access, and desk setup.',
    assignmentRule: 'manager', // Resolved to employee manager
    specificAssigneeId: null,
    relativeOffsetDays: -5,
    required: true,
    sequence: 1,
    active: true,
  },
  {
    id: 'pt-002',
    planTemplateId: 'tpl-001',
    activityTypeId: 'act-type-4', // Document
    title: 'Collect Signed Non-Disclosure Agreement',
    description: 'Verify and archive signed NDA and personal employment contract documents.',
    assignmentRule: 'hr', // Resolved to HR representative
    specificAssigneeId: null,
    relativeOffsetDays: -1,
    required: true,
    sequence: 2,
    active: true,
  },
  {
    id: 'pt-003',
    planTemplateId: 'tpl-001',
    activityTypeId: 'act-type-3', // Meeting
    title: 'Conduct HR Orientation Session',
    description: 'Welcome new hire, review company benefits, policies, and workplace overview.',
    assignmentRule: 'hr',
    specificAssigneeId: null,
    relativeOffsetDays: 0,
    required: true,
    sequence: 3,
    active: true,
  },
  {
    id: 'pt-004',
    planTemplateId: 'tpl-001',
    activityTypeId: 'act-type-1', // To Do
    title: 'Set up payroll profile and banking info',
    description: 'Verify employee tax form, bank account details, and EPF/SOCSO credentials.',
    assignmentRule: 'employee', // Resolved to onboarding employee
    specificAssigneeId: null,
    relativeOffsetDays: 1,
    required: true,
    sequence: 4,
    active: true,
  },
  {
    id: 'pt-005',
    planTemplateId: 'tpl-001',
    activityTypeId: 'act-type-3', // Meeting
    title: 'Manager 1-on-1 Introduction & Expectations',
    description: 'Align on 30-60-90 day goals, team structure, and immediate priorities.',
    assignmentRule: 'manager',
    specificAssigneeId: null,
    relativeOffsetDays: 3,
    required: true,
    sequence: 5,
    active: true,
  },
  {
    id: 'pt-006',
    planTemplateId: 'tpl-001',
    activityTypeId: 'act-type-6', // Follow-up
    title: 'First-week check-in review',
    description: 'Check-in on initial week progress, team integration, and resolve any blockers.',
    assignmentRule: 'manager',
    specificAssigneeId: null,
    relativeOffsetDays: 7,
    required: false,
    sequence: 6,
    active: true,
  },
  {
    id: 'pt-007',
    planTemplateId: 'tpl-001',
    activityTypeId: 'act-type-5', // Review
    title: 'Conduct 30-Day Onboarding Review',
    description: 'Formal 30-day feedback meeting between employee, manager, and HR.',
    assignmentRule: 'hr',
    specificAssigneeId: null,
    relativeOffsetDays: 30,
    required: true,
    sequence: 7,
    active: true,
  },

  // Template 2: Software Engineering Onboarding
  {
    id: 'pt-010',
    planTemplateId: 'tpl-002',
    activityTypeId: 'act-type-1', // To Do
    title: 'Setup development environment and Git repositories',
    description: 'Configure local IDE, SSH keys, repository permissions, and dev containers.',
    assignmentRule: 'employee',
    specificAssigneeId: null,
    relativeOffsetDays: 0,
    required: true,
    sequence: 1,
    active: true,
  },
  {
    id: 'pt-011',
    planTemplateId: 'tpl-002',
    activityTypeId: 'act-type-3', // Meeting
    title: 'Engineering Architecture Briefing',
    description: 'Overview of Rizurf microservice architecture, API standards, and deployment pipelines.',
    assignmentRule: 'manager',
    specificAssigneeId: null,
    relativeOffsetDays: 2,
    required: true,
    sequence: 2,
    active: true,
  },
  {
    id: 'pt-012',
    planTemplateId: 'tpl-002',
    activityTypeId: 'act-type-5', // Review
    title: 'Security and access control review',
    description: 'Verify 2FA setup, VPN access, production environment isolation, and compliance rules.',
    assignmentRule: 'hr',
    specificAssigneeId: null,
    relativeOffsetDays: 5,
    required: true,
    sequence: 3,
    active: true,
  },
  {
    id: 'pt-013',
    planTemplateId: 'tpl-002',
    activityTypeId: 'act-type-5', // Review
    title: 'First Pull Request Code Review',
    description: 'Pairing session with senior engineer to submit and review initial code contribution.',
    assignmentRule: 'manager',
    specificAssigneeId: null,
    relativeOffsetDays: 14,
    required: true,
    sequence: 4,
    active: true,
  },

  // Template 3: Internship / Apprenticeship Onboarding
  {
    id: 'pt-020',
    planTemplateId: 'tpl-003',
    activityTypeId: 'act-type-4', // Document
    title: 'Collect signed apprenticeship agreement',
    description: 'Verify educational institution endorsement and signed internship contract.',
    assignmentRule: 'hr',
    specificAssigneeId: null,
    relativeOffsetDays: -3,
    required: true,
    sequence: 1,
    active: true,
  },
  {
    id: 'pt-021',
    planTemplateId: 'tpl-003',
    activityTypeId: 'act-type-3', // Meeting
    title: 'Apprenticeship Programme & Mentor Pairing',
    description: 'Introduction to designated mentor, learning roadmap, and evaluation milestones.',
    assignmentRule: 'manager',
    specificAssigneeId: null,
    relativeOffsetDays: 1,
    required: true,
    sequence: 2,
    active: true,
  },
  {
    id: 'pt-022',
    planTemplateId: 'tpl-003',
    activityTypeId: 'act-type-6', // Follow-up
    title: '14-Day mentor check-in session',
    description: 'Review initial learning objectives, project assignments, and mentorship feedback.',
    assignmentRule: 'manager',
    specificAssigneeId: null,
    relativeOffsetDays: 14,
    required: true,
    sequence: 3,
    active: true,
  },
];
