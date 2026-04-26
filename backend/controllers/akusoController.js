const crypto = require("crypto");

const { config } = require("../config/env");
const AssistantFeedback = require("../models/AssistantFeedback");
const { sanitizeCodeCapableText } = require("../services/assistant/outputSanitizer");
const { searchHelpArticles } = require("../services/assistant/helpDocs");
const { searchKnowledgeArticles } = require("../services/assistant/knowledgeBase");
const { buildMathResponse } = require("../services/assistant/math");
const {
  getCreatorPublicPageRoute,
  getCreatorRouteForDashboard,
  getCreatorRouteForOnboarding,
  getUploadRoute,
  getUserProfileRoute,
} = require("../services/assistant/tools/shared");
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
  sendCodingRequest,
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
const {
  setAkusoStreamHeaders,
  streamAkusoChatResponse,
  writeAkusoStreamEvent,
} = require("../services/akusoStreamingService");
const {
  getAkusoMetricsSnapshot,
  recordAkusoFeedback,
  recordAkusoModelAttempt,
  recordAkusoPolicyDecision,
  recordAkusoRequest,
  recordAkusoResponse,
} = require("../services/akusoMetricsService");

const safeText = (value = "", max = 160) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const mergeWarnings = (...groups) =>
  [...new Set(groups.flat().map((entry) => safeText(entry, 200)).filter(Boolean))].slice(0, 4);

const mergeSuggestions = (...groups) =>
  [...new Set(groups.flat().map((entry) => safeText(entry, 140)).filter(Boolean))].slice(0, 6);

const normalizeConcreteRoute = (value = "") => {
  const route = safeText(value, 160);
  if (!route || /\/:[a-z]/i.test(route)) {
    return "";
  }
  return route;
};

const buildAkusoSource = ({ id = "", type = "", label = "", summary = "" } = {}) => {
  const safeLabel = safeText(label, 120);
  if (!safeLabel) {
    return null;
  }

  return {
    id: safeText(id || `${type || "source"}:${safeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, 80),
    type: safeText(type || "akuso_source", 40) || "akuso_source",
    label: safeLabel,
    summary: safeText(summary, 240),
  };
};

const buildAkusoDetail = (title = "", body = "") => {
  const safeTitle = safeText(title, 120);
  const safeBody = safeText(body, 1200);
  if (!safeTitle || !safeBody) {
    return null;
  }

  return {
    title: safeTitle,
    body: safeBody,
  };
};

const buildAkusoCard = ({
  type = "card",
  title = "",
  subtitle = "",
  description = "",
  route = "",
  payload = {},
} = {}) => {
  const safeTitle = safeText(title, 120);
  if (!safeTitle) {
    return null;
  }

  return {
    type: safeText(type, 40) || "card",
    title: safeTitle,
    subtitle: safeText(subtitle, 200),
    description: safeText(description, 500),
    route: normalizeConcreteRoute(route),
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {},
  };
};

const summarizeSourceLabels = (sources = []) =>
  (Array.isArray(sources) ? sources : [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.label || ""))
    .map((entry) => safeText(entry, 140))
    .filter(Boolean)
    .slice(0, 8);

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

const buildPolicyAnswer = ({
  policyResult,
  featureTitle = "",
  isAuthenticated = false,
  canNavigate = false,
} = {}) => {
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
    if (featureTitle && isAuthenticated && canNavigate) {
      return `${featureTitle} uses a secure in-app flow. Open the protected page to review the details and complete the action yourself.`;
    }
    if (featureTitle && isAuthenticated) {
      return `${featureTitle} is handled through a secure in-app flow. Akuso will not perform the action or reveal private financial data for you.`;
    }
    return featureTitle
      ? `${featureTitle} is protected. ${policyResult.denialReason}`
      : policyResult.denialReason;
  }
  return policyResult.denialReason || "Akuso handled the request safely.";
};

const resolveFeatureRoute = async (feature = null, user = {}) => {
  const featureKey = String(feature?.featureKey || "").trim();
  const userId = String(user?.id || user?._id || "").trim();

  if (!featureKey) {
    return "";
  }

  if (featureKey === "profile_editor") {
    return userId ? getUserProfileRoute(userId) : feature.routePattern || "";
  }
  if (featureKey === "creator_onboarding") {
    return userId ? getCreatorRouteForOnboarding(userId) : feature.routePattern || "";
  }
  if (featureKey === "creator_dashboard") {
    return userId ? getCreatorRouteForDashboard(userId) : feature.routePattern || "";
  }
  if (featureKey === "creator_page") {
    return userId ? getCreatorPublicPageRoute(userId) : feature.routePattern || "";
  }
  if (featureKey === "creator_music_upload") {
    return userId ? getUploadRoute(userId, "music") : feature.routePattern || "";
  }
  if (featureKey === "creator_books_upload") {
    return userId ? getUploadRoute(userId, "book") : feature.routePattern || "";
  }
  if (featureKey === "creator_podcasts_upload") {
    return userId ? getUploadRoute(userId, "podcast") : feature.routePattern || "";
  }

  return feature.routePattern || "";
};

const buildSensitiveFeatureGuidance = async ({
  feature = null,
  policyResult,
  user = {},
} = {}) => {
  if (!feature || policyResult.categoryBucket !== POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH) {
    return {
      canNavigate: false,
      actions: [],
      suggestions: policyResult.suggestions,
      details: [],
      sources: [],
      cards: [],
    };
  }

  const resolvedRoute = policyResult.featureAccessAllowed
    ? await resolveFeatureRoute(feature, user)
    : "";
  const canNavigate = Boolean(resolvedRoute && user?.id);

  return {
    canNavigate,
    actions: canNavigate
      ? [
          {
            type: "navigate",
            label: feature.pageName,
            target: resolvedRoute,
          },
        ]
      : [],
    suggestions: mergeSuggestions(
      policyResult.suggestions,
      feature.commonQuestions,
      feature.safeNavigationSteps
    ),
    details: [
      buildAkusoDetail(
        "Secure next step",
        feature.safeNavigationSteps?.[0] ||
          `Open ${feature.pageName} and continue with the built-in protected controls.`
      ),
      buildAkusoDetail(
        "Access",
        canNavigate
          ? `Your current session can open ${feature.pageName} safely, but Akuso will still leave the protected action to the secure page.`
          : feature.cautionNotes?.[0] ||
              "Use the protected page and complete the action yourself after signing in."
      ),
    ].filter(Boolean),
    sources: [
      buildAkusoSource({
        id: `feature:${feature.featureKey}`,
        type: "feature_registry",
        label: feature.pageName,
        summary: feature.assistantExplanation,
      }),
    ].filter(Boolean),
    cards: canNavigate
      ? [
          buildAkusoCard({
            type: "quick-link",
            title: feature.pageName,
            subtitle: "Secure in-app flow",
            description: feature.assistantExplanation,
            route: resolvedRoute,
            payload: {
              destination: feature.featureKey,
              text: `Open ${feature.pageName}`,
            },
          }),
        ].filter(Boolean)
      : [],
  };
};

const buildAppHelpFallback = async ({ input, context, policyResult, user = {} }) => {
  const primaryFeature =
    policyResult.classification.feature || context.relevantFeatures[0] || null;
  const helpArticles = searchHelpArticles(
    input.message || primaryFeature?.pageName || context.page.currentFeatureTitle || "",
    { limit: 3 }
  );

  if (primaryFeature) {
    const resolvedRoute = await resolveFeatureRoute(primaryFeature, user);
    const canNavigate = policyResult.featureAccessAllowed && resolvedRoute;
    const primaryRoute = canNavigate ? resolvedRoute : "";
    const safeNextStep =
      primaryFeature.safeNavigationSteps?.[0] ||
      `Open ${primaryFeature.pageName} and use the built-in controls for the action you want.`;
    const accessNote = canNavigate
      ? `Your current access level can open ${primaryFeature.pageName} directly.`
      : context.auth.isAuthenticated
        ? primaryFeature.cautionNotes?.[0] ||
          "Akuso can explain this feature, but access depends on your role."
        : `You need to sign in before Akuso can open ${primaryFeature.pageName}.`;
    const answer = [
      primaryFeature.pageName,
      "",
      "What it does:",
      `- ${primaryFeature.assistantExplanation}`,
      "",
      "Safe next step:",
      `1. ${safeNextStep}`,
      "",
      "Access:",
      `- ${accessNote}`,
    ].join("\n");
    const details = [
      buildAkusoDetail("Safe next step", safeNextStep),
      buildAkusoDetail(
        "Access",
        canNavigate
          ? `Your current access level can open ${primaryFeature.pageName} directly.`
          : accessNote
      ),
      ...helpArticles.slice(0, 1).map((article) =>
        buildAkusoDetail("Trusted help", article.summary || article.title || "")
      ),
    ].filter(Boolean);
    const sources = [
      buildAkusoSource({
        id: `feature:${primaryFeature.featureKey}`,
        type: "feature_registry",
        label: primaryFeature.pageName,
        summary: primaryFeature.assistantExplanation,
      }),
      ...helpArticles.map((article) =>
        buildAkusoSource({
          id: `help:${article.id || article.title}`,
          type: "help_doc",
          label: article.title,
          summary: article.summary,
        })
      ),
    ].filter(Boolean);
    const cards = [
      buildAkusoCard({
        type: "quick-link",
        title: primaryFeature.pageName,
        subtitle: canNavigate ? "Open inside Tengacion" : "Guided feature",
        description: primaryFeature.assistantExplanation,
        route: primaryRoute,
        payload: {
          destination: primaryFeature.featureKey,
          text: `Open ${primaryFeature.pageName}`,
        },
      }),
      ...helpArticles.slice(0, 2).map((article) =>
        buildAkusoCard({
          type: "help",
          title: article.title,
          subtitle: "Trusted help",
          description: article.summary,
          route: normalizeConcreteRoute(article.route) || primaryRoute,
          payload: {
            featureId: article.featureId || primaryFeature.featureKey,
            text: article.title,
          },
        })
      ),
    ].filter(Boolean);

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
          currentPage: input.currentPage || context.page.currentPage || context.page.pageTitle,
          user,
          limit: 4,
        })
      ),
      actions: canNavigate
        ? [
            {
              type: "navigate",
              label: primaryFeature.pageName,
              target: resolvedRoute,
            },
          ]
        : [],
      sources,
      details,
      cards,
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
      currentPage: input.currentPage || context.page.currentPage || context.page.pageTitle,
      user,
      limit: 6,
    }),
    actions: [],
    sources: [],
    details: [
      buildAkusoDetail(
        "Grounded scope",
        "Akuso can explain real Tengacion features and help you take the next safe in-app step."
      ),
    ].filter(Boolean),
    cards: [],
  };
};

const buildKnowledgeFallback = ({ input, policyResult }) => {
  const article = searchKnowledgeArticles(input.message, { limit: 3 })[0] || null;
  if (article) {
    const bullets = Array.isArray(article.bullets) ? article.bullets.slice(0, 4) : [];
    return {
      answer: [
        article.title,
        "",
        "Summary:",
        article.summary,
        ...(bullets.length > 0
          ? ["", "Key points:", ...bullets.map((bullet) => `- ${bullet}`)]
          : []),
      ].join("\n"),
      warnings: policyResult.warnings,
      suggestions: mergeSuggestions(article.bullets, "Ask Akuso to explain it more simply."),
      actions: [],
      sources: [
        buildAkusoSource({
          id: `knowledge:${article.id || article.title}`,
          type: "knowledge_base",
          label: article.title,
          summary: article.summary,
        }),
      ].filter(Boolean),
      details: article.bullets
        .slice(0, 3)
        .map((bullet, index) =>
          buildAkusoDetail(index === 0 ? "Key idea" : `Key point ${index + 1}`, bullet)
        )
        .filter(Boolean),
      cards: [
        buildAkusoCard({
          type: "knowledge",
          title: article.title,
          subtitle: "Grounded answer",
          description: article.summary,
          payload: {
            text: `Explain ${article.title} more simply`,
          },
        }),
      ].filter(Boolean),
    };
  }

  return {
    answer: [
      "Akuso can explain this, but I need a little more detail to stay grounded.",
      "",
      "Try asking with:",
      "- A specific topic or concept",
      "- A place, timeframe, or example",
      "- The level of simplicity you want",
    ].join("\n"),
    warnings: policyResult.warnings,
    suggestions: ["Ask a narrower question.", "Request a simpler explanation."],
    actions: [],
    sources: [],
    details: [
      buildAkusoDetail(
        "How to get a better answer",
        "Try a more specific topic, place, timeframe, or concept so Akuso can stay grounded."
      ),
    ].filter(Boolean),
    cards: [],
  };
};

const buildReasoningFallback = ({ input, policyResult }) => {
  const mathResponse = buildMathResponse({
    message: input.message || input.prompt || "",
  });

  if (mathResponse) {
    return {
      answer: [
        `The answer is ${mathResponse.answerText}.`,
        "",
        "Expression:",
        mathResponse.expression,
        "",
        "Steps:",
        ...(mathResponse.steps.length > 0
          ? mathResponse.steps.map((step, index) => `${index + 1}. ${step}`)
          : ["1. I used the standard order of operations."]),
      ].join("\n"),
      warnings: policyResult.warnings,
      suggestions: [
        "Ask Akuso to check another calculation.",
        "Ask for a simpler explanation of the steps.",
      ],
      actions: [],
      sources: [],
      details: [
        buildAkusoDetail("Expression", mathResponse.expression),
        buildAkusoDetail(
          "Steps",
          mathResponse.steps.length > 0
            ? mathResponse.steps.join("\n")
            : "I used the standard order of operations."
        ),
      ].filter(Boolean),
      cards: [
        buildAkusoCard({
          type: "knowledge",
          title: "Math answer",
          subtitle: mathResponse.expression,
          description: `Final answer: ${mathResponse.answerText}`,
          payload: {
            text: `Explain ${mathResponse.expression} more simply`,
          },
        }),
      ].filter(Boolean),
    };
  }

  return buildKnowledgeFallback({ input, policyResult });
};

const buildCalculatorFallbackAnswer = () =>
  [
    "I can help build that as a real feature. Assuming a React/Vite frontend, here is a safe calculator component that avoids eval, supports keyboard input, blocks repeated operators, and keeps the UI accessible.",
    "",
    "```jsx",
    "import { useEffect, useMemo, useState } from \"react\";",
    "",
    "const OPERATIONS = {",
    "  \"+\": (left, right) => left + right,",
    "  \"-\": (left, right) => left - right,",
    "  \"x\": (left, right) => left * right,",
    "  \"/\": (left, right) => (right === 0 ? NaN : left / right),",
    "};",
    "",
    "const formatNumber = (value) => {",
    "  if (!Number.isFinite(value)) return \"Error\";",
    "  return Number.parseFloat(value.toFixed(10)).toString();",
    "};",
    "",
    "export default function Calculator() {",
    "  const [display, setDisplay] = useState(\"0\");",
    "  const [storedValue, setStoredValue] = useState(null);",
    "  const [operator, setOperator] = useState(\"\");",
    "  const [waitingForNext, setWaitingForNext] = useState(false);",
    "",
    "  const expression = useMemo(() => {",
    "    if (storedValue === null || !operator) return display;",
    "    return `${storedValue} ${operator} ${waitingForNext ? \"\" : display}`.trim();",
    "  }, [display, operator, storedValue, waitingForNext]);",
    "",
    "  const clear = () => {",
    "    setDisplay(\"0\");",
    "    setStoredValue(null);",
    "    setOperator(\"\");",
    "    setWaitingForNext(false);",
    "  };",
    "",
    "  const inputDigit = (digit) => {",
    "    setDisplay((current) => (waitingForNext || current === \"0\" ? digit : `${current}${digit}`));",
    "    setWaitingForNext(false);",
    "  };",
    "",
    "  const inputDecimal = () => {",
    "    setDisplay((current) => {",
    "      if (waitingForNext) return \"0.\";",
    "      return current.includes(\".\") ? current : `${current}.`;",
    "    });",
    "    setWaitingForNext(false);",
    "  };",
    "",
    "  const backspace = () => {",
    "    if (waitingForNext) return;",
    "    setDisplay((current) => (current.length > 1 ? current.slice(0, -1) : \"0\"));",
    "  };",
    "",
    "  const applyPercent = () => {",
    "    setDisplay((current) => formatNumber(Number(current) / 100));",
    "  };",
    "",
    "  const chooseOperator = (nextOperator) => {",
    "    const currentValue = Number(display);",
    "    if (operator && !waitingForNext) {",
    "      const result = OPERATIONS[operator](Number(storedValue), currentValue);",
    "      setStoredValue(result);",
    "      setDisplay(formatNumber(result));",
    "    } else {",
    "      setStoredValue(currentValue);",
    "    }",
    "    setOperator(nextOperator);",
    "    setWaitingForNext(true);",
    "  };",
    "",
    "  const calculate = () => {",
    "    if (!operator || storedValue === null) return;",
    "    const result = OPERATIONS[operator](Number(storedValue), Number(display));",
    "    setDisplay(formatNumber(result));",
    "    setStoredValue(null);",
    "    setOperator(\"\");",
    "    setWaitingForNext(true);",
    "  };",
    "",
    "  useEffect(() => {",
    "    const onKeyDown = (event) => {",
    "      if (/^[0-9]$/.test(event.key)) inputDigit(event.key);",
    "      if (event.key === \".\") inputDecimal();",
    "      if ([\"+\", \"-\", \"/\"].includes(event.key)) chooseOperator(event.key);",
    "      if (event.key === \"*\") chooseOperator(\"x\");",
    "      if (event.key === \"Enter\" || event.key === \"=\") calculate();",
    "      if (event.key === \"Backspace\") backspace();",
    "      if (event.key === \"Escape\") clear();",
    "    };",
    "    window.addEventListener(\"keydown\", onKeyDown);",
    "    return () => window.removeEventListener(\"keydown\", onKeyDown);",
    "  });",
    "",
    "  const keys = [\"7\", \"8\", \"9\", \"/\", \"4\", \"5\", \"6\", \"x\", \"1\", \"2\", \"3\", \"-\", \"0\", \".\", \"%\", \"+\"];",
    "",
    "  return (",
    "    <section className=\"calculator\" aria-label=\"Calculator\">",
    "      <div className=\"calculator__display\" aria-live=\"polite\">",
    "        <small>{expression}</small>",
    "        <strong>{display}</strong>",
    "      </div>",
    "      <div className=\"calculator__keys\">",
    "        <button type=\"button\" onClick={clear}>Clear</button>",
    "        <button type=\"button\" onClick={backspace}>Delete</button>",
    "        {keys.map((key) => (",
    "          <button key={key} type=\"button\" onClick={() => {",
    "            if (/^[0-9]$/.test(key)) inputDigit(key);",
    "            else if (key === \".\") inputDecimal();",
    "            else if (key === \"%\") applyPercent();",
    "            else chooseOperator(key);",
    "          }}>",
    "            {key}",
    "          </button>",
    "        ))}",
    "        <button type=\"button\" className=\"calculator__equals\" onClick={calculate}>Equal</button>",
    "      </div>",
    "    </section>",
    "  );",
    "}",
    "```",
    "",
    "Add CSS with a fixed button grid, large readable display, focus-visible outlines, and mobile max-width constraints. Then add tests for repeated operators, division by zero, decimal input, percentage, keyboard entry, and backspace.",
  ].join("\n");

const buildSoftwareEngineeringFallback = ({ input, policyResult }) => {
  const message = input.message || input.prompt || "";
  const calculatorRequested = /\bcalculator\b/i.test(message);

  return {
    answer: calculatorRequested
      ? buildCalculatorFallbackAnswer()
      : [
          "Akuso can help with software implementation.",
          "",
          "To make the answer code-ready, share:",
          "1. The framework or stack",
          "2. The relevant files or snippets",
          "3. The expected behavior",
          "4. Any current error message",
          "",
          "Akuso should then respond with a file plan, complete snippets, validation paths, and focused tests.",
        ].join("\n"),
    warnings: mergeWarnings(
      policyResult.warnings,
      "Akuso cannot edit files directly from chat unless a connected coding agent or repository context is provided."
    ),
    suggestions: [
      "Ask Akuso for a file-by-file implementation plan.",
      "Ask for React component code plus CSS and tests.",
      "Share the failing error or relevant file snippets.",
    ],
    actions: [],
    sources: [],
    details: [
      buildAkusoDetail(
        "Coding behavior",
        "Akuso should state assumptions, avoid unsafe eval, include accessible UI behavior, and suggest focused tests for the requested feature."
      ),
    ].filter(Boolean),
    cards: [
      buildAkusoCard({
        type: "guide",
        title: "Implementation checklist",
        subtitle: "Code-ready response",
        description: "Plan files, write complete snippets, cover edge cases, and include tests.",
        payload: {
          text: "Give me the full implementation with tests.",
        },
      }),
    ].filter(Boolean),
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
    answer: [
      `I drafted ${drafts.length} creator-writing option${drafts.length === 1 ? "" : "s"} for ${policyResult.classification.topic || "your request"}.`,
      "",
      "Options:",
      ...drafts.slice(0, 3).map((draft, index) => `${index + 1}. ${draft}`),
    ].join("\n"),
    warnings: policyResult.warnings,
    suggestions: ["Make it shorter.", "Make it sound more premium.", "Rewrite it for fans."],
    actions: [],
    drafts,
    sources: [],
    details: [
      buildAkusoDetail(
        "Writing profile",
        `Tone: ${preferences.tone || "default"}. Audience: ${preferences.audience || "general"}. Length: ${preferences.answerLength || "medium"}.`
      ),
    ].filter(Boolean),
    cards: drafts
      .slice(0, 3)
      .map((draft, index) =>
        buildAkusoCard({
          type: "draft",
          title: `Draft ${index + 1}`,
          subtitle: "Creator writing",
          description: draft,
          payload: {
            text: draft,
          },
        })
      )
      .filter(Boolean),
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
      observability: {
        provider: "local_fallback",
        fallbackReason: "model_router_local",
      },
      meta: {
        provider: "local_fallback",
        model: "",
        task: routeDecision.task,
        usedModel: false,
        grounded: true,
        safetyLevel: policyResult.safetyLevel,
        sources: summarizeSourceLabels(fallback.sources),
      },
    };
  }

  recordAkusoModelAttempt();
  await logAkusoEvent({
    event: "model_attempt",
    traceId,
    req,
    userId: req.user?.id || "",
    conversationId: input.conversationId || context.conversationId || "",
    metadata: {
      routePurpose,
      task: routeDecision.task,
      model: routeDecision.model,
    },
  }).catch(() => null);

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
        : routeDecision.task === "software_engineering"
          ? await sendCodingRequest(requestOptions)
        : routeDecision.task === "reasoning"
          ? await sendReasoningRequest(requestOptions)
          : await sendChatRequest(requestOptions);

    const parsed = response?.parsed;
    if (!parsed || typeof parsed !== "object") {
      return {
        ...fallback,
        observability: {
          provider: "local_fallback",
          fallbackReason: "invalid_model_payload",
        },
        meta: {
          provider: "local_fallback",
          model: "",
          task: routeDecision.task,
          usedModel: false,
          grounded: true,
          safetyLevel: policyResult.safetyLevel,
          sources: summarizeSourceLabels(fallback.sources),
        },
      };
    }

    return {
      answer: sanitizeCodeCapableText(parsed.answer || fallback.answer, 6000),
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
      details: fallback.details || [],
      cards: fallback.cards || [],
      observability: {
        provider: "openai",
        fallbackReason: "",
      },
      meta: {
        provider: "openai",
        model: routeDecision.model,
        task: routeDecision.task,
        usedModel: true,
        grounded: true,
        safetyLevel: policyResult.safetyLevel,
        sources: summarizeSourceLabels(fallback.sources),
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
      observability: {
        provider: "local_fallback",
        fallbackReason: "openai_error",
      },
      warnings: mergeWarnings(fallback.warnings, "Akuso used a safe local fallback for this reply."),
      meta: {
        provider: "local_fallback",
        model: "",
        task: routeDecision.task,
        usedModel: false,
        grounded: true,
        safetyLevel: policyResult.safetyLevel,
        sources: summarizeSourceLabels(fallback.sources),
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

    if (res.headersSent) {
      writeAkusoStreamEvent(res, "error", safeError.body);
      res.end();
      return null;
    }

    return res.status(safeError.statusCode).json(safeError.body);
  }
};

const runAkusoChatRequest = async ({ req, traceId }) => {
  recordAkusoRequest({ routeName: "chat" });
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
  recordAkusoPolicyDecision({
    categoryBucket: policyResult.categoryBucket,
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
    const policyFeature =
      policyResult.classification.feature || context.relevantFeatures[0] || null;
    const sensitiveGuidance =
      policyResult.categoryBucket === POLICY_BUCKETS.SENSITIVE_ACTION_REQUIRES_AUTH
        ? await buildSensitiveFeatureGuidance({
            feature: policyFeature,
            policyResult,
            user: req.user || {},
          })
        : null;
    const policyResponse = formatAkusoChatResponse({
      traceId,
      conversationId: memory.conversationId,
      mode: policyResult.mode,
      category: policyResult.categoryBucket,
      answer: buildPolicyAnswer({
        policyResult,
        featureTitle: policyFeature?.pageName || "",
        isAuthenticated: context.auth.isAuthenticated,
        canNavigate: Boolean(sensitiveGuidance?.canNavigate),
      }),
      warnings: mergeWarnings(
        policyResult.warnings,
        !sensitiveGuidance?.canNavigate ? policyFeature?.cautionNotes || [] : []
      ),
      suggestions: sensitiveGuidance?.suggestions || policyResult.suggestions,
      actions: sensitiveGuidance?.actions || [],
      details:
        sensitiveGuidance?.details?.length > 0
          ? sensitiveGuidance.details
          : policyResult.suggestions
              .slice(0, 1)
              .map((entry) => buildAkusoDetail("Safe next step", entry))
              .filter(Boolean),
      sources: sensitiveGuidance?.sources || [],
      cards: sensitiveGuidance?.cards || [],
      meta: {
        provider: "policy_engine",
        model: "",
        task: "policy",
        usedModel: false,
        grounded: true,
        safetyLevel: policyResult.safetyLevel,
        sources: summarizeSourceLabels(sensitiveGuidance?.sources || []),
      },
    });
    recordAkusoResponse({
      provider: "policy_engine",
      routeName: "chat",
    });
    await logAkusoEvent({
      event: "response",
      traceId,
      req,
      userId: req.user?.id || "",
      conversationId: memory.conversationId,
      metadata: {
        routePurpose: "chat",
        provider: "policy_engine",
        categoryBucket: policyResult.categoryBucket,
      },
    }).catch(() => null);

    return {
      statusCode: policyResult.httpStatus,
      body: policyResponse,
    };
  }

  const fallback =
    policyResult.mode === "creator_writing"
      ? buildWritingFallback({ input: mergedInput, context, policyResult })
      : policyResult.taskType === "software_engineering"
        ? buildSoftwareEngineeringFallback({ input: mergedInput, policyResult })
        : policyResult.taskType === "reasoning"
          ? buildReasoningFallback({ input: mergedInput, policyResult })
          : policyResult.mode === "app_help"
            ? await buildAppHelpFallback({
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
    details: responsePayload.details,
    sources: responsePayload.sources,
    cards: responsePayload.cards,
    meta: responsePayload.meta,
  });
  recordAkusoResponse({
    provider: responsePayload.observability?.provider || responsePayload.meta?.provider || "local_fallback",
    routeName: "chat",
    fallbackReason: responsePayload.observability?.fallbackReason || "",
  });
  await logAkusoEvent({
    event: "response",
    traceId,
    req,
    userId: req.user?.id || "",
    conversationId: response.conversationId || memory.conversationId,
    metadata: {
      routePurpose: "chat",
      provider:
        responsePayload.observability?.provider || responsePayload.meta?.provider || "local_fallback",
      fallbackReason: responsePayload.observability?.fallbackReason || "",
      categoryBucket: policyResult.categoryBucket,
    },
  }).catch(() => null);

  await persistMemoryFromResponse({
    req,
    input: mergedInput,
    context,
    response,
    policyResult,
  });

  return {
    statusCode: 200,
    body: response,
  };
};

const runAkusoHintsRequest = async ({ req, traceId }) => {
  recordAkusoRequest({ routeName: "hints" });
  const input = req.akusoInput || {};
  const hints = getAkusoHints({
    query: input.query,
    currentRoute: input.currentRoute,
    currentPage: input.currentPage,
    user: req.user || {},
    limit: 8,
  });

  return {
    statusCode: 200,
    body: formatAkusoHintsResponse({
      traceId,
      mode: input.mode || "app_help",
      hints,
      currentRoute: input.currentRoute,
    }),
  };
};

const runAkusoFeedbackRequest = async ({ req, traceId }) => {
  recordAkusoRequest({ routeName: "feedback" });
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
  recordAkusoFeedback({
    rating: input.rating,
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

  return {
    statusCode: 201,
    body: formatAkusoFeedbackResponse({
      traceId,
      feedbackId: feedback._id.toString(),
    }),
  };
};

const runAkusoTemplateRequest = async ({ req, traceId }) => {
  recordAkusoRequest({ routeName: "templates" });
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
  recordAkusoPolicyDecision({
    categoryBucket: policyResult.categoryBucket,
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
        routePurpose: "template",
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
        routePurpose: "template",
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
      }),
      warnings: policyResult.warnings,
      suggestions: policyResult.suggestions,
      actions: [],
      details: policyResult.suggestions
        .slice(0, 1)
        .map((entry) => buildAkusoDetail("Safe next step", entry))
        .filter(Boolean),
      sources: [],
      cards: [],
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
    recordAkusoResponse({
      provider: "policy_engine",
      routeName: "template",
    });
    await logAkusoEvent({
      event: "response",
      traceId,
      req,
      userId: req.user?.id || "",
      conversationId: memory.conversationId,
      metadata: {
        routePurpose: "template",
        provider: "policy_engine",
        categoryBucket: policyResult.categoryBucket,
      },
    }).catch(() => null);

    return {
      statusCode: policyResult.httpStatus,
      body: policyResponse,
    };
  }

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
    details: responsePayload.details,
    sources: responsePayload.sources,
    cards: responsePayload.cards,
    meta: responsePayload.meta,
  });
  recordAkusoResponse({
    provider: responsePayload.observability?.provider || responsePayload.meta?.provider || "local_fallback",
    routeName: "template",
    fallbackReason: responsePayload.observability?.fallbackReason || "",
  });
  await logAkusoEvent({
    event: "response",
    traceId,
    req,
    userId: req.user?.id || "",
    conversationId: response.conversationId || memory.conversationId,
    metadata: {
      routePurpose: "template",
      provider:
        responsePayload.observability?.provider || responsePayload.meta?.provider || "local_fallback",
      fallbackReason: responsePayload.observability?.fallbackReason || "",
      categoryBucket: policyResult.categoryBucket,
    },
  }).catch(() => null);

  await persistMemoryFromResponse({
    req,
    input: mergedInput,
    context,
    response,
    policyResult,
  });

  return {
    statusCode: 200,
    body: response,
  };
};

const runAkusoMetricsRequest = async ({ traceId }) => ({
  statusCode: 200,
  body: {
    ok: true,
    traceId,
    metrics: getAkusoMetricsSnapshot(),
  },
});

exports.runAkusoChatRequest = runAkusoChatRequest;
exports.runAkusoHintsRequest = runAkusoHintsRequest;
exports.runAkusoFeedbackRequest = runAkusoFeedbackRequest;
exports.runAkusoTemplateRequest = runAkusoTemplateRequest;
exports.runAkusoMetricsRequest = runAkusoMetricsRequest;

exports.chat = withAkusoHandler(async (req, res, traceId) => {
  if (req.akusoInput?.stream && config.akuso?.enableStreaming) {
    setAkusoStreamHeaders(res);
    writeAkusoStreamEvent(res, "ready", {
      traceId,
    });
    writeAkusoStreamEvent(res, "status", {
      phase: "analyzing",
      label: "Checking policy and grounding",
    });
    const result = await runAkusoChatRequest({ req, traceId });
    return streamAkusoChatResponse({
      req,
      res,
      response: result.body,
      traceId,
      includePrelude: false,
    });
  }

  const result = await runAkusoChatRequest({ req, traceId });
  return res.status(result.statusCode).json(result.body);
});

exports.hints = withAkusoHandler(async (req, res, traceId) => {
  const result = await runAkusoHintsRequest({ req, traceId });
  return res.status(result.statusCode).json(result.body);
});

exports.feedback = withAkusoHandler(async (req, res, traceId) => {
  const result = await runAkusoFeedbackRequest({ req, traceId });
  return res.status(result.statusCode).json(result.body);
});

exports.generateTemplate = withAkusoHandler(async (req, res, traceId) => {
  const result = await runAkusoTemplateRequest({ req, traceId });
  return res.status(result.statusCode).json(result.body);
});

exports.metrics = withAkusoHandler(async (req, res, traceId) => {
  const result = await runAkusoMetricsRequest({ traceId });
  return res.status(result.statusCode).json(result.body);
});
