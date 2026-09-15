import React, { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { formatDateDisplay } from '../../utils/dateUtils.js';

/**
 * "X days" / "1 day" / "Today" — never "0 days".
 */
function formatTimeRemaining(daysUntilEnd) {
  if (daysUntilEnd === 0) return 'Today';
  if (daysUntilEnd === 1) return '1 day';
  return `${daysUntilEnd} days`;
}

// The Dashboard only shows the 2 soonest-ending people by default (the list is already sorted
// nearest-date-first by dashboardService) — "See more" reveals the rest in a bounded, internally
// scrollable list, per direct user request ("in dashboard it should only show latest 2 only").
const DEFAULT_VISIBLE_COUNT = 2;

/**
 * Dashboard section showing personnel whose canonical contractEndDate falls within the next 7
 * days (0-7 inclusive) — see dashboardService.getDashboardSummary() for the eligibility rule and
 * date-window calculation, both centralized there rather than duplicated in this component.
 * Respects the Dashboard's All/Employees/Interns filter because `people` is already the same
 * filtered array the lifecycle cards and distribution are built from.
 *
 * `onViewProfile`, when supplied, is wired to the SAME PersonnelProfileModal the Personnel
 * directory's "View Profile" already uses (never a second profile implementation) — clicking a
 * person's name opens it. Entirely optional: the row still renders cleanly without it.
 */
export default function EndingWithin7DaysWidget({ people = [], onViewProfile }) {
  const [expanded, setExpanded] = useState(false);
  const visiblePeople = expanded ? people : people.slice(0, DEFAULT_VISIBLE_COUNT);
  const hiddenCount = people.length - DEFAULT_VISIBLE_COUNT;

  return (
    <div className="dashboard-widget">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="widget-icon-badge" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
            <CalendarClock size={14} />
          </div>
          <div>
            <h3 className="widget-title">Ending Within 7 Days</h3>
            <p className="widget-subtitle">Personnel whose current period ends within the next 7 days</p>
          </div>
        </div>
      </div>

      {people.length === 0 ? (
        <p className="empty-widget-text">Nobody is ending within the next 7 days.</p>
      ) : (
        <>
          <div
            className={expanded ? 'dashboard-widget-scroll-list' : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.45rem' }}
          >
            {visiblePeople.map((person) => (
              <div
                key={person.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.7rem',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
                  <div className="table-avatar" style={{ width: '24px', height: '24px', fontSize: '0.65rem' }}>{person.photo}</div>
                  <div style={{ minWidth: 0 }}>
                    {onViewProfile ? (
                      <button
                        type="button"
                        onClick={() => onViewProfile(person.id)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left', fontSize: '0.72rem' }}
                        className="table-user-name"
                        title="View Profile"
                      >
                        {person.fullName}
                      </button>
                    ) : (
                      <div className="table-user-name" style={{ fontSize: '0.72rem' }}>{person.fullName}</div>
                    )}
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                      {person.directoryType} · {person.department ? person.department.name : 'Unassigned'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>End Date</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatDateDisplay(person.contractEndDate)}</div>
                  </div>
                  <span
                    className="status-pill"
                    style={{
                      backgroundColor: person.daysUntilEnd === 0 ? '#FEF2F2' : '#FFFBEB',
                      color: person.daysUntilEnd === 0 ? '#DC2626' : '#D97706',
                      whiteSpace: 'nowrap',
                      fontSize: '0.62rem',
                    }}
                  >
                    {formatTimeRemaining(person.daysUntilEnd)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {hiddenCount > 0 && (
            <button type="button" className="dashboard-widget-see-more" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? 'Show less' : `See more (${hiddenCount})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
