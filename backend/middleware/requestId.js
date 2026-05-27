const crypto = require("crypto");

const REQUEST_ID_HEADER = "X-Request-ID";
const SAFE_REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

const normalizeRequestId = (value = "") => {
  const normalized = String(value || "").trim();
  return SAFE_REQUEST_ID_PATTERN.test(normalized) ? normalized : "";
};

const createRequestId = () => crypto.randomUUID();

const requestId = (req, res, next) => {
  const incomingId = normalizeRequestId(req.get(REQUEST_ID_HEADER));
  const resolvedRequestId = incomingId || createRequestId();

  req.id = resolvedRequestId;
  req.requestId = resolvedRequestId;
  res.locals.requestId = resolvedRequestId;
  res.set(REQUEST_ID_HEADER, resolvedRequestId);

  next();
};

module.exports = {
  REQUEST_ID_HEADER,
  createRequestId,
  normalizeRequestId,
  requestId,
};
