import React from 'react';
import { UserPlus } from 'lucide-react';
import PersonnelWithin7DaysWidget from './PersonnelWithin7DaysWidget.jsx';

/**
 * Dashboard card: Upcoming and Onboarding personnel whose start date falls within the next 7 days
 * (0-7 inclusive) — the ERP reminders feed's "starting" items, the same ones the header bell shows
 * as Starting Soon (reminderService.peopleFromFeed(feed, 'starting') / server/db/reminders.js).
 * Green, like Starting Soon in the bell; a little stronger on the day itself.
 */
export default function StartingWithin7DaysWidget({ people, onViewProfile }) {
  return (
    <PersonnelWithin7DaysWidget
      title="Starting Within 7 Days"
      subtitle="Personnel whose start date is within the next 7 days"
      icon={UserPlus}
      tone={{ bg: 'var(--ok-bg)', color: 'var(--ok-text)' }}
      dateLabel="Start Date"
      emptyText="Nobody is starting within the next 7 days."
      loadingText="Checking start dates…"
      badge={(days) => (days === 0 ? { bg: '#D1FAE5', color: 'var(--ok-text)' } : { bg: 'var(--ok-bg)', color: 'var(--ok-text)' })}
      people={people}
      onViewProfile={onViewProfile}
    />
  );
}
