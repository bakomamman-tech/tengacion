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
      data?.message || data?.error || fallbackMessage
    );

    error.status = response.status;
    throw error;
  }

  return data;
};

const ownerRequest = async (
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

  return assertOk(
    response,
    data,
    "TengaAgent could not complete the owner request."
  );
};

const publicAgentRequest = async (
  organizationSlug,
  agentKey,
  suffix = "",
  { method = "GET", body } = {}
) => {
  const base =
    `${API_BASE}/tengaagent/public/${encodeURIComponent(
      organizationSlug
    )}/${encodeURIComponent(agentKey)}`;

  const response = await fetch(
    `${base}${suffix}`,
    {
      method,
      headers:
        body !== undefined
          ? { "Content-Type": "application/json" }
          : undefined,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    }
  );

  const data = await parseJson(response);

  return assertOk(
    response,
    data,
    "This public TengaAgent request could not be completed."
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

export async function submitTengaAgentAppointment({
  agentId = "tengacion-demo",
  sessionId,
  name,
  email,
  phone,
  company,
  purpose,
  notes,
  preferredStartAt,
  timezone,
  durationMinutes,
  consentToContact,
}) {
  const response = await fetch(
    `${API_BASE}/tengaagent/chat/${encodeURIComponent(agentId)}/appointment`,
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
        purpose,
        notes,
        preferredStartAt,
        timezone,
        durationMinutes,
        consentToContact,
      }),
    }
  );

  const data = await parseJson(response);

  return assertOk(
    response,
    data,
    "TengaAgent could not save your appointment request."
  );
}

export const getPublicTengaAgent = ({
  organizationSlug,
  agentKey,
}) =>
  publicAgentRequest(
    organizationSlug,
    agentKey
  );

export const getPublicTengaAgentConversation = ({
  organizationSlug,
  agentKey,
  sessionId,
}) =>
  publicAgentRequest(
    organizationSlug,
    agentKey,
    `/conversation?sessionId=${encodeURIComponent(sessionId)}`
  );

export const getPublicTengaAgentAvailability = ({
  organizationSlug,
  agentKey,
  durationMinutes = 30,
  from,
  to,
}) => {
  const params = new URLSearchParams();
  params.set("durationMinutes", String(durationMinutes));

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

  return publicAgentRequest(
    organizationSlug,
    agentKey,
    `/availability?${params.toString()}`
  );
};

export const sendPublicTengaAgentMessage = ({
  organizationSlug,
  agentKey,
  message,
  sessionId,
}) =>
  publicAgentRequest(
    organizationSlug,
    agentKey,
    "/message",
    {
      method: "POST",
      body: { message, sessionId },
    }
  );

export const submitPublicTengaAgentLead = ({
  organizationSlug,
  agentKey,
  sessionId,
  ...lead
}) =>
  publicAgentRequest(
    organizationSlug,
    agentKey,
    "/lead",
    {
      method: "POST",
      body: { sessionId, ...lead },
    }
  );

export const submitPublicTengaAgentAppointment = ({
  organizationSlug,
  agentKey,
  sessionId,
  ...appointment
}) =>
  publicAgentRequest(
    organizationSlug,
    agentKey,
    "/appointment",
    {
      method: "POST",
      body: {
        sessionId,
        ...appointment,
      },
    }
  );

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

export const setTengaAgentOwnerPublication = ({
  published,
}) =>
  ownerRequest("/agent/publication", {
    method: "PATCH",
    body: { published },
  });

export const getTengaAgentOwnerAvailability = () =>
  ownerRequest("/availability");

export const saveTengaAgentOwnerAvailability = (
  schedule
) =>
  ownerRequest("/availability", {
    method: "PUT",
    body: schedule,
  });

export const getTengaAgentOwnerLeads = ({
  limit = 50,
} = {}) =>
  ownerRequest(
    `/leads?limit=${encodeURIComponent(limit)}`
  );

export const updateTengaAgentOwnerLeadStatus = ({
  leadId,
  status,
}) =>
  ownerRequest(
    `/leads/${encodeURIComponent(leadId)}/status`,
    {
      method: "PATCH",
      body: { status },
    }
  );

export const getTengaAgentOwnerAppointments = ({
  limit = 50,
} = {}) =>
  ownerRequest(
    `/appointments?limit=${encodeURIComponent(limit)}`
  );

export const rescheduleTengaAgentOwnerAppointment = ({
  appointmentId,
  preferredStartAt,
  timezone,
  durationMinutes,
}) =>
  ownerRequest(
    `/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
    {
      method: "PATCH",
      body: {
        preferredStartAt,
        timezone,
        durationMinutes,
      },
    }
  );

export const updateTengaAgentOwnerAppointmentStatus = ({
  appointmentId,
  status,
}) =>
  ownerRequest(
    `/appointments/${encodeURIComponent(appointmentId)}/status`,
    {
      method: "PATCH",
      body: { status },
    }
  );

export const getTengaAgentOwnerConversations = ({
  status = "all",
  limit = 50,
} = {}) =>
  ownerRequest(
    `/conversations?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(limit)}`
  );

export const getTengaAgentOwnerConversation = ({
  conversationId,
}) =>
  ownerRequest(
    `/conversations/${encodeURIComponent(conversationId)}`
  );

export const updateTengaAgentOwnerConversationAction = ({
  conversationId,
  action,
}) =>
  ownerRequest(
    `/conversations/${encodeURIComponent(conversationId)}/action`,
    {
      method: "PATCH",
      body: { action },
    }
  );

export const sendTengaAgentOwnerHumanMessage = ({
  conversationId,
  content,
}) =>
  ownerRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: { content },
    }
  );

// Pilot-only, read-only demo owner access. The backend enforces the owner claim.
const pilotDemoRequest = async (path, { method = "GET", body } = {}) => {
  const token = getSessionAccessToken();
  if (!token) throw new Error("Please sign in to access the pilot owner inbox.");
  const response = await fetch(API_BASE + "/tengaagent/owner/pilot-demo" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  return assertOk(response, await parseJson(response), "Pilot owner request failed.");
};
export const getTengaAgentPilotOwnerStatus = () => pilotDemoRequest("/status");
export const claimTengaAgentPilotDemo = (claimSecret) =>
  pilotDemoRequest("/claim", { method: "POST", body: { claimSecret } });
export const getTengaAgentPilotLeads = () => pilotDemoRequest("/leads");
export const getTengaAgentPilotAppointments = () => pilotDemoRequest("/appointments");
