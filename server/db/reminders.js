// The ERP's reminders feed (GET /reminders): everything across the app that needs attention soon,
// in one list, so the header bell, Dashboard "Soonest Due Tasks" and "Ending Within 7 Days" all
// read the same data instead of each deciding for itself. Notes reminders stay in the browser
// (notificationService.checkDueReminders()) and are merged in there.
//
// Read-only: computed from live data on every request (people from the live Personnel list — the
// Interns DB first, this app's copy as fallback; plan tasks and candidate messages from this app's
// tables). Nothing is written, nothing is marked seen. Each source fails on its own: \`sources\`
// says which ones loaded, so a client never treats a source that failed as "nothing due".
import { pool } from "./pool.js";
import { toAppDateString } from "../dates.js";
import { listUnseenCandidateReplies } from "./upcomingCandidates.js";

// How far ahead the feed looks for due tasks, start dates and end dates.
export const REMINDER_WINDOW_DAYS = 7;

function daysBetween(fromYmd, toYmd) {
  const from = Date.parse(`${fromYmd}T00:00:00Z`);
  const to = Date.parse(`${String(toYmd).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(from) || Number.isNaN(to) ? NaN : Math.round((to - from) / 86400000);
}

function personSummary(p) {
  return {
    personId: String(p.id),
    personName: p.fullName,
    personType: p.directoryType ?? null,
    photo: p.photo ?? null,
    photoUrl: p.photoUrl ?? null,
    department: p.department ?? null,
    status: p.status ?? null,
  };
}

// Start dates (Upcoming/Onboarding) and end / final working dates (Active/Offboarding) within the
// window. Same people list and same rule the Dashboard uses.
function personDateReminders(people, today) {
  const items = [];
  for (const p of people) {
    if (["Upcoming", "Onboarding"].includes(p.status) && p.startDate) {
      const days = daysBetween(today, p.startDate);
      if (days >= 0 && days <= REMINDER_WINDOW_DAYS) {
        items.push({
          key: `starting:${p.id}:${String(p.startDate).slice(0, 10)}`,
          kind: "starting", module: "personnel",
          title: p.fullName,
          message: days === 0 ? "Starts today" : `Starts in ${days} day${days === 1 ? "" : "s"}`,
          date: String(p.startDate).slice(0, 10), days,
          link: `/employees/${p.id}`,
          ...personSummary(p),
        });
      }
    }
    if (["Active", "Offboarding"].includes(p.status) && p.contractEndDate) {
      const days = daysBetween(today, p.contractEndDate);
      if (days >= 0 && days <= REMINDER_WINDOW_DAYS) {
        const what = p.status === "Offboarding" ? "Final working day" : "Ends";
        items.push({
          key: `ending:${p.id}:${String(p.contractEndDate).slice(0, 10)}`,
          kind: "ending", module: "personnel",
          title: p.fullName,
          message: days === 0 ? `${what} today` : `${what} in ${days} day${days === 1 ? "" : "s"}`,
          date: String(p.contractEndDate).slice(0, 10), days,
          link: `/employees/${p.id}`,
          ...personSummary(p),
        });
      }
    }
  }
  return items;
}

// Open tasks on each person's CURRENT plan that are overdue, due today or due within the window —
// only while the person is still in that stage (an onboarding plan once they're Active, or an
// offboarding plan once they're Former, is a record, not a to-do).
async function planTaskReminders(people, today) {
  const peopleById = new Map(people.map((p) => [String(p.id), p]));
  const until = new Date(Date.parse(`${today}T00:00:00Z`) + REMINDER_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const items = [];
  for (const [module, stage] of [["onboarding", "Onboarding"], ["offboarding", "Offboarding"]]) {
    // Each person's current (latest) plan, then its open tasks up to the end of the window.
    const [latest] = await pool.query(`SELECT MAX(id) AS id FROM ${module}_plan_instances GROUP BY employee_id`);
    if (latest.length === 0) continue;
    const [rows] = await pool.query(
      `SELECT ti.id, ti.title, ti.required, p.employee_id AS employeeId,
              DATE_FORMAT(COALESCE(a.due_date, ti.originally_calculated_due_date), '%Y-%m-%d') AS due
         FROM ${module}_task_instances ti
         JOIN ${module}_plan_instances p ON p.id = ti.plan_instance_id
         LEFT JOIN activities a ON a.id = ti.activity_id
        WHERE COALESCE(a.completed, 0) = 0
          AND p.id IN (?)
          AND COALESCE(a.due_date, ti.originally_calculated_due_date) <= ?`,
      [latest.map((r) => r.id), until],
    );
    for (const row of rows) {
      const person = peopleById.get(String(row.employeeId));
      if (!person || person.status !== stage || !row.due) continue;
      const days = daysBetween(today, row.due);
      const state = days < 0 ? "overdue" : days === 0 ? "today" : "soon";
      items.push({
        key: `task:${module}:${row.id}:${state === "soon" ? "soon" : state}`,
        kind: "task", module, state,
        title: row.title,
        message: `${person.fullName} · ${stage} · ${state === "overdue" ? `Overdue by ${-days} day${days === -1 ? "" : "s"}` : state === "today" ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`}`,
        date: row.due, days,
        required: Boolean(row.required),
        taskId: row.id,
        link: `/${module}/employees/${person.id}`,
        ...personSummary(person),
      });
    }
  }
  return items;
}

async function candidateReplyReminders() {
  const replies = await listUnseenCandidateReplies();
  return replies.map((r) => ({
    key: `reply:${r.applicantId}:${r.latestMessageId}`,
    kind: "reply", module: "upcoming",
    title: r.fullName,
    message: r.count === 1 ? "New reply — not opened yet" : `${r.count} new replies — not opened yet`,
    date: r.latestAt, days: 0,
    link: `/upcoming/${r.applicantId}`,
    candidateId: r.applicantId,
  }));
}

/**
 * @param {Promise<Array<Object>>} peoplePromise the live Personnel list (routes/employees.js)
 */
export async function buildReminders(peoplePromise) {
  const today = toAppDateString();
  const sources = {};
  const run = async (name, fn) => {
    try {
      const result = await fn();
      sources[name] = "ok";
      return result;
    } catch (error) {
      console.error(`Reminders: ${name} unavailable`, error);
      sources[name] = "failed";
      return [];
    }
  };

  const people = await run("personnel", () => peoplePromise);
  const [personItems, taskItems, replyItems] = await Promise.all([
    sources.personnel === "ok" ? personDateReminders(people, today) : [],
    sources.personnel === "ok" ? run("tasks", () => planTaskReminders(people, today)) : (sources.tasks = "failed", []),
    run("upcoming", () => candidateReplyReminders()),
  ]);

  const items = [...taskItems, ...personItems, ...replyItems]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { today, windowDays: REMINDER_WINDOW_DAYS, sources, items };
}
