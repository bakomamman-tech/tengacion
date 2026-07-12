const { findFeatureByIntent, getSurfaceFeatureSummary, getSurfaceQuickPrompts } = require("./featureRegistry");
const { searchHelpArticles } = require("./helpDocs");
const { searchKnowledgeArticles } = require("./knowledgeBase");
const { sanitizePlainText } = require("./outputSanitizer");

const normalizeQuery = (value = "") => sanitizePlainText(value, 240);

const CONTEXT_DEPENDENT_QUERY = /^(it|that|this|there|them|those|yes|no|okay|ok|why|how|explain|continue|go on|tell me more|what about)(?:\b|\s)/i;

const buildContextualQuery = ({ query = "", context = {} } = {}) => {
  const normalized = normalizeQuery(query);
  const memory = context?.memory && typeof context.memory === "object" ? context.memory : {};
  const needsContext = normalized.length < 28 || CONTEXT_DEPENDENT_QUERY.test(normalized);
  if (!needsContext) return normalized;

  const anchors = [
    memory?.lastTopic,
    memory?.lastFeatureId,
    context?.currentFeatureTitle,
    context?.pageTitle,
  ]
    .map((value) => normalizeQuery(value))
    .filter(Boolean);

  return normalizeQuery([normalized, ...new Set(anchors)].filter(Boolean).join(" "));
};

const retrieveAssistantContext = ({ query = "", classification = {}, context = {} } = {}) => {
  const normalizedQuery = normalizeQuery(query);
  const contextualQuery = buildContextualQuery({ query: normalizedQuery, context });
  const surface = context?.currentSurface || classification?.surface || "general";
  const access = context?.isAdmin ? "admin" : context?.isCreator ? "creator" : "authenticated";

  const feature = classification?.feature || findFeatureByIntent(contextualQuery, { access });
  const helpArticles =
    classification?.category === "app_guidance" || classification?.category === "sensitive_action"
      ? searchHelpArticles(contextualQuery, { limit: 4 })
      : [];
  const knowledgeArticles =
    classification?.mode === "knowledge" || classification?.mode === "health" || classification?.mode === "writing" || classification?.mode === "math"
      ? searchKnowledgeArticles(contextualQuery, { limit: 4 })
      : [];

  const retrieved = {
    feature: feature
      ? {
          id: feature.id,
          title: feature.title,
          description: feature.safeDescription || feature.description || "",
          route: feature.route || "",
          access: feature.access,
          allowedActions: [...(feature.allowedActions || [])],
        }
      : null,
    helpArticles,
    knowledgeArticles,
    quickPrompts: getSurfaceQuickPrompts({ surface, access }),
    visibleFeatures: getSurfaceFeatureSummary({ surface, access }),
    contextualQuery,
  };

  return retrieved;
};

const buildRetrievedContextSummary = (retrieved = {}) => {
  const lines = [];
  if (retrieved.feature) {
    lines.push(`Feature: ${retrieved.feature.title} - ${retrieved.feature.description}`);
  }
  for (const article of retrieved.helpArticles || []) {
    lines.push(`Help: ${article.title} - ${article.summary}`);
  }
  for (const article of retrieved.knowledgeArticles || []) {
    lines.push(`Knowledge: ${article.title} - ${article.summary}`);
  }
  return lines.filter(Boolean);
};

module.exports = {
  buildContextualQuery,
  buildRetrievedContextSummary,
  retrieveAssistantContext,
};
