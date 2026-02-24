class ApiError extends Error {
  constructor(message, statusCode = 500, details = null, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", details = null) {
    return new ApiError(message, 400, details);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(message, 401);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(message, 403);
  }

  static notFound(message = "Not found") {
    return new ApiError(message, 404);
  }

  static conflict(message = "Conflict", details = null) {
    return new ApiError(message, 409, details);
  }

  static serviceUnavailable(message = "Service unavailable") {
    return new ApiError(message, 503);
  }
}

module.exports = ApiError;
