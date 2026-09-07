const Organization = require("../../models/tengaAgent/Organization");
const Agent = require("../../models/tengaAgent/Agent");

const CUSTOMER_ZERO_AGENT_KEY = "tengacion-demo";

const CUSTOMER_ZERO_ORGANIZATION = {
  name: "Tengacion Technologies Limited",
  slug: "tengacion",
  website: "https://tengacion.com",
  industry: "Technology and Software",
  countryCode: "NG",
  timezone: "Africa/Lagos",
  plan: "internal",
  status: "active",
};

const CUSTOMER_ZERO_AGENT = {
  key: CUSTOMER_ZERO_AGENT_KEY,
  name: "TengaAgent",
  role: "AI Receptionist",
  greeting:
    "Hi! I'm TengaAgent, Tengacion's AI receptionist. How can I help you today?",
  tone: "friendly-professional",
  languages: [
    "English",
    "Hausa",
    "Nigerian Pidgin",
  ],
  enabledTools: [],
  isPublicDemo: true,
  status: "active",
  systemInstructions:
    "Represent Tengacion accurately. Do not invent prices, guarantees, customers, credentials, or capabilities. Help visitors understand software, AI, web, mobile, and digital-product services. When exact project pricing is requested, explain that pricing depends on scope and invite the visitor to describe the project.",
};

async function ensureCustomerZeroAgent() {
  const organization =
    await Organization.findOneAndUpdate(
      {
        slug: CUSTOMER_ZERO_ORGANIZATION.slug,
      },
      {
        $set: CUSTOMER_ZERO_ORGANIZATION,
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

  const agent =
    await Agent.findOneAndUpdate(
      {
        organizationId: organization._id,
        key: CUSTOMER_ZERO_AGENT.key,
      },
      {
        $set: {
          ...CUSTOMER_ZERO_AGENT,
          organizationId: organization._id,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

  return {
    organization,
    agent,
  };
}

module.exports = {
  CUSTOMER_ZERO_AGENT_KEY,
  ensureCustomerZeroAgent,
};
