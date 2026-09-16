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
    throw new Error("TengaAgent returned an invalid response.");
  }
};

const request = async (
  path,
  { method = "GET", body } = {}
) => {
  const token = getSessionAccessToken();

  if (!token) {
    const error = new Error(
      "Please sign in to manage your TengaAgent workspace."
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
        "TengaAgent could not complete this owner request."
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

export const getTengaAgentOwnerKnowledge = () =>
  request("/knowledge");

export const saveTengaAgentOwnerKnowledge = ({
  type,
  title,
  text,
}) =>
  request("/knowledge", {
    method: "POST",
    body: { type, title, text },
  });

export const archiveTengaAgentOwnerKnowledgeSource = ({
  sourceId,
}) =>
  request(
    `/knowledge/${encodeURIComponent(sourceId)}`,
    { method: "DELETE" }
  );

export const importTengaAgentOwnerWebsite = ({
  url,
  title,
}) =>
  request("/knowledge/website", {
    method: "POST",
    body: { url, title },
  });

export const updateTengaAgentOwnerBusinessProfile = ({
  name,
  website,
  industry,
  countryCode,
  timezone,
}) =>
  request("/profile", {
    method: "PATCH",
    body: {
      name,
      website,
      industry,
      countryCode,
      timezone,
    },
  });

export const updateTengaAgentOwnerConfiguration = ({
  name,
  role,
  greeting,
  tone,
  languages,
  systemInstructions,
  enabledTools,
}) =>
  request("/agent/configuration", {
    method: "PATCH",
    body: {
      name,
      role,
      greeting,
      tone,
      languages,
      systemInstructions,
      enabledTools,
    },
  });
