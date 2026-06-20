import { API_BASE, apiRequest } from "../api";

export const fetchPublicSchoolPage = (slug) =>
  apiRequest(`${API_BASE}/schools/public/${encodeURIComponent(slug || "")}`);

export const submitSchoolInquiry = (slug, payload = {}) =>
  apiRequest(`${API_BASE}/schools/public/${encodeURIComponent(slug || "")}/inquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
