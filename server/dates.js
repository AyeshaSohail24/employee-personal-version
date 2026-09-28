// The app's business calendar is Malaysia time (UTC+8). The database and Vercel both run in UTC,
// so "today" or a timestamp's date taken from either (CURDATE(), toISOString()) is a day behind
// for anything between midnight and 8am in Malaysia. Use these when a DATE has to be recorded or
// shown as a calendar day — mirrors src/utils/dateUtils.js on the browser side.
export const APP_TIME_ZONE = "Asia/Kuala_Lumpur";

const appDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A moment's calendar date in Malaysia time, as 'YYYY-MM-DD' (defaults to now). */
export function toAppDateString(date = new Date()) {
  return appDateFormat.format(date); // en-CA formats as YYYY-MM-DD
}
