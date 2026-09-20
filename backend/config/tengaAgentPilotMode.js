"use strict";

// This opt-in pilot exemption is tied to one isolated Render service.
// It cannot be enabled by changing NODE_ENV or the flag on production Tengacion.
const PILOT_RENDER_SERVICE_ID = "srv-dalprie7bikc73a6hhgg";

const isTengaAgentPilotMode = (env = process.env) =>
  env.TENGAAGENT_PILOT_MODE === "true" &&
  env.RENDER_SERVICE_ID === PILOT_RENDER_SERVICE_ID &&
  env.NODE_ENV === "production";

const isPilotApiPath = (path, method) => {
  const route = String(path || "");
  const verb = String(method || "").toUpperCase();
  if (verb === "GET" && /^\/health(?:\/|$)/.test(route)) return true;
  if (verb === "GET" && route === "/me") return true;
  if (/^\/auth(?:\/|$)/.test(route)) return true;
  if (/^\/tengaagent\/(?:owner|public|chat)(?:\/|$)/.test(route)) return true;
  if (verb === "GET" && route === "/tengaagent/health") return true;
  if (verb === "GET" && route === "/tengaagent/billing/plans") return true;
  return false;
};

const tengaAgentPilotApiGuard = (req, res, next) => {
  if (!isTengaAgentPilotMode() || isPilotApiPath(req.path, req.method)) {
    return next();
  }
  return res.status(403).set("Cache-Control", "no-store").json({
    code: "TENGAAGENT_PILOT_ONLY",
    message: "This isolated pilot only supports TengaAgent testing; payments and other Tengacion APIs are disabled.",
  });
};

module.exports = { isTengaAgentPilotMode, isPilotApiPath, tengaAgentPilotApiGuard };
