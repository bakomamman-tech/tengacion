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
    throw new Error(
      data?.message ||
        data?.error ||
        fallbackMessage
    );
  }

  return data;
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
