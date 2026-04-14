const crypto = require("crypto");
const CreatorProfile = require("../../models/CreatorProfile");
const { runAkusoChatRequest } = require("../../controllers/akusoController");
const { buildCreatorDiscoveryDirectory } = require("../creatorDiscoveryService");
const { detectPromptInjectionAttempt } = require("../akusoClassifierService");
const { loadAkusoMemory } = require("../akusoMemoryService");
const { searchHelpArticles } = require("./helpDocs");
const { searchKnowledgeArticles } = require("./knowledgeBase");
const {
  assistantResponseSchema,
} = require("./schemas");
const { makeAssistantResponse } = require("./responseFactory");
const {
  findFeatureByIntent,
  findFeatureByRoute,
} = require("./featureRegistry");
const { buildAssistantSources, buildAssistantTrust } = require("./trustSignals");
const { getQuickLinksTool } = require("./tools/summaries");
const { sanitizePlainText } = require("./outputSanitizer");

const ADMIN_ROLES = new Set([
  "admin",
  "super_admin",
  "moderator",
  "trust_safety_admin",
]);

const GREETING_PATTERNS = [
  /^(hi|hello|hey|yo|gm)\b/i,
  /^good (morning|afternoon|evening)\b/i,
  /(?:^|\s)(hi|hello|hey)\s+akuso\b/i,
  /(?:^|\s)good (morning|afternoon|evening)\s+akuso\b/i,
];

const FOLLOW_UP_PATTERNS = [
  /^(open|show|go to|take me to|take me|bring up|open up)\s+(it|that|there|this|the page|the screen)\b/i,
  /^(show me that|open that again|take me there|show it again)\b/i,
  /^(take me back|go back|return)\b/i,
  /^(open the last one|open the previous one)\b/i,
];

const safeText = (value = "", max = 180) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const detectGreetingIntent = (message = "") =>
  GREETING_PATTERNS.some((pattern) => pattern.test(String(message || "").trim()));

const isFollowUpMessage = (message = "") =>
  FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(String(message || "").trim()));

const mapLegacyModeHintToAkuso = (value = "") => {
  const hint = String(value || "").trim().toLowerCase();
  if (["write", "writing", "copy", "caption"].includes(hint)) {
    return "creator_writing";
  }
  if (["copilot", "app"].includes(hint)) {
    return "app_help";
  }
  return "auto";
};

const mapLegacyPreferencesToAkuso = (value = {}) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const length = String(source.length || "").trim().toLowerCase();
  return {
    answerLength: length === "long" ? "detailed" : length === "short" ? "short" : "medium",
    tone: safeText(source.tone || "", 40),
    preferredMode: "",
    creatorStyle: safeText(source.simplicity || "", 40),
    audience: safeText(source.audience || "", 40),
    language: safeText(source.language || "", 40),
  };
};

const mapAkusoModeToAssistant = ({
  akusoMode = "",
  category = "",
  assistantModeHint = "",
  message = "",
} = {}) => {
  const hint = String(assistantModeHint || "").trim().toLowerCase();
  const text = String(message || "").trim().toLowerCase();

  if (category === "EMERGENCY_ESCALATION") return "emergency";
  if (["DISALLOWED", "PROMPT_INJECTION_ATTEMPT"].includes(category)) return "refusal";
  if (akusoMode === "app_help") return "copilot";
  if (akusoMode === "creator_writing") return "writing";
  if (hint === "math" || /\bsolve\b|\bcalculate\b|\bstep by step\b/.test(text)) return "math";
  if (hint === "health") return "health";
  return "knowledge";
};

const buildSafetyFromAkuso = (body = {}) => {
  const category = String(body?.category || "").trim();
  const warnings = Array.isArray(body?.warnings) ? body.warnings.filter(Boolean) : [];
  const firstWarning = warnings[0] || "";

  if (category === "EMERGENCY_ESCALATION") {
    return {
      level: "emergency",
      notice: safeText(firstWarning || "This request needs urgent real-world escalation.", 500),
      escalation: "Contact emergency care or a licensed clinician immediately.",
    };
  }
  if (["DISALLOWED", "PROMPT_INJECTION_ATTEMPT"].includes(category)) {
    return {
      level: "refusal",
      notice: safeText(firstWarning || body.answer || "Akuso refused this request safely.", 500),
      escalation: "",
    };
  }
  if (category === "SENSITIVE_ACTION_REQUIRES_AUTH" || category === "SAFE_WITH_CAUTION" || warnings.length) {
    return {
      level: "caution",
      notice: safeText(firstWarning || "Akuso handled this request with caution.", 500),
      escalation: "",
    };
  }

  return {
    level: "safe",
    notice: "",
    escalation: "",
  };
};

const inferDiscoveryCategory = (message = "") => {
  const text = String(message || "").trim().toLowerCase();
  if (/\b(book|books|author|authors|reading|publish)\b/.test(text)) return "books";
  if (/\b(podcast|podcasts|episode|host|hosts)\b/.test(text)) return "podcasts";
  return "music";
};

const isCreatorDiscoveryQuery = (message = "") =>
  /\b(find|search|discover)\b/i.test(message) &&
  /\b(creators?|artists?|authors?|hosts?)\b/i.test(message);

const extractDiscoverySearch = (message = "") =>
  safeText(
    String(message || "")
      .replace(/^(please\s+)?(find|search for|search|discover)\b[:\s-]*/i, "")
      .replace(/\b(creators?|artists?|authors?|hosts?)\b/gi, "")
      .trim(),
    120
  );

const isCapabilityQuestion = (message = "") =>
  /\bwhat can i do here\b/i.test(message) ||
  /\bwhat are my options\b/i.test(message) ||
  /\bhow does this work\b/i.test(message);

const requiresSensitiveMessageConfirmation = (message = "") =>
  /\b(send|message|dm)\b/i.test(message) &&
  (/\bautomatically\b/i.test(message) || /\bfor me\b/i.test(message));

const inferSensitivePendingRoute = ({ message = "", feature = null } = {}) => {
  const text = String(message || "").trim().toLowerCase();
  if (/\b(message|messages|chat|dm|inbox)\b/.test(text)) return "/messages";
  if (/\b(withdraw|withdrawal|payout|bank)\b/.test(text)) return "/creator/payouts";
  if (/\b(earnings|balance|revenue)\b/.test(text)) return "/creator/earnings";
  if (/\b(password|security|otp|token|session)\b/.test(text)) return "/settings/security";
  if (/\b(privacy|visibility)\b/.test(text)) return "/settings/privacy";
  return String(feature?.route || "").trim();
};

const inferSensitivePendingLabel = (route = "") => {
  if (route === "/messages") return "Messages";
  if (route === "/creator/payouts") return "Payouts";
  if (route === "/creator/earnings") return "Earnings";
  if (route === "/settings/security") return "Security settings";
  if (route === "/settings/privacy") return "Privacy settings";
  return "Secure page";
};

const buildLegacySources = ({ message = "", akusoBody = {}, assistantMode = "", feature = null }) => {
  const isKnowledgeMode = assistantMode === "knowledge";
  const retrieved = {
    feature:
      assistantMode === "copilot"
        ? feature
        : null,
    helpArticles:
      assistantMode === "copilot"
        ? searchHelpArticles(message || feature?.title || "", { limit: 2 })
        : [],
    knowledgeArticles: isKnowledgeMode ? searchKnowledgeArticles(message, { limit: 2 }) : [],
  };

  const sources = buildAssistantSources({
    retrieved,
    usedModel: Boolean(akusoBody?.meta?.usedModel),
    provider: akusoBody?.meta?.provider || "local-fallback",
  });

  return {
    retrieved,
    sources,
  };
};

const buildDraftCards = (drafts = [], assistantMode = "writing") =>
  (Array.isArray(drafts) ? drafts : [])
    .filter(Boolean)
    .slice(0, 3)
    .map((draft, index) => ({
      type: "draft",
      title: `Draft ${index + 1}`,
      subtitle: assistantMode === "writing" ? "Creator writing" : "Akuso draft",
      description: safeText(draft, 500),
      route: "",
      payload: {
        text: safeText(draft, 500),
      },
    }));

const buildCreatorCards = async ({ req, user = {}, message = "" } = {}) => {
  const directory = await buildCreatorDiscoveryDirectory({
    viewerId: user?.id || "",
    category: inferDiscoveryCategory(message),
    search: extractDiscoverySearch(message) || message,
    sort: "popular",
    page: 1,
    limit: 4,
  });

  return (directory?.items || []).slice(0, 4).map((item) => ({
    type: "creator",
    title: safeText(item.name || "Creator", 120),
    subtitle: safeText(
      item.username ? `@${item.username}` : (item.categoryLabels || []).join(" • ") || "Creator",
      200
    ),
    description: safeText(item.bio || "A creator on Tengacion.", 500),
    route: safeText(item.route || item.creatorRoute || "", 160),
    payload: {
      creatorId: safeText(item.creatorId || "", 80),
      userId: safeText(item.userId || "", 80),
      username: safeText(item.username || "", 80),
      category: safeText(item.category || "", 40),
    },
  }));
};

const buildQuickLinkCards = async ({ user = {}, context = {} } = {}) => {
  const result = await getQuickLinksTool.handler(
    {},
    {
      user,
      assistantContext: {
        currentPath: context.currentPath || "",
        surface: context.surface || "",
      },
    }
  );
  return {
    message: safeText(result?.message || "", 240),
    cards: Array.isArray(result?.cards) ? result.cards.slice(0, 6) : [],
  };
};

const buildGreetingResponse = async ({ user = {}, context = {}, conversationId = "", traceId = "", message = "" } = {}) => {
  const salutation = /good morning/i.test(message)
    ? "Good morning"
    : /good afternoon/i.test(message)
      ? "Good afternoon"
      : /good evening/i.test(message)
        ? "Good evening"
        : "Hi";
  const quickLinks = await buildQuickLinkCards({ user, context });
  const response = makeAssistantResponse({
    responseId: traceId,
    message: `${salutation}. I'm Akuso. I can help you move around Tengacion, explain features, find creators, draft copy, and answer safe knowledge questions.`,
    mode: "general",
    cards: [],
    followUps: quickLinks.cards.slice(0, 4).map((card) => ({
      label: card.title,
      prompt: `Open ${card.title}`,
      kind: "prompt",
      route: "",
    })),
    conversationId,
    confidence: 0.96,
  });

  return assistantResponseSchema.parse(response);
};

const buildSensitiveMessageResponse = ({
  conversationId = "",
  traceId = "",
} = {}) =>
  assistantResponseSchema.parse(
    makeAssistantResponse({
      responseId: traceId,
      message:
        "I can't send a message automatically for you, but I can open Messages so you can review and send it yourself.",
      mode: "copilot",
      safety: {
        level: "caution",
        notice: "Akuso will not send account or private messages on your behalf.",
        escalation: "",
      },
      trust: {
        provider: "local-fallback",
        mode: "app-aware",
        grounded: true,
        usedModel: false,
        confidenceLabel: "high",
        note: "Akuso kept this request inside a server-checked safety boundary.",
      },
      sources: [
        {
          id: "feature:messages",
          type: "feature_registry",
          label: "Messages",
          summary: "Open your inbox and continue chats.",
        },
      ],
      details: [
        {
          title: "Safe next step",
          body: "Open Messages and send the message yourself after reviewing the recipient and content.",
        },
      ],
      followUps: [
        {
          label: "Open Messages",
          prompt: "Open Messages",
          kind: "prompt",
          route: "",
        },
      ],
      actions: [],
      cards: [],
      requiresConfirmation: true,
      pendingAction: {
        type: "navigate",
        label: "Messages",
        description: "Open Messages so you can send the message yourself.",
        route: "/messages",
        payload: {},
      },
      conversationId,
      confidence: 0.94,
    })
  );

const enrichAssistantUser = async (user = {}) => {
  const role = safeText(user?.role || "user", 40).toLowerCase() || "user";
  const isCreator = user?.id
    ? Boolean(await CreatorProfile.exists({ userId: user.id }))
    : false;
  return {
    ...user,
    role,
    isCreator,
    isAdmin: Boolean(user?.isAdmin) || ADMIN_ROLES.has(role),
  };
};

const chat = async ({
  req = null,
  user = {},
  message = "",
  conversationId = "",
  pendingAction: _pendingAction = null,
  context = {},
  assistantModeHint = "",
  preferences = {},
} = {}) => {
  const traceId = crypto.randomUUID();
  const enrichedUser = await enrichAssistantUser(user);
  const currentRoute = safeText(context?.currentPath || "", 160);
  const currentPage = safeText(context?.pageTitle || "", 120);
  const priorMemory =
    isFollowUpMessage(message) && safeText(conversationId, 80)
      ? await loadAkusoMemory({
          userId: enrichedUser?.id || "",
          conversationId: safeText(conversationId, 80),
          sessionKey: safeText(enrichedUser?.sessionId || "", 80),
        }).catch(() => null)
      : null;

  if (detectGreetingIntent(message)) {
    return buildGreetingResponse({
      user: enrichedUser,
      context,
      conversationId,
      traceId,
      message,
    });
  }

  if (requiresSensitiveMessageConfirmation(message)) {
    return buildSensitiveMessageResponse({
      conversationId,
      traceId,
    });
  }

  const akusoInput = {
    message,
    mode: mapLegacyModeHintToAkuso(assistantModeHint),
    currentRoute,
    currentPage,
    contextHints: {
      surface: safeText(context?.surface || "", 60),
      pageTitle: currentPage,
      section: safeText(context?.currentSearch || "", 80),
      selectedEntity: safeText(context?.selectedChatId || context?.selectedContentId || "", 80),
      publicCreatorId: "",
    },
    preferences: mapLegacyPreferencesToAkuso(preferences),
    conversationId: safeText(conversationId, 80),
    sessionKey: safeText(enrichedUser?.sessionId || "", 80),
  };

  const akusoReq = {
    ...req,
    user: enrichedUser,
    akusoInput,
    akusoPromptGuard: detectPromptInjectionAttempt(message),
  };

  const result = await runAkusoChatRequest({
    req: akusoReq,
    traceId,
  });
  const body = result?.body || {};
  const assistantMode = mapAkusoModeToAssistant({
    akusoMode: body.mode,
    category: body.category,
    assistantModeHint,
    message,
  });

  const legacyFeature =
    findFeatureByIntent(message, {
      access: enrichedUser.isAdmin ? "admin" : enrichedUser.isCreator ? "creator" : "authenticated",
    }) ||
    findFeatureByRoute(currentRoute) ||
    null;

  const { sources } = buildLegacySources({
    message,
    akusoBody: body,
    assistantMode,
    feature: legacyFeature,
  });

  let cards = [];
  if (assistantMode === "writing") {
    cards = buildDraftCards(body.drafts, assistantMode);
  } else if (isCreatorDiscoveryQuery(message)) {
    cards = await buildCreatorCards({ req, user: enrichedUser, message });
  } else if (isCapabilityQuestion(message)) {
    const quickLinks = await buildQuickLinkCards({ user: enrichedUser, context });
    cards = quickLinks.cards;
  } else if (assistantMode === "knowledge") {
    cards = searchKnowledgeArticles(message, { limit: 3 }).map((article) => ({
      type: "knowledge",
      title: safeText(article.title, 120),
      subtitle: safeText(article.summary || "", 200),
      description: safeText((article.bullets || []).slice(0, 2).join(" "), 500),
      route: "",
      payload: {
        articleId: safeText(article.id || "", 80),
      },
    }));
  }

  const actions = (Array.isArray(body.actions) ? body.actions : []).map((action) => ({
    type: safeText(action.type || "", 40),
    target: safeText(action.target || action.route || "", 160),
    state: {},
    label: safeText(action.label || "", 120),
  }));

  if (
    actions.length === 0 &&
    isFollowUpMessage(message) &&
    safeText(body.conversationId || conversationId, 80)
  ) {
    const rememberedRoute = safeText(priorMemory?.lastRoute || "", 160);
    if (rememberedRoute.startsWith("/")) {
      const rememberedFeature = findFeatureByRoute(rememberedRoute);
      actions.push({
        type: "navigate",
        target: rememberedRoute,
        state: {},
        label: safeText(rememberedFeature?.title || "Open page", 120),
      });
    }
  }

  const safety = buildSafetyFromAkuso(body);
  const confidence =
    actions.length > 0
      ? 0.9
      : cards.length > 0
        ? 0.86
        : sources.length > 0
          ? 0.78
          : 0.66;

  const trust = buildAssistantTrust({
    classification: {
      mode: assistantMode,
    },
    confidence,
    usedModel: Boolean(body?.meta?.usedModel),
    provider: body?.meta?.provider || "local-fallback",
    sources,
  });

  const details = [];
  if (safety.notice) {
    details.push({
      title: safety.level === "caution" ? "Safety note" : "Policy note",
      body: safety.notice,
    });
  } else if (legacyFeature?.safeDescription) {
    details.push({
      title: legacyFeature.title,
      body: legacyFeature.safeDescription,
    });
  }

  const followUps = (Array.isArray(body.suggestions) ? body.suggestions : [])
    .filter(Boolean)
    .slice(0, 4)
    .map((suggestion) => ({
      label: safeText(suggestion, 120),
      prompt: safeText(suggestion, 240),
      kind: "prompt",
      route: "",
    }));

  const pendingRoute =
    body.category === "SENSITIVE_ACTION_REQUIRES_AUTH"
      ? inferSensitivePendingRoute({ message, feature: legacyFeature })
      : "";
  const confirmationAction =
    pendingRoute
      ? {
          type: "navigate",
          label: inferSensitivePendingLabel(pendingRoute),
          description: `Open ${inferSensitivePendingLabel(pendingRoute)} and complete the action yourself.`,
          route: pendingRoute,
          payload: {},
        }
      : null;

  const normalizedMessage =
    assistantMode === "knowledge" &&
    !sources.length &&
    !cards.length &&
    !actions.length &&
    !isFollowUpMessage(message)
      ? "I can help with safe navigation, creator writing, learning, or simple math. Tell me what you want to do."
      : safeText(body.answer || "", 1000) ||
        "I can help with Tengacion, writing, learning, and safe navigation.";

  const response = makeAssistantResponse({
    responseId: safeText(body.traceId || "", 80),
    message:
      cards.length > 0 && isCreatorDiscoveryQuery(message)
        ? `I found ${cards.length} creator${cards.length === 1 ? "" : "s"} for "${extractDiscoverySearch(message) || safeText(message, 120)}".`
        : normalizedMessage,
    mode: assistantMode,
    safety,
    trust,
    sources,
    details,
    followUps,
    actions: body.category === "SENSITIVE_ACTION_REQUIRES_AUTH" ? [] : actions,
    cards,
    requiresConfirmation: Boolean(confirmationAction),
    pendingAction: confirmationAction,
    conversationId: safeText(body.conversationId || conversationId, 80),
    confidence,
  });

  return assistantResponseSchema.parse(response);
};

module.exports = {
  chat,
  detectGreetingIntent,
};
