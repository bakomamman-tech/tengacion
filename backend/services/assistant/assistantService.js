const crypto = require("crypto");

const { config } = require("../../config/env");
const logger = require("../../utils/logger");
const { buildAssistantSystemPrompt } = require("./systemPrompt");
const { buildAction, safeText } = require("./tools/shared");
const {
  executeTool,
  normalizeAssistantResult,
  toolByName,
  toolDefinitions,
} = require("./toolRegistry");
const { assistantResponseSchema } = require("./schemas");

const SAFE_GREETINGS = [
  "I can help with navigation, discovery, uploads, purchases, notifications, captions, and feature help.",
  "I can open safe pages, find creators, search content, and draft short captions.",
];

const GREETING_PATTERNS = [
  /^(hi|hello|hey|yo|gm)\b/i,
  /^good (morning|afternoon|evening)\b/i,
  /(?:^|\s)(hi|hello|hey)\s+akuso\b/i,
  /(?:^|\s)good (morning|afternoon|evening)\s+akuso\b/i,
];

const buildClarificationResponse = (conversationId = "") =>
  normalizeAssistantResult(
    {
      message: SAFE_GREETINGS[0],
      actions: [],
      cards: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId,
    },
    conversationId
  );

const buildGreetingResponse = (message = "", conversationId = "") => {
  const lower = String(message || "").trim().toLowerCase();
  const salutation = lower.includes("good morning")
    ? "Good morning"
    : lower.includes("good afternoon")
      ? "Good afternoon"
      : lower.includes("good evening")
        ? "Good evening"
        : "Hi";

  return normalizeAssistantResult(
    {
      message: `${salutation}. I'm Akuso. Tell me where you want to go, or ask me to find creators, open messages, or draft a caption.`,
      actions: [],
      cards: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId,
    },
    conversationId
  );
};

const buildRiskResponse = (conversationId, pendingAction = null, message = "") =>
  normalizeAssistantResult(
    {
      message:
        message ||
        "I can't do that automatically in Phase 1. I can open the relevant page or help you do it safely.",
      actions: [],
      cards: [],
      requiresConfirmation: true,
      pendingAction:
        pendingAction || {
          type: "unsupported",
          label: "Unsupported action",
          description: "Akuso blocks risky actions in Phase 1.",
          route: "",
          payload: {},
        },
      conversationId,
    },
    conversationId
  );

const stripCommandWords = (value = "") =>
  String(value || "")
    .replace(
      /^(please\s+)?(take me to|open|go to|go|show me|show|find|search for|search|help me find|help me upload|help me|draft|write|create|explain)\b[:\s-]*/i,
      ""
    )
    .trim();

const extractTopicFromMessage = (message = "") => {
  const clean = stripCommandWords(message);
  const aboutMatch = clean.match(/\babout\s+(.+)$/i);
  if (aboutMatch?.[1]) {
    return aboutMatch[1].trim();
  }
  const forMatch = clean.match(/\bfor\s+(.+)$/i);
  if (forMatch?.[1]) {
    return forMatch[1].trim();
  }
  return clean || String(message || "").trim();
};

const extractCaptionTopic = (message = "") => {
  const clean = stripCommandWords(message);
  const captionMatch = clean.match(/\bcaption\b(?:\s+(?:for|about))?\s+(.+)$/i);
  if (captionMatch?.[1]) {
    return captionMatch[1].trim();
  }

  const forMatch = clean.match(/\bfor\s+(.+)$/i);
  if (forMatch?.[1]) {
    return forMatch[1].trim();
  }

  return extractTopicFromMessage(message);
};

const detectRiskIntent = (message = "") => {
  const text = String(message || "").toLowerCase();
  const riskyPatterns = [
    /\bdelete\b.*\b(post|content|message|account|profile)\b/,
    /\bremove\b.*\b(post|content|message|account|profile)\b/,
    /\bwithdraw\b.*\b(money|funds|cash)\b/,
    /\btransfer\b.*\b(money|funds|cash)\b/,
    /\bchange\b.*\b(payment|security|password|bank)\b/,
    /\bupdate\b.*\b(payment|security|password|bank)\b/,
    /\bpublish\b.*\b(automatically|for me|now)\b/,
    /\bsend\b.*\b(message|dm|chat)\b/,
    /\bmoderat(e|ion)\b/,
    /\bban\b.*\b(user|account)\b/,
  ];

  return riskyPatterns.some((pattern) => pattern.test(text));
};

const detectGreetingIntent = (message = "") => GREETING_PATTERNS.some((pattern) => pattern.test(String(message || "").trim()));

const ASSISTANT_MEMORY_MAX_ENTRIES = 200;
const ASSISTANT_MEMORY_TTL_MS = 30 * 60 * 1000;
const conversationMemory = new Map();

const FOLLOW_UP_PATTERNS = [
  /^(open|show|go to|take me to|take me|bring up|open up)\s+(it|that|there|this|the page|the screen)\b/i,
  /^(show me that|open that again|take me there|show it again)\b/i,
  /^(take me back|go back|return)\b/i,
  /^(open the last one|open the previous one)\b/i,
];

const isSafeStoredRoute = (route = "") => {
  const value = String(route || "").trim();
  return Boolean(value) && value.startsWith("/") && !value.includes("://") && !value.includes("\\") && !value.includes("..");
};

const resolveSurfaceFromPath = (path = "") => {
  const route = String(path || "").trim().toLowerCase();
  if (!route) {
    return "general";
  }

  if (route.startsWith("/home")) return "home";
  if (route.startsWith("/messages")) return "messages";
  if (route.startsWith("/notifications")) return "notifications";
  if (route.startsWith("/profile/")) return "profile";
  if (route.startsWith("/creator")) {
    return route.includes("/dashboard") ? "creator_dashboard" : "creator";
  }
  if (route.startsWith("/search")) return "search";
  if (route.startsWith("/find-creators") || route.startsWith("/creators")) return "discovery";
  if (route.startsWith("/purchases")) return "purchases";
  if (route.startsWith("/settings")) return "settings";

  return "general";
};

const normalizeAssistantContext = (context = {}) => {
  const currentPath = safeText(context?.currentPath || "", 160);
  const currentSearch = safeText(context?.currentSearch || "", 160);
  const pageTitle = safeText(context?.pageTitle || "", 120);
  const selectedChatId = safeText(context?.selectedChatId || "", 80);
  const selectedContentId = safeText(context?.selectedContentId || "", 80);
  const resolvedSurface = safeText(context?.surface || "", 40).toLowerCase();
  const surface = resolvedSurface && resolvedSurface !== "unknown" ? resolvedSurface : resolveSurfaceFromPath(currentPath);

  return {
    currentPath,
    currentSearch,
    surface,
    pageTitle,
    selectedChatId,
    selectedContentId,
  };
};

const getPrimaryResponseRoute = (response = {}) => {
  const navigateAction = Array.isArray(response?.actions)
    ? response.actions.find((action) => action?.type === "navigate" && isSafeStoredRoute(action?.target))
    : null;
  if (navigateAction) {
    return {
      route: String(navigateAction.target || "").trim(),
      label: safeText(navigateAction.label || "", 80),
      state:
        navigateAction.state && typeof navigateAction.state === "object" && !Array.isArray(navigateAction.state)
          ? navigateAction.state
          : {},
    };
  }

  const cardRoute = Array.isArray(response?.cards)
    ? response.cards.find((card) => isSafeStoredRoute(card?.route))
    : null;
  if (cardRoute) {
    return {
      route: String(cardRoute.route || "").trim(),
      label: safeText(cardRoute.title || "", 80),
      state: {},
    };
  }

  const pendingRoute = response?.pendingAction && isSafeStoredRoute(response.pendingAction.route)
    ? String(response.pendingAction.route || "").trim()
    : "";
  if (pendingRoute) {
    return {
      route: pendingRoute,
      label: safeText(response?.pendingAction?.label || "", 80),
      state:
        response?.pendingAction?.payload &&
        typeof response.pendingAction.payload === "object" &&
        !Array.isArray(response.pendingAction.payload)
          ? response.pendingAction.payload
          : {},
    };
  }

  return null;
};

const pruneConversationMemory = () => {
  const now = Date.now();
  for (const [conversationId, entry] of conversationMemory.entries()) {
    if (!entry || now - Number(entry.updatedAt || 0) > ASSISTANT_MEMORY_TTL_MS) {
      conversationMemory.delete(conversationId);
    }
  }

  if (conversationMemory.size <= ASSISTANT_MEMORY_MAX_ENTRIES) {
    return;
  }

  const staleEntries = Array.from(conversationMemory.entries()).sort(
    (left, right) => Number(left[1]?.updatedAt || 0) - Number(right[1]?.updatedAt || 0)
  );
  while (conversationMemory.size > ASSISTANT_MEMORY_MAX_ENTRIES && staleEntries.length > 0) {
    const [conversationId] = staleEntries.shift();
    if (conversationId) {
      conversationMemory.delete(conversationId);
    }
  }
};

const rememberConversationState = (conversationId, state = {}) => {
  const key = String(conversationId || "").trim();
  if (!key) {
    return;
  }

  conversationMemory.set(key, {
    lastUserMessage: safeText(state.lastUserMessage || "", 240),
    lastTopic: safeText(state.lastTopic || "", 120),
    lastRoute: safeText(state.lastRoute || "", 160),
    lastLabel: safeText(state.lastLabel || "", 120),
    lastState:
      state.lastState && typeof state.lastState === "object" && !Array.isArray(state.lastState)
        ? state.lastState
        : {},
    currentPath: safeText(state.currentPath || "", 160),
    currentSearch: safeText(state.currentSearch || "", 160),
    pageTitle: safeText(state.pageTitle || "", 120),
    surface: safeText(state.surface || "general", 40),
    updatedAt: Date.now(),
  });

  pruneConversationMemory();
};

const getConversationState = (conversationId) => {
  const key = String(conversationId || "").trim();
  if (!key) {
    return null;
  }

  const entry = conversationMemory.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() - Number(entry.updatedAt || 0) > ASSISTANT_MEMORY_TTL_MS) {
    conversationMemory.delete(key);
    return null;
  }

  return entry;
};

const getContextualRoute = (conversationState = {}, requestContext = {}) => {
  if (isSafeStoredRoute(conversationState.lastRoute)) {
    return {
      route: conversationState.lastRoute,
      label: safeText(conversationState.lastLabel || "", 120),
      state: conversationState.lastState || {},
    };
  }

  if (isSafeStoredRoute(requestContext.currentPath)) {
    return {
      route: requestContext.currentPath,
      label: safeText(requestContext.pageTitle || "", 120),
      state: {},
    };
  }

  return null;
};

const isFollowUpMessage = (message = "") =>
  FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(String(message || "").trim()));

const buildContextualNavigateResponse = (routeData, conversationId = "") =>
  normalizeAssistantResult(
    {
      message: routeData?.label
        ? `Opening ${routeData.label}.`
        : "Opening that for you.",
      actions: [buildAction(routeData.route, routeData.state || {}, routeData.label || "")],
      cards: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId,
    },
    conversationId
  );

const NAVIGATION_VERBS = /\b(open|take me|go to|show me|show|visit|view|launch|bring up|jump to)\b/i;
const GENERAL_HELP_PATTERNS = [
  /\bwhat can (i|you) do\b/i,
  /\bwhat can (i|you) do here\b/i,
  /\bwhat are my options\b/i,
  /\bshow me (?:my )?(?:options|shortcuts|quick links|things i can do)\b/i,
  /\bwhat do you do\b/i,
  /\bhow does this work\b/i,
  /^\s*help\s*\??\s*$/i,
];
const CREATOR_SEARCH_HINTS = /\b(creator|creators|artist|artists|musician|musicians|singer|singers|producer|producers|writer|writers|author|authors|podcaster|podcasters|profile|profiles|page|pages|people)\b/i;

const detectGeneralHelpIntent = (message = "") =>
  GENERAL_HELP_PATTERNS.some((pattern) => pattern.test(String(message || "").trim()));

const detectCreatorPageIntent = (message = "") => {
  const text = String(message || "").toLowerCase();
  return (
    /\b(creator(?:'s)?\s+page|my\s+creator\s+page|public\s+creator\s+page|fan\s+page|creator\s+profile)\b/.test(text) &&
    NAVIGATION_VERBS.test(text)
  );
};

const normalizeCreatorSearchQuery = (message = "") =>
  String(message || "")
    .replace(
      /^(please\s+)?(take me to|open|go to|go|show me|show|find me|find|search for|search|help me find|help me upload|help me|draft|write|create|explain)\b[:\s-]*/i,
      ""
    )
    .replace(/\b(me|my)\b/gi, " ")
    .replace(
      /\b(creators?|creator|artists?|artist|musicians?|musician|singers?|singer|producers?|producer|authors?|author|writers?|writer|podcasters?|podcaster|profiles?|profile|pages?|page|people)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

const resolveCreatorSearchCategory = (message = "") => {
  const lower = String(message || "").toLowerCase();
  if (/\b(podcast|podcasts|episode|episodes)\b/.test(lower)) {
    return "podcasts";
  }
  if (/\b(book|books|author|authors|writer|writers|publishing)\b/.test(lower)) {
    return "books";
  }
  if (/\b(gospel|music|song|songs|track|tracks|artist|artists|singer|singers|musician|musicians|producer|producers|worship|choir|band|dj|rapper|rappers)\b/.test(lower)) {
    return "music";
  }
  return "all";
};

const detectLocalPlan = (message = "", conversationState = {}) => {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();

  if (detectRiskIntent(text)) {
    const isMessaging = /\bsend\b.*\b(message|dm|chat)\b/.test(lower);
    return {
      kind: "risky",
      response: buildRiskResponse(
        "",
        isMessaging
          ? {
              type: "navigate",
              label: "Open Messages",
              description: "Akuso can take you to your inbox instead.",
              route: "/messages",
              payload: { destination: "messages" },
            }
          : {
              type: "unsupported",
              label: "Blocked action",
              description: "Phase 1 blocks destructive, financial, and account-changing actions.",
              route: "",
              payload: {},
            }
      ),
    };
  }

  if (/\b(take me home|go home|open home|home)\b/.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "home" } };
  }

  if (/\b(messages?|inbox|chat)\b/.test(lower) && NAVIGATION_VERBS.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "messages" } };
  }

  if (/\bnotifications?|alerts?\b/.test(lower)) {
    if (NAVIGATION_VERBS.test(lower)) {
      return { kind: "tool", name: "getNotificationsSummary", args: {} };
    }
    return { kind: "tool", name: "navigateTo", args: { destination: "notifications" } };
  }

  if (/\b(profile|my profile)\b/.test(lower) && NAVIGATION_VERBS.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "profile" } };
  }

  if (detectCreatorPageIntent(text)) {
    return { kind: "tool", name: "openCreatorPage", args: {} };
  }

  if (/\bcreator dashboard\b/.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "creator_dashboard" } };
  }

  if (/\b(settings?)\b/.test(lower) && NAVIGATION_VERBS.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "settings" } };
  }

  if (/\bbook publishing\b/.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "book_publishing" } };
  }

  if (/\b(upload\b.*\b(song|music|track)\b|\brelease\b.*\b(song|music|track)\b|\bmusic upload\b)/.test(lower)) {
    return { kind: "tool", name: "openUploadPage", args: { type: "music" } };
  }

  if (/\b(upload\b.*\b(book)\b|\bpublish\b.*\b(book)\b|\bbook upload\b)/.test(lower)) {
    return { kind: "tool", name: "openUploadPage", args: { type: "book" } };
  }

  if (/\b(upload\b.*\b(podcast|episode)\b|\brelease\b.*\b(podcast|episode)\b|\bpodcast upload\b)/.test(lower)) {
    return { kind: "tool", name: "openUploadPage", args: { type: "podcast" } };
  }

  if (/\b(become a creator|creator onboarding|how do i become a creator|creator signup)\b/.test(lower)) {
    return { kind: "tool", name: "openCreatorOnboarding", args: {} };
  }

  if (/\b(purchases?|orders?|library)\b/.test(lower) && NAVIGATION_VERBS.test(lower)) {
    return { kind: "tool", name: "getPurchasesSummary", args: {} };
  }

  if (/\b(search|find|show)\b/.test(lower) && CREATOR_SEARCH_HINTS.test(lower)) {
    const category = resolveCreatorSearchCategory(lower);
    const search = normalizeCreatorSearchQuery(text) || text;
    return {
      kind: "tool",
      name: "searchCreators",
      args: {
        query: search,
        category,
      },
    };
  }

  if (
    /\b(search|find|show)\b/.test(lower) &&
    /\b(podcast|book|books|song|songs|track|tracks|album|albums|content|post|posts)\b/.test(lower)
  ) {
    const contentType = /\bpodcast|podcasts\b/.test(lower)
      ? "podcasts"
      : /\bbook|books\b/.test(lower)
        ? "books"
        : /\balbum|albums\b/.test(lower)
          ? "albums"
          : /\bpost|posts\b/.test(lower)
            ? "posts"
            : /\btrack|tracks|song|songs\b/.test(lower)
              ? "tracks"
              : "all";
    return {
      kind: "tool",
      name: "searchContent",
      args: {
        query: extractTopicFromMessage(text),
        type: contentType,
      },
    };
  }

  if (/\b(draft|write|create)\b/.test(lower) && /\bcaption\b/.test(lower)) {
    return {
      kind: "tool",
      name: "draftPostCaption",
      args: {
        topic: extractCaptionTopic(text),
        tone: /\b(playful|funny|witty)\b/.test(lower)
          ? "playful"
          : /\b(professional|business|work)\b/.test(lower)
            ? "professional"
            : /\b(inspire|inspiring|motivational)\b/.test(lower)
              ? "inspiring"
              : /\b(friendly|warm|kind)\b/.test(lower)
                ? "friendly"
                : "warm",
      },
    };
  }

  if (/\b(explain|what is|what does|how does|help with)\b/.test(lower)) {
    return {
      kind: "tool",
      name: "explainFeature",
      args: {
        featureName: extractTopicFromMessage(text),
      },
    };
  }

  const contextualRoute = isFollowUpMessage(text) ? getContextualRoute(conversationState) : null;
  if (contextualRoute) {
    return {
      kind: "contextual-route",
      routeData: contextualRoute,
    };
  }

  if (detectGeneralHelpIntent(text)) {
    return { kind: "tool", name: "getQuickLinks", args: {} };
  }

  return {
    kind: "unknown",
    message: text,
  };
};

const maybeCallModelPlanner = async ({ message, user, conversationId, context = {}, memory = {} }) => {
  if (!config.hasOpenAI) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openAiModel,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: buildAssistantSystemPrompt({ user, context, memory }),
          },
          {
            role: "user",
            content: message,
          },
        ],
        tools: toolDefinitions,
        tool_choice: "auto",
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || "OpenAI request failed");
    }

    const choice = data?.choices?.[0]?.message || {};
    const toolCalls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
    if (toolCalls.length > 0) {
      const results = [];
      for (const toolCall of toolCalls) {
        const toolName = String(toolCall?.function?.name || "").trim();
        const rawArgs = String(toolCall?.function?.arguments || "{}");
        if (!toolByName.has(toolName)) {
          logger.warn("assistant.model.unknown_tool", { conversationId, toolName });
          continue;
        }

        let parsedArgs = {};
        try {
          parsedArgs = rawArgs ? JSON.parse(rawArgs) : {};
        } catch (parseError) {
          logger.warn("assistant.model.bad_args", {
            conversationId,
            toolName,
            message: parseError?.message || "Invalid JSON",
          });
          continue;
        }

        const toolResult = await executeTool(toolName, parsedArgs, {
          user,
          conversationId,
          source: "openai",
          assistantContext: context,
          conversationMemory: memory,
        });
        results.push(toolResult);
      }

      if (results.length > 0) {
        return results;
      }
    }

    const text = String(choice.content || "").trim();
    if (text) {
      return [
        normalizeAssistantResult(
          {
            message: text,
            actions: [],
            cards: [],
            requiresConfirmation: false,
            pendingAction: null,
            conversationId,
          },
          conversationId
        ),
      ];
    }

    return null;
  } catch (error) {
    logger.warn("assistant.model.fallback", {
      conversationId,
      message: error?.message || "Model planner failed",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const mergeResults = (results = [], conversationId = "") => {
  if (!Array.isArray(results) || results.length === 0) {
    return buildClarificationResponse(conversationId);
  }

  const merged = {
    message: "",
    actions: [],
    cards: [],
    requiresConfirmation: false,
    pendingAction: null,
    conversationId,
  };

  for (const result of results) {
    const normalized = normalizeAssistantResult(result, conversationId);
    if (!merged.message && normalized.message) {
      merged.message = normalized.message;
    }
    merged.actions.push(...normalized.actions);
    merged.cards.push(...normalized.cards);
    if (normalized.requiresConfirmation) {
      merged.requiresConfirmation = true;
      merged.pendingAction = normalized.pendingAction || merged.pendingAction;
    }
  }

  if (!merged.message) {
    merged.message = "I found something useful for you.";
  }

  return assistantResponseSchema.parse(merged);
};

const chat = async ({ user, message, conversationId = "", pendingAction = null, context = {} }) => {
  const normalizedMessage = String(message || "").trim();
  const nextConversationId = String(conversationId || "").trim() || crypto.randomUUID();
  const requestContext = normalizeAssistantContext(context);
  const previousMemory = getConversationState(nextConversationId) || {};
  const mergedMemory = {
    ...previousMemory,
    ...requestContext,
    surface: requestContext.surface || previousMemory.surface || resolveSurfaceFromPath(requestContext.currentPath),
    currentPath: requestContext.currentPath || previousMemory.currentPath || "",
    currentSearch: requestContext.currentSearch || previousMemory.currentSearch || "",
    pageTitle: requestContext.pageTitle || previousMemory.pageTitle || "",
  };

  const buildAndRememberResponse = (result) => {
    const normalized = normalizeAssistantResult(
      {
        ...result,
        conversationId: nextConversationId,
      },
      nextConversationId
    );
    const primaryRoute = getPrimaryResponseRoute(normalized);
    rememberConversationState(nextConversationId, {
      lastUserMessage: normalizedMessage,
      lastTopic: extractTopicFromMessage(normalizedMessage),
      lastRoute: primaryRoute?.route || mergedMemory.currentPath || "",
      lastLabel: primaryRoute?.label || mergedMemory.pageTitle || "",
      lastState: primaryRoute?.state || {},
      currentPath: mergedMemory.currentPath,
      currentSearch: mergedMemory.currentSearch,
      pageTitle: mergedMemory.pageTitle,
      surface: mergedMemory.surface,
    });
    return normalized;
  };

  logger.info("assistant.request.received", {
    conversationId: nextConversationId,
    userId: user?.id || "",
    messageLength: normalizedMessage.length,
    hasPendingAction: Boolean(pendingAction),
    surface: mergedMemory.surface,
  });

  if (!config.assistantEnabled) {
    return buildAndRememberResponse(
      {
        message:
          "Akuso is disabled in this environment. Turn it back on to use navigation, search, creator discovery, and caption drafting.",
        actions: [],
        cards: [],
        requiresConfirmation: false,
        pendingAction: null,
      },
    );
  }

  if (detectGreetingIntent(normalizedMessage)) {
    logger.info("assistant.plan.greeting", {
      conversationId: nextConversationId,
      userId: user?.id || "",
    });
    return buildAndRememberResponse(buildGreetingResponse(normalizedMessage, nextConversationId));
  }

  const localPlan = detectLocalPlan(normalizedMessage, mergedMemory);
  if (localPlan.kind === "risky") {
    logger.info("assistant.plan.risky", {
      conversationId: nextConversationId,
      userId: user?.id || "",
    });
    return buildAndRememberResponse(localPlan.response);
  }

  if (localPlan.kind === "contextual-route") {
    logger.info("assistant.plan.contextual_route", {
      conversationId: nextConversationId,
      userId: user?.id || "",
      route: localPlan.routeData?.route || "",
    });
    return buildAndRememberResponse(buildContextualNavigateResponse(localPlan.routeData, nextConversationId));
  }

  if (localPlan.kind === "tool") {
    logger.info("assistant.plan.local_tool", {
      conversationId: nextConversationId,
      toolName: localPlan.name,
      userId: user?.id || "",
    });
    const result = await executeTool(localPlan.name, localPlan.args, {
      user,
      conversationId: nextConversationId,
      source: "local",
      pendingAction,
      assistantContext: mergedMemory,
      conversationMemory: previousMemory,
    });
    return buildAndRememberResponse(result);
  }

  const modelResults = await maybeCallModelPlanner({
    message: normalizedMessage,
    conversationId: nextConversationId,
    user,
    context: mergedMemory,
    memory: previousMemory,
  });

  if (modelResults) {
    logger.info("assistant.plan.model", {
      conversationId: nextConversationId,
      userId: user?.id || "",
      resultCount: modelResults.length,
    });
    return buildAndRememberResponse(mergeResults(modelResults, nextConversationId));
  }

  logger.info("assistant.plan.fallback", {
    conversationId: nextConversationId,
    userId: user?.id || "",
  });
  return buildAndRememberResponse(buildClarificationResponse(nextConversationId));
};

module.exports = {
  buildClarificationResponse,
  buildGreetingResponse,
  chat,
  detectLocalPlan,
  detectGreetingIntent,
};
