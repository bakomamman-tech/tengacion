const ApiError = require("../utils/ApiError");
const { config } = require("../config/env");

const errorHandler = (err, req, res, _next) => {
  if (err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Upload exceeds the maximum allowed size of 100MB."
        : err.message || "Upload failed";
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      success: false,
      message,
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const isOperational =
    err instanceof ApiError || (Number(statusCode) >= 400 && Number(statusCode) < 500);
  const isProduction = config.NODE_ENV === "production";
  const message =
    isProduction && !isOperational ? "Internal Server Error" : err.message || "Internal Server Error";
  const payload = {
    success: false,
    message,
  };

  if (err.details && (!isProduction || isOperational)) {
    payload.details = err.details;
  }

  if (!isProduction) {
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
