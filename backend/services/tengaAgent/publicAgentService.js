const Organization = require("../../models/tengaAgent/Organization");
const Agent = require("../../models/tengaAgent/Agent");

const {
  respondToAgent,
  wantsHumanFollowUp,
} = require("./agentRuntimeService");

const cleanKey = (value, max = 120) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, max);

const wantsAppointmentRequest = (value) => {
  const input = cleanKey(value, 2000);

  return [
    "appointment",
    "book a meeting",
    "book meeting",
    "book a call",
    "schedule a call",
    "schedule call",
    "schedule a meeting",
    "schedule meeting",
    "set up a meeting",
    "arrange a meeting",
    "meeting time",
  ].some((phrase) => input.includes(phrase));
};

const buildOrganizationBaseline = (organization) => {
  const lines = [
    `Business name: ${organization.name}.`,
  ];

  if (organization.industry) {
    lines.push(`Industry: ${organization.industry}.`);
  }

  if (organization.website) {
    lines.push(`Website: ${organization.website}.`);
  }

  if (organization.countryCode) {
    lines.push(`Country code: ${organization.countryCode}.`);
  }

  if (organization.timezone) {
    lines.push(`Business timezone: ${organization.timezone}.`);
  }

  return lines.join("\n");
};

const resolvePublishedAgent = async ({
  organizationSlug,
  agentKey,
}) => {
  const slug = cleanKey(organizationSlug, 100);
  const key = cleanKey(agentKey, 120);

  if (!slug || !key) {
    return null;
  }

  const organization = await Organization.findOne({
    slug,
    status: { $in: ["pilot", "active"] },
  });

  if (!organization) {
    return null;
  }

  const agent = await Agent.findOne({
    organizationId: organization._id,
    key,
    status: "active",
  });

  if (!agent) {
    return null;
  }

  return { organization, agent };
};

const buildPublicActions = ({
  message,
  agent,
}) => {
  const enabledTools = new Set(
    Array.isArray(agent?.enabledTools)
      ? agent.enabledTools
      : []
  );

  if (
    enabledTools.has("appointment_requests") &&
    wantsAppointmentRequest(message)
  ) {
    return [
      {
        type: "book_appointment",
        label: "Request a meeting time",
      },
    ];
  }

  if (
    enabledTools.has("lead_capture") &&
    wantsHumanFollowUp(message)
  ) {
    return [
      {
        type: "capture_lead",
        label: "Leave your details",
      },
    ];
  }

  return [];
};

const respondToPublishedAgent = async ({
  organization,
  agent,
  message,
  conversationHistory = [],
}) => {
  const actions = buildPublicActions({
    message,
    agent,
  });

  if (actions[0]?.type === "book_appointment") {
    return {
      reply:
        `I can help you request a meeting time with ${organization.name}. Choose a preferred date and time below; the appointment is not confirmed until the business approves it.`,
      actions,
    };
  }

  if (actions[0]?.type === "capture_lead") {
    return {
      reply:
        `I can help you connect with ${organization.name}. Use the contact option below to leave your details and a short summary of what you need.`,
      actions,
    };
  }

  const result = await respondToAgent({
    message,
    organizationId: organization._id,
    agentId: agent._id,
    organizationName: organization.name,
    agentName: agent.name,
    agentRole: agent.role,
    agentInstructions: agent.systemInstructions,
    baselineKnowledge: buildOrganizationBaseline(
      organization
    ),
    conversationHistory,
  });

  return {
    ...result,
    actions,
  };
};

module.exports = {
  buildOrganizationBaseline,
  buildPublicActions,
  resolvePublishedAgent,
  respondToPublishedAgent,
  wantsAppointmentRequest,
};
