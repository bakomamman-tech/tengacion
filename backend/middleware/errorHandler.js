const logger = require("../utils/logger");

/**
 * Global error handler
 * Must be registered LAST in server.js
 */
const errorHandler = (err, req, res, next) => {
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
    message: err.message || "Server Error",
    stack:
      process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

module.exports = errorHandler;
