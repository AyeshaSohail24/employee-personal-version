/**
 * Seed data for the Former module's Exit Information satellite records (see
 * src/domain/formerDomain.js's EXIT_TYPES and src/services/formerService.js). Exactly one record
 * per employeeId, never a copy of the personnel record itself — just the small amount of exit
 * metadata (Exit Type, Exit Remarks) that has no home anywhere else in the existing data model.
 *
 * Deliberately seeds ONLY ONE of the two current Former people (emp-018 Daniel Lee) with real,
 * plausible data (his 'Fixed-Term Contract' employeeTypeId makes "Contract Ended" the accurate
 * category), and leaves the other (emp-009 Kenneth Ooi) with no record at all — demonstrating
 * both the populated and the genuine "—" empty state honestly, rather than fabricating Exit Type
 * for someone whose actual exit reason was never recorded.
 */
export const seedFormerExitRecords = [
  {
    id: 'exit-018',
    employeeId: 'emp-018',
    exitType: 'Contract Ended',
    exitRemarks: 'Fixed-term contract concluded as scheduled; no renewal offered at this time.',
    recordedAt: '2026-06-30T09:00:00.000Z',
  },
];
