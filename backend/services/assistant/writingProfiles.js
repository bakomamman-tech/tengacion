const normalizeText = (value = "", max = 200) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const WRITING_TONES = ["formal", "casual", "exciting", "premium", "inspirational", "warm", "professional", "playful"];
const WRITING_AUDIENCES = ["fans", "buyers", "investors", "general public", "students", "followers", "listeners", "readers"];
const WRITING_LENGTHS = ["short", "medium", "long"];
const WRITING_SIMPLICITY = ["basic", "standard", "advanced"];
const WRITING_CONTENT_TYPES = [
  "caption",
  "bio",
  "post",
  "article",
  "promo",
  "release",
  "podcast_summary",
  "podcast_teaser",
  "book_blurb",
  "book_launch",
  "music_launch_post",
  "product_description",
  "event_announcement",
  "fan_engagement",
  "artist_intro",
  "talent_competition",
  "rewrite",
  "summary",
];

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
    formal: "Official update",
    casual: "Quick drop",
    exciting: "Big moment",
    premium: "Premium release",
    inspirational: "Momentum update",
    warm: "Fresh update",
    professional: "Professional note",
    playful: "Fun update",
  };
  return map[String(tone || "").trim().toLowerCase()] || "Fresh update";
};

const audienceHintMap = {
  buyers: "for buyers who want a clear reason to act",
  fans: "for fans who enjoy feeling part of the journey",
  followers: "for followers who want an easy update",
  investors: "for an investor-facing audience",
  listeners: "for listeners who want a strong hook",
  readers: "for readers who care about the story and value",
  students: "in a simple, learning-friendly style",
  "general public": "for a broad public audience",
};

const lengthHintMap = {
  short: "Keep it tight and direct.",
  medium: "Give it a clear opening, a value point, and a light call to action.",
  long: "Add more scene-setting, credibility, and a stronger close.",
};

const buildAudienceTail = (audience = "general public") => audienceHintMap[audience] || audienceHintMap["general public"];

const buildLengthHint = (length = "short") => lengthHintMap[length] || lengthHintMap.short;

const buildVariants = (lines = []) =>
  lines
    .map((line) => normalizeText(line, 500))
    .filter(Boolean)
    .slice(0, 3);

const buildWritingFallbackDraft = ({
  task = "draft",
  contentType = "caption",
  topic = "",
  sourceText = "",
  preferences = {},
} = {}) => {
  const normalized = normalizeWritingPreferences(preferences);
  const cleanTopic = normalizeText(topic, 140) || "your topic";
  const cleanSource = normalizeText(sourceText, 320);
  const prefix = buildVariantPrefix(normalized.tone);
  const audienceTail = buildAudienceTail(normalized.audience);
  const lengthHint = buildLengthHint(normalized.length);

  if (task === "rewrite" && cleanSource) {
    return buildVariants([
      `${prefix}: ${cleanSource}`,
      `Cleaner version: ${cleanSource}. ${lengthHint}`,
      `Polished version: ${cleanSource}. Written ${audienceTail}.`,
    ]);
  }

  if (contentType === "summary") {
    return buildVariants([
      `${prefix}: ${cleanTopic} explained in a clear, simple way.`,
      `${cleanTopic} matters because it is practical, easy to follow, and relevant ${audienceTail}.`,
      `Short summary: ${cleanTopic}, with the main idea, the key takeaway, and what comes next.`,
    ]);
  }

  if (contentType === "bio") {
    return buildVariants([
      `I create around ${cleanTopic} and share work that feels thoughtful, clear, and consistent ${audienceTail}.`,
      `Building a strong voice around ${cleanTopic}, with content, stories, and updates people can connect with.`,
      `${cleanTopic} creator focused on clarity, consistency, and real audience connection.`,
    ]);
  }

  if (contentType === "article") {
    return buildVariants([
      `${prefix}: ${cleanTopic} explained with context, practical insight, and a clear next step. ${lengthHint}`,
      `Article angle: what ${cleanTopic} is, why it matters now, and what your audience should understand first.`,
      `${cleanTopic} deserves an article that feels grounded, easy to follow, and useful after the first read.`,
    ]);
  }

  if (contentType === "book_blurb" || contentType === "book_launch") {
    return buildVariants([
      `${prefix}: ${cleanTopic} opens with a strong promise and gives readers a reason to stay to the final page.`,
      `Book launch copy: ${cleanTopic} is here with a clear hook, emotional pull, and a voice readers can remember.`,
      `Reader-facing line: if you want a book that feels thoughtful, vivid, and engaging, ${cleanTopic} is ready for you.`,
    ]);
  }

  if (contentType === "podcast_summary" || contentType === "podcast_teaser") {
    return buildVariants([
      `${prefix}: This episode dives into ${cleanTopic} with a clear angle, strong takeaway, and easy listening flow.`,
      `Podcast teaser: tune in for a practical, honest conversation about ${cleanTopic}.`,
      `Listener-facing line: if ${cleanTopic} matters to you, this episode is worth your time.`,
    ]);
  }

  if (contentType === "release" || contentType === "music_launch_post") {
    return buildVariants([
      `${prefix}: ${cleanTopic} is out now. Press play, share it, and step into the moment with me.`,
      `Launch post: ${cleanTopic} is finally live, carrying the energy, story, and sound I wanted to share with you.`,
      `Fan line: ${cleanTopic} is for everyone who has been waiting for something fresh, honest, and memorable.`,
    ]);
  }

  if (contentType === "promo" || contentType === "product_description") {
    return buildVariants([
      `${prefix}: ${cleanTopic} is ready ${audienceTail}, with a clear value and an easy reason to act.`,
      `Promo copy: ${cleanTopic} is built to catch attention quickly and convert that attention into action.`,
      `Product line: ${cleanTopic} brings a polished offer, strong clarity, and a confident call to action.`,
    ]);
  }

  if (contentType === "event_announcement" || contentType === "talent_competition") {
    return buildVariants([
      `${prefix}: ${cleanTopic} is happening soon, and this is your moment to show up early and be part of it.`,
      `Event announcement: ${cleanTopic} is open, active, and designed to bring the right people into one strong moment.`,
      `Public invite: if you care about ${cleanTopic}, save the date, spread the word, and come ready.`,
    ]);
  }

  if (contentType === "fan_engagement") {
    return buildVariants([
      `${prefix}: I want to hear from you. What has ${cleanTopic} meant to you lately?`,
      `Fan prompt: drop your thoughts on ${cleanTopic}, tag someone who should see this, and let us build the conversation together.`,
      `Community line: your voice matters here, so tell me what you think about ${cleanTopic}.`,
    ]);
  }

  if (contentType === "artist_intro") {
    return buildVariants([
      `${prefix}: Meet a creator shaping space around ${cleanTopic} with intention, originality, and a clear voice.`,
      `Artist intro: ${cleanTopic} is part of a wider creative journey built on craft, consistency, and connection.`,
      `Introduction line: this creator brings ${cleanTopic} to the audience with confidence and personality.`,
    ]);
  }

  if (contentType === "post") {
    return buildVariants([
      `${prefix}: ${cleanTopic}. ${lengthHint}`,
      `Post idea: ${cleanTopic}, told with a clear point, simple value, and a reason people will engage.`,
      `Community post: ${cleanTopic} is worth sharing, discussing, and bringing into the timeline today.`,
    ]);
  }

  return buildVariants([
    `${prefix}: ${cleanTopic}.`,
    `Version 2: ${cleanTopic}, written ${audienceTail}.`,
    `Version 3: ${cleanTopic}, in a ${normalized.tone} tone with ${normalized.length} pacing.`,
  ]);
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
