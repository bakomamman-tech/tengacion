const { config } = require("../../config/env");
const Organization = require("../../models/tengaAgent/Organization");
const Agent = require("../../models/tengaAgent/Agent");
const WhatsAppConnection = require("../../models/tengaAgent/WhatsAppConnection");
const CalendarConnection = require("../../models/tengaAgent/CalendarConnection");
const { getBillingSummary } = require("./billingService");

const hasValue = (value) => String(value || "").trim().length > 0;

const getEnvStatus = () => {
  const checks = {
    core: {
      mongo: hasValue(process.env.MONGO_URI || config.MONGO_URI),
      jwt: hasValue(process.env.JWT_SECRET || config.JWT_SECRET),
      jwtRefresh: hasValue(process.env.JWT_REFRESH_SECRET || config.JWT_REFRESH_SECRET),
      authChallenge: hasValue(process.env.AUTH_CHALLENGE_SECRET || config.AUTH_CHALLENGE_SECRET),
      openai: hasValue(process.env.OPENAI_API_KEY),
    },
    whatsapp: {
      verifyToken: hasValue(process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN),
      appSecret: hasValue(process.env.TENGAAGENT_WHATSAPP_APP_SECRET),
      accessToken: hasValue(process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN),
      graphVersion: /^v\d+\.\d+$/.test(
        String(process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION || "").trim()
      ),
      autoReplyEnabled:
        String(process.env.TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED || "")
          .trim()
          .toLowerCase() === "true",
      voiceEnabled:
        String(process.env.TENGAAGENT_WHATSAPP_VOICE_ENABLED || "")
          .trim()
          .toLowerCase() === "true",
    },
    calendar: {
      encryptionKey: hasValue(process.env.TENGAAGENT_CALENDAR_ENCRYPTION_KEY),
      googleClientId: hasValue(process.env.GOOGLE_CALENDAR_CLIENT_ID),
      googleClientSecret: hasValue(process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
      microsoftClientId: hasValue(process.env.MICROSOFT_CALENDAR_CLIENT_ID),
      microsoftClientSecret: hasValue(process.env.MICROSOFT_CALENDAR_CLIENT_SECRET),
    },
  };

  return checks;
};

const summarizeEnv = (checks) => ({
  coreReady: Object.values(checks.core).every(Boolean),
  whatsappReady:
    checks.whatsapp.verifyToken &&
    checks.whatsapp.appSecret &&
    checks.whatsapp.accessToken &&
    checks.whatsapp.graphVersion,
  voiceReady:
    checks.whatsapp.voiceEnabled &&
    checks.whatsapp.accessToken &&
    checks.whatsapp.graphVersion &&
    checks.core.openai,
  googleCalendarReady:
    checks.calendar.encryptionKey &&
    checks.calendar.googleClientId &&
    checks.calendar.googleClientSecret,
  microsoftCalendarReady:
    checks.calendar.encryptionKey &&
    checks.calendar.microsoftClientId &&
    checks.calendar.microsoftClientSecret,
});

const getTenantPilotReadiness = async ({ organizationId }) => {
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    return null;
  }

  const [agents, whatsappConnections, calendarConnections, billing] =
    await Promise.all([
      Agent.find({
        organizationId: organization._id,
        status: { $in: ["active", "paused", "draft"] },
      }).lean(),
      WhatsAppConnection.find({
        organizationId: organization._id,
        status: "active",
      }).lean(),
      CalendarConnection.find({
        organizationId: organization._id,
        status: { $in: ["connected", "error"] },
      }).lean(),
      getBillingSummary(organization),
    ]);

  const env = getEnvStatus();
  const environment = summarizeEnv(env);
  const publishedAgentCount = agents.filter(
    (agent) => agent.status === "active"
  ).length;

  const checks = {
    workspace: true,
    subscription: Boolean(billing?.allowed),
    hasAgent: agents.length > 0,
    hasPublishedAgent: publishedAgentCount > 0,
    coreEnvironment: environment.coreReady,
    whatsappEnvironment: environment.whatsappReady,
    whatsappTenantConnection: whatsappConnections.length > 0,
    voiceEnvironment: environment.voiceReady,
  };

  return {
    organization: {
      id: organization._id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      status: organization.status,
    },
    billing,
    checks,
    environment,
    integrations: {
      activeWhatsAppConnections: whatsappConnections.length,
      calendarConnections: calendarConnections.map((connection) => ({
        provider: connection.provider,
        status: connection.status,
      })),
    },
    counts: {
      agents: agents.length,
      publishedAgents: publishedAgentCount,
    },
    pilotReady:
      checks.subscription &&
      checks.hasPublishedAgent &&
      checks.coreEnvironment,
    channelReady: {
      web:
        checks.subscription &&
        checks.hasPublishedAgent &&
        checks.coreEnvironment,
      whatsapp:
        checks.subscription &&
        checks.hasPublishedAgent &&
        checks.whatsappEnvironment &&
        checks.whatsappTenantConnection,
      voiceNotes:
        checks.subscription &&
        checks.hasPublishedAgent &&
        checks.whatsappEnvironment &&
        checks.whatsappTenantConnection &&
        checks.voiceEnvironment,
    },
  };
};

module.exports = {
  getEnvStatus,
  getTenantPilotReadiness,
  summarizeEnv,
};
