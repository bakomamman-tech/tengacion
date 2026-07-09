const logger = require("../utils/logger");

/**
 * Global error handler
 * Must be registered LAST in server.js
 */
const errorHandler = (err, req, res, next) => {
  if (err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is too large. Maximum allowed size is 100MB."
        : err.message || "Upload failed";
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;

    return res.status(status).json({
      success: false,
      error: message,
      message,
    });
  }

  logger.error("Request error", {
    path: req.originalUrl,
    method: req.method,
    requestId: req.requestId || res.locals?.requestId || "",
    message: err.message,
    stack:
      process.env.NODE_ENV === "production" ? undefined : err.stack,
  });

  const explicitStatus = Number(err.statusCode || err.status || 0);
  const statusCode = explicitStatus >= 400 && explicitStatus < 600
    ? explicitStatus
    : res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500;
  const body = {
    success: false,
    error: err.message || "Server Error",
    message: err.message || "Server Error",
    requestId: req.requestId || res.locals?.requestId || "",
    stack:
      process.env.NODE_ENV === "production" ? undefined : err.stack,
  };

  if (err.code) {
    body.code = err.code;
  }
  if (err.details && (err.isOperational || statusCode < 500 || process.env.NODE_ENV !== "production")) {
    body.details = err.details;
  }

  res.status(statusCode).json(body);
};

module.exports = errorHandler;
