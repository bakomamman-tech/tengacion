const crypto = require("crypto");

const AssistantFeedback = require("../models/AssistantFeedback");
const { searchHelpArticles } = require("../services/assistant/helpDocs");
const { searchKnowledgeArticles } = require("../services/assistant/knowledgeBase");
const { buildWritingFallbackDraft } = require("../services/assistant/writingProfiles");
const { buildAkusoContext } = require("../services/akusoContextBuilder");
const { buildAkusoPromptBundle } = require("../services/akusoPromptBuilder");
const { evaluateAkusoPolicy, POLICY_BUCKETS } = require("../services/akusoPolicyService");
const { selectAkusoModel } = require("../services/akusoModelRouter");
const {
  formatAkusoChatResponse,
  formatAkusoErrorResponse,
  formatAkusoFeedbackResponse,
  formatAkusoHintsResponse,
} = require("../services/akusoResponseFormatter");
const {
  logAkusoEvent,
  logOpenAIFailure,
  logPolicyDecision,
  logPromptInjection,
} = require("../services/akusoAuditLogger");
const {
  sendChatRequest,
  sendReasoningRequest,
  sendWritingRequest,
} = require("../services/akusoOpenAIService");
const { getAkusoHints } = require("../services/akusoFeatureRegistryService");
const {
  loadAkusoMemory,
  loadAkusoPreferences,
  sanitizeAkusoPreferences,
  saveAkusoMemory,
  saveAkusoPreferences,
} = require("../services/akusoMemoryService");

const safeText = (value = "", max = 160) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const mergeWarnings = (...groups) =>
  [...new Set(groups.flat().map((entry) => safeText(entry, 200)).filter(Boolean))].slice(0, 4);

const mergeSuggestions = (...groups) =>
  [...new Set(groups.flat().map((entry) => safeText(entry, 140)).filter(Boolean))].slice(0, 6);

const inferWritingContentType = (message = "") => {
  const text = String(message || "").toLowerCase();
  if (/\bbio\b/.test(text)) return "bio";
  if (/\bblurb\b|\bbook\b/.test(text)) return "book_blurb";
  if (/\bpodcast\b|\bepisode\b/.test(text)) return "podcast_teaser";
  if (/\barticle\b/.test(text)) return "article";
  if (/\brewrite\b/.test(text)) return "rewrite";
  if (/\brelease\b|\blaunch\b|\bsong\b|\bmusic\b/.test(text)) return "music_launch_post";
  return "caption";
};

const buildPolicyAnswer = ({ policyResult, featureTitle = "" } = {}) => {
  if (policyResult.categoryBucket === POLICY_BUCKETS.PROMPT_INJECTION_ATTEMPT) {
    return policyResult.denialReason;
  }
  if (policyResult.categoryBucket === POLICY_BUCKETS.DISALLOWED) {
    return policyResult.denialReason;
  }
  if (policyResult.categoryBucket === POLICY_BUCKETS.EMERGENCY_ESCALATION) {
    return policyResult.denialReason;
  }
  if (policyResult.categoryBucket === POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH) {
    return featureTitle
      ? `${featureTitle} is protected. ${policyResult.denialReason}`
      : policyResult.denialReason;
  }
  return policyResult.denialReason || "Akuso handled the request safely.";
};

const buildAppHelpFallback = ({ input, context, policyResult, user = {} }) => {
  const primaryFeature =
    policyResult.classification.feature || context.relevantFeatures[0] || null;
  const helpArticles = searchHelpArticles(
    input.message || primaryFeature?.pageName || context.page.currentFeatureTitle || "",
    { limit: 3 }
  );

  if (primaryFeature) {
    const canNavigate = policyResult.featureAccessAllowed && primaryFeature.routePattern;
    const answer = canNavigate
      ? `${primaryFeature.pageName}: ${primaryFeature.assistantExplanation}`
      : context.auth.isAuthenticated
        ? `${primaryFeature.pageName}: ${primaryFeature.assistantExplanation}`
        : `I can explain ${primaryFeature.pageName}, but you need to sign in before Akuso can open that screen.`;

    return {
      answer,
      warnings: mergeWarnings(policyResult.warnings, !canNavigate ? primaryFeature.cautionNotes : []),
      suggestions: mergeSuggestions(
        primaryFeature.commonQuestions,
        primaryFeature.safeNavigationSteps,
        helpArticles.map((article) => article.title),
        getAkusoHints({
          query: input.message,
          currentRoute: input.currentRoute,
          user,
          limit: 4,
        })
      ),
      actions: canNavigate
        ? [
            {
              type: "navigate",
              label: primaryFeature.pageName,
              target: primaryFeature.routePattern,
            },
          ]
        : [],
      sources: [primaryFeature.pageName, ...helpArticles.map((article) => article.title)],
    };
  }

  return {
    answer:
      context.page.currentPage || context.page.pageTitle
        ? `Akuso can help you understand ${context.page.currentPage || context.page.pageTitle} and guide you to the next safe step.`
        : "Akuso can help you move around Tengacion and explain what each real feature does.",
    warnings: policyResult.warnings,
    suggestions: getAkusoHints({
      query: input.message,
      currentRoute: input.currentRoute,
      user,
      limit: 6,
    }),
    actions: [],
    sources: [],
  };
};

const buildKnowledgeFallback = ({ input, policyResult }) => {
  const article = searchKnowledgeArticles(input.message, { limit: 3 })[0] || null;
  if (article) {
    return {
      answer: `${article.title}: ${article.summary}`,
      warnings: policyResult.warnings,
      suggestions: mergeSuggestions(article.bullets, "Ask Akuso to explain it more simply."),
      actions: [],
      sources: [article.title],
    };
  }

  return {
    answer:
      "Akuso can explain knowledge topics clearly, but this request needs more grounded detail than the local knowledge set provides right now.",
    warnings: policyResult.warnings,
    suggestions: ["Ask a narrower question.", "Request a simpler explanation."],
    actions: [],
    sources: [],
  };
};

const buildWritingFallback = ({ input, context, policyResult }) => {
  const preferences = sanitizeAkusoPreferences({
    ...context.preferences,
    ...input.preferences,
  });
  const contentType = inferWritingContentType(input.message || input.prompt || "");
  const drafts = buildWritingFallbackDraft({
    task: contentType === "rewrite" ? "rewrite" : "draft",
    contentType,
    topic: policyResult.classification.topic || input.prompt || input.message,
    sourceText: contentType === "rewrite" ? input.prompt || input.message : "",
    preferences: {
      tone: preferences.tone,
      audience: preferences.audience,
      length: preferences.answerLength === "detailed" ? "long" : preferences.answerLength,
      simplicity: "standard",
      language: preferences.language || "English",
    },
  });

  return {
    answer: `I drafted ${drafts.length} creator-writing option${drafts.length === 1 ? "" : "s"} for ${policyResult.classification.topic || "your request"}.`,
    warnings: policyResult.warnings,
    suggestions: ["Make it shorter.", "Make it sound more premium.", "Rewrite it for fans."],
    actions: [],
    drafts,
    sources: [],
  };
};

const maybeEnhanceFallback = async ({
  routePurpose = "chat",
  input,
  context,
  policyResult,
  fallback,
  traceId,
  req,
}) => {
  const routeDecision = selectAkusoModel({ policyResult, routePurpose });
  if (!routeDecision.useModel) {
    return {
      ...fallback,
      meta: {
        provider: "local_fallback",
        model: "",
        task: routeDecision.task,
        usedModel: false,
        grounded: true,
        safetyLevel: policyResult.safetyLevel,
        sources: fallback.sources || [],
      },
    };
  }

  const promptBundle = buildAkusoPromptBundle({
    input,
    context,
    policyResult,
    fallback,
    routePurpose,
  });

  try {
    const requestOptions = {
      model: routeDecision.model,
      systemPrompt: promptBundle.systemPrompt,
      userPrompt: promptBundle.userPrompt,
      responseSchema: promptBundle.responseSchema,
    };
    const response =
      routeDecision.task === "creator_writing"
        ? await sendWritingRequest(requestOptions)
        : routeDecision.task === "reasoning"
          ? await sendReasoningRequest(requestOptions)
          : await sendChatRequest(requestOptions);

    const parsed = response?.parsed;
    if (!parsed || typeof parsed !== "object") {
      return {
        ...fallback,
        meta: {
          provider: "local_fallback",
          model: "",
          task: routeDecision.task,
          usedModel: false,
          grounded: true,
          safetyLevel: policyResult.safetyLevel,
          sources: fallback.sources || [],
        },
      };
    }

    return {
      answer: safeText(parsed.answer || fallback.answer, 1600),
      warnings: mergeWarnings(fallback.warnings, parsed.warnings || []),
      suggestions: mergeSuggestions(fallback.suggestions, parsed.suggestions || []),
      actions: fallback.actions || [],
      drafts:
        routeDecision.task === "creator_writing"
          ? Array.isArray(parsed.drafts) && parsed.drafts.length > 0
            ? parsed.drafts
            : fallback.drafts || []
          : fallback.drafts || [],
      sources: fallback.sources || [],
      meta: {
        provider: "openai",
        model: routeDecision.model,
        task: routeDecision.task,
        usedModel: true,
        grounded: true,
        safetyLevel: policyResult.safetyLevel,
        sources: fallback.sources || [],
      },
    };
  } catch (error) {
    await logOpenAIFailure({
      traceId,
      req,
      userId: req.user?.id || "",
      metadata: {
        task: routeDecision.task,
        model: routeDecision.model,
        message: error?.message || "Unknown OpenAI failure",
      },
    }).catch(() => null);

    return {
      ...fallback,
      warnings: mergeWarnings(fallback.warnings, "Akuso used a safe local fallback for this reply."),
      meta: {
        provider: "local_fallback",
        model: "",
        task: routeDecision.task,
        usedModel: false,
        grounded: true,
        safetyLevel: policyResult.safetyLevel,
        sources: fallback.sources || [],
      },
    };
  }
};

const persistMemoryFromResponse = async ({
  req,
  input,
  context,
  response,
  policyResult,
}) => {
  const routeAction = (response.actions || []).find((action) => action.type === "navigate") || null;
  await saveAkusoMemory({
    userId: req.user?.id || "",
    conversationId: input.conversationId || response.conversationId,
    sessionKey: input.sessionKey,
    state: {
      recentSummary: response.answer,
      lastTopic: policyResult.classification.topic,
      lastMode: policyResult.mode,
      lastSurface: context.page.surface,
      lastRoute: routeAction?.target || context.page.currentRoute || "",
      lastFeatureKey:
        policyResult.classification.feature?.featureKey || context.page.currentFeatureKey || "",
      preferredAnswerLength: context.preferences.answerLength,
      preferredTone: context.preferences.tone,
      preferredMode: context.preferences.preferredMode || policyResult.mode,
      creatorStyle: context.preferences.creatorStyle,
    },
    preferences: context.preferences,
  }).catch(() => null);

  if (req.user?.id) {
    await saveAkusoPreferences({
      userId: req.user.id,
      preferences: context.preferences,
    }).catch(() => null);
  }
};

const withAkusoHandler = (handler) => async (req, res) => {
  const traceId = crypto.randomUUID();
  try {
    return await handler(req, res, traceId);
  } catch (error) {
    const safeError = formatAkusoErrorResponse({
      traceId,
      statusCode: error?.statusCode || error?.status || 500,
      code: error?.code || "AKUSO_INTERNAL_ERROR",
      message:
        error?.statusCode && error.statusCode < 500
          ? error.message
          : "Akuso hit an internal error and could not complete that request.",
      suggestions: ["Please try again.", "If this keeps happening, send feedback to the team."],
    });

    await logAkusoEvent({
      level: "error",
      event: "controller_failure",
      traceId,
      req,
      userId: req.user?.id || "",
      metadata: {
        message: error?.message || "Unknown controller error",
      },
    }).catch(() => null);

    return res.status(safeError.statusCode).json(safeError.body);
  }
};

exports.chat = withAkusoHandler(async (req, res, traceId) => {
  const input = req.akusoInput || {};
  const storedPreferences = await loadAkusoPreferences({ userId: req.user?.id || "" });
  const memory = await loadAkusoMemory({
    userId: req.user?.id || "",
    conversationId: input.conversationId,
    sessionKey: input.sessionKey,
  });
  const mergedInput = {
    ...input,
    preferences: {
      ...storedPreferences,
      ...(input.preferences || {}),
    },
  };

  const policyResult = evaluateAkusoPolicy({
    input: mergedInput,
    user: req.user || {},
    promptInjectionGuard: req.akusoPromptGuard,
  });
  const context = await buildAkusoContext({
    input: mergedInput,
    user: req.user || {},
    memory,
  });

  if (policyResult.categoryBucket === POLICY_BUCKETS.PROMPT_INJECTION_ATTEMPT) {
    await logPromptInjection({
      traceId,
      req,
      userId: req.user?.id || "",
      metadata: {
        mode: policyResult.mode,
      },
    }).catch(() => null);
  } else {
    await logPolicyDecision({
      level:
        policyResult.categoryBucket === POLICY_BUCKETS.EMERGENCY_ESCALATION ||
        policyResult.categoryBucket === POLICY_BUCKETS.DISALLOWED
          ? "warn"
          : "info",
      event: "policy_decision",
      traceId,
      req,
      userId: req.user?.id || "",
      metadata: {
        categoryBucket: policyResult.categoryBucket,
        mode: policyResult.mode,
        featureKey: policyResult.classification.feature?.featureKey || "",
      },
    }).catch(() => null);
  }

  if (
    [
      POLICY_BUCKETS.PROMPT_INJECTION_ATTEMPT,
      POLICY_BUCKETS.DISALLOWED,
      POLICY_BUCKETS.EMERGENCY_ESCALATION,
      POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH,
    ].includes(policyResult.categoryBucket)
  ) {
    const policyResponse = formatAkusoChatResponse({
      traceId,
      conversationId: memory.conversationId,
      mode: policyResult.mode,
      category: policyResult.categoryBucket,
      answer: buildPolicyAnswer({
        policyResult,
        featureTitle: policyResult.classification.feature?.pageName || "",
      }),
      warnings: policyResult.warnings,
      suggestions: policyResult.suggestions,
      actions: [],
      meta: {
        provider: "policy_engine",
        model: "",
        task: "policy",
        usedModel: false,
        grounded: true,
        safetyLevel: policyResult.safetyLevel,
        sources: [],
      },
    });

    return res.status(policyResult.httpStatus).json(policyResponse);
  }

  const fallback =
    policyResult.mode === "creator_writing"
      ? buildWritingFallback({ input: mergedInput, context, policyResult })
      : policyResult.mode === "app_help"
        ? buildAppHelpFallback({
            input: mergedInput,
            context,
            policyResult,
            user: req.user || {},
          })
        : buildKnowledgeFallback({ input: mergedInput, policyResult });

  const responsePayload = await maybeEnhanceFallback({
    routePurpose: "chat",
    input: mergedInput,
    context,
    policyResult,
    fallback,
    traceId,
    req,
  });

  const response = formatAkusoChatResponse({
    traceId,
    conversationId: memory.conversationId,
    mode: policyResult.mode,
    category: policyResult.categoryBucket,
    answer: responsePayload.answer,
    warnings: responsePayload.warnings,
    suggestions: responsePayload.suggestions,
    actions: responsePayload.actions,
    drafts: responsePayload.drafts,
    meta: responsePayload.meta,
  });

  await persistMemoryFromResponse({
    req,
    input: mergedInput,
    context,
    response,
    policyResult,
  });

  return res.json(response);
});

exports.hints = withAkusoHandler(async (req, res, traceId) => {
  const input = req.akusoInput || {};
  const hints = getAkusoHints({
    query: input.query,
    currentRoute: input.currentRoute,
    user: req.user || {},
    limit: 8,
  });

  return res.json(
    formatAkusoHintsResponse({
      traceId,
      mode: input.mode || "app_help",
      hints,
      currentRoute: input.currentRoute,
    })
  );
});

exports.feedback = withAkusoHandler(async (req, res, traceId) => {
  const input = req.akusoInput || {};
  const feedback = await AssistantFeedback.create({
    userId: req.user.id,
    conversationId: input.conversationId,
    responseId: input.traceId,
    rating: input.rating === "report" ? "not_helpful" : input.rating,
    reason: input.comment,
    mode: input.mode,
    surface: "akuso",
    responseMode: input.mode,
    responseSummary: input.category,
    metadata: {
      akuso: true,
      traceId: input.traceId,
      feedbackToken: input.feedbackToken,
      category: input.category,
      rating: input.rating,
    },
  });

  await logAkusoEvent({
    event: "feedback",
    traceId,
    req,
    userId: req.user.id,
    metadata: {
      rating: input.rating,
      category: input.category,
    },
    persist: true,
  }).catch(() => null);

  return res.status(201).json(
    formatAkusoFeedbackResponse({
      traceId,
      feedbackId: feedback._id.toString(),
    })
  );
});

exports.generateTemplate = withAkusoHandler(async (req, res, traceId) => {
  const input = req.akusoInput || {};
  const memory = await loadAkusoMemory({
    userId: req.user?.id || "",
    conversationId: input.conversationId,
    sessionKey: input.sessionKey,
  });
  const mergedInput = {
    ...input,
    message: input.prompt,
    mode: "creator_writing",
  };
  const policyResult = evaluateAkusoPolicy({
    input: mergedInput,
    user: req.user || {},
    promptInjectionGuard: req.akusoPromptGuard,
  });
  const context = await buildAkusoContext({
    input: mergedInput,
    user: req.user || {},
    memory,
  });

  const fallback = buildWritingFallback({
    input: mergedInput,
    context,
    policyResult,
  });
  const responsePayload = await maybeEnhanceFallback({
    routePurpose: "template",
    input: mergedInput,
    context,
    policyResult,
    fallback,
    traceId,
    req,
  });

  const response = formatAkusoChatResponse({
    traceId,
    conversationId: memory.conversationId,
    mode: "creator_writing",
    category: policyResult.categoryBucket,
    answer: responsePayload.answer,
    warnings: responsePayload.warnings,
    suggestions: responsePayload.suggestions,
    drafts: responsePayload.drafts,
    meta: responsePayload.meta,
  });

  await persistMemoryFromResponse({
    req,
    input: mergedInput,
    context,
    response,
    policyResult,
  });

  return res.json(response);
});
