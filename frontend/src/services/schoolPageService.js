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

export const getSchoolTuitionReceiptUrl = (slug, reference) =>
  `${API_BASE}/schools/public/${encodeURIComponent(slug || "")}/tuition-payments/receipt/${encodeURIComponent(reference || "")}`;

export const fetchSchoolTuitionReceipt = async (slug, reference) => {
  const response = await fetch(getSchoolTuitionReceiptUrl(slug, reference), {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/pdf" },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || payload?.error || "Could not prepare the tuition receipt.");
  }
  return response.blob();
};
