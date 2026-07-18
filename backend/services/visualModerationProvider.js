const fsp = require("fs/promises");

const {
  ANIMAL_CRUELTY_BLOCK_THRESHOLD,
  CSAM_CRITICAL_THRESHOLD,
  EXPLICIT_BLOCK_THRESHOLD,
  GORE_BLOCK_THRESHOLD,
  GORE_RESTRICT_THRESHOLD,
  MODERATION_CONTEXTUAL_VISION_ENABLED,
  MODERATION_MODEL,
  MODERATION_PROVIDER,
  MODERATION_REQUEST_TIMEOUT_MS,
  MODERATION_VISION_MODEL,
  REVIEW_THRESHOLD,
} = require("../config/moderation");
const { config } = require("../config/env");

const CONTEXTUAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category", "confidence", "severity", "context", "reason"],
  properties: {
    category: {
      type: "string",
      enum: [
        "none",
        "explicit_adult",
        "suspected_child_exploitation",
        "child_abuse",
        "graphic_gore",
        "animal_cruelty",
      ],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
    context: {
      type: "string",
      enum: [
        "ordinary",
        "educational_news_medical",
        "rescue_conservation",
        "glorifying_abuse",
        "unknown",
      ],
    },
    reason: { type: "string", maxLength: 240 },
  },
};

const uniqueStrings = (values = []) => [
  ...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String)),
];

const clampScore = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const buildDecision = ({ decision, labels = [], reason, confidence = 0 }) => ({
  decision,
  labels: uniqueStrings(labels),
  reason: String(reason || "").trim(),
  confidence: clampScore(confidence),
});

const decisionRank = { approve: 0, quarantine: 1, reject: 2 };

const mergeVisualDecisions = (decisions = []) => {
  const values = (Array.isArray(decisions) ? decisions : []).filter(Boolean);
  if (values.length === 0) {
    return buildDecision({
      decision: "quarantine",
      labels: ["inspection_failed"],
      reason: "Unable to inspect uploaded visual media.",
      confidence: 0.2,
    });
  }

  const worst = values.reduce((current, entry) =>
    (decisionRank[entry.decision] || 0) > (decisionRank[current.decision] || 0)
      ? entry
      : current
  );
  return buildDecision({
    decision: worst.decision,
    labels: values.flatMap((entry) => entry.labels || []),
    reason: worst.reason || "Visual moderation completed.",
    confidence: Math.max(...values.map((entry) => clampScore(entry.confidence)), 0),
  });
};

const mapOmniModerationResult = (result = {}) => {
  const categories = result.categories || {};
  const scores = result.category_scores || {};
  const sexualMinorScore = clampScore(scores["sexual/minors"]);
  const sexualScore = clampScore(scores.sexual);
  const graphicScore = clampScore(scores["violence/graphic"]);

  if (categories["sexual/minors"] || sexualMinorScore >= CSAM_CRITICAL_THRESHOLD) {
    return buildDecision({
      decision: "reject",
      labels: ["suspected_child_exploitation", "provider:openai_moderation"],
      reason: "Suspected child sexual exploitation content was blocked and escalated.",
      confidence: Math.max(sexualMinorScore, 0.98),
    });
  }

  if (sexualScore >= EXPLICIT_BLOCK_THRESHOLD) {
    return buildDecision({
      decision: "reject",
      labels: ["explicit_pornography", "provider:openai_moderation"],
      reason: "Explicit adult sexual content was blocked.",
      confidence: sexualScore,
    });
  }

  if (categories.sexual || sexualScore >= REVIEW_THRESHOLD) {
    return buildDecision({
      decision: "quarantine",
      labels: ["explicit_pornography", "sexual_content_review", "provider:openai_moderation"],
      reason: "Sexual content requires trust and safety review before publication.",
      confidence: Math.max(sexualScore, REVIEW_THRESHOLD),
    });
  }

  if (graphicScore >= GORE_BLOCK_THRESHOLD) {
    return buildDecision({
      decision: "reject",
      labels: ["graphic_gore", "provider:openai_moderation"],
      reason: "Extreme graphic violence was blocked.",
      confidence: graphicScore,
    });
  }

  if (categories["violence/graphic"] || graphicScore >= GORE_RESTRICT_THRESHOLD) {
    return buildDecision({
      decision: "quarantine",
      labels: ["graphic_gore", "provider:openai_moderation"],
      reason: "Graphic violent content requires review before publication.",
      confidence: Math.max(graphicScore, GORE_RESTRICT_THRESHOLD),
    });
  }

  return buildDecision({
    decision: "approve",
    labels: ["provider:openai_moderation"],
    reason: "The image passed OpenAI moderation checks.",
    confidence: Math.max(0.1, 1 - Math.max(sexualScore, graphicScore)),
  });
};

const mapOmniModerationResults = (results = []) =>
  mergeVisualDecisions(
    (Array.isArray(results) ? results : []).map(mapOmniModerationResult)
  );

const mapContextualVisionResult = (result = {}) => {
  const category = String(result.category || "none").trim().toLowerCase();
  const confidence = clampScore(result.confidence);
  const severity = String(result.severity || "low").trim().toLowerCase();
  const context = String(result.context || "unknown").trim().toLowerCase();
  const contextual = ["educational_news_medical", "rescue_conservation"].includes(context);
  const critical = ["high", "critical"].includes(severity);
  const reason = String(result.reason || "").trim();

  if (category === "none" || confidence < REVIEW_THRESHOLD) {
    return buildDecision({
      decision: "approve",
      labels: ["provider:contextual_vision"],
      reason: "No contextual child-abuse or animal-cruelty risk was detected.",
      confidence: Math.max(0.1, 1 - confidence),
    });
  }

  if (category === "suspected_child_exploitation") {
    return buildDecision({
      decision: confidence >= 0.9 ? "reject" : "quarantine",
      labels: ["suspected_child_exploitation", "provider:contextual_vision"],
      reason: reason || "Possible child exploitation content requires immediate safety review.",
      confidence,
    });
  }

  if (category === "child_abuse") {
    return buildDecision({
      decision: critical && confidence >= 0.9 && !contextual ? "reject" : "quarantine",
      labels: ["child_abuse", "provider:contextual_vision"],
      reason: reason || "Possible child abuse content requires trust and safety review.",
      confidence,
    });
  }

  if (category === "animal_cruelty") {
    return buildDecision({
      decision:
        !contextual && critical && confidence >= ANIMAL_CRUELTY_BLOCK_THRESHOLD
          ? "reject"
          : "quarantine",
      labels: ["animal_cruelty", "provider:contextual_vision"],
      reason: reason || "Possible animal cruelty content requires trust and safety review.",
      confidence,
    });
  }

  if (category === "graphic_gore") {
    return buildDecision({
      decision: !contextual && critical && confidence >= GORE_BLOCK_THRESHOLD ? "reject" : "quarantine",
      labels: ["graphic_gore", "provider:contextual_vision"],
      reason: reason || "Possible graphic gore requires trust and safety review.",
      confidence,
    });
  }

  if (category === "explicit_adult") {
    return buildDecision({
      decision: confidence >= EXPLICIT_BLOCK_THRESHOLD ? "reject" : "quarantine",
      labels: ["explicit_pornography", "provider:contextual_vision"],
      reason: reason || "Possible explicit adult content requires trust and safety review.",
      confidence,
    });
  }

  return buildDecision({
    decision: "quarantine",
    labels: ["visual_risk_unclassified", "provider:contextual_vision"],
    reason: "Visual safety risk could not be classified confidently.",
    confidence,
  });
};

const withTimeout = (promise, timeoutMs = MODERATION_REQUEST_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Visual moderation request timed out.")), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

let cachedClient = null;
let testClient = null;

const getClient = () => {
  if (testClient) return testClient;
  if (cachedClient) return cachedClient;
  const apiKey = String(config.openAiApiKey || config.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  const openaiModule = require("openai");
  const OpenAI = openaiModule.OpenAI || openaiModule.default || openaiModule;
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
};

const normalizeResponseText = (response = {}) => {
  if (typeof response.output_text === "string") return response.output_text.trim();
  for (const item of Array.isArray(response.output) ? response.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === "string" && part.text.trim()) return part.text.trim();
    }
  }
  return "";
};

const toDataUrls = async (assets = []) => {
  const values = [];
  for (const asset of Array.isArray(assets) ? assets : []) {
    const localPath = String(asset?.localPath || "").trim();
    if (!localPath) continue;
    const data = await fsp.readFile(localPath);
    if (!data.length) continue;
    const mimeType = String(asset?.mimeType || "image/jpeg").toLowerCase();
    values.push(`data:${mimeType};base64,${data.toString("base64")}`);
  }
  return values;
};

const analyzeWithOpenAI = async (assets = []) => {
  const client = getClient();
  if (!client) {
    throw new Error("Visual moderation provider is not configured.");
  }

  const dataUrls = await toDataUrls(assets);
  if (dataUrls.length === 0) {
    throw new Error("No readable image data was available for moderation.");
  }

  const moderationPromise = withTimeout(client.moderations.create({
    model: MODERATION_MODEL,
    input: dataUrls.map((url) => ({ type: "image_url", image_url: { url } })),
  }));

  const contextualPromise = MODERATION_CONTEXTUAL_VISION_ENABLED
    ? withTimeout(client.responses.create({
        model: MODERATION_VISION_MODEL,
        input: [{
          role: "system",
          content: [{
            type: "input_text",
            text: [
              "Classify uploaded visual media for publication safety.",
              "When several images are attached, classify the single most severe visible risk across the entire upload.",
              "Focus only on explicit adult sexual content, suspected sexual exploitation of minors, physical child abuse, graphic gore, and animal cruelty.",
              "Do not flag ordinary family photos, non-explicit affection, childbirth or clinical imagery, normal animal care, farming, hunting without cruelty, wildlife, sports, or fictional art unless the prohibited harm is actually visible.",
              "Use educational/news/medical or rescue/conservation context when clearly present; uncertainty should lower confidence.",
              "Return only the requested structured classification and avoid graphic narrative detail.",
            ].join(" "),
          }],
        }, {
          role: "user",
          content: [
            { type: "input_text", text: "Assess the attached upload before it can be made public." },
            ...dataUrls.map((imageUrl) => ({
              type: "input_image",
              image_url: imageUrl,
              detail: "auto",
            })),
          ],
        }],
        max_output_tokens: 300,
        reasoning: { effort: "none" },
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "visual_safety_classification",
            strict: true,
            schema: CONTEXTUAL_SCHEMA,
          },
        },
      }))
    : Promise.resolve(null);

  const [moderationResponse, contextualResponse] = await Promise.all([
    moderationPromise,
    contextualPromise,
  ]);
  const moderationResults = moderationResponse?.results;
  if (!Array.isArray(moderationResults) || moderationResults.length === 0) {
    throw new Error("Visual moderation provider returned no result.");
  }

  const decisions = [mapOmniModerationResults(moderationResults)];
  if (MODERATION_CONTEXTUAL_VISION_ENABLED) {
    const rawText = normalizeResponseText(contextualResponse);
    let contextualResult = null;
    try {
      contextualResult = JSON.parse(rawText);
    } catch {
      throw new Error("Contextual visual moderation returned an invalid result.");
    }
    decisions.push(mapContextualVisionResult(contextualResult));
  }

  return mergeVisualDecisions(decisions);
};

const analyzeVisualAssets = async (assets = []) => {
  if (MODERATION_PROVIDER === "internal_heuristics") {
    return null;
  }
  if (MODERATION_PROVIDER !== "openai") {
    throw new Error(`Unsupported visual moderation provider: ${MODERATION_PROVIDER}`);
  }
  return analyzeWithOpenAI(assets);
};

const setVisualModerationClientForTests = (client = null) => {
  testClient = client;
  cachedClient = null;
};

module.exports = {
  analyzeVisualAssets,
  mapContextualVisionResult,
  mapOmniModerationResult,
  mapOmniModerationResults,
  mergeVisualDecisions,
  setVisualModerationClientForTests,
};
