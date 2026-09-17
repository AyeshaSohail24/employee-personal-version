// Real SMTP sending via Hostinger — MAIL_* in .env. `secure: true` matches
// port 465 (implicit TLS); this would need to become `secure: false` +
// `requireTLS: true` if the port ever moves to 587 (STARTTLS) instead.
import nodemailer from "nodemailer";
import { MAIL } from "../config.js";

let transporter = null;

function getTransporter() {
  if (!MAIL.host || !MAIL.username || !MAIL.password) {
    throw new Error("Email is not configured — MAIL_HOST/MAIL_USERNAME/MAIL_PASSWORD are missing.");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: MAIL.host,
      port: MAIL.port,
      secure: MAIL.port === 465,
      auth: { user: MAIL.username, pass: MAIL.password },
    });
  }
  return transporter;
}

export async function sendEmail({ to, cc, subject, body }) {
  if (!to) throw new Error("sendEmail requires a `to` address.");
  const from = MAIL.fromName ? `"${MAIL.fromName}" <${MAIL.fromAddress}>` : MAIL.fromAddress;

  const info = await getTransporter().sendMail({ from, to, cc: cc || undefined, subject, text: body });
  return { provider: "smtp", delivered: true, messageId: info.messageId };
}
