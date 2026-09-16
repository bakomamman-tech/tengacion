const Agent = require("../../models/tengaAgent/Agent");
const {
  OWNER_AGENT_KEY,
  findOwnerWorkspace,
} = require("./ownerWorkspaceService");

const SUPPORTED_OWNER_TOOLS = new Set([
  "lead_capture",
  "appointment_requests",
]);

const cleanText = (value, max) =>
  String(value || "").trim().slice(0, max);

const normalizeLanguages = (value) => {
  if (!Array.isArray(value)) {
    throw new Error("Agent languages must be an array.");
  }

  const languages = Array.from(
    new Set(
      value
        .map((entry) => cleanText(entry, 40))
        .filter(Boolean)
    )
  ).slice(0, 8);

  if (languages.length === 0) {
    throw new Error("Add at least one agent language.");
  }

  return languages;
};

const normalizeTools = (value) => {
  if (!Array.isArray(value)) {
    throw new Error("Enabled tools must be an array.");
  }

  const normalized = Array.from(
    new Set(
      value
        .map((entry) => cleanText(entry, 80).toLowerCase())
        .filter(Boolean)
    )
  );

  const unsupported = normalized.filter(
    (entry) => !SUPPORTED_OWNER_TOOLS.has(entry)
  );

  if (unsupported.length > 0) {
    throw new Error("Unsupported TengaAgent tool.");
  }

  return normalized;
};

const ensureOwnerAgent = async (organization) =>
  Agent.findOneAndUpdate(
    {
      organizationId: organization._id,
      key: OWNER_AGENT_KEY,
    },
    {
      $setOnInsert: {
        organizationId: organization._id,
        key: OWNER_AGENT_KEY,
        name: "TengaAgent",
        role: "AI Receptionist",
        greeting: "Hi! How can I help you today?",
        tone: "friendly-professional",
        languages: ["English"],
        enabledTools: [],
        isPublicDemo: false,
        status: "draft",
        systemInstructions:
          "Represent this business accurately. Use only approved business knowledge. Never invent prices, policies, credentials, guarantees, or capabilities.",
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

const getOwnerAgent = async (workspace) =>
  workspace.agent || ensureOwnerAgent(workspace.organization);

const setOwnerAgentPublicationPreservingTools = async ({
  userId,
  published,
}) => {
  const workspace = await findOwnerWorkspace(userId);

  if (!workspace) {
    return null;
  }

  const agent = await getOwnerAgent(workspace);

  agent.status = published
    ? "active"
    : agent.status === "draft"
      ? "draft"
      : "paused";

  await agent.save();

  return {
    organization: workspace.organization,
    agent,
  };
};

const updateOwnerAgentConfiguration = async ({
  userId,
  name,
  role,
  greeting,
  tone,
  languages,
  systemInstructions,
  enabledTools,
}) => {
  const workspace = await findOwnerWorkspace(userId);

  if (!workspace) {
    return null;
  }

  const agent = await getOwnerAgent(workspace);
  const wasPublished = agent.status === "active";

  if (typeof name === "string") {
    const value = cleanText(name, 120);
    if (!value) {
      throw new Error("Agent name is required.");
    }
    agent.name = value;
  }

  if (typeof role === "string") {
    const value = cleanText(role, 160);
    if (!value) {
      throw new Error("Agent role is required.");
    }
    agent.role = value;
  }

  if (typeof greeting === "string") {
    const value = cleanText(greeting, 600);
    if (!value) {
      throw new Error("Agent greeting is required.");
    }
    agent.greeting = value;
  }

  if (typeof tone === "string") {
    const value = cleanText(tone, 80);
    if (!value) {
      throw new Error("Agent tone is required.");
    }
    agent.tone = value;
  }

  if (languages !== undefined) {
    agent.languages = normalizeLanguages(languages);
  }

  if (typeof systemInstructions === "string") {
    agent.systemInstructions = cleanText(
      systemInstructions,
      12000
    );
  }

  if (enabledTools !== undefined) {
    agent.enabledTools = normalizeTools(enabledTools);
  }

  if (wasPublished) {
    agent.status = "paused";
  }

  await agent.save();

  return {
    organization: workspace.organization,
    agent,
    publicationPaused: wasPublished,
  };
};

module.exports = {
  SUPPORTED_OWNER_TOOLS,
  normalizeLanguages,
  normalizeTools,
  setOwnerAgentPublicationPreservingTools,
  updateOwnerAgentConfiguration,
};
