import { apiClient } from './apiClient.js';

/**
 * The ERP reminders feed (GET /reminders — server/db/reminders.js): open Onboarding/Offboarding
 * tasks that are overdue, due today or due within 7 days, start dates and end / final working
 * dates within 7 days, and unseen candidate replies in Upcoming. One feed behind the header bell
 * (via notificationService.syncErpReminders()), Dashboard "Soonest Due Tasks" and "Ending Within 7
 * Days", so they can never disagree. Read-only.
 *
 * @returns {Promise<{ today: string, windowDays: number, sources: Object, items: Array<Object> }>}
 */
export const reminderService = {
  async getFeed({ fresh = false } = {}) {
    return apiClient.get('/reminders', { fresh });
  },
};

// Feed items that also become bell notifications: tasks only once they're due today or overdue
// (not every task due this week), and every start/end date and candidate reply.
export function isBellWorthy(item) {
  if (item.kind === 'task') return item.state === 'overdue' || item.state === 'today';
  return ['starting', 'ending', 'reply'].includes(item.kind);
}

// Which feed source an item comes from (server/db/reminders.js `sources`).
export function reminderSource(kind) {
  if (kind === 'task') return 'tasks';
  if (kind === 'reply') return 'upcoming';
  return 'personnel';
}

/**
 * The Dashboard's people cards: the feed's 'starting' (Starting Within 7 Days — Upcoming and
 * Onboarding start dates) or 'ending' (Ending Within 7 Days — Active and Offboarding end / final
 * working dates) items — the same items the bell notifies about — for one personnel-type filter,
 * soonest first. null when the feed hasn't loaded or its Personnel part failed.
 */
export function peopleFromFeed(feed, kind, personnelType = 'All') {
  if (feed?.sources?.personnel !== 'ok') return null;
  return feed.items
    .filter((item) => item.kind === kind && (personnelType === 'All' || item.personType === personnelType))
    .map((item) => ({
      id: item.personId,
      fullName: item.personName,
      photo: item.photo,
      photoUrl: item.photoUrl,
      directoryType: item.personType,
      department: item.department,
      status: item.status,
      date: item.date,
      days: item.days,
      link: item.link,
    }))
    .sort((x, y) => x.days - y.days || x.fullName.localeCompare(y.fullName));
}

// Label shown above a notification / task row.
export function reminderLabel(item) {
  switch (item.kind ?? item.erpKind) {
    case 'task': return `${item.module === 'offboarding' ? 'Offboarding' : 'Onboarding'} Task${item.state === 'overdue' ? ' · Overdue' : item.state === 'today' ? ' · Due Today' : ''}`;
    case 'starting': return 'Starting Soon';
    case 'ending': return item.status === 'Offboarding' ? 'Final Working Day' : 'Ending Soon';
    case 'reply': return 'Candidate Reply';
    default: return 'Reminder';
  }
}
