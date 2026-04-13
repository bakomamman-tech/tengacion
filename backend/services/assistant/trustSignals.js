const { sanitizePlainText } = require("./outputSanitizer");

const confidenceToLabel = (value = 0.6) => {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return "medium";
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.65) return "medium";
  return "low";
};

const dedupeSources = (items = []) => {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const id = sanitizePlainText(item?.id || "", 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      type: sanitizePlainText(item?.type || "", 40),
      label: sanitizePlainText(item?.label || "", 120),
      summary: sanitizePlainText(item?.summary || "", 240),
    });
  }

  return result.filter((item) => item.type && item.label);
};

const buildAssistantSources = ({ retrieved = {}, usedModel = false, provider = "local-fallback" } = {}) =>
  dedupeSources([
    retrieved?.feature
      ? {
          id: `feature:${retrieved.feature.id}`,
          type: "feature_registry",
          label: retrieved.feature.title,
          summary: retrieved.feature.description || "",
        }
      : null,
    ...(Array.isArray(retrieved?.helpArticles)
      ? retrieved.helpArticles.slice(0, 2).map((article) => ({
          id: `help:${article.id}`,
          type: "help_doc",
          label: article.title,
          summary: article.summary || "",
        }))
      : []),
    ...(Array.isArray(retrieved?.knowledgeArticles)
      ? retrieved.knowledgeArticles.slice(0, 2).map((article) => ({
          id: `knowledge:${article.id}`,
          type: "knowledge_base",
          label: article.title,
          summary: article.summary || "",
        }))
      : []),
    usedModel
      ? {
          id: `provider:${sanitizePlainText(provider, 40) || "openai"}`,
          type: "model_layer",
          label: "Guarded model layer",
          summary: "Akuso used the production model layer to improve wording while keeping the local safety and permission checks.",
        }
      : null,
  ]).slice(0, 8);

const buildAssistantTrust = ({
  classification = {},
  confidence = 0.6,
  usedModel = false,
  provider = "local-fallback",
  sources = [],
} = {}) => {
  const normalizedMode = String(classification?.mode || "general").trim().toLowerCase();
  const trustMode =
    normalizedMode === "copilot"
      ? "app-aware"
      : normalizedMode === "knowledge"
        ? "public-knowledge"
        : normalizedMode === "writing"
          ? "creator-writing"
          : normalizedMode === "health"
            ? "health-caution"
            : normalizedMode || "general";

  const confidenceLabel = confidenceToLabel(confidence);
  const grounded = Array.isArray(sources) ? sources.length > 0 : false;
  const note = usedModel
    ? "Akuso improved this reply with the guarded model layer and kept app actions inside server-checked boundaries."
    : grounded
      ? "Akuso grounded this reply in Tengacion feature data, help docs, or curated knowledge."
      : "Akuso used its local guarded fallback because trusted context was limited.";

  return {
    provider: sanitizePlainText(provider, 40) || "local-fallback",
    mode: trustMode,
    grounded,
    usedModel: Boolean(usedModel),
    confidenceLabel,
    note: sanitizePlainText(note, 240),
  };
};

module.exports = {
  buildAssistantSources,
  buildAssistantTrust,
  confidenceToLabel,
};
