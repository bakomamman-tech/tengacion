import { API_BASE } from "../../config/apiBase";
import { getSessionAccessToken } from "../../authSession";

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "We could not complete that request. Please try again.");
  }
  return payload;
};

const request = async (path, options = {}) => {
  const { auth = false, ...fetchOptions } = options;
  const token = auth ? getSessionAccessToken() : "";
  const response = await fetch(`${API_BASE}/tengaharvest${path}`, {
    ...fetchOptions,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  });
  return parseResponse(response);
};

export const getTengaHarvestServices = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
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

export const getTengaHarvestAdminOverview = () =>
  request("/admin/overview", { auth: true });

export const updateTengaHarvestParticipantStatus = (participantId, status) =>
  request(`/admin/participants/${encodeURIComponent(participantId)}/status`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ status }),
  });

export const updateTengaHarvestServiceStatus = (serviceId, payload) =>
  request(`/admin/services/${encodeURIComponent(serviceId)}/status`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });

export const updateTengaHarvestBookingStatus = (bookingId, payload) =>
  request(`/admin/bookings/${encodeURIComponent(bookingId)}/status`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
