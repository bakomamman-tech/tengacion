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

const resolvePublicUrl = (value, baseUrl) => {
  const raw = toText(value);
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("/") && baseUrl) {
    return `${String(baseUrl).replace(/\/+$/, "")}${raw}`;
  }
  return "";
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
  const appUrl = config.APP_URL || config.appUrl || "https://tengacion.com";
  const emailLogoUrl =
    resolvePublicUrl(process.env.EMAIL_LOGO_URL, appUrl) ||
    config.EMAIL_LOGO_URL ||
    config.emailLogoUrl ||
    `${String(appUrl).replace(/\/+$/, "")}/tengacion_logo_512.png`;

  return {
    contactEmail,
    supportEmail,
    adminNotificationEmail,
    emailFrom,
    emailLogoUrl,
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
