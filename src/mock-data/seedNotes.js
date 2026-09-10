// Personal HR working notes for the logged-in user (emp-001, Tariq Ibrahim / "Ayesha Z." in the
// header profile badge). Purely a personal notepad — no employee-record, task, or workflow
// linkage. ownerId is kept as an internal-only compatibility field for a future multi-user
// setup; it is never surfaced in the UI (see notesService/NOTES pages).
export const seedNotes = [
  {
    id: 'note-001',
    title: 'Candidate Follow-ups',
    content:
      'Follow up with the shortlisted Data Analytics candidates before Friday.\n\n' +
      '- Confirm availability for second-round interviews\n' +
      '- Check references for the two external candidates\n' +
      '- Loop in Sarah before sending offers',
    category: 'Recruitment',
    tags: ['internship', 'follow-up'],
    isPinned: true,
    isArchived: false,
    colorAccent: 'teal',
    ownerId: 'emp-001',
    createdAt: '2026-09-08T09:15:00Z',
    updatedAt: '2026-09-10T08:30:00Z',
  },
  {
    id: 'note-002',
    title: 'Discuss with Ms. Sarah',
    content:
      'Things to raise in this week\'s 1-on-1:\n' +
      '1. Budget approval for the new HR intern seats\n' +
      '2. Software Engineering onboarding tasks feedback from Kevin\n' +
      '3. Whether we need a second Product & UX department reviewer',
    category: 'Meeting',
    tags: ['sarah', 'weekly-sync'],
    isPinned: true,
    isArchived: false,
    colorAccent: 'amber',
    ownerId: 'emp-001',
    createdAt: '2026-09-07T13:00:00Z',
    updatedAt: '2026-09-09T16:45:00Z',
  },
  {
    id: 'note-003',
    title: 'Onboarding Improvement Ideas',
    content:
      'Kevin mentioned the Day 0 dev-environment task could use a short setup video instead of the current written checklist.\n\n' +
      'Worth considering for the Software Engineering department scope once we have time.',
    category: 'Onboarding',
    tags: ['onboarding', 'improvement'],
    isPinned: false,
    isArchived: false,
    colorAccent: 'blue',
    ownerId: 'emp-001',
    createdAt: '2026-09-05T11:20:00Z',
    updatedAt: '2026-09-05T11:20:00Z',
  },
  {
    id: 'note-004',
    title: 'Marcus — Performance Review Prep',
    content:
      'Pull together notes ahead of Marcus\'s quarterly review:\n' +
      '- Engineering architecture briefing feedback was strong\n' +
      '- Ask about his interest in mentoring interns next quarter',
    category: 'Employee',
    tags: ['review', 'marcus'],
    isPinned: false,
    isArchived: false,
    colorAccent: 'default',
    ownerId: 'emp-001',
    createdAt: '2026-09-03T10:00:00Z',
    updatedAt: '2026-09-04T09:10:00Z',
  },
  {
    id: 'note-005',
    title: 'Corporate Finance Dept — Admin Notes',
    content:
      'Corporate Finance still has zero configured department onboarding tasks. Flag to the finance lead once they confirm their checklist.',
    category: 'General',
    tags: ['admin'],
    isPinned: false,
    isArchived: false,
    colorAccent: 'purple',
    ownerId: 'emp-001',
    createdAt: '2026-08-30T14:30:00Z',
    updatedAt: '2026-08-30T14:30:00Z',
  },
  {
    id: 'note-006',
    title: 'Old Recruitment Drive Notes (Q2)',
    content: 'Archived notes from the Q2 recruitment push — kept for reference only.',
    category: 'Recruitment',
    tags: ['archive', 'q2'],
    isPinned: false,
    isArchived: true,
    colorAccent: 'default',
    ownerId: 'emp-001',
    createdAt: '2026-06-15T10:00:00Z',
    updatedAt: '2026-07-01T10:00:00Z',
  },
];
