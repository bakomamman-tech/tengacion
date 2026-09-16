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

const assertOk = (
  response,
  data,
  fallbackMessage
) => {
  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        fallbackMessage
    );

    error.status = response.status;
    throw error;
  }

  return data;
};

const ownerRequest = async (
  path,
  {
    method = "GET",
    body,
  } = {}
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
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
      },
      ...(body !== undefined
        ? {
            body: JSON.stringify(body),
          }
        : {}),
    }
  );

  const data = await parseJson(response);

  return assertOk(
    response,
    data,
    "TengaAgent could not complete the owner request."
  );
};

export async function sendTengaAgentMessage({
  agentId = "tengacion-demo",
  message,
  sessionId,
}) {
  const response = await fetch(
    `${API_BASE}/tengaagent/chat/${encodeURIComponent(agentId)}/message`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        sessionId,
      }),
    }
  );

  const data = await parseJson(response);

  return assertOk(
    response,
    data,
    "TengaAgent could not complete the request."
  );
}

export async function submitTengaAgentLead({
  agentId = "tengacion-demo",
  sessionId,
  name,
  email,
  phone,
  company,
  projectSummary,
  consentToContact,
}) {
  const response = await fetch(
    `${API_BASE}/tengaagent/chat/${encodeURIComponent(agentId)}/lead`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        name,
        email,
        phone,
        company,
        projectSummary,
        consentToContact,
      }),
    }
  );

  const data = await parseJson(response);

  return assertOk(
    response,
    data,
    "TengaAgent could not save your contact details."
  );
}

export const getTengaAgentOwnerWorkspace = () =>
  ownerRequest("/workspace");

export const saveTengaAgentOwnerWorkspace = ({
  name,
  website,
  industry,
  countryCode = "NG",
  timezone = "Africa/Lagos",
}) =>
  ownerRequest("/workspace", {
    method: "POST",
    body: {
      name,
      website,
      industry,
      countryCode,
      timezone,
    },
  });

export const getTengaAgentOwnerLeads = ({
  limit = 50,
} = {}) =>
  ownerRequest(
    `/leads?limit=${encodeURIComponent(limit)}`
  );
