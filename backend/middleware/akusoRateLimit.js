const crypto = require("crypto");
const { ipKeyGenerator, rateLimit } = require("express-rate-limit");

const { config } = require("../config/env");
const { formatAkusoErrorResponse } = require("../services/akusoResponseFormatter");
const { logRateLimitHit } = require("../services/akusoAuditLogger");

const createAkusoRateLimiter = ({
  windowMs = config.akuso?.rateLimitWindowMs || 15 * 60 * 1000,
  max = config.akuso?.rateLimitMax || 40,
} = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `akuso:${req.user?.id || ipKeyGenerator(req)}`,
    handler: async (req, res, _next, options) => {
      const traceId = crypto.randomUUID();
      await logRateLimitHit({
        traceId,
        req,
        userId: req.user?.id || "",
        metadata: {
          windowMs,
          max,
        },
      }).catch(() => null);

      const errorResponse = formatAkusoErrorResponse({
        traceId,
        statusCode: options?.statusCode || 429,
        code: "AKUSO_RATE_LIMITED",
        message:
          "Akuso is receiving too many requests from this account right now. Please wait a moment and try again.",
        suggestions: ["Try again shortly.", "Shorten the request if possible."],
      });

      return res.status(errorResponse.statusCode).json(errorResponse.body);
    },
  });

module.exports = createAkusoRateLimiter();
module.exports.createAkusoRateLimiter = createAkusoRateLimiter;
