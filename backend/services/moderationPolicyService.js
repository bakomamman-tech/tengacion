const {
  MODERATION_QUEUES,
  MODERATION_STATUSES,
} = require("../config/moderation");

const STATUS = Object.fromEntries(MODERATION_STATUSES.map((entry) => [entry, entry]));
const QUEUE = Object.fromEntries(MODERATION_QUEUES.map((entry) => [entry, entry]));

const CSAM_TERMS = [
  "child sexual abuse",
  "child porn",
  "child pornography",
  "csam",
  "minor nude",
  "minor explicit",
  "underage explicit",
  "preteens",
  "preteen sex",
  "young teen explicit",
];

const EXPLICIT_ADULT_TERMS = [
  "explicit porn",
  "explicit pornography",
  "hardcore sex",
  "porn",
  "porno",
  "sex tape",
  "xxx",
  "nsfw sex",
];

const EXTREME_GORE_TERMS = [
  "beheading",
  "bloodshed",
  "bloodbath",
  "decapitation",
  "dismember",
  "dismemberment",
  "gore",
  "graphic blood",
  "graphic violence",
  "massacre",
  "mutilation",
];

const ANIMAL_CRUELTY_TERMS = [
  "animal cruelty",
  "animal torture",
  "cockfight",
  "cockfighting",
  "dogfight",
  "dog fighting",
  "sadistic animal",
  "torture animal",
];

const GORE_CONTEXT_TERMS = [
  "awareness",
  "documentary",
  "education",
  "journalism",
  "medical",
  "news",
  "research",
];

const ANIMAL_CONTEXT_TERMS = [
  "awareness",
  "conservation",
  "documentary",
  "education",
  "rescue",
  "veterinary",
];

const SADISTIC_TERMS = [
  "glorified",
  "glorifying",
  "sadistic",
  "for fun",
  "celebration",
];

const normalizeText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeMediaSignals = (media = []) =>
  (Array.isArray(media) ? media : [])
    .map((entry) =>
      [
        entry?.originalFilename,
        entry?.sourceUrl,
        entry?.previewUrl,
        entry?.mimeType,
        entry?.mediaType,
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join(" | ");

const collectMatches = (haystack = "", terms = []) =>
  terms.filter((entry) => haystack.includes(normalizeText(entry)));

const hasAnyMatch = (haystack = "", terms = []) => collectMatches(haystack, terms).length > 0;

const buildRestrictedPreviewPath = ({ req, category = "", severity = "HIGH" } = {}) => {
  const query = new URLSearchParams();
  if (category) {
    query.set("category", category);
  }
  if (severity) {
    query.set("severity", severity);
  }

  const pathname = `/api/media/moderation-placeholder.svg?${query.toString()}`;
  if (!req || typeof req.get !== "function") {
    return pathname;
  }
  return `${req.protocol}://${req.get("host")}${pathname}`;
};

const evaluateModerationPolicy = ({
  title = "",
  description = "",
  metadata = {},
  media = [],
  reportReason = "",
  detectionSource = "automated_upload_scan",
}) => {
  const combinedText = normalizeText(
    [
      title,
      description,
      metadata?.caption,
      metadata?.seriesName,
      metadata?.authorName,
      metadata?.details,
      reportReason,
      normalizeMediaSignals(media),
    ]
      .filter(Boolean)
      .join(" | ")
  );

  const csamMatches = collectMatches(combinedText, CSAM_TERMS);
  if (csamMatches.length > 0) {
    return {
      queue: QUEUE.suspected_child_exploitation,
      status: STATUS.BLOCK_SUSPECTED_CHILD_EXPLOITATION,
      severity: "CRITICAL",
      priorityScore: 100,
      riskLabels: ["suspected_child_exploitation", ...csamMatches],
      quarantineMedia: true,
      neverGeneratePreview: true,
      requiresEscalation: true,
      workflowState: "ESCALATED",
      publicWarningLabel: "Suspected child exploitation content blocked",
      summary: "Suspected child sexual exploitation content was blocked and escalated.",
    };
  }

  const explicitAdultMatches = collectMatches(combinedText, EXPLICIT_ADULT_TERMS);
  if (explicitAdultMatches.length > 0) {
    return {
      queue: QUEUE.explicit_pornography,
      status: STATUS.BLOCK_EXPLICIT_ADULT,
      severity: "CRITICAL",
      priorityScore: 90,
      riskLabels: ["explicit_pornography", ...explicitAdultMatches],
      quarantineMedia: true,
      neverGeneratePreview: true,
      requiresEscalation: false,
      workflowState: "OPEN",
      publicWarningLabel: "Explicit adult content blocked",
      summary: "Explicit adult sexual content was blocked and quarantined.",
    };
  }

  const animalCrueltyMatches = collectMatches(combinedText, ANIMAL_CRUELTY_TERMS);
  if (animalCrueltyMatches.length > 0) {
    const sadistic = hasAnyMatch(combinedText, SADISTIC_TERMS);
    const contextual = hasAnyMatch(combinedText, ANIMAL_CONTEXT_TERMS);
    return {
      queue: QUEUE.animal_cruelty,
      status: sadistic
        ? STATUS.BLOCK_ANIMAL_CRUELTY
        : contextual
          ? STATUS.RESTRICTED_BLURRED
          : STATUS.HOLD_FOR_REVIEW,
      severity: sadistic ? "CRITICAL" : contextual ? "HIGH" : "HIGH",
      priorityScore: sadistic ? 85 : contextual ? 72 : 75,
      riskLabels: ["animal_cruelty", ...(sadistic ? ["sadistic"] : []), ...animalCrueltyMatches],
      quarantineMedia: !contextual,
      neverGeneratePreview: false,
      requiresEscalation: false,
      workflowState: "OPEN",
      publicWarningLabel: "Sensitive animal cruelty media",
      summary: sadistic
        ? "Animal cruelty with sadistic or glorifying context was blocked."
        : contextual
          ? "Animal cruelty content was restricted to blurred preview pending review."
          : "Animal cruelty content was held for trust and safety review.",
    };
  }

  const goreMatches = collectMatches(combinedText, EXTREME_GORE_TERMS);
  if (goreMatches.length > 0) {
    const contextual = hasAnyMatch(combinedText, GORE_CONTEXT_TERMS);
    const extreme = hasAnyMatch(combinedText, ["beheading", "decapitation", "dismemberment", "massacre"]);
    return {
      queue: QUEUE.graphic_gore,
      status: extreme && !contextual
        ? STATUS.BLOCK_EXTREME_GORE
        : contextual
          ? STATUS.RESTRICTED_BLURRED
          : STATUS.HOLD_FOR_REVIEW,
      severity: extreme && !contextual ? "CRITICAL" : "HIGH",
      priorityScore: extreme && !contextual ? 80 : contextual ? 68 : 70,
      riskLabels: ["graphic_gore", ...goreMatches],
      quarantineMedia: !contextual,
      neverGeneratePreview: false,
      requiresEscalation: false,
      workflowState: "OPEN",
      publicWarningLabel: "Graphic violent media",
      summary:
        extreme && !contextual
          ? "Extreme gore was blocked from public display."
          : contextual
            ? "Graphic violence was restricted to blurred previews only."
            : "Graphic gore was held for moderator review.",
    };
  }

  if (detectionSource === "user_report") {
    const reportedReason = normalizeText(reportReason);
    const severity =
      reportedReason === "violence" || reportedReason === "nudity" ? "HIGH" : "MEDIUM";

    return {
      queue: QUEUE.user_reported_sensitive_content,
      status: STATUS.HOLD_FOR_REVIEW,
      severity,
      priorityScore: severity === "HIGH" ? 60 : 50,
      riskLabels: ["user_reported_sensitive_content", reportedReason].filter(Boolean),
      quarantineMedia: false,
      neverGeneratePreview: false,
      requiresEscalation: false,
      workflowState: "OPEN",
      publicWarningLabel: "Sensitive content under review",
      summary: "User-reported sensitive content was added to the moderation queue.",
    };
  }

  return {
    queue: "",
    status: STATUS.ALLOW,
    severity: "LOW",
    priorityScore: 0,
    riskLabels: [],
    quarantineMedia: false,
    neverGeneratePreview: false,
    requiresEscalation: false,
    workflowState: "RESOLVED",
    publicWarningLabel: "",
    summary: "Content passed the current moderation policy checks.",
  };
};

module.exports = {
  buildRestrictedPreviewPath,
  evaluateModerationPolicy,
};
