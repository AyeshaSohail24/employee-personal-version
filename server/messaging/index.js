// The one place that knows which channel maps to which provider. Callers
// (db/candidateMessaging.js) pick a channel; they never talk to a provider
// module directly, so adding a third channel later is a change here plus one
// new provider file, not a change everywhere a message gets sent.
import { sendEmail } from "./emailProvider.js";
import { sendWhatsAppMessage } from "./whatsappProvider.js";

export const CHANNELS = ["email", "whatsapp"];

export async function sendCandidateMessage({ channel, toEmail, ccEmail, toPhone, subject, body }) {
  if (channel === "email") return sendEmail({ to: toEmail, cc: ccEmail, subject, body });
  if (channel === "whatsapp") return sendWhatsAppMessage({ to: toPhone, body });
  throw new Error(`Unknown channel "${channel}".`);
}
