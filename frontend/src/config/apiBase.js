const normalizeApiBase = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "/api";
  }

  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) {
    return raw.replace(/\/+$/, "") || "/api";
  }

  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
};

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

export default API_BASE;
