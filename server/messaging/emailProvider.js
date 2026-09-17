// No email provider chosen yet (SMTP details still being confirmed). This
// stub is the whole surface a real implementation needs to fill in — nothing
// in db/candidateMessaging.js or messaging/index.js changes when it does.
export async function sendEmail({ to, cc, subject, body }) {
  console.log(`[email:stub] would send to=${to ?? "(none)"} cc=${cc ?? "(none)"} subject="${subject ?? ""}"`);
  return { provider: "stub", delivered: false };
}
