import { API_BASE } from "../../config/apiBase";

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || "We could not complete that request. Please try again.");
  }
  return payload;
};

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}/tengaharvest${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  return parseResponse(response);
};

export const getTengaHarvestServices = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return request(`/services${params.toString() ? `?${params}` : ""}`);
};

export const getTengaHarvestImpact = () => request("/impact");

export const joinTengaHarvestPilot = (payload) =>
  request("/participants", { method: "POST", body: JSON.stringify(payload) });

export const submitTengaHarvestService = (payload) =>
  request("/provider-services", { method: "POST", body: JSON.stringify(payload) });

export const createTengaHarvestBooking = (payload) =>
  request("/bookings", { method: "POST", body: JSON.stringify(payload) });
