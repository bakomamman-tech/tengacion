import { API_BASE } from "../config/apiBase";

const parseJson = async (response) => {
  const raw = await response.text();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      "TengaAgent returned an invalid appointment response."
    );
  }
};

const requestAppointment = async ({
  organizationSlug,
  agentKey,
  suffix = "",
  method = "GET",
  body,
}) => {
  const base = `${API_BASE}/tengaagent/public/${encodeURIComponent(
    organizationSlug
  )}/${encodeURIComponent(agentKey)}/appointment`;
  const response = await fetch(`${base}${suffix}`, {
    method,
    headers:
      body !== undefined
        ? { "Content-Type": "application/json" }
        : undefined,
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });
  const data = await parseJson(response);

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        "Your appointment request could not be completed."
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

export const getPublicSessionAppointment = ({
  organizationSlug,
  agentKey,
  sessionId,
}) =>
  requestAppointment({
    organizationSlug,
    agentKey,
    suffix: `?sessionId=${encodeURIComponent(sessionId)}`,
  });

export const reschedulePublicSessionAppointment = ({
  organizationSlug,
  agentKey,
  sessionId,
  preferredStartAt,
  timezone,
  durationMinutes,
}) =>
  requestAppointment({
    organizationSlug,
    agentKey,
    suffix: "/reschedule",
    method: "PATCH",
    body: {
      sessionId,
      preferredStartAt,
      timezone,
      durationMinutes,
    },
  });

export const cancelPublicSessionAppointment = ({
  organizationSlug,
  agentKey,
  sessionId,
}) =>
  requestAppointment({
    organizationSlug,
    agentKey,
    suffix: "/cancel",
    method: "PATCH",
    body: { sessionId },
  });
