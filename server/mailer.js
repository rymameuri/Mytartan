const MAIL_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];

function mailConfig(env = process.env) {
  const host = env.SMTP_HOST?.trim();
  const port = Number(env.SMTP_PORT || 587);
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.trim();
  const from = env.SMTP_FROM?.trim() || user;
  const secure = env.SMTP_SECURE === "true" || port === 465;
  return { host, port, user, pass, from, secure };
}

function isMailConfigured(env = process.env) {
  const config = mailConfig(env);
  return Boolean(config.host && config.from);
}

function mailStatus(env = process.env) {
  const config = mailConfig(env);
  return {
    configured: isMailConfigured(env),
    missing: MAIL_KEYS.filter((key) => {
      if (key === "SMTP_FROM") return !config.from;
      if (key === "SMTP_HOST") return !config.host;
      if (key === "SMTP_PORT") return false;
      if (key === "SMTP_USER" || key === "SMTP_PASS") return false;
      return !env[key]?.trim();
    }),
    hint: isMailConfigured(env)
      ? null
      : "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in server/.env. SMTP_USER/PASS are optional for an open local relay.",
  };
}

function publicAppUrl(env = process.env) {
  return (env.APP_PUBLIC_URL || env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function mailNotConfiguredError() {
  const error = new Error(mailStatus().hint);
  error.code = "MAIL_NOT_CONFIGURED";
  return error;
}

async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    throw mailNotConfiguredError();
  }
  const nodemailer = require("nodemailer");
  const config = mailConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  });
  return transporter.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html: html || text,
  });
}

module.exports = {
  MAIL_KEYS,
  mailConfig,
  isMailConfigured,
  mailStatus,
  publicAppUrl,
  mailNotConfiguredError,
  sendMail,
};
