export const seedOffboardingPlanTemplates = [
  {
    id: 'tpl-off-001',
    name: 'Standard Employee Offboarding / Exit Clearance',
    type: 'Offboarding',
    departmentId: null, // General / All Departments
    description: 'Standard exit clearance workflow for departing employees covering handover, IT asset return, and HR clearance.',
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'tpl-off-002',
    name: 'Software Engineering Offboarding & Security Handover',
    type: 'Offboarding',
    departmentId: 'dept-3', // Software Engineering
    description: 'Technical offboarding checklist for engineering staff covering repository access, SSH key revocation, and dev hardware return.',
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'tpl-off-003',
    name: 'Executive / Managerial Exit Clearance',
    type: 'Offboarding',
    departmentId: null, // General
    description: 'Offboarding workflow for department heads and executives covering succession planning, governance, and bank signatory transfer.',
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

export const seedOffboardingPlanTasks = [
  // Template 1: Standard Employee Offboarding / Exit Clearance
  {
    id: 'pt-off-001',
    planTemplateId: 'tpl-off-001',
    activityTypeId: 'act-type-1', // To Do
    title: 'Conduct Handover Briefing & Document Transfer',
    description: 'Document current operational tasks, active project files, and conduct handover session with replacement/team.',
    assignmentRule: 'employee', // Resolved to departing employee
    specificAssigneeId: null,
    relativeOffsetDays: -30,
    required: true,
    sequence: 1,
    active: true,
  },
  {
    id: 'pt-off-002',
    planTemplateId: 'tpl-off-001',
    activityTypeId: 'act-type-5', // Review
    title: 'Review Outstanding Projects & Pending Deliverables',
    description: 'Manager review of pending deliverables, reassigning active duties, and client handover verification.',
    assignmentRule: 'manager', // Resolved to departing employee manager
    specificAssigneeId: null,
    relativeOffsetDays: -14,
    required: true,
    sequence: 2,
    active: true,
  },
  {
    id: 'pt-off-003',
    planTemplateId: 'tpl-off-001',
    activityTypeId: 'act-type-4', // Document
    title: 'Confirm IT Asset & Laptop Return Arrangement',
    description: 'Verify returning laptop, access badges, monitor, mobile device, and peripherals.',
    assignmentRule: 'hr', // Resolved to HR representative
    specificAssigneeId: null,
    relativeOffsetDays: -7,
    required: true,
    sequence: 3,
    active: true,
  },
  {
    id: 'pt-off-004',
    planTemplateId: 'tpl-off-001',
    activityTypeId: 'act-type-4', // Document
    title: 'Complete Exit Clearance Form & Expense Claims',
    description: 'Submit outstanding travel expenses, medical receipts, and complete signed exit clearance document.',
    assignmentRule: 'employee',
    specificAssigneeId: null,
    relativeOffsetDays: -3,
    required: true,
    sequence: 4,
    active: true,
  },
  {
    id: 'pt-off-005',
    planTemplateId: 'tpl-off-001',
    activityTypeId: 'act-type-3', // Meeting
    title: 'Conduct Formal Exit Interview',
    description: 'HR exit interview session to gather feedback, discuss career reasons, and explain post-employment benefits.',
    assignmentRule: 'hr',
    specificAssigneeId: null,
    relativeOffsetDays: -1,
    required: true,
    sequence: 5,
    active: true,
  },
  {
    id: 'pt-off-006',
    planTemplateId: 'tpl-off-001',
    activityTypeId: 'act-type-1', // To Do
    title: 'Deactivate Internal Systems & Portal Access',
    description: 'Revoke corporate email account, SSO credentials, VPN access, and internal portal roles on final working day.',
    assignmentRule: 'hr',
    specificAssigneeId: null,
    relativeOffsetDays: 0,
    required: true,
    sequence: 6,
    active: true,
  },
  {
    id: 'pt-off-007',
    planTemplateId: 'tpl-off-001',
    activityTypeId: 'act-type-6', // Follow-up
    title: 'Post-Exit Payroll & Tax Certificate Settlement',
    description: 'Process final salary payment, pro-rated leave encashment, EA tax form issuance, and archive file.',
    assignmentRule: 'hr',
    specificAssigneeId: null,
    relativeOffsetDays: 7,
    required: false,
    sequence: 7,
    active: true,
  },

  // Template 2: Software Engineering Offboarding & Security Handover
  {
    id: 'pt-off-010',
    planTemplateId: 'tpl-off-002',
    activityTypeId: 'act-type-1', // To Do
    title: 'Transfer Git Repository Ownership & Architecture Docs',
    description: 'Reassign pull request ownership, update architecture documentation, and grant admin rights to tech lead.',
    assignmentRule: 'employee',
    specificAssigneeId: null,
    relativeOffsetDays: -14,
    required: true,
    sequence: 1,
    active: true,
  },
  {
    id: 'pt-off-011',
    planTemplateId: 'tpl-off-002',
    activityTypeId: 'act-type-5', // Review
    title: 'Revoke Production Access & SSH Credentials',
    description: 'Audit production server SSH keys, cloud infrastructure IAM roles, and staging tokens.',
    assignmentRule: 'manager',
    specificAssigneeId: null,
    relativeOffsetDays: -7,
    required: true,
    sequence: 2,
    active: true,
  },
  {
    id: 'pt-off-012',
    planTemplateId: 'tpl-off-002',
    activityTypeId: 'act-type-4', // Document
    title: 'Return Dev Hardware & Hardware Security Tokens',
    description: 'Collect YubiKeys, testing devices, dev laptop, and peripheral adapters.',
    assignmentRule: 'hr',
    specificAssigneeId: null,
    relativeOffsetDays: -1,
    required: true,
    sequence: 3,
    active: true,
  },
  {
    id: 'pt-off-013',
    planTemplateId: 'tpl-off-002',
    activityTypeId: 'act-type-3', // Meeting
    title: 'Conduct Technical Code & Knowledge Transfer Review',
    description: 'Final walkthrough meeting with engineering team on active repositories and bug tracker items.',
    assignmentRule: 'manager',
    specificAssigneeId: null,
    relativeOffsetDays: 0,
    required: true,
    sequence: 4,
    active: true,
  },

  // Template 3: Executive / Managerial Exit Clearance
  {
    id: 'pt-off-020',
    planTemplateId: 'tpl-off-003',
    activityTypeId: 'act-type-1', // To Do
    title: 'Succession Planning & Leadership Handover',
    description: 'Formulate transition strategy, brief interim department head, and archive strategic documents.',
    assignmentRule: 'employee',
    specificAssigneeId: null,
    relativeOffsetDays: -30,
    required: true,
    sequence: 1,
    active: true,
  },
  {
    id: 'pt-off-021',
    planTemplateId: 'tpl-off-003',
    activityTypeId: 'act-type-4', // Document
    title: 'Bank Signatory & Corporate Governance Transfer',
    description: 'Update bank signatory mandates, corporate secretarial records, and legal proxy authorizations.',
    assignmentRule: 'hr',
    specificAssigneeId: null,
    relativeOffsetDays: -14,
    required: true,
    sequence: 2,
    active: true,
  },
  {
    id: 'pt-off-022',
    planTemplateId: 'tpl-off-003',
    activityTypeId: 'act-type-3', // Meeting
    title: 'Team Operational Briefing & Key Client Handover',
    description: 'Client intro meetings with incoming lead and operational handover session with executive team.',
    assignmentRule: 'manager',
    specificAssigneeId: null,
    relativeOffsetDays: -7,
    required: true,
    sequence: 3,
    active: true,
  },
  {
    id: 'pt-off-023',
    planTemplateId: 'tpl-off-003',
    activityTypeId: 'act-type-3', // Meeting
    title: 'Final Executive Exit Interview',
    description: 'Strategic exit interview with CEO / Board representative.',
    assignmentRule: 'hr',
    specificAssigneeId: null,
    relativeOffsetDays: -1,
    required: true,
    sequence: 4,
    active: true,
  },
];
