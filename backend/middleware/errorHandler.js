const logger = require("../utils/logger");

/**
 * Global error handler
 * Must be registered LAST in server.js
 */
const errorHandler = (err, req, res, next) => {
  if (err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is too large. Maximum allowed size is 25MB."
        : err.message || "Upload failed";

    return res.status(400).json({
      success: false,
      error: message,
      message,
    });
  }

  logger.error("Request error", {
    path: req.originalUrl,
    method: req.method,
    message: err.message,
    stack:
      process.env.NODE_ENV === "production" ? undefined : err.stack,
  });

  const statusCode =
    res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500;

  res.status(statusCode).json({
    success: false,
    error: err.message || "Server Error",
    message: err.message || "Server Error",
    stack:
      process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

module.exports = errorHandler;
