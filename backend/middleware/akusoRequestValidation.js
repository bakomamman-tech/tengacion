const { z } = require("zod");

const { config } = require("../config/env");
const { sanitizeRoute } = require("../services/assistant/outputSanitizer");

const isSafeRoute = (value = "") => !value || sanitizeRoute(value) === value;

const routeSchema = z
  .string()
  .trim()
  .max(160)
  .optional()
  .default("")
  .refine((value) => isSafeRoute(value), {
    message: "Invalid internal route",
  });

const modeSchema = z
  .enum(["auto", "app_help", "creator_writing", "knowledge_learning"])
  .optional()
  .default("auto");

const preferencesSchema = z
  .object({
    answerLength: z.enum(["short", "medium", "detailed"]).optional().default("medium"),
    tone: z.string().trim().max(40).optional().default(""),
    preferredMode: z.string().trim().max(40).optional().default(""),
    creatorStyle: z.string().trim().max(80).optional().default(""),
    audience: z.string().trim().max(40).optional().default(""),
    language: z.string().trim().max(40).optional().default(""),
  })
  .strict();

const contextHintsSchema = z
  .object({
    surface: z.string().trim().max(60).optional().default(""),
    pageTitle: z.string().trim().max(120).optional().default(""),
    section: z.string().trim().max(80).optional().default(""),
    selectedEntity: z.string().trim().max(80).optional().default(""),
    publicCreatorId: z.string().trim().max(80).optional().default(""),
  })
  .strict();

const chatSchema = z
  .object({
    message: z.string().trim().min(1).max(config.akuso?.maxInputChars || 2000),
    mode: modeSchema,
    currentRoute: routeSchema,
    currentPage: z.string().trim().max(120).optional().default(""),
    contextHints: contextHintsSchema.optional().default({}),
    preferences: preferencesSchema.optional().default({}),
    conversationId: z.string().trim().max(80).optional().default(""),
    sessionKey: z.string().trim().max(80).optional().default(""),
  })
  .strict();

const templateSchema = z
  .object({
    prompt: z.string().trim().min(1).max(config.akuso?.maxInputChars || 2000),
    contentType: z.string().trim().max(40).optional().default("caption"),
    currentRoute: routeSchema,
    currentPage: z.string().trim().max(120).optional().default(""),
    preferences: preferencesSchema.optional().default({}),
    conversationId: z.string().trim().max(80).optional().default(""),
    sessionKey: z.string().trim().max(80).optional().default(""),
  })
  .strict();

const feedbackSchema = z
  .object({
    traceId: z.string().trim().max(80).optional().default(""),
    feedbackToken: z.string().trim().max(140).optional().default(""),
    conversationId: z.string().trim().max(80).optional().default(""),
    rating: z.enum(["helpful", "not_helpful", "report"]).default("helpful"),
    comment: z.string().trim().max(500).optional().default(""),
    mode: z.string().trim().max(40).optional().default(""),
    category: z.string().trim().max(60).optional().default(""),
  })
  .strict();

const hintsSchema = z
  .object({
    query: z.string().trim().max(160).optional().default(""),
    currentRoute: routeSchema,
    currentPage: z.string().trim().max(120).optional().default(""),
    mode: modeSchema,
  })
  .strict();

const buildValidator = (schema, source = "body") => (req, res, next) => {
  const input = source === "query" ? req.query || {} : req.body || {};
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "AKUSO_VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message || "Invalid Akuso request",
    });
  }

  req.akusoInput = parsed.data;
  return next();
};

module.exports = {
  validateAkusoChatRequest: buildValidator(chatSchema),
  validateAkusoFeedbackRequest: buildValidator(feedbackSchema),
  validateAkusoHintsRequest: buildValidator(hintsSchema, "query"),
  validateAkusoTemplateRequest: buildValidator(templateSchema),
};
