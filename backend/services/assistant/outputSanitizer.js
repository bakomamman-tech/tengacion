const stripHtml = (value = "") =>
  String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "");

const sanitizePlainText = (value = "", maxLength = 1000) =>
  stripHtml(String(value || ""))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\bjavascript\s*:/gi, "")
    .replace(/\bdata\s*:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(0, Number(maxLength) || 0));

const sanitizeMultilineText = (value = "", maxLength = 2000) =>
  stripHtml(String(value || ""))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\bjavascript\s*:/gi, "")
    .replace(/\bdata\s*:/gi, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, Math.max(0, Number(maxLength) || 0));

const sanitizeRoute = (value = "") => {
  const route = String(value || "").trim();
  if (!route.startsWith("/")) {
    return "";
  }
  if (route.includes("://") || route.includes("\\") || route.includes("..")) {
    return "";
  }
  return route.slice(0, 160);
};

const sanitizeAssistantDetail = (detail = {}) => ({
  title: sanitizePlainText(detail?.title || "", 120),
  body: sanitizeMultilineText(detail?.body || "", 1200),
});

const sanitizeAssistantFollowUp = (followUp = {}) => ({
  label: sanitizePlainText(followUp?.label || "", 120),
  prompt: sanitizePlainText(followUp?.prompt || "", 240),
  kind: sanitizePlainText(followUp?.kind || "prompt", 40),
  route: sanitizeRoute(followUp?.route || ""),
});

const sanitizeAssistantSafety = (safety = {}) => ({
  level: ["safe", "caution", "refusal", "emergency"].includes(String(safety?.level || "").trim().toLowerCase())
    ? String(safety.level).trim().toLowerCase()
    : "safe",
  notice: sanitizeMultilineText(safety?.notice || "", 500),
  escalation: sanitizePlainText(safety?.escalation || "", 240),
});

const sanitizeAssistantPreferences = (value = {}) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    tone: sanitizePlainText(source.tone || "", 40),
    audience: sanitizePlainText(source.audience || "", 40),
    length: sanitizePlainText(source.length || "", 20),
    simplicity: sanitizePlainText(source.simplicity || "", 20),
    language: sanitizePlainText(source.language || "", 40),
  };
};

module.exports = {
  sanitizeAssistantDetail,
  sanitizeAssistantFollowUp,
  sanitizeAssistantPreferences,
  sanitizeAssistantSafety,
  sanitizeMultilineText,
  sanitizePlainText,
  sanitizeRoute,
};
