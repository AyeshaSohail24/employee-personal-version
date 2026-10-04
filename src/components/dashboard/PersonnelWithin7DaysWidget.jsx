import React, { useState } from 'react';
import { formatDateDisplay } from '../../utils/dateUtils.js';

/**
 * "X days" / "1 day" / "Today" — never "0 days".
 */
function formatTimeRemaining(days) {
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

// The Dashboard only shows the 2 soonest people by default (the list is already sorted
// nearest-date-first) — "See more" reveals the rest in a bounded, internally scrollable list, per
// direct user request ("in dashboard it should only show latest 2 only").
const DEFAULT_VISIBLE_COUNT = 2;

/**
 * Dashboard card listing people with a date within the next 7 days — shared by Starting Within 7
 * Days and Ending Within 7 Days so they look and behave the same. `people` comes from the ERP
 * reminders feed (reminderService.peopleFromFeed() — the same items the header bell notifies
 * about), already filtered by the Dashboard's All/Employees/Interns choice: { id, fullName, photo,
 * directoryType, department, date, days }. null while the feed hasn't loaded.
 *
 * `onViewProfile` opens the SAME PersonnelProfileModal the Personnel directory uses.
 * `tone`: { bg, color } for the header icon; `badge(days)` → { bg, color } for the countdown pill.
 */
export default function PersonnelWithin7DaysWidget({
  title, subtitle, icon: Icon, tone, dateLabel, emptyText, loadingText, badge, people: peopleOrNull = [], onViewProfile,
}) {
  const [expanded, setExpanded] = useState(false);
  const notLoaded = peopleOrNull === null;
  const people = peopleOrNull ?? [];
  const visiblePeople = expanded ? people : people.slice(0, DEFAULT_VISIBLE_COUNT);
  const hiddenCount = people.length - DEFAULT_VISIBLE_COUNT;

  return (
    <div className="dashboard-widget">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="widget-icon-badge" style={{ backgroundColor: tone.bg, color: tone.color }}>
            <Icon size={14} />
          </div>
          <div>
            <h3 className="widget-title">{title}</h3>
            <p className="widget-subtitle">{subtitle}</p>
          </div>
        </div>
      </div>

      {people.length === 0 ? (
        <p className="empty-widget-text">{notLoaded ? loadingText : emptyText}</p>
      ) : (
        <>
          <div
            className={expanded ? 'dashboard-widget-scroll-list' : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.45rem' }}
          >
            {visiblePeople.map((person) => {
              const pill = badge(person.days);
              return (
                <div key={person.id} className="dashboard-person-row">
                  <div className="dashboard-person-row-who">
                    <div className="table-avatar" style={{ width: '24px', height: '24px', fontSize: '0.65rem', flexShrink: 0 }}>{person.photo}</div>
                    <div style={{ minWidth: 0 }}>
                      {onViewProfile ? (
                        <button
                          type="button"
                          onClick={() => onViewProfile(person.id)}
                          className="table-user-name dashboard-person-row-name"
                          title="View Profile"
                        >
                          {person.fullName}
                        </button>
                      ) : (
                        <div className="table-user-name dashboard-person-row-name">{person.fullName}</div>
                      )}
                      <div className="dashboard-person-row-meta">
                        {person.directoryType} · {person.department ? person.department.name : 'Unassigned'}
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-person-row-when">
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{dateLabel}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatDateDisplay(person.date)}</div>
                    </div>
                    <span className="status-pill" style={{ backgroundColor: pill.bg, color: pill.color, whiteSpace: 'nowrap', fontSize: '0.62rem' }}>
                      {formatTimeRemaining(person.days)}
                    </span>
                  </div>
                </div>
              );
            })}
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
