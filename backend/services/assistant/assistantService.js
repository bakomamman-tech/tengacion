const crypto = require("crypto");

const { config } = require("../../config/env");
const logger = require("../../utils/logger");
const { buildAssistantContext } = require("./contextBuilder");
const { classifyAssistantRequest, detectEmergency, detectPromptInjection, detectDisallowed } = require("./policyEngine");
const { retrieveAssistantContext } = require("./retrieval");
const { loadConversationMemory, loadUserPreferences, saveConversationMemory, saveUserPreferences } = require("./memoryStore");
const { recordAssistantRisk, clearAssistantRisk } = require("./abuseGuard");
const { logAssistantEvent } = require("./audit");
const { canAccessFeature, findFeatureById, findFeatureByRoute, getSurfaceQuickPrompts } = require("./featureRegistry");
const { getHelpArticleByFeatureId, getHelpPrompts, searchHelpArticles } = require("./helpDocs");
const { searchKnowledgeArticles } = require("./knowledgeBase");
const {
  getCreatorPublicPageRoute,
  getCreatorRouteForDashboard,
  getCreatorRouteForOnboarding,
  getUploadRoute,
  getUserProfileRoute,
} = require("./tools/shared");
const { buildCreatorDiscoveryDirectory } = require("../../services/creatorDiscoveryService");
const { buildWritingFallbackDraft, normalizeWritingPreferences } = require("./writingProfiles");
const { buildMathResponse, extractMathExpression } = require("./math");
const { buildHealthResponse, buildEmergencyHealthResponse, isHealthEmergency } = require("./healthGuidance");
const {
  makeAssistantResponse,
  makeHealthResponse,
  makeKnowledgeResponse,
  makeMathResponse,
  makeRefusalResponse,
  makeSafeNavigationResponse,
  makeWritingResponse,
} = require("./responseFactory");
const { sanitizePlainText, sanitizeMultilineText, sanitizeAssistantPreferences } = require("./outputSanitizer");
const { assistantResponseSchema } = require("./schemas");

const conversationMemory = new Map();
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

const safeConversationId = (value = "") => String(value || "").trim().slice(0, 80) || crypto.randomUUID();
const normalizeMessage = (value = "") => sanitizeMultilineText(value, 1000).trim();
const detectGreetingIntent = (message = "") => GREETING_PATTERNS.some((pattern) => pattern.test(normalizeMessage(message)));
const isFollowUpMessage = (message = "") => FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalizeMessage(message)));

const stripCommandWords = (value = "") =>
  normalizeMessage(value)
    .replace(
      /^(please\s+)?(take me to|open|go to|go|show me|show|find|search for|search|help me find|help me upload|help me|draft|write|create|explain|teach me about|solve|calculate)\b[:\s-]*/i,
      ""
    )
    .trim();

const extractTopicFromMessage = (message = "") => {
  const clean = stripCommandWords(message);
  const aboutMatch = clean.match(/\babout\s+(.+)$/i);
  if (aboutMatch?.[1]) return aboutMatch[1].trim();
  const forMatch = clean.match(/\bfor\s+(.+)$/i);
  if (forMatch?.[1]) return forMatch[1].trim();
  return clean || normalizeMessage(message);
};

const extractCaptionTopic = (message = "") => {
  const clean = stripCommandWords(message);
  const captionMatch = clean.match(/\bcaption\b(?:\s+(?:for|about))?\s+(.+)$/i);
  return captionMatch?.[1]?.trim() || extractTopicFromMessage(message);
};

const classifyModeHint = (value = "") => {
  const hint = sanitizePlainText(value, 40).toLowerCase();
  if (["write", "writing", "copy", "caption"].includes(hint)) return "writing";
  if (["math", "calculator"].includes(hint)) return "math";
  if (["health", "medical"].includes(hint)) return "health";
  if (["app", "copilot"].includes(hint)) return "copilot";
  if (["knowledge", "general", "info"].includes(hint)) return "knowledge";
  return "";
};

const loadMemoryState = async ({ userId, conversationId }) => {
  const key = safeConversationId(conversationId);
  const local = conversationMemory.get(key) || {};
  if (!userId) return local;

  const persisted = await loadConversationMemory({ userId, conversationId: key }).catch(() => null);
  return {
    ...local,
    ...(persisted || {}),
  };
};

const rememberConversation = async ({ userId, conversationId, state = {}, preferences = {}, modeHint = "" } = {}) => {
  const key = safeConversationId(conversationId);
  const nextState = {
    lastUserMessage: sanitizePlainText(state.lastUserMessage || "", 240),
    lastTopic: sanitizePlainText(state.lastTopic || "", 160),
    lastRoute: sanitizePlainText(state.lastRoute || "", 160),
    lastLabel: sanitizePlainText(state.lastLabel || "", 120),
    lastFeatureId: sanitizePlainText(state.lastFeatureId || "", 80),
    lastMode: sanitizePlainText(state.lastMode || "", 40),
    lastSurface: sanitizePlainText(state.lastSurface || "", 60),
    lastSummary: sanitizePlainText(state.lastSummary || "", 800),
    updatedAt: Date.now(),
  };
  conversationMemory.set(key, nextState);

  if (!userId) return;

  await saveConversationMemory({
    userId,
    conversationId: key,
    summary: nextState.lastSummary || nextState.lastTopic || nextState.lastUserMessage,
    lastTopic: nextState.lastTopic,
    lastMode: nextState.lastMode,
    lastSurface: nextState.lastSurface,
    lastRoute: nextState.lastRoute,
    lastFeatureId: nextState.lastFeatureId,
    preferences,
    metadata: { assistantModeHint: sanitizePlainText(modeHint, 40) },
  }).catch(() => null);
};

const buildGreetingResponse = (message = "", conversationId = "", assistantContext = {}) => {
  const salutation = /good morning/i.test(message)
    ? "Good morning"
    : /good afternoon/i.test(message)
      ? "Good afternoon"
      : /good evening/i.test(message)
        ? "Good evening"
        : "Hi";

  const prompts = getSurfaceQuickPrompts({
    surface: assistantContext?.currentSurface || assistantContext?.surface || "general",
    access: assistantContext?.isAdmin ? "admin" : assistantContext?.isCreator ? "creator" : "authenticated",
  }).slice(0, 4);

  return makeAssistantResponse({
    message: `${salutation}. I'm Akuso. I can help you move around Tengacion, explain features, find creators, draft copy, solve math, or give safe general knowledge.`,
    mode: "general",
    details: [
      {
        title: "What I can do",
        body:
          "I can guide users through safe app pages, help creators write better copy, and explain educational topics with a clear, warm style.",
      },
      {
        title: "How to ask",
        body: "Try simple prompts like 'Open my messages', 'Write a premium caption', or 'Explain this topic simply'.",
      },
    ],
    followUps: prompts.map((prompt) => ({ label: prompt, prompt })),
    conversationId,
    confidence: 0.96,
  });
};

const buildClarificationResponse = ({ conversationId = "", context = {}, retrieved = {}, classification = {} } = {}) =>
  makeAssistantResponse({
    message:
      (context?.currentSurface || context?.surface) && (context.currentSurface || context.surface) !== "general"
        ? `I'm on the ${(context.currentSurface || context.surface)} side of Tengacion with you. Ask me to open a page, explain what you can do here, or draft something for your audience.`
        : "I can help with safe navigation, creator writing, learning, and simple math. Tell me what you want to do.",
    mode: "general",
    details: retrieved?.feature
      ? [
          {
            title: `Current feature: ${retrieved.feature.title}`,
            body: retrieved.feature.description || retrieved.feature.safeDescription || "",
          },
        ]
      : [],
    followUps: [
      ...(retrieved?.quickPrompts || []),
      ...(classification?.followUps || []),
    ]
      .filter(Boolean)
      .slice(0, 4)
      .map((prompt) => ({ label: prompt, prompt })),
    conversationId,
    confidence: 0.72,
  });

const buildAppGuidanceResponse = async ({ conversationId, assistantContext, classification, retrieved, normalizedMessage }) => {
  const feature = retrieved.feature || classification.feature || null;
  const featureRoute = (await resolveFeatureRoute(feature, assistantContext)) || classification.routeHint || "";
  const userAccess = assistantContext?.isAdmin ? "admin" : assistantContext?.isCreator ? "creator" : "authenticated";
  const canNavigateDirectly = Boolean(featureRoute) && canAccessFeature(feature, userAccess);
  const helpArticle = feature?.id ? getHelpArticleByFeatureId(feature.id) : null;
  const helpArticles = feature
    ? [
        ...(helpArticle ? [helpArticle] : []),
        ...searchHelpArticles(feature.title || normalizedMessage, { limit: 2 }),
      ]
    : searchHelpArticles(normalizedMessage, { limit: 3 });
  const isSurfaceOverviewQuery =
    /\bwhat can (?:i|you) do(?: here)?\b/i.test(normalizedMessage) ||
    /\bwhat are my options\b/i.test(normalizedMessage) ||
    /\bhow does this work\b/i.test(normalizedMessage);
  const quickLinkCards = (retrieved?.visibleFeatures || []).slice(0, 3).map((visibleFeature) => ({
    type: "quick-link",
    title: visibleFeature.title || "Open page",
    subtitle: visibleFeature.safeDescription || visibleFeature.description || "",
    description: (visibleFeature.allowedActions || []).slice(0, 3).join(" • "),
    route: visibleFeature.route || "",
    payload: {
      destination: visibleFeature.id || "",
    },
  }));

  if (
    feature?.id === "creator_discovery" ||
    (/\b(find|search|discover)\b/i.test(normalizedMessage) && /\bcreator(s)?\b/i.test(normalizedMessage))
  ) {
    const discoveryQuery = extractTopicFromMessage(normalizedMessage)
      .replace(/\b(creators?|creator|artists?|artist|authors?|author|hosts?|host)\b$/i, "")
      .trim();
    const discovery = await buildCreatorDiscoveryDirectory({
      viewerId: assistantContext?.userId || "",
      search: discoveryQuery || extractTopicFromMessage(normalizedMessage),
      category: inferDiscoveryCategory(normalizedMessage),
      sort: "popular",
      page: 1,
      limit: 4,
    });
    const creatorItems = Array.isArray(discovery?.items) ? discovery.items.slice(0, 4) : [];

    return makeSafeNavigationResponse({
      message:
        creatorItems.length > 0
          ? `I found ${creatorItems.length} creator${creatorItems.length === 1 ? "" : "s"} for "${discoveryQuery || extractTopicFromMessage(normalizedMessage)}".`
          : `I couldn't find creators for "${discoveryQuery || extractTopicFromMessage(normalizedMessage)}". Try a broader search or open creator discovery.`,
      route: "/find-creators",
      label: "Find creators",
      details: [
        {
          title: "Search tip",
          body: "Try a name, @handle, genre, category, or creator lane to find the best match.",
        },
      ],
      followUps: [
        { label: "Open creator discovery", prompt: "Open creator discovery" },
        { label: "Find book creators", prompt: "Find book creators" },
        { label: "Find music creators", prompt: "Find music creators" },
      ],
      cards: creatorItems.map((item) => ({
        type: "creator",
        title: item.name || "Creator",
        subtitle: item.username ? `@${item.username}` : (item.categoryLabels || []).join(" • ") || "Creator",
        description: item.bio || "A creator on Tengacion.",
        route: item.route || item.creatorRoute || "",
        payload: {
          creatorId: item.creatorId || "",
          userId: item.userId || "",
          username: item.username || "",
          category: item.category || "",
        },
      })),
      conversationId,
      confidence: 0.92,
    });
  }

  if (canNavigateDirectly) {
    return makeSafeNavigationResponse({
      message: `Opening ${feature?.title || "that page"}.`,
      route: featureRoute,
      label: feature?.title || "Open page",
      details: [
        {
          title: feature?.title || "Feature",
          body: feature?.safeDescription || feature?.description || "",
        },
        ...(helpArticle ? [{ title: helpArticle.title, body: helpArticle.summary }] : []),
      ],
      followUps: [
        ...(feature?.quickPrompts || []),
        ...(helpArticle?.steps || []).slice(0, 2),
      ]
        .filter(Boolean)
        .slice(0, 4)
        .map((prompt) => ({ label: prompt, prompt })),
      cards: isSurfaceOverviewQuery
        ? quickLinkCards
        : helpArticles.slice(0, 3).map((article) => ({
            type: "help",
            title: article.title || "Help article",
            subtitle: article.summary || "",
            description: (article.steps || []).slice(0, 2).join(" "),
            route: article.route || "",
            payload: { articleId: article.id, featureId: article.feature?.id || article.featureId || "" },
          })),
      conversationId,
      confidence: 0.9,
    });
  }

  if (feature && feature.access === "creator" && !assistantContext.isCreator && !assistantContext.isAdmin) {
    return makeSafeNavigationResponse({
      message: "That page is for creators. I can take you to creator onboarding so you can get access safely.",
      route: assistantContext.creatorOnboardingComplete ? "/creator/register" : "/creator",
      label: assistantContext.creatorOnboardingComplete ? "Creator registration" : "Creator onboarding",
      details: [
        {
          title: feature.title,
          body: feature.safeDescription || feature.description || "",
        },
      ],
      followUps: [
        { label: "Open creator onboarding", prompt: "Open creator onboarding" },
        { label: "How do I become a creator?", prompt: "How do I become a creator?" },
      ],
      cards: helpArticles.slice(0, 3).map((article) => ({
        type: "help",
        title: article.title || "Help article",
        subtitle: article.summary || "",
        description: (article.steps || []).slice(0, 2).join(" "),
        route: article.route || "",
        payload: { articleId: article.id, featureId: article.feature?.id || article.featureId || "" },
      })),
      conversationId,
      confidence: 0.82,
    });
  }

  if (feature && feature.access === "admin" && !assistantContext.isAdmin) {
    return makeKnowledgeResponse({
      message: "That page is for admin staff only. I can explain the public or creator-facing alternative instead.",
      details: [
        {
          title: feature.title,
          body: feature.safeDescription || feature.description || "",
        },
      ],
      followUps: [{ label: "Show me something safe", prompt: "Show me something safe I can access" }],
      cards: helpArticles.slice(0, 3).map((article) => ({
        type: "help",
        title: article.title || "Help article",
        subtitle: article.summary || "",
        description: (article.steps || []).slice(0, 2).join(" "),
        route: article.route || "",
        payload: { articleId: article.id, featureId: article.feature?.id || article.featureId || "" },
      })),
      conversationId,
      confidence: 0.72,
      safety: { level: "caution", notice: "Admin-only area", escalation: "" },
    });
  }

  return makeKnowledgeResponse({
    message: feature
      ? `${feature.title} is available, and I can explain how to use it safely.`
      : "I can explain the Tengacion screen you’re on and help with the next safe step.",
    details: [
      ...(feature
        ? [
            {
              title: feature.title,
              body: feature.safeDescription || feature.description || "",
            },
          ]
        : []),
      ...(helpArticle ? [{ title: helpArticle.title, body: helpArticle.summary }] : []),
    ],
    followUps: [
      ...(feature?.quickPrompts || []),
      ...getHelpPrompts({ featureId: feature?.id || "", surface: assistantContext.currentSurface }),
    ]
      .filter(Boolean)
      .slice(0, 4)
      .map((prompt) => ({ label: prompt, prompt })),
    cards: helpArticles.slice(0, 3).map((article) => ({
      type: "help",
      title: article.title || "Help article",
      subtitle: article.summary || "",
      description: (article.steps || []).slice(0, 2).join(" "),
      route: article.route || "",
      payload: { articleId: article.id, featureId: article.feature?.id || article.featureId || "" },
    })),
    conversationId,
    confidence: 0.8,
  });
};

const inferDiscoveryCategory = (message = "") => {
  const lower = normalizeMessage(message).toLowerCase();
  if (/\bbook|books|author|reading|publish\b/i.test(lower)) return "books";
  if (/\bpodcast|episode|show notes\b/i.test(lower)) return "podcasts";
  if (/\bmusic|song|track|album|artist|release\b/i.test(lower)) return "music";
  return "all";
};

const resolveFeatureRoute = async (feature = null, assistantContext = {}) => {
  const userId = assistantContext?.userId || "";
  const featureId = String(feature?.id || "").trim();

  if (featureId === "profile_editor") return getUserProfileRoute(userId);
  if (featureId === "creator_onboarding") return getCreatorRouteForOnboarding(userId);
  if (featureId === "creator_dashboard") return getCreatorRouteForDashboard(userId);
  if (featureId === "creator_page") return getCreatorPublicPageRoute(userId);
  if (featureId === "creator_music_upload") return getUploadRoute(userId, "music");
  if (featureId === "creator_books_upload") return getUploadRoute(userId, "book");
  if (featureId === "creator_podcasts_upload") return getUploadRoute(userId, "podcast");

  return feature?.route || "";
};

const buildKnowledgeResponse = ({ conversationId, retrieved, normalizedMessage, classification }) => {
  const article = (retrieved.knowledgeArticles || [])[0] || null;
  const moreArticles = searchKnowledgeArticles(normalizedMessage, { limit: 3 });
  const cards = (article ? [article, ...moreArticles.filter((entry) => entry.id !== article.id)] : moreArticles)
    .slice(0, 3)
    .map((entry) => ({
      type: "knowledge",
      title: entry.title,
      subtitle: entry.summary || "",
      description: (entry.bullets || []).slice(0, 2).join(" "),
      route: "",
      payload: { articleId: entry.id, summary: entry.summary || "" },
    }));

  const safety =
    classification?.category === "financial" || classification?.category === "legal"
      ? {
          level: "caution",
          notice:
            classification.category === "financial"
              ? "I can give high-level financial education, but not personal financial advice."
              : "I can give high-level legal information, but not legal advice.",
          escalation: "",
        }
      : { level: "safe", notice: "", escalation: "" };

  return makeKnowledgeResponse({
    message: article
      ? `${article.title}: ${article.summary}`
      : `I can help with safe navigation, writing, learning, or simple math. Here is a grounded answer about ${classification.topic || "your question"}.`,
    details: article
      ? [
          {
            title: article.title,
            body: article.bullets.join("\n"),
          },
        ]
      : [],
    followUps: [
      ...(retrieved.quickPrompts || []),
      ...(article?.bullets || []).slice(0, 2),
    ]
      .filter(Boolean)
      .slice(0, 4)
      .map((prompt) => ({ label: prompt, prompt })),
    cards,
    safety,
    conversationId,
    confidence: 0.74,
  });
};

const classifyWritingTask = (message = "") => {
  const lower = normalizeMessage(message).toLowerCase();
  if (/\brewrite\b|\bimprove\b|\bpolish\b|\bfix grammar\b|\bgrammar\b/.test(lower)) return "rewrite";
  if (/\bsummary\b|\bsummarize\b/.test(lower)) return "summary";
  if (/\bbio\b/.test(lower)) return "bio";
  if (/\barticle\b/.test(lower)) return "article";
  if (/\bpromo\b|\bpromotion\b/.test(lower)) return "promo";
  if (/\brelease\b/.test(lower)) return "release";
  if (/\bpodcast\b/.test(lower)) return "podcast_summary";
  if (/\bbook\b/.test(lower)) return "book_blurb";
  if (/\bpost\b/.test(lower)) return "post";
  return "caption";
};

const detectWritingContentType = classifyWritingTask;

const buildWritingResponse = ({ conversationId, normalizedMessage, preferences, classification, retrieved }) => {
  const contentType = detectWritingContentType(normalizedMessage);
  const topic = classification.writingTopic || extractCaptionTopic(normalizedMessage);
  const writingPreferences = normalizeWritingPreferences({
    ...preferences,
    tone: preferences?.tone || classification?.writingPreferences?.tone || "warm",
  });
  const drafts = buildWritingFallbackDraft({
    task: classifyWritingTask(normalizedMessage),
    contentType,
    topic,
    sourceText: classification?.sourceText || "",
    preferences: writingPreferences,
  });

  return makeWritingResponse({
    message: `Here are ${drafts.length} writing options for ${topic || "your request"}.`,
    details: [
      {
        title: "Writing brief",
        body: `Type: ${contentType}\nTone: ${writingPreferences.tone}\nAudience: ${writingPreferences.audience}\nLength: ${writingPreferences.length}\nSimplicity: ${writingPreferences.simplicity}`,
      },
      ...(retrieved.feature
        ? [
            {
              title: `Relevant feature: ${retrieved.feature.title}`,
              body: retrieved.feature.description || retrieved.feature.safeDescription || "",
            },
          ]
        : []),
    ],
    followUps: [
      { label: "Make it more premium", prompt: `Make this ${contentType} more premium` },
      { label: "Make it shorter", prompt: `Shorten this ${contentType}` },
      { label: "Rewrite for fans", prompt: `Rewrite this for fans in a friendly tone` },
    ],
    cards: drafts.slice(0, 3).map((draft, index) => ({
      type: "draft",
      title: `Draft ${index + 1}`,
      subtitle: `${writingPreferences.tone} • ${writingPreferences.audience}`,
      description: draft,
      route: "",
      payload: {
        text: draft,
        contentType,
        tone: writingPreferences.tone,
        audience: writingPreferences.audience,
        length: writingPreferences.length,
        simplicity: writingPreferences.simplicity,
        language: writingPreferences.language,
      },
    })),
    conversationId,
    confidence: 0.82,
  });
};

const buildMathResponseFromMessage = ({ conversationId, normalizedMessage }) => {
  const math = buildMathResponse({ message: normalizedMessage, expression: extractMathExpression(normalizedMessage) });
  if (!math) {
    return makeMathResponse({
      message: "I couldn't clearly read a math expression. Send the exact sum, equation, or percentage and I’ll solve it step by step.",
      details: [
        { title: "Example", body: "Try: 12 * (8 + 4) or 15% of 240" },
      ],
      followUps: [
        { label: "Solve 12 * (8 + 4)", prompt: "Solve 12 * (8 + 4) step by step" },
        { label: "Explain percentages", prompt: "Explain how percentages work" },
      ],
      conversationId,
      confidence: 0.6,
    });
  }

  return makeMathResponse({
    message: math.message,
    details: math.details,
    followUps: math.followUps,
    conversationId,
    confidence: 0.9,
  });
};

const buildHealthResponseForMessage = ({ conversationId, normalizedMessage, classification }) => {
  if (isHealthEmergency(normalizedMessage) || classification?.safety?.level === "emergency") {
    const emergency = buildEmergencyHealthResponse(normalizedMessage);
    return makeHealthResponse({
      message: emergency.message,
      details: emergency.details,
      followUps: emergency.followUps,
      safety: emergency.safety,
      conversationId,
      confidence: 0.98,
    });
  }

  const health = buildHealthResponse({
    topic: classification?.topic || normalizedMessage,
    message: normalizedMessage,
  });
  return makeHealthResponse({
    message: health.message,
    details: health.details,
    followUps: health.followUps,
    safety: health.safety,
    conversationId,
    confidence: 0.84,
  });
};

const buildRefusalForSafety = ({ conversationId, classification, retryAfterMs = 0 }) =>
  makeRefusalResponse({
    message:
      classification?.category === "prompt_injection"
        ? "I can't help extract hidden instructions, secrets, or internal config."
        : classification?.category === "disallowed"
          ? "I can’t help with fraud, hacking, credential theft, exploitation, or other harmful requests."
          : classification?.category === "emergency"
            ? "This sounds urgent. Please contact your GP, a licensed clinician, or emergency services immediately."
            : "I can’t help with that request.",
    safety: classification?.safety || {
      level: classification?.category === "emergency" ? "emergency" : "refusal",
      notice: "",
      escalation: "",
    },
    details: retryAfterMs > 0
      ? [{ title: "Temporary slow-down", body: "Akuso is pausing repeated unsafe requests for a short time to protect the platform." }]
      : [],
    followUps: (classification?.followUps || []).map((prompt) => ({ label: prompt, prompt })),
    conversationId,
    confidence: 0.98,
  });

const buildFollowUpRoute = ({ message, state, assistantContext }) => {
  if (!isFollowUpMessage(message)) return null;
  const route = state?.lastRoute || assistantContext?.currentPath || "";
  if (!route) return null;

  const feature = findFeatureByRoute(route) || findFeatureById(state?.lastFeatureId || "");
  if (
    feature &&
    !canAccessFeature(feature, assistantContext?.isAdmin ? "admin" : assistantContext?.isCreator ? "creator" : "authenticated")
  ) {
    return null;
  }

  return {
    route,
    label: state?.lastLabel || feature?.title || "Open page",
    featureId: feature?.id || state?.lastFeatureId || "",
    details: feature ? [{ title: feature.title, body: feature.safeDescription || feature.description || "" }] : [],
  };
};

const finalizeResponse = async ({
  response,
  conversationId,
  user,
  assistantContext,
  classification,
  preferences,
  modeHint,
  normalizedMessage,
}) => {
  const normalized = assistantResponseSchema.parse({ ...response, conversationId });
  const primaryRoute = Array.isArray(normalized.actions)
    ? normalized.actions.find((action) => action?.type === "navigate" && String(action?.target || "").startsWith("/"))
    : null;
  const route = primaryRoute?.target || "";
  const feature = route ? findFeatureByRoute(route) : classification?.feature || null;
  const summary = sanitizePlainText(
    [normalized.message, normalized.details?.[0]?.title ? `${normalized.details[0].title}` : "", route ? `Route: ${route}` : ""]
      .filter(Boolean)
      .join(" | "),
    800
  );

  await rememberConversation({
    userId: user?.id || "",
    conversationId,
    state: {
      lastUserMessage: normalizedMessage,
      lastTopic: classification?.topic || extractTopicFromMessage(normalizedMessage),
      lastRoute: route,
      lastLabel: primaryRoute?.label || feature?.title || classification?.feature?.title || "",
      lastFeatureId: feature?.id || classification?.feature?.id || "",
      lastMode: normalized.mode || classification?.mode || "general",
      lastSurface: assistantContext?.currentSurface || assistantContext?.surface || "general",
      lastSummary: summary,
    },
    preferences,
    modeHint,
  });

  if (user?.id) {
    await saveUserPreferences({
      userId: user.id,
      preferences,
      metadata: { assistantModeHint: sanitizePlainText(modeHint, 40) },
    }).catch(() => null);
  }

  return normalized;
};

const chat = async ({
  req = null,
  user,
  message,
  conversationId = "",
  pendingAction = null,
  context = {},
  assistantModeHint = "",
  preferences = {},
}) => {
  const normalizedMessage = normalizeMessage(message);
  const nextConversationId = safeConversationId(conversationId);
  const storedPreferences = user?.id ? await loadUserPreferences({ userId: user.id }).catch(() => ({})) : {};
  const mergedPreferences = sanitizeAssistantPreferences({ ...storedPreferences, ...preferences });
  const memory = await loadMemoryState({ userId: user?.id || "", conversationId: nextConversationId });

  const assistantContext = await buildAssistantContext({
    user,
    context,
    preferences: mergedPreferences,
    memory,
    modeHint: assistantModeHint,
    pendingAction,
  });

  const classification = classifyAssistantRequest({
    message: normalizedMessage,
    context: assistantContext,
    user,
    preferences: mergedPreferences,
  });

  const abuseState = recordAssistantRisk({
    userId: user?.id || "",
    sessionId: user?.sessionId || "",
    ip: req?.ip || "",
    suspicious:
      classification.category === "prompt_injection" ||
      classification.category === "disallowed" ||
      classification.category === "emergency",
  });

  if (abuseState.throttled) {
    const response = buildRefusalForSafety({
      conversationId: nextConversationId,
      classification,
      retryAfterMs: abuseState.retryAfterMs,
    });
    await logAssistantEvent({
      req,
      userId: user?.id || "",
      action: "throttled",
      category: "abuse",
      severity: "warn",
      conversationId: nextConversationId,
      metadata: { retryAfterMs: abuseState.retryAfterMs },
    }).catch(() => null);
    return finalizeResponse({
      response,
      conversationId: nextConversationId,
      user,
      assistantContext,
      classification,
      preferences: mergedPreferences,
      modeHint: assistantModeHint,
      normalizedMessage,
    });
  }

  const retrieved = retrieveAssistantContext({
    query: normalizedMessage,
    classification,
    context: assistantContext,
  });

  logger.info("assistant.request.received", {
    conversationId: nextConversationId,
    userId: user?.id || "",
    messageLength: normalizedMessage.length,
    surface: assistantContext?.currentSurface || assistantContext?.surface || "general",
    category: classification?.category || "unknown",
  });

  let response = null;
  const hint = classifyModeHint(assistantModeHint);

  if (!config.assistantEnabled) {
    response = makeRefusalResponse({
      message:
        "Akuso is disabled in this environment. Turn it back on to use safe navigation, creator writing, search help, and study support.",
      details: [
        { title: "Disabled assistant", body: "Enable ASSISTANT_ENABLED to restore the production assistant flows." },
      ],
      followUps: getSurfaceQuickPrompts({
        surface: assistantContext?.currentSurface || "general",
        access: assistantContext?.isAdmin ? "admin" : assistantContext?.isCreator ? "creator" : "authenticated",
      })
        .slice(0, 4)
        .map((prompt) => ({ label: prompt, prompt })),
      conversationId: nextConversationId,
      confidence: 0.98,
    });
  } else if (
    detectEmergency(normalizedMessage) ||
    classification.category === "emergency" ||
    classification.category === "medical" ||
    classification.mode === "health" ||
    hint === "health"
  ) {
    response = buildHealthResponseForMessage({ conversationId: nextConversationId, normalizedMessage, classification });
  } else if (detectPromptInjection(normalizedMessage) || classification.category === "prompt_injection") {
    response = buildRefusalForSafety({ conversationId: nextConversationId, classification });
  } else if (detectDisallowed(normalizedMessage) || classification.category === "disallowed") {
    response = buildRefusalForSafety({ conversationId: nextConversationId, classification });
  } else if (classification.category === "sensitive_action") {
    const pendingRoute = classification.routeHint || "";
    const pendingLabel = classification.feature?.title || (pendingRoute === "/messages" ? "Messages" : "Secure page");

    response = makeAssistantResponse({
      message: pendingRoute
        ? `I can't do that automatically, but I can open ${pendingLabel} so you can finish it yourself.`
        : "I can't perform that action automatically, but I can point you to the secure page you need.",
      mode: "copilot",
      safety: {
        level: "caution",
        notice: "Akuso will not perform sensitive actions on your behalf without confirmation.",
        escalation: "",
      },
      details: [
        {
          title: "Safe next step",
          body: pendingRoute
            ? `Open ${pendingLabel} and review the action manually.`
            : "Ask Akuso for the secure page or safe alternative.",
        },
      ],
      followUps: pendingRoute
        ? [
            { label: `Open ${pendingLabel}`, prompt: `Open ${pendingLabel}` },
            { label: "Show safe alternative", prompt: "Show me the safe alternative" },
          ]
        : [{ label: "Show safe alternative", prompt: "Show me the safe alternative" }],
      requiresConfirmation: Boolean(pendingRoute),
      pendingAction: pendingRoute
        ? {
            type: "navigate",
            label: pendingLabel,
            route: pendingRoute,
            description: `Open ${pendingLabel} so you can complete the action yourself.`,
          }
        : null,
      conversationId: nextConversationId,
      confidence: 0.9,
    });
  } else {
    const followUpRoute = buildFollowUpRoute({ message: normalizedMessage, state: memory, assistantContext });
    if (followUpRoute) {
      response = makeSafeNavigationResponse({
        message: `Opening ${followUpRoute.label}.`,
        route: followUpRoute.route,
        label: followUpRoute.label,
        details: followUpRoute.details,
        followUps: [
          { label: "Show me more", prompt: `Tell me more about ${followUpRoute.label}` },
          { label: "What else can I do?", prompt: "What else can I do here?" },
        ],
        conversationId: nextConversationId,
        confidence: 0.88,
      });
    } else if (hint === "math" || classification.mode === "math" || classification.category === "math") {
      response = buildMathResponseFromMessage({ conversationId: nextConversationId, normalizedMessage });
    } else if (hint === "writing" || classification.mode === "writing" || classification.category === "writing") {
      response = buildWritingResponse({
        conversationId: nextConversationId,
        normalizedMessage,
        preferences: mergedPreferences,
        classification,
        retrieved,
      });
    } else if (
      classification.category === "app_guidance" ||
      classification.mode === "copilot" ||
      (classification.routeHint && retrieved.feature && ["financial", "legal", "sensitive_action"].includes(classification.category))
    ) {
      response = await buildAppGuidanceResponse({
        conversationId: nextConversationId,
        assistantContext,
        classification,
        retrieved,
        normalizedMessage,
      });
    } else if (classification.mode === "knowledge" || classification.category === "knowledge" || hint === "knowledge" || !normalizedMessage) {
      response = buildKnowledgeResponse({
        conversationId: nextConversationId,
        retrieved,
        normalizedMessage,
        classification,
      });
    } else if (detectGreetingIntent(normalizedMessage)) {
      response = buildGreetingResponse(normalizedMessage, nextConversationId, assistantContext);
    } else {
      response = buildClarificationResponse({
        conversationId: nextConversationId,
        context: assistantContext,
        retrieved,
        classification,
      });
    }
  }

  const finalized = await finalizeResponse({
    response,
    conversationId: nextConversationId,
    user,
    assistantContext,
    classification,
    preferences: mergedPreferences,
    modeHint: assistantModeHint,
    normalizedMessage,
  });

  if (classification.category === "prompt_injection" || classification.category === "disallowed") {
    await logAssistantEvent({
      req,
      userId: user?.id || "",
      action: "refusal",
      category: classification.category,
      severity: "warn",
      conversationId: nextConversationId,
      metadata: { topic: classification.topic || "", mode: finalized.mode || classification.mode || "" },
    }).catch(() => null);
  } else if (finalized.safety?.level === "emergency") {
    await logAssistantEvent({
      req,
      userId: user?.id || "",
      action: "emergency",
      category: "emergency",
      severity: "error",
      conversationId: nextConversationId,
      metadata: { topic: classification.topic || "" },
    }).catch(() => null);
  } else {
    await logAssistantEvent({
      req,
      userId: user?.id || "",
      action: "response",
      category: finalized.mode || "general",
      severity: "info",
      conversationId: nextConversationId,
      metadata: {
        topic: classification.topic || "",
        surface: assistantContext?.currentSurface || assistantContext?.surface || "general",
        confidence: finalized.confidence,
      },
    }).catch(() => null);
  }

  if (classification.category === "prompt_injection" || classification.category === "disallowed" || classification.category === "emergency") {
    clearAssistantRisk({
      userId: user?.id || "",
      sessionId: user?.sessionId || "",
      ip: req?.ip || "",
    });
  }

  return finalized;
};

module.exports = {
  buildClarificationResponse,
  buildGreetingResponse,
  chat,
  detectGreetingIntent,
  isFollowUpMessage,
  extractCaptionTopic,
  extractTopicFromMessage,
};
