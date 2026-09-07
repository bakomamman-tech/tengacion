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

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "TengaAgent could not complete the request."
    );
  }

  return data;
}
