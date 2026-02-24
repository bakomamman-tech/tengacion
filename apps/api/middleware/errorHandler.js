const ApiError = require("../utils/ApiError");
const { config } = require("../config/env");

const errorHandler = (err, req, res, _next) => {
  const isOperational = err instanceof ApiError;
  const statusCode = err.statusCode || 500;
  const payload = {
    success: false,
    message: err.message || "Internal Server Error",
    ...(err.details ? { details: err.details } : {}),
  };

  if (config.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }

  if (!isOperational) {
    console.error("Unhandled exception", {
      path: req.originalUrl,
      method: req.method,
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json(payload);
};

module.exports = errorHandler;
