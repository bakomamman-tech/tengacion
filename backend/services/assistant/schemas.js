const { z } = require("zod");

const ASSISTANT_DESTINATIONS = [
  "home",
  "messages",
  "notifications",
  "profile",
  "creator_dashboard",
  "creator_page",
  "settings",
  "settings_privacy",
  "settings_security",
  "settings_notifications",
  "settings_display",
  "settings_sound",
  "help_support",
  "feedback",
  "book_publishing",
  "music_upload",
  "podcast_upload",
  "creator_settings",
  "creator_support",
  "creator_verification",
  "creator_earnings",
  "creator_payouts",
  "purchases",
  "creator_onboarding",
  "find_creators",
  "search",
  "dashboard",
  "friends",
  "groups",
  "rooms",
  "saved",
  "memories",
  "events",
  "birthdays",
  "calculator",
  "ads_manager",
  "live",
  "news",
  "trending",
  "admin_dashboard",
];

const ASSISTANT_UPLOAD_TYPES = ["music", "book", "podcast"];
const ASSISTANT_SEARCH_CONTENT_TYPES = ["all", "posts", "tracks", "books", "albums", "podcasts"];
const ASSISTANT_MODES = ["general", "knowledge", "copilot", "writing", "math", "health", "refusal", "emergency"];
const ASSISTANT_WRITING_TONES = ["formal", "casual", "exciting", "premium", "inspirational", "warm", "professional", "playful"];
const ASSISTANT_WRITING_AUDIENCES = ["fans", "buyers", "investors", "general public", "students", "followers", "listeners", "readers"];
const ASSISTANT_WRITING_LENGTHS = ["short", "medium", "long"];
const ASSISTANT_WRITING_SIMPLICITY = ["basic", "standard", "advanced"];
const ASSISTANT_TONES = ["friendly", "playful", "professional", "inspiring", "warm"];
const ASSISTANT_CONTEXT_SURFACES = [
  "general",
  "home",
  "messages",
  "notifications",
  "profile",
  "creator",
  "creator_page",
  "creator_onboarding",
  "creator_dashboard",
  "creator_music_upload",
  "creator_books_upload",
  "creator_podcasts_upload",
  "creator_finance",
  "search",
  "discovery",
  "purchases",
  "settings",
  "support",
  "social",
  "utility",
  "business",
  "live",
  "news",
  "discover",
  "admin",
];

const isSafeInternalRoute = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/")) {
    return false;
  }

  if (raw.includes("://") || raw.includes("\\") || raw.includes("..")) {
    return false;
  }

  return true;
};

const internalRouteSchema = z.string().trim().min(1).max(160).refine(isSafeInternalRoute, {
  message: "Invalid internal route",
});

const optionalInternalRouteSchema = z
  .string()
  .trim()
  .max(160)
  .default("")
  .refine((value) => value === "" || isSafeInternalRoute(value), {
    message: "Invalid internal route",
  });

const actionStateSchema = z.object({}).passthrough().default({});

const navigationActionSchema = z.object({
  type: z.literal("navigate"),
  target: internalRouteSchema,
  state: actionStateSchema.optional().default({}),
  label: z.string().trim().max(120).optional().default(""),
}).strict();

const openModalActionSchema = z.object({
  type: z.literal("open_modal"),
  target: z.string().trim().max(120).optional().default(""),
  state: actionStateSchema.optional().default({}),
  label: z.string().trim().max(120).optional().default(""),
}).strict();

const openTabActionSchema = z.object({
  type: z.literal("open_tab"),
  target: z.string().trim().max(120).optional().default(""),
  state: actionStateSchema.optional().default({}),
  label: z.string().trim().max(120).optional().default(""),
}).strict();

const prefillFormActionSchema = z.object({
  type: z.literal("prefill_form"),
  target: z.string().trim().max(120).optional().default(""),
  state: actionStateSchema.optional().default({}),
  label: z.string().trim().max(120).optional().default(""),
}).strict();

const assistantActionSchema = z.discriminatedUnion("type", [
  navigationActionSchema,
  openModalActionSchema,
  openTabActionSchema,
  prefillFormActionSchema,
]);

const assistantCardSchema = z
  .object({
    type: z.string().trim().min(1).max(40),
    title: z.string().trim().min(1).max(120),
    subtitle: z.string().trim().max(200).optional().default(""),
    description: z.string().trim().max(500).optional().default(""),
    route: optionalInternalRouteSchema,
    payload: z.object({}).passthrough().optional().default({}),
  })
  .strict();

const assistantSourceSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    type: z.string().trim().min(1).max(40),
    label: z.string().trim().min(1).max(120),
    summary: z.string().trim().max(240).optional().default(""),
  })
  .strict();

const assistantDetailSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(1200),
  })
  .strict();

const assistantFollowUpSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    prompt: z.string().trim().min(1).max(240),
    kind: z.string().trim().max(40).optional().default("prompt"),
    route: optionalInternalRouteSchema,
  })
  .strict();

const assistantSafetySchema = z
  .object({
    level: z.enum(["safe", "caution", "refusal", "emergency"]).default("safe"),
    notice: z.string().trim().max(500).optional().default(""),
    escalation: z.string().trim().max(240).optional().default(""),
  })
  .strict();

const assistantTrustSchema = z
  .object({
    provider: z.string().trim().max(40).optional().default("local-fallback"),
    mode: z.string().trim().max(40).optional().default("general"),
    grounded: z.boolean().optional().default(true),
    usedModel: z.boolean().optional().default(false),
    confidenceLabel: z.string().trim().max(24).optional().default("medium"),
    note: z.string().trim().max(240).optional().default(""),
  })
  .strict();

const assistantPreferencesSchema = z
  .object({
    tone: z.string().trim().max(40).optional().default(""),
    audience: z.string().trim().max(40).optional().default(""),
    length: z.string().trim().max(20).optional().default(""),
    simplicity: z.string().trim().max(20).optional().default(""),
    language: z.string().trim().max(40).optional().default(""),
  })
  .strict();

const assistantContextSchema = z
  .object({
    currentPath: z.string().trim().max(160).optional().default(""),
    currentSearch: z.string().trim().max(160).optional().default(""),
    surface: z.enum(ASSISTANT_CONTEXT_SURFACES).optional().default("general"),
    pageTitle: z.string().trim().max(120).optional().default(""),
    selectedChatId: z.string().trim().max(80).optional().default(""),
    selectedContentId: z.string().trim().max(80).optional().default(""),
  })
  .strict();

const assistantPendingActionSchema = z
  .object({
    type: z.string().trim().min(1).max(40),
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(400).optional().default(""),
    route: optionalInternalRouteSchema,
    payload: z.object({}).passthrough().optional().default({}),
  })
  .strict();

const assistantRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    conversationId: z.string().trim().max(80).optional().default(""),
    pendingAction: assistantPendingActionSchema.nullable().optional().default(null),
    context: assistantContextSchema.optional().default({}),
    assistantModeHint: z.string().trim().max(40).optional().default(""),
    preferences: assistantPreferencesSchema.optional().default({}),
  })
  .strict();

const assistantResponseSchema = z
  .object({
    responseId: z.string().trim().max(80).optional().default(""),
    message: z.string().trim().min(1).max(1000),
    mode: z.enum(ASSISTANT_MODES).default("general"),
    safety: assistantSafetySchema.default({ level: "safe", notice: "", escalation: "" }),
    trust: assistantTrustSchema.default({
      provider: "local-fallback",
      mode: "general",
      grounded: true,
      usedModel: false,
      confidenceLabel: "medium",
      note: "",
    }),
    sources: z.array(assistantSourceSchema).max(8).default([]),
    details: z.array(assistantDetailSchema).max(10).default([]),
    followUps: z.array(assistantFollowUpSchema).max(10).default([]),
    actions: z.array(assistantActionSchema).max(5).default([]),
    cards: z.array(assistantCardSchema).max(12).default([]),
    requiresConfirmation: z.boolean().default(false),
    pendingAction: assistantPendingActionSchema.nullable().optional().default(null),
    conversationId: z.string().trim().max(80).optional().default(""),
    confidence: z.number().min(0).max(1).optional().default(0.6),
  })
  .strict();

const assistantFeedbackSchema = z
  .object({
    conversationId: z.string().trim().max(80).optional().default(""),
    messageId: z.string().trim().max(80).optional().default(""),
    responseId: z.string().trim().max(80).optional().default(""),
    rating: z.enum(["helpful", "not_helpful"]),
    reason: z.string().trim().max(500).optional().default(""),
    mode: z.string().trim().max(40).optional().default(""),
    surface: z.string().trim().max(60).optional().default(""),
    responseMode: z.string().trim().max(40).optional().default(""),
    responseSummary: z.string().trim().max(800).optional().default(""),
    metadata: z.object({}).passthrough().optional().default({}),
  })
  .strict();

const navigateToToolInputSchema = z
  .object({
    destination: z.enum(ASSISTANT_DESTINATIONS),
  })
  .strict();

const searchCreatorsToolInputSchema = z
  .object({
    query: z.string().trim().min(1).max(120),
    category: z.enum(["music", "books", "podcasts", "all"]).optional().default("all"),
  })
  .strict();

const searchContentToolInputSchema = z
  .object({
    query: z.string().trim().min(1).max(120),
    type: z.enum(ASSISTANT_SEARCH_CONTENT_TYPES).optional().default("all"),
  })
  .strict();

const emptyToolInputSchema = z.object({}).strict();

const openUploadPageToolInputSchema = z
  .object({
    type: z.enum(ASSISTANT_UPLOAD_TYPES),
  })
  .strict();

const draftPostCaptionToolInputSchema = z
  .object({
    topic: z.string().trim().min(1).max(140),
    tone: z.enum(ASSISTANT_TONES).optional().default("warm"),
  })
  .strict();

const explainFeatureToolInputSchema = z
  .object({
    featureName: z.string().trim().min(1).max(140),
  })
  .strict();

const draftContentToolInputSchema = z
  .object({
    contentType: z
      .enum([
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
      ])
      .default("caption"),
    topic: z.string().trim().min(1).max(160),
    sourceText: z.string().trim().max(1200).optional().default(""),
    tone: z.enum(ASSISTANT_WRITING_TONES).optional().default("warm"),
    audience: z.enum(ASSISTANT_WRITING_AUDIENCES).optional().default("general public"),
    length: z.enum(ASSISTANT_WRITING_LENGTHS).optional().default("short"),
    simplicity: z.enum(ASSISTANT_WRITING_SIMPLICITY).optional().default("standard"),
    language: z.string().trim().max(40).optional().default("English"),
  })
  .strict();

const solveMathToolInputSchema = z
  .object({
    expression: z.string().trim().min(1).max(240),
  })
  .strict();

const healthGuidanceToolInputSchema = z
  .object({
    topic: z.string().trim().max(160).optional().default(""),
    message: z.string().trim().max(1000).optional().default(""),
  })
  .strict();

const searchHelpToolInputSchema = z
  .object({
    query: z.string().trim().min(1).max(160),
  })
  .strict();

module.exports = {
  ASSISTANT_DESTINATIONS,
  ASSISTANT_MODES,
  ASSISTANT_UPLOAD_TYPES,
  ASSISTANT_SEARCH_CONTENT_TYPES,
  ASSISTANT_WRITING_AUDIENCES,
  ASSISTANT_WRITING_LENGTHS,
  ASSISTANT_WRITING_SIMPLICITY,
  ASSISTANT_WRITING_TONES,
  ASSISTANT_TONES,
  assistantActionSchema,
  assistantContextSchema,
  assistantCardSchema,
  assistantDetailSchema,
  assistantFeedbackSchema,
  assistantFollowUpSchema,
  assistantPendingActionSchema,
  assistantPreferencesSchema,
  assistantRequestSchema,
  assistantResponseSchema,
  assistantSafetySchema,
  assistantSourceSchema,
  assistantTrustSchema,
  emptyToolInputSchema,
  draftContentToolInputSchema,
  draftPostCaptionToolInputSchema,
  explainFeatureToolInputSchema,
  internalRouteSchema,
  isSafeInternalRoute,
  healthGuidanceToolInputSchema,
  navigateToToolInputSchema,
  openUploadPageToolInputSchema,
  searchHelpToolInputSchema,
  searchContentToolInputSchema,
  searchCreatorsToolInputSchema,
  solveMathToolInputSchema,
};
