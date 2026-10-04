import React from 'react';
import { CalendarClock } from 'lucide-react';
import PersonnelWithin7DaysWidget from './PersonnelWithin7DaysWidget.jsx';

/**
 * Dashboard card: Active and Offboarding personnel whose end / final working date falls within the
 * next 7 days (0-7 inclusive) — the ERP reminders feed's "ending" items, the same ones the header
 * bell notifies about (reminderService.peopleFromFeed(feed, 'ending') / server/db/reminders.js).
 * Ending today is red, otherwise amber.
 */
export default function EndingWithin7DaysWidget({ people, onViewProfile }) {
  return (
    <PersonnelWithin7DaysWidget
      title="Ending Within 7 Days"
      subtitle="Personnel whose current period ends within the next 7 days"
      icon={CalendarClock}
      tone={{ bg: '#FFFBEB', color: '#D97706' }}
      dateLabel="End Date"
      emptyText="Nobody is ending within the next 7 days."
      loadingText="Checking end dates…"
      badge={(days) => (days === 0 ? { bg: '#FEF2F2', color: '#DC2626' } : { bg: '#FFFBEB', color: '#D97706' })}
      people={people}
      onViewProfile={onViewProfile}
    />
  );
}
