import { API_BASE, apiRequest } from "../api";

export const fetchPublicSchoolPage = (slug) =>
  apiRequest(`${API_BASE}/schools/public/${encodeURIComponent(slug || "")}`);

export const submitSchoolInquiry = (slug, payload = {}) =>
  apiRequest(`${API_BASE}/schools/public/${encodeURIComponent(slug || "")}/inquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

export const initializeSchoolTuitionPayment = (slug, payload = {}) =>
  apiRequest(
    `${API_BASE}/schools/public/${encodeURIComponent(slug || "")}/tuition-payments/initialize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    }
  );

export const verifySchoolTuitionPayment = (slug, reference) =>
  apiRequest(
    `${API_BASE}/schools/public/${encodeURIComponent(slug || "")}/tuition-payments/verify/${encodeURIComponent(reference || "")}`
  );
