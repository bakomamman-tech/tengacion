const { config } = require("../../config/env");
const Organization = require("../../models/tengaAgent/Organization");
const Agent = require("../../models/tengaAgent/Agent");
const WhatsAppConnection = require("../../models/tengaAgent/WhatsAppConnection");
const CalendarConnection = require("../../models/tengaAgent/CalendarConnection");
const { getBillingSummary } = require("./billingService");

const MIN_SECRET_LENGTH = 32;
const hasValue = (value) => String(value || "").trim().length > 0;
const hasStrongSecret = (value) =>
  String(value || "").trim().length >= MIN_SECRET_LENGTH;
const isGraphVersion = (value) =>
  /^v\d+\.\d+$/.test(String(value || "").trim());
const isPort = (value) => {
  const port = Number(String(value || "").trim());
  return Number.isInteger(port) && port > 0 && port <= 65535;
};

const makeRequirement = ({ key, configured, valid = configured }) => ({
  key,
  status: !configured ? "missing" : valid ? "configured" : "invalid",
});

const getEnvStatus = () => {
  const mongoValue = process.env.MONGO_URI || config.MONGO_URI;
  const jwtValue = process.env.JWT_SECRET || config.JWT_SECRET;
  const jwtRefreshValue =
    process.env.JWT_REFRESH_SECRET || config.JWT_REFRESH_SECRET;
  const authChallengeValue =
    process.env.AUTH_CHALLENGE_SECRET || config.AUTH_CHALLENGE_SECRET;
  const mediaSigningValue =
    process.env.MEDIA_SIGNING_SECRET || config.MEDIA_SIGNING_SECRET;
  const calendarKey = process.env.TENGAAGENT_CALENDAR_ENCRYPTION_KEY;
  const smtpPort = process.env.SMTP_PORT;

  return {
    core: {
      mongo: hasValue(mongoValue),
      jwt: hasStrongSecret(jwtValue),
      jwtRefresh: hasStrongSecret(jwtRefreshValue),
      authChallenge: hasStrongSecret(authChallengeValue),
      mediaSigning: hasStrongSecret(mediaSigningValue),
      openai: hasValue(process.env.OPENAI_API_KEY),
    },
    whatsapp: {
      verifyToken: hasValue(process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN),
      appSecret: hasValue(process.env.TENGAAGENT_WHATSAPP_APP_SECRET),
      accessToken: hasValue(process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN),
      graphVersion: isGraphVersion(
        process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION
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
      encryptionKey: hasStrongSecret(calendarKey),
      googleClientId: hasValue(process.env.GOOGLE_CALENDAR_CLIENT_ID),
      googleClientSecret: hasValue(process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
      microsoftClientId: hasValue(process.env.MICROSOFT_CALENDAR_CLIENT_ID),
      microsoftClientSecret: hasValue(process.env.MICROSOFT_CALENDAR_CLIENT_SECRET),
    },
    email: {
      host: hasValue(process.env.SMTP_HOST),
      port: isPort(smtpPort),
      user: hasValue(process.env.SMTP_USER),
      pass: hasValue(process.env.SMTP_PASS),
      from: hasValue(process.env.SMTP_FROM),
    },
  };
};

const getEnvironmentRequirements = () => {
  const reqs = {
    core: [
      makeRequirement({
        key: "MONGO_URI",
        configured: hasValue(process.env.MONGO_URI || config.MONGO_URI),
      }),
      makeRequirement({
        key: "JWT_SECRET",
        configured: hasValue(process.env.JWT_SECRET || config.JWT_SECRET),
        valid: hasStrongSecret(process.env.JWT_SECRET || config.JWT_SECRET),
      }),
      makeRequirement({
        key: "JWT_REFRESH_SECRET",
        configured: hasValue(
          process.env.JWT_REFRESH_SECRET || config.JWT_REFRESH_SECRET
        ),
        valid: hasStrongSecret(
          process.env.JWT_REFRESH_SECRET || config.JWT_REFRESH_SECRET
        ),
      }),
      makeRequirement({
        key: "AUTH_CHALLENGE_SECRET",
        configured: hasValue(
          process.env.AUTH_CHALLENGE_SECRET || config.AUTH_CHALLENGE_SECRET
        ),
        valid: hasStrongSecret(
          process.env.AUTH_CHALLENGE_SECRET || config.AUTH_CHALLENGE_SECRET
        ),
      }),
      makeRequirement({
        key: "MEDIA_SIGNING_SECRET",
        configured: hasValue(
          process.env.MEDIA_SIGNING_SECRET || config.MEDIA_SIGNING_SECRET
        ),
        valid: hasStrongSecret(
          process.env.MEDIA_SIGNING_SECRET || config.MEDIA_SIGNING_SECRET
        ),
      }),
      makeRequirement({
        key: "OPENAI_API_KEY",
        configured: hasValue(process.env.OPENAI_API_KEY),
      }),
    ],
    whatsapp: [
      makeRequirement({
        key: "TENGAAGENT_WHATSAPP_VERIFY_TOKEN",
        configured: hasValue(process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN),
      }),
      makeRequirement({
        key: "TENGAAGENT_WHATSAPP_APP_SECRET",
        configured: hasValue(process.env.TENGAAGENT_WHATSAPP_APP_SECRET),
      }),
      makeRequirement({
        key: "TENGAAGENT_WHATSAPP_ACCESS_TOKEN",
        configured: hasValue(process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN),
      }),
      makeRequirement({
        key: "TENGAAGENT_WHATSAPP_GRAPH_VERSION",
        configured: hasValue(process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION),
        valid: isGraphVersion(process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION),
      }),
      {
        key: "TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED",
        status:
          String(process.env.TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED || "")
            .trim()
            .toLowerCase() === "true"
            ? "configured"
            : "disabled",
      },
    ],
    voice: [
      {
        key: "TENGAAGENT_WHATSAPP_VOICE_ENABLED",
        status:
          String(process.env.TENGAAGENT_WHATSAPP_VOICE_ENABLED || "")
            .trim()
            .toLowerCase() === "true"
            ? "configured"
            : "disabled",
      },
      makeRequirement({
        key: "OPENAI_API_KEY",
        configured: hasValue(process.env.OPENAI_API_KEY),
      }),
    ],
    calendar: [
      makeRequirement({
        key: "TENGAAGENT_CALENDAR_ENCRYPTION_KEY",
        configured: hasValue(process.env.TENGAAGENT_CALENDAR_ENCRYPTION_KEY),
        valid: hasStrongSecret(process.env.TENGAAGENT_CALENDAR_ENCRYPTION_KEY),
      }),
      makeRequirement({
        key: "GOOGLE_CALENDAR_CLIENT_ID",
        configured: hasValue(process.env.GOOGLE_CALENDAR_CLIENT_ID),
      }),
      makeRequirement({
        key: "GOOGLE_CALENDAR_CLIENT_SECRET",
        configured: hasValue(process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
      }),
      makeRequirement({
        key: "MICROSOFT_CALENDAR_CLIENT_ID",
        configured: hasValue(process.env.MICROSOFT_CALENDAR_CLIENT_ID),
      }),
      makeRequirement({
        key: "MICROSOFT_CALENDAR_CLIENT_SECRET",
        configured: hasValue(process.env.MICROSOFT_CALENDAR_CLIENT_SECRET),
      }),
    ],
    email: [
      makeRequirement({ key: "SMTP_HOST", configured: hasValue(process.env.SMTP_HOST) }),
      makeRequirement({
        key: "SMTP_PORT",
        configured: hasValue(process.env.SMTP_PORT),
        valid: isPort(process.env.SMTP_PORT),
      }),
      makeRequirement({ key: "SMTP_USER", configured: hasValue(process.env.SMTP_USER) }),
      makeRequirement({ key: "SMTP_PASS", configured: hasValue(process.env.SMTP_PASS) }),
      makeRequirement({ key: "SMTP_FROM", configured: hasValue(process.env.SMTP_FROM) }),
    ],
  };

  return reqs;
};

const summarizeEnv = (checks) => ({
  coreReady: Object.values(checks.core).every(Boolean),
  whatsappReady:
    checks.whatsapp.verifyToken &&
    checks.whatsapp.appSecret &&
    checks.whatsapp.accessToken &&
    checks.whatsapp.graphVersion &&
    checks.whatsapp.autoReplyEnabled,
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
  emailReady: Object.values(checks.email).every(Boolean),
});

const getTenantPilotReadiness = async ({ organizationId }) => {
  const organization = await Organization.findById(organizationId);
  if (!organization) return null;

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
  const requirements = getEnvironmentRequirements();
  const publishedAgentCount = agents.filter(
    (agent) => agent.status === "active"
  ).length;
  const whatsappEntitled = Boolean(billing?.entitlements?.whatsapp);
  const voiceEntitled = Boolean(billing?.entitlements?.voice);

  if (!whatsappEntitled) {
    requirements.whatsapp = requirements.whatsapp.map((entry) => ({
      ...entry,
      status: "not_in_plan",
    }));
  }
  if (!voiceEntitled) {
    requirements.voice = requirements.voice.map((entry) => ({
      ...entry,
      status: "not_in_plan",
    }));
  }

  const checks = {
    workspace: true,
    subscription: Boolean(billing?.allowed),
    hasAgent: agents.length > 0,
    hasPublishedAgent: publishedAgentCount > 0,
    coreEnvironment: environment.coreReady,
    whatsappEnvironment: whatsappEntitled && environment.whatsappReady,
    whatsappTenantConnection:
      whatsappEntitled && whatsappConnections.length > 0,
    voiceEnvironment: voiceEntitled && environment.voiceReady,
    emailEnvironment: environment.emailReady,
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
    requirements,
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
  MIN_SECRET_LENGTH,
  getEnvStatus,
  getEnvironmentRequirements,
  getTenantPilotReadiness,
  summarizeEnv,
};
