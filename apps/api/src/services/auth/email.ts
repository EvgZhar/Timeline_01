import nodemailer from "nodemailer";
import { getSecret } from "../settings/settingsService.js";

let transporter: nodemailer.Transporter | null = null;
let fromAddress = "";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

async function readSmtpConfig(): Promise<SmtpConfig | null> {
  const host = await getSecret("SMTP_HOST") || process.env.SMTP_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(await getSecret("SMTP_PORT") || process.env.SMTP_PORT) || 587,
    user: await getSecret("SMTP_USER") || process.env.SMTP_USER || "",
    pass: await getSecret("SMTP_PASS") || process.env.SMTP_PASS || "",
  };
}

async function getTransporter() {
  if (transporter) return transporter;
  const cfg = await readSmtpConfig();
  if (!cfg || !cfg.user) return null;
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  fromAddress = cfg.user;
  return transporter;
}

export function refreshTransporter(): void {
  transporter = null;
  fromAddress = "";
}

const BASE_URL = process.env.AUTH_CALLBACK_URL || "http://localhost:5173";

export const emailService = {
  sendVerificationEmail: async (to: string, token: string) => {
    const t = await getTransporter();
    if (!t) return;
    const link = `${BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
    await t.sendMail({
      from: fromAddress,
      to,
      subject: "Подтверждение email — Timeline",
      html: `<h2>Добро пожаловать в Timeline!</h2><p>Для подтверждения email перейдите по ссылке:</p><p><a href="${link}">${link}</a></p><p>Ссылка действительна 24 часа.</p>`,
    });
  },

  sendPasswordResetEmail: async (to: string, token: string) => {
    const t = await getTransporter();
    if (!t) return;
    const link = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await t.sendMail({
      from: fromAddress,
      to,
      subject: "Восстановление пароля — Timeline",
      html: `<p>Для восстановления пароля перейдите по ссылке:</p><p><a href="${link}">${link}</a></p><p>Ссылка действительна 1 час.</p>`,
    });
  },
};
