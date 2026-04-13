const normalizeText = (value = "", max = 200) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const WRITING_TONES = ["formal", "casual", "exciting", "premium", "inspirational", "warm", "professional", "playful"];
const WRITING_AUDIENCES = ["fans", "buyers", "investors", "general public", "students", "followers", "listeners", "readers"];
const WRITING_LENGTHS = ["short", "medium", "long"];
const WRITING_SIMPLICITY = ["basic", "standard", "advanced"];
const WRITING_CONTENT_TYPES = ["caption", "bio", "post", "article", "promo", "release", "podcast_summary", "book_blurb", "rewrite", "summary"];

const normalizeWritingPreferences = (value = {}) => ({
  tone: WRITING_TONES.includes(String(value?.tone || "").trim().toLowerCase())
    ? String(value.tone).trim().toLowerCase()
    : "warm",
  audience: WRITING_AUDIENCES.includes(String(value?.audience || "").trim().toLowerCase())
    ? String(value.audience).trim().toLowerCase()
    : "general public",
  length: WRITING_LENGTHS.includes(String(value?.length || "").trim().toLowerCase())
    ? String(value.length).trim().toLowerCase()
    : "short",
  simplicity: WRITING_SIMPLICITY.includes(String(value?.simplicity || "").trim().toLowerCase())
    ? String(value.simplicity).trim().toLowerCase()
    : "standard",
  language: normalizeText(value?.language || "English", 40) || "English",
});

const buildWritingBrief = ({
  task = "draft",
  contentType = "caption",
  topic = "",
  sourceText = "",
  preferences = {},
} = {}) => {
  const normalized = normalizeWritingPreferences(preferences);
  const lines = [
    `Task: ${normalizeText(task, 40) || "draft"}`,
    `Content type: ${normalizeText(contentType, 40) || "caption"}`,
    `Tone: ${normalized.tone}`,
    `Audience: ${normalized.audience}`,
    `Length: ${normalized.length}`,
    `Simplicity: ${normalized.simplicity}`,
    `Language: ${normalized.language}`,
  ];

  if (topic) {
    lines.push(`Topic: ${normalizeText(topic, 160)}`);
  }

  if (sourceText) {
    lines.push(`Source text: ${normalizeText(sourceText, 400)}`);
  }

  return lines.join("\n");
};

const buildVariantPrefix = (tone = "warm") => {
  const map = {
    formal: "Professional update",
    casual: "Quick note",
    exciting: "Big update",
    premium: "Premium announcement",
    inspirational: "Momentum update",
    warm: "Fresh update",
    professional: "Professional update",
    playful: "Fun update",
  };
  return map[String(tone || "").trim().toLowerCase()] || "Fresh update";
};

const buildWritingFallbackDraft = ({
  task = "draft",
  contentType = "caption",
  topic = "",
  sourceText = "",
  preferences = {},
} = {}) => {
  const normalized = normalizeWritingPreferences(preferences);
  const cleanTopic = normalizeText(topic, 140) || "your topic";
  const cleanSource = normalizeText(sourceText, 240);
  const prefix = buildVariantPrefix(normalized.tone);
  const audienceTail =
    normalized.audience === "investors"
      ? "for a serious audience"
      : normalized.audience === "students"
        ? "in a simple learning style"
        : normalized.audience === "buyers"
          ? "for buyers"
          : normalized.audience === "fans"
            ? "for fans"
            : "for everyone";

  if (task === "rewrite" && cleanSource) {
    return [
      `${prefix}: ${cleanSource}`,
      `Clear version: ${cleanSource}`,
      `Polished version: ${cleanSource}`,
    ];
  }

  if (contentType === "bio") {
    return [
      `${prefix}: I create and share ${cleanTopic} ${audienceTail}.`,
      `About me: I work on ${cleanTopic} and keep my audience engaged with clear, useful content.`,
      `Bio idea: building in public around ${cleanTopic} with a focused, consistent voice.`,
    ];
  }

  if (contentType === "article" || contentType === "summary") {
    return [
      `${prefix}: ${cleanTopic} explained simply.`,
      `Key points: 1) what it is, 2) why it matters, 3) what to do next.`,
      `Closing idea: ${cleanTopic} deserves a clear, practical explanation.`,
    ];
  }

  if (contentType === "book_blurb") {
    return [
      `${prefix}: A compelling story about ${cleanTopic}.`,
      `Blurb: ${cleanTopic} pulls readers in with a clear promise and a strong emotional hook.`,
      `Buyer's note: ${cleanTopic} is written to hold attention from the first line.`,
    ];
  }

  if (contentType === "podcast_summary") {
    return [
      `${prefix}: This episode covers ${cleanTopic}.`,
      `Summary: In this episode, we explore ${cleanTopic} in a way listeners can follow quickly.`,
      `Teaser: ${cleanTopic} is the main conversation in this episode.`,
    ];
  }

  if (contentType === "release") {
    return [
      `${prefix}: ${cleanTopic} is out now.`,
      `Release copy: ${cleanTopic} arrives with a clear message, a polished vibe, and a reason to share.`,
      `Fan-facing line: ${cleanTopic} is made for people who want something fresh and memorable.`,
    ];
  }

  if (contentType === "promo") {
    return [
      `${prefix}: Join us for ${cleanTopic}.`,
      `Promo copy: ${cleanTopic} is built to catch attention and create action.`,
      `CTA line: ${cleanTopic} is ready for your audience.`,
    ];
  }

  if (contentType === "post") {
    return [
      `${prefix}: ${cleanTopic}.`,
      `Post idea: ${cleanTopic} with a clear takeaway for your audience.`,
      `CTA: If this matters to you, ${cleanTopic} is worth sharing.`,
    ];
  }

  return [
    `${prefix}: ${cleanTopic}.`,
    `Version 2: ${cleanTopic} for ${normalized.audience}.`,
    `Version 3: ${cleanTopic} with a ${normalized.tone} tone and ${normalized.length} length.`,
  ];
};

module.exports = {
  WRITING_AUDIENCES,
  WRITING_CONTENT_TYPES,
  WRITING_LENGTHS,
  WRITING_SIMPLICITY,
  WRITING_TONES,
  buildWritingBrief,
  buildWritingFallbackDraft,
  normalizeWritingPreferences,
};
