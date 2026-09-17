import { getSessionAccessToken } from "../authSession";
import { API_BASE } from "../config/apiBase";

const request = async (path, { method = "GET", body } = {}) => {
  const token = getSessionAccessToken();

  if (!token) {
    const error = new Error("Please sign in to manage TengaAgent follow-ups.");
    error.status = 401;
    throw error;
  }

  const response = await fetch(`${API_BASE}/tengaagent/owner${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const raw = await response.text();
  let data = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("TengaAgent returned an invalid follow-up response.");
    }
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || "TengaAgent could not complete the follow-up request."
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const getTengaAgentOwnerFollowUps = ({ filter = "all", limit = 100 } = {}) =>
  request(
    `/follow-ups?filter=${encodeURIComponent(filter)}&limit=${encodeURIComponent(limit)}`
  );

export const getTengaAgentOwnerFollowUpActivity = ({
  appointmentId,
  limit = 100,
}) =>
  request(
    `/follow-ups/${encodeURIComponent(appointmentId)}/activity?limit=${encodeURIComponent(limit)}`
  );

export const draftTengaAgentOwnerFollowUpEmail = ({
  appointmentId,
  instruction = "",
}) =>
  request(`/follow-ups/${encodeURIComponent(appointmentId)}/draft-email`, {
    method: "POST",
    body: instruction ? { instruction } : {},
  });

export const sendTengaAgentOwnerFollowUpEmail = ({
  appointmentId,
  subject,
  message,
}) =>
  request(`/follow-ups/${encodeURIComponent(appointmentId)}/send-email`, {
    method: "POST",
    body: { subject, message },
  });

export const logTengaAgentOwnerFollowUpContact = ({
  appointmentId,
  channel,
  direction,
  notes,
  occurredAt,
}) =>
  request(`/follow-ups/${encodeURIComponent(appointmentId)}/log-contact`, {
    method: "POST",
    body: {
      channel,
      direction,
      notes,
      ...(occurredAt ? { occurredAt } : {}),
    },
  });

export const completeTengaAgentOwnerFollowUp = ({ appointmentId }) =>
  request(`/follow-ups/${encodeURIComponent(appointmentId)}/complete`, {
    method: "PATCH",
  });

export const rescheduleTengaAgentOwnerFollowUp = ({ appointmentId, followUpAt }) =>
  request(`/follow-ups/${encodeURIComponent(appointmentId)}/reschedule`, {
    method: "PATCH",
    body: { followUpAt },
  });
