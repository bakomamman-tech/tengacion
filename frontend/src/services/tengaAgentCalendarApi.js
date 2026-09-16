import { getSessionAccessToken } from "../authSession";
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
      "TengaAgent calendar integration returned an invalid response."
    );
  }
};

const ownerCalendarRequest = async (
  path,
  { method = "GET", body } = {}
) => {
  const token = getSessionAccessToken();

  if (!token) {
    const error = new Error(
      "Please sign in to manage calendar connections."
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

  const data = await parseJson(response);

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        "TengaAgent calendar request failed."
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

export const getTengaAgentCalendarConnections = () =>
  ownerCalendarRequest("/calendar-connections");

export const startTengaAgentCalendarConnection = (
  provider
) =>
  ownerCalendarRequest(
    `/calendar-connections/${encodeURIComponent(
      provider
    )}/connect`,
    {
      method: "POST",
    }
  );

export const completeTengaAgentCalendarConnection = ({
  code,
  state,
  error,
}) =>
  ownerCalendarRequest(
    "/calendar-connections/oauth/complete",
    {
      method: "POST",
      body: {
        code,
        state,
        error,
      },
    }
  );

export const disconnectTengaAgentCalendarConnection = (
  provider
) =>
  ownerCalendarRequest(
    `/calendar-connections/${encodeURIComponent(
      provider
    )}`,
    {
      method: "DELETE",
    }
  );
