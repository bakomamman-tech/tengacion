import { getSessionAccessToken } from "../authSession";
import { API_BASE } from "../config/apiBase";

const request = async (path, { method = "GET", body } = {}) => {
  const token = getSessionAccessToken();

  if (!token) {
    const error = new Error(
      "Please sign in to manage appointment outcomes."
    );
    error.status = 401;
    throw error;
  }

  const response = await fetch(
    `${API_BASE}/tengaagent/owner${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    }
  );

  const raw = await response.text();
  let data = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("TengaAgent returned an invalid outcome response.");
    }
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        "TengaAgent could not complete the outcome request."
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

export const getTengaAgentOwnerAppointmentOutcomes = ({
  limit = 100,
} = {}) =>
  request(
    `/appointment-outcomes?limit=${encodeURIComponent(limit)}`
  );

export const updateTengaAgentOwnerAppointmentOutcome = ({
  appointmentId,
  disposition,
  notes,
  followUpNeeded,
  followUpAt,
}) =>
  request(
    `/appointments/${encodeURIComponent(appointmentId)}/outcome`,
    {
      method: "PATCH",
      body: {
        disposition,
        notes,
        followUpNeeded,
        followUpAt,
      },
    }
  );
