import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!transporter) {
    // Dev fallback - log message
    console.log("[Email][DEV] To:", to);
    console.log("Subject:", subject);
    console.log(html);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "noreply@example.com",
    to,
    subject,
    html,
  });
}
