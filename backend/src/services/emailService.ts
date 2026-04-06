import nodemailer from 'nodemailer';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type EmailResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

function getFromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@thalai-connect.local';
}

export function isEmailServiceConfigured() {
  return Boolean(getTransporter());
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const transporter = getTransporter();

  if (!transporter) {
    return {
      ok: false,
      skipped: true,
      reason: 'SMTP is not configured',
    };
  }

  if (!payload.to) {
    return {
      ok: false,
      skipped: true,
      reason: 'Recipient email not provided',
    };
  }

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}
