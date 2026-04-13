const { findFeatureByIntent, getSurfaceFeatureSummary, getSurfaceQuickPrompts } = require("./featureRegistry");
const { searchHelpArticles } = require("./helpDocs");
const { searchKnowledgeArticles } = require("./knowledgeBase");
const { sanitizePlainText } = require("./outputSanitizer");

const normalizeQuery = (value = "") => sanitizePlainText(value, 240);

const retrieveAssistantContext = ({ query = "", classification = {}, context = {} } = {}) => {
  const normalizedQuery = normalizeQuery(query);
  const surface = context?.currentSurface || classification?.surface || "general";
  const access = context?.isAdmin ? "admin" : context?.isCreator ? "creator" : "authenticated";

  const feature = classification?.feature || findFeatureByIntent(normalizedQuery, { access });
  const helpArticles =
    classification?.category === "app_guidance" || classification?.category === "sensitive_action"
      ? searchHelpArticles(normalizedQuery, { limit: 4 })
      : [];
  const knowledgeArticles =
    classification?.mode === "knowledge" || classification?.mode === "health" || classification?.mode === "writing" || classification?.mode === "math"
      ? searchKnowledgeArticles(normalizedQuery, { limit: 4 })
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
  buildRetrievedContextSummary,
  retrieveAssistantContext,
};
