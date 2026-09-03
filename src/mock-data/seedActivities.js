export const seedActivities = [
  {
    id: 'act-001',
    typeId: 'act-type-5', // Review
    title: 'Conduct 30-Day Check-in Review',
    description: 'Schedule a 30-minute 1-on-1 review with Hannah Razak to check onboarding progress.',
    employeeId: 'emp-013', // Hannah Razak (Onboarding)
    assigneeId: 'emp-001', // Tariq Ibrahim
    dueDate: '2026-09-02', // Due Today (ref 2026-09-02)
    completed: false,
    completedAt: null,
    completedBy: null,
    source: 'Manual',
    createdAt: '2026-08-28T09:00:00Z',
    createdBy: 'emp-001',
    updatedAt: '2026-08-28T09:00:00Z',
  },
  {
    id: 'act-002',
    typeId: 'act-type-4', // Document
    title: 'Collect Signed Non-Disclosure Agreement',
    description: 'Ensure signed NDA document is uploaded and verified in HR records.',
    employeeId: 'emp-004', // Marcus Tan (Active)
    assigneeId: 'emp-001', // Tariq Ibrahim
    dueDate: '2026-08-25', // Overdue
    completed: false,
    completedAt: null,
    completedBy: null,
    source: 'Manual',
    createdAt: '2026-08-20T10:30:00Z',
    createdBy: 'emp-003',
    updatedAt: '2026-08-20T10:30:00Z',
  },
  {
    id: 'act-003',
    typeId: 'act-type-1', // To Do
    title: 'Verify Engineering Access Permissions',
    description: 'Verify GitHub, Jira, and AWS permissions for Marcus Tan.',
    employeeId: 'emp-004', // Marcus Tan
    assigneeId: 'emp-001', // Tariq Ibrahim
    dueDate: '2026-08-28', // Overdue
    completed: false,
    completedAt: null,
    completedBy: null,
    source: 'Manual',
    createdAt: '2026-08-22T14:15:00Z',
    createdBy: 'emp-001',
    updatedAt: '2026-08-22T14:15:00Z',
  },
  {
    id: 'act-004',
    typeId: 'act-type-3', // Meeting
    title: 'Offboarding Exit Interview Briefing',
    description: 'Hold structured exit interview meeting with departing employee Farah Mansor.',
    employeeId: 'emp-016', // Farah Mansor (Departing)
    assigneeId: 'emp-001', // Tariq Ibrahim
    dueDate: '2026-09-02', // Due Today
    completed: false,
    completedAt: null,
    completedBy: null,
    source: 'Offboarding',
    createdAt: '2026-08-26T11:00:00Z',
    createdBy: 'emp-003',
    updatedAt: '2026-08-26T11:00:00Z',
  },
  {
    id: 'act-005',
    typeId: 'act-type-5', // Review
    title: 'Q3 Product Engineering Performance Appraisal',
    description: 'Complete quarterly performance review and goals sign-off for Maya Lin.',
    employeeId: 'emp-002', // Maya Lin (Active)
    assigneeId: 'emp-001', // Tariq Ibrahim
    dueDate: '2026-09-15', // Upcoming
    completed: false,
    completedAt: null,
    completedBy: null,
    source: 'Manual',
    createdAt: '2026-08-29T16:00:00Z',
    createdBy: 'emp-001',
    updatedAt: '2026-08-29T16:00:00Z',
  },
  {
    id: 'act-006',
    typeId: 'act-type-4', // Document
    title: 'Review Historical Handover Log',
    description: 'Audit archival handover records for former employee Kenneth Ooi.',
    employeeId: 'emp-009', // Kenneth Ooi (Former)
    assigneeId: 'emp-001', // Tariq Ibrahim
    dueDate: '2026-09-10', // Upcoming
    completed: false,
    completedAt: null,
    completedBy: null,
    source: 'Manual',
    createdAt: '2026-08-30T09:30:00Z',
    createdBy: 'emp-003',
    updatedAt: '2026-08-30T09:30:00Z',
  },
  {
    id: 'act-007',
    typeId: 'act-type-2', // Call
    title: 'Pre-boarding Welcome Call',
    description: 'Contact upcoming joiner Benjamin Teoh prior to start date.',
    employeeId: 'emp-015', // Benjamin Teoh (Upcoming)
    assigneeId: 'emp-004', // Marcus Tan
    dueDate: '2026-09-20', // Upcoming
    completed: false,
    completedAt: null,
    completedBy: null,
    source: 'Onboarding',
    createdAt: '2026-08-27T08:45:00Z',
    createdBy: 'emp-003',
    updatedAt: '2026-08-27T08:45:00Z',
  },
  {
    id: 'act-008',
    typeId: 'act-type-6', // Follow-up
    title: 'Follow-up on Medical Insurance Enrollment',
    description: 'Verify insurance provider confirmation for newly onboarded staff.',
    employeeId: 'emp-013', // Hannah Razak
    assigneeId: 'emp-004', // Marcus Tan
    dueDate: '2026-08-30', // Overdue
    completed: false,
    completedAt: null,
    completedBy: null,
    source: 'Manual',
    createdAt: '2026-08-24T13:20:00Z',
    createdBy: 'emp-004',
    updatedAt: '2026-08-24T13:20:00Z',
  },
  {
    id: 'act-009',
    typeId: 'act-type-1', // To Do
    title: 'Workstation Setup Verification',
    description: 'Ensure laptop and office accessories are delivered to Penang branch.',
    employeeId: 'emp-005', // Priyanka Nair
    assigneeId: 'emp-003', // Sarah Abdullah
    dueDate: '2026-09-02', // Due Today
    completed: false,
    completedAt: null,
    completedBy: null,
    source: 'Manual',
    createdAt: '2026-08-29T10:00:00Z',
    createdBy: 'emp-003',
    updatedAt: '2026-08-29T10:00:00Z',
  },
  {
    id: 'act-010',
    typeId: 'act-type-4', // Document
    title: 'Sign Work-Location Preference Agreement',
    description: 'Verify hybrid work arrangement schedule agreement for Chloe Lim.',
    employeeId: 'emp-007', // Chloe Lim
    assigneeId: 'emp-001', // Tariq Ibrahim
    dueDate: '2026-08-20', // Completed
    completed: true,
    completedAt: '2026-08-19T15:30:00Z',
    completedBy: 'emp-001',
    source: 'Manual',
    createdAt: '2026-08-15T09:00:00Z',
    createdBy: 'emp-001',
    updatedAt: '2026-08-19T15:30:00Z',
  },
  {
    id: 'act-011',
    typeId: 'act-type-3', // Meeting
    title: 'Department Strategy Alignment',
    description: 'Quarterly alignment meeting for Operations department leads.',
    employeeId: 'emp-008', // Harith Zain
    assigneeId: 'emp-004', // Marcus Tan
    dueDate: '2026-08-28', // Completed
    completed: true,
    completedAt: '2026-08-28T16:45:00Z',
    completedBy: 'emp-004',
    source: 'Manual',
    createdAt: '2026-08-21T11:30:00Z',
    createdBy: 'emp-004',
    updatedAt: '2026-08-28T16:45:00Z',
  },
  {
    id: 'act-012',
    typeId: 'act-type-5', // Review
    title: 'Annual Cybersecurity Refresher Completion Check',
    description: 'Confirm completion of mandatory security training module.',
    employeeId: 'emp-006', // Lucas Fernandez
    assigneeId: 'emp-003', // Sarah Abdullah
    dueDate: '2026-09-25', // Upcoming
    completed: false,
    completedAt: null,
    completedBy: null,
    source: 'System',
    createdAt: '2026-09-01T08:00:00Z',
    createdBy: 'emp-001',
    updatedAt: '2026-09-01T08:00:00Z',
  },
];
