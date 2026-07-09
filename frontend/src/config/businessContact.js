const DEFAULT_BUSINESS_EMAIL = "stephen@tengacion.com";

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

export const COMPANY_LEGAL_NAME = "Tengacion Technologies Limited";
export const COMPANY_WEBSITE_LABEL = "www.tengacion.com";
export const COMPANY_REGISTRATION_AUTHORITY = "Corporate Affairs Commission (CAC)";
export const COMPANY_REGISTRATION_JURISDICTION = "Nigeria";

export const CONTACT_EMAIL =
  normalizeEmail(import.meta.env.VITE_CONTACT_EMAIL) || DEFAULT_BUSINESS_EMAIL;

export const SUPPORT_EMAIL =
  normalizeEmail(import.meta.env.VITE_SUPPORT_EMAIL) || CONTACT_EMAIL;

export const ADMIN_NOTIFICATION_EMAIL =
  normalizeEmail(import.meta.env.VITE_ADMIN_NOTIFICATION_EMAIL) || SUPPORT_EMAIL;

export const buildMailto = (email = CONTACT_EMAIL, subject = "") => {
  const target = normalizeEmail(email) || CONTACT_EMAIL;
  const trimmedSubject = String(subject || "").trim();
  return trimmedSubject
    ? `mailto:${target}?subject=${encodeURIComponent(trimmedSubject)}`
    : `mailto:${target}`;
};
