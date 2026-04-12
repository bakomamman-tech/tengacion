const crypto = require("crypto");

const { config } = require("../../config/env");
const logger = require("../../utils/logger");
const { buildAssistantSystemPrompt } = require("./systemPrompt");
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

const detectLocalPlan = (message = "") => {
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

  if (/\b(messages?|inbox|chat)\b/.test(lower) && /\b(open|take me|go to|show me)\b/.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "messages" } };
  }

  if (/\bnotifications?|alerts?\b/.test(lower)) {
    if (/\bshow|open|take me|go to\b/.test(lower)) {
      return { kind: "tool", name: "getNotificationsSummary", args: {} };
    }
    return { kind: "tool", name: "navigateTo", args: { destination: "notifications" } };
  }

  if (/\b(profile|my profile)\b/.test(lower) && /\b(open|take me|go to|show me)\b/.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "profile" } };
  }

  if (
    /\b(creator(?:'s)?\s+page|public\s+creator\s+page|fan\s+page)\b/.test(lower) &&
    /\b(open|take me|go to|show me)\b/.test(lower)
  ) {
    return { kind: "tool", name: "navigateTo", args: { destination: "creator_page" } };
  }

  if (/\bcreator dashboard\b/.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "creator_dashboard" } };
  }

  if (/\b(settings?)\b/.test(lower) && /\b(open|take me|go to|show me)\b/.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "settings" } };
  }

  if (/\bbook publishing\b/.test(lower)) {
    return { kind: "tool", name: "navigateTo", args: { destination: "book_publishing" } };
  }

  if (/\b(upload\b.*\b(song|music|track)\b|\bmusic upload\b)/.test(lower)) {
    return { kind: "tool", name: "openUploadPage", args: { type: "music" } };
  }

  if (/\b(upload\b.*\b(book)\b|\bbook upload\b)/.test(lower)) {
    return { kind: "tool", name: "openUploadPage", args: { type: "book" } };
  }

  if (/\b(upload\b.*\b(podcast|episode)\b|\bpodcast upload\b)/.test(lower)) {
    return { kind: "tool", name: "openUploadPage", args: { type: "podcast" } };
  }

  if (/\b(become a creator|creator onboarding|how do i become a creator|creator signup)\b/.test(lower)) {
    return { kind: "tool", name: "openCreatorOnboarding", args: {} };
  }

  if (/\b(purchases?|orders?|library)\b/.test(lower) && /\b(show|open|take me|go to)\b/.test(lower)) {
    return { kind: "tool", name: "getPurchasesSummary", args: {} };
  }

  if (/\b(search|find|show)\b/.test(lower) && /\b(creator|creators)\b/.test(lower)) {
    const category = /\b(podcast|podcasts)\b/.test(lower)
      ? "podcasts"
      : /\b(book|books|author|publishing)\b/.test(lower)
        ? "books"
        : /\b(gospel|music|song|songs|artist|artists|track|tracks)\b/.test(lower)
          ? "music"
          : "all";
    return {
      kind: "tool",
      name: "searchCreators",
      args: {
        query: stripCommandWords(text) || text,
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

  return {
    kind: "unknown",
    message: text,
  };
};

const maybeCallModelPlanner = async ({ message, user, conversationId }) => {
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
            content: buildAssistantSystemPrompt({ user }),
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

const chat = async ({ user, message, conversationId = "", pendingAction = null }) => {
  const normalizedMessage = String(message || "").trim();
  const nextConversationId = String(conversationId || "").trim() || crypto.randomUUID();

  logger.info("assistant.request.received", {
    conversationId: nextConversationId,
    userId: user?.id || "",
    messageLength: normalizedMessage.length,
    hasPendingAction: Boolean(pendingAction),
  });

  if (!config.assistantEnabled) {
    return normalizeAssistantResult(
      {
        message:
          "Akuso is disabled in this environment. Turn it back on to use navigation, search, creator discovery, and caption drafting.",
        actions: [],
        cards: [],
        requiresConfirmation: false,
        pendingAction: null,
        conversationId: nextConversationId,
      },
      nextConversationId
    );
  }

  if (detectGreetingIntent(normalizedMessage)) {
    logger.info("assistant.plan.greeting", {
      conversationId: nextConversationId,
      userId: user?.id || "",
    });
    return buildGreetingResponse(normalizedMessage, nextConversationId);
  }

  const localPlan = detectLocalPlan(normalizedMessage);
  if (localPlan.kind === "risky") {
    logger.info("assistant.plan.risky", {
      conversationId: nextConversationId,
      userId: user?.id || "",
    });
    return normalizeAssistantResult(
      {
        ...localPlan.response,
        conversationId: nextConversationId,
      },
      nextConversationId
    );
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
    });
    return normalizeAssistantResult(
      {
        ...result,
        conversationId: nextConversationId,
      },
      nextConversationId
    );
  }

  const modelResults = await maybeCallModelPlanner({
    message: normalizedMessage,
    conversationId: nextConversationId,
    user,
  });

  if (modelResults) {
    logger.info("assistant.plan.model", {
      conversationId: nextConversationId,
      userId: user?.id || "",
      resultCount: modelResults.length,
    });
    return mergeResults(modelResults, nextConversationId);
  }

  logger.info("assistant.plan.fallback", {
    conversationId: nextConversationId,
    userId: user?.id || "",
  });
  return buildClarificationResponse(nextConversationId);
};

module.exports = {
  buildClarificationResponse,
  buildGreetingResponse,
  chat,
  detectLocalPlan,
  detectGreetingIntent,
};
