const { config } = require("../config/env");

const toText = (value) =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();

const toBool = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
};

const parsePort = (value, fallback = NaN) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getEmailSettings = () => {
  const smtpUser = toText(process.env.SMTP_USER) || toText(process.env.EMAIL_USER) || config.SMTP_USER;
  const smtpPass = toText(process.env.SMTP_PASS) || toText(process.env.EMAIL_PASS) || config.SMTP_PASS;
  const smtpHost =
    toText(process.env.SMTP_HOST) ||
    toText(process.env.EMAIL_HOST) ||
    config.SMTP_HOST ||
    (smtpUser || smtpPass ? "smtp.gmail.com" : "");
  const smtpPort = parsePort(
    process.env.SMTP_PORT || process.env.EMAIL_PORT || config.SMTP_PORT,
    smtpHost ? 465 : NaN
  );
  const smtpSecureInput = toText(process.env.SMTP_SECURE || process.env.EMAIL_SECURE);
  const smtpSecure = smtpSecureInput ? toBool(smtpSecureInput) : Boolean(config.SMTP_SECURE ?? smtpPort === 465);
  const contactEmail = toText(process.env.CONTACT_EMAIL) || config.CONTACT_EMAIL || "stephen@tengacion.com";
  const supportEmail = toText(process.env.SUPPORT_EMAIL) || config.SUPPORT_EMAIL || contactEmail;
  const adminNotificationEmail =
    toText(process.env.ADMIN_NOTIFICATION_EMAIL) || config.ADMIN_NOTIFICATION_EMAIL || supportEmail;
  const emailFrom = toText(process.env.EMAIL_FROM) || config.EMAIL_FROM || supportEmail;

  return {
    contactEmail,
    supportEmail,
    adminNotificationEmail,
    emailFrom,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    configured: Boolean(smtpHost && smtpPort && smtpUser && smtpPass),
  };
};

const isEmailConfigured = () => getEmailSettings().configured;

module.exports = {
  getEmailSettings,
  isEmailConfigured,
};
