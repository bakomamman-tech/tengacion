const getRealtimeSecurity = (app) => {
  if (!app || typeof app.get !== "function") {
    return null;
  }
  return app.get("realtimeSecurity");
};

const disconnectSessionSockets = (app, sessionId, options = {}) => {
  const realtimeSecurity = getRealtimeSecurity(app);
  return realtimeSecurity?.disconnectSession?.(sessionId, options) || 0;
};

const disconnectUserSockets = (app, userId, options = {}) => {
  const realtimeSecurity = getRealtimeSecurity(app);
  return realtimeSecurity?.disconnectUser?.(userId, options) || 0;
};

const disconnectUserSessionsExcept = (app, userId, exceptSessionId = "", options = {}) => {
  const realtimeSecurity = getRealtimeSecurity(app);
  return (
    realtimeSecurity?.disconnectUserSessionsExcept?.(userId, exceptSessionId, options) || 0
  );
};

module.exports = {
  disconnectSessionSockets,
  disconnectUserSockets,
  disconnectUserSessionsExcept,
};
