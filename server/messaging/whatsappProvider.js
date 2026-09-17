// No WhatsApp provider chosen yet (Twilio vs. the Meta Cloud API directly is
// still undecided). This stub is the whole surface a real implementation
// needs to fill in — nothing in db/candidateMessaging.js or messaging/index.js
// changes when it does.
export async function sendWhatsAppMessage({ to, body }) {
  console.log(`[whatsapp:stub] would send to=${to ?? "(none)"} body="${body ?? ""}"`);
  return { provider: "stub", delivered: false };
}
