import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

const BASE_URL = process.env.AUTH_CALLBACK_URL || "http://localhost:5173";

export const emailService = {
  sendVerificationEmail: async (to: string, token: string) => {
    const t = getTransporter();
    if (!t) return;
    const link = `${BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
    await t.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: "Подтверждение email — Timeline",
      html: `<p>Для подтверждения email перейдите по ссылке:</p><p><a href="${link}">${link}</a></p>`,
    });
  },

  sendPasswordResetEmail: async (to: string, token: string) => {
    const t = getTransporter();
    if (!t) return;
    const link = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await t.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: "Восстановление пароля — Timeline",
      html: `<p>Для восстановления пароля перейдите по ссылке:</p><p><a href="${link}">${link}</a></p><p>Ссылка действительна 1 час.</p>`,
    });
  },
};
