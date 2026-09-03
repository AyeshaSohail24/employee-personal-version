export const seedEmploymentRecords = [
  // Tariq Ibrahim (CEO)
  {
    id: 'rec-001-1',
    employeeId: 'emp-001',
    departmentId: 'dept-1',
    positionId: 'pos-1',
    managerId: null,
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-1',
    effectiveFrom: '2021-01-15',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Maya Lin (CTO)
  {
    id: 'rec-002-1',
    employeeId: 'emp-002',
    departmentId: 'dept-2',
    positionId: 'pos-2',
    managerId: 'emp-001',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-1',
    effectiveFrom: '2021-03-01',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Sarah Abdullah (HR Director)
  {
    id: 'rec-003-1',
    employeeId: 'emp-003',
    departmentId: 'dept-5',
    positionId: 'pos-3',
    managerId: 'emp-001',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-1',
    effectiveFrom: '2021-06-15',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Marcus Tan (Engineering Manager) - Hired as Senior Engineer, promoted to Manager
  {
    id: 'rec-004-1',
    employeeId: 'emp-004',
    departmentId: 'dept-3',
    positionId: 'pos-5', // Senior Full Stack Engineer
    managerId: 'emp-002',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-2',
    effectiveFrom: '2022-02-01',
    effectiveTo: '2024-01-31',
    changeReason: 'Initial Hire',
  },
  {
    id: 'rec-004-2',
    employeeId: 'emp-004',
    departmentId: 'dept-3',
    positionId: 'pos-4', // Engineering Manager
    managerId: 'emp-002',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-2',
    effectiveFrom: '2024-02-01',
    effectiveTo: null,
    changeReason: 'Promotion',
  },

  // Priyanka Nair (Senior Full Stack Engineer)
  {
    id: 'rec-005-1',
    employeeId: 'emp-005',
    departmentId: 'dept-3',
    positionId: 'pos-5',
    managerId: 'emp-004',
    supervisorId: 'emp-002',
    locationId: 'loc-1',
    scheduleId: 'sched-2',
    effectiveFrom: '2022-08-15',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Lucas Fernandez (Head of Product)
  {
    id: 'rec-006-1',
    employeeId: 'emp-006',
    departmentId: 'dept-4',
    positionId: 'pos-7',
    managerId: 'emp-002',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-2',
    effectiveFrom: '2022-10-01',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Chloe Lim (UI/UX Product Designer)
  {
    id: 'rec-007-1',
    employeeId: 'emp-007',
    departmentId: 'dept-4',
    positionId: 'pos-8',
    managerId: 'emp-006',
    supervisorId: null,
    locationId: 'loc-3',
    scheduleId: 'sched-2',
    effectiveFrom: '2023-01-10',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Harith Zain (Head of Operations)
  {
    id: 'rec-008-1',
    employeeId: 'emp-008',
    departmentId: 'dept-6',
    positionId: 'pos-9',
    managerId: 'emp-001',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-1',
    effectiveFrom: '2023-03-15',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Kenneth Ooi (Former Senior Engineer - History Closed May 31, 2026)
  {
    id: 'rec-009-1',
    employeeId: 'emp-009',
    departmentId: 'dept-3',
    positionId: 'pos-5',
    managerId: 'emp-004',
    supervisorId: null,
    locationId: 'loc-2',
    scheduleId: 'sched-2',
    effectiveFrom: '2023-06-01',
    effectiveTo: '2026-05-31', // History closed!
    changeReason: 'Initial Hire',
  },

  // Jessica Wong (Marketing Manager)
  {
    id: 'rec-010-1',
    employeeId: 'emp-010',
    departmentId: 'dept-7',
    positionId: 'pos-11',
    managerId: 'emp-001',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-1',
    effectiveFrom: '2023-09-01',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Amirah Hashim (Digital Marketing Specialist)
  {
    id: 'rec-011-1',
    employeeId: 'emp-011',
    departmentId: 'dept-7',
    positionId: 'pos-12',
    managerId: 'emp-010',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-1',
    effectiveFrom: '2024-01-08',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Rajiv Sharma (Corporate Finance Manager)
  {
    id: 'rec-012-1',
    employeeId: 'emp-012',
    departmentId: 'dept-8',
    positionId: 'pos-13',
    managerId: 'emp-001',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-1',
    effectiveFrom: '2024-02-15',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Hannah Razak (Onboarding Frontend Engineer)
  {
    id: 'rec-013-1',
    employeeId: 'emp-013',
    departmentId: 'dept-3',
    positionId: 'pos-6',
    managerId: 'emp-004',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-2',
    effectiveFrom: '2026-08-15',
    effectiveTo: null,
    changeReason: 'Initial Hire',
  },

  // Kevin Heng (Software Engineering Intern)
  {
    id: 'rec-014-1',
    employeeId: 'emp-014',
    departmentId: 'dept-3',
    positionId: 'pos-15',
    managerId: 'emp-004',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-1',
    effectiveFrom: '2026-09-01',
    effectiveTo: '2027-02-28',
    changeReason: 'Internship Agreement',
  },

  // Benjamin Teoh (Upcoming Senior Accountant - Future Dated Oct 1, 2026)
  {
    id: 'rec-015-1',
    employeeId: 'emp-015',
    departmentId: 'dept-8',
    positionId: 'pos-14',
    managerId: 'emp-012',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-1',
    effectiveFrom: '2026-10-01',
    effectiveTo: null,
    changeReason: 'Offer Accepted (Future Hire)',
  },

  // Farah Mansor (Departing Operations Specialist)
  {
    id: 'rec-016-1',
    employeeId: 'emp-016',
    departmentId: 'dept-6',
    positionId: 'pos-10',
    managerId: 'emp-008',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-3',
    effectiveFrom: '2023-04-01',
    effectiveTo: '2026-09-30', // Departure date set in future
    changeReason: 'Initial Hire',
  },

  // Aaron Kumar (Departing UI/UX Designer)
  {
    id: 'rec-017-1',
    employeeId: 'emp-017',
    departmentId: 'dept-4',
    positionId: 'pos-8',
    managerId: 'emp-006',
    supervisorId: null,
    locationId: 'loc-3',
    scheduleId: 'sched-2',
    effectiveFrom: '2024-05-15',
    effectiveTo: '2026-09-15',
    changeReason: 'Initial Hire',
  },

  // Daniel Lee (Former Senior Engineer - History Closed June 30, 2026)
  {
    id: 'rec-018-1',
    employeeId: 'emp-018',
    departmentId: 'dept-3',
    positionId: 'pos-5',
    managerId: 'emp-004',
    supervisorId: null,
    locationId: 'loc-1',
    scheduleId: 'sched-2',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2026-06-30', // History closed!
    changeReason: 'Initial Hire',
  },
];
