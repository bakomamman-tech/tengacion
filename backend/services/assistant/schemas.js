const { z } = require("zod");

const ASSISTANT_DESTINATIONS = [
  "home",
  "messages",
  "notifications",
  "profile",
  "creator_dashboard",
  "creator_page",
  "settings",
  "book_publishing",
  "music_upload",
  "podcast_upload",
  "purchases",
  "creator_onboarding",
  "find_creators",
  "search",
  "dashboard",
];

const ASSISTANT_UPLOAD_TYPES = ["music", "book", "podcast"];
const ASSISTANT_SEARCH_CONTENT_TYPES = ["all", "posts", "tracks", "books", "albums", "podcasts"];
const ASSISTANT_TONES = ["friendly", "playful", "professional", "inspiring", "warm"];

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
    route: internalRouteSchema.optional().default(""),
    payload: z.object({}).passthrough().optional().default({}),
  })
  .strict();

const assistantPendingActionSchema = z
  .object({
    type: z.string().trim().min(1).max(40),
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(400).optional().default(""),
    route: internalRouteSchema.optional().default(""),
    payload: z.object({}).passthrough().optional().default({}),
  })
  .strict();

const assistantRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    conversationId: z.string().trim().max(80).optional().default(""),
    pendingAction: assistantPendingActionSchema.nullable().optional().default(null),
  })
  .strict();

const assistantResponseSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    actions: z.array(assistantActionSchema).max(5).default([]),
    cards: z.array(assistantCardSchema).max(12).default([]),
    requiresConfirmation: z.boolean().default(false),
    pendingAction: assistantPendingActionSchema.nullable().optional().default(null),
    conversationId: z.string().trim().max(80).optional().default(""),
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

module.exports = {
  ASSISTANT_DESTINATIONS,
  ASSISTANT_UPLOAD_TYPES,
  ASSISTANT_SEARCH_CONTENT_TYPES,
  ASSISTANT_TONES,
  assistantActionSchema,
  assistantCardSchema,
  assistantPendingActionSchema,
  assistantRequestSchema,
  assistantResponseSchema,
  emptyToolInputSchema,
  draftPostCaptionToolInputSchema,
  explainFeatureToolInputSchema,
  internalRouteSchema,
  isSafeInternalRoute,
  navigateToToolInputSchema,
  openUploadPageToolInputSchema,
  searchContentToolInputSchema,
  searchCreatorsToolInputSchema,
};
