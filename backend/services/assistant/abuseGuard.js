const { config } = require("../../config/env");

const THROTTLE_WINDOW_MS = Number(config.assistantAbuseWindowMs || 10 * 60 * 1000);
const THROTTLE_DURATION_MS = Number(config.assistantThrottleDurationMs || 15 * 60 * 1000);
const SUSPICIOUS_LIMIT = Number(config.assistantAbuseThreshold || 4);

const state = new Map();

const buildKey = ({ userId = "", sessionId = "", ip = "" } = {}) => {
  const id = String(userId || sessionId || ip || "").trim();
  return id || "anonymous";
};

const pruneEntry = (entry = {}, now = Date.now()) => {
  const recent = Array.isArray(entry.events) ? entry.events.filter((event) => now - Number(event?.at || 0) <= THROTTLE_WINDOW_MS) : [];
  const blockedUntil = Number(entry.blockedUntil || 0);
  return {
    events: recent,
    blockedUntil: blockedUntil > now ? blockedUntil : 0,
  };
};

const recordAssistantRisk = ({ userId = "", sessionId = "", ip = "", suspicious = false } = {}) => {
  const key = buildKey({ userId, sessionId, ip });
  const now = Date.now();
  const current = pruneEntry(state.get(key) || {}, now);
  const nextEvents = suspicious ? [...current.events, { at: now }] : current.events;
  let blockedUntil = current.blockedUntil || 0;

  if (nextEvents.length >= SUSPICIOUS_LIMIT) {
    blockedUntil = now + THROTTLE_DURATION_MS;
  }

  const nextState = {
    events: nextEvents,
    blockedUntil,
  };
  state.set(key, nextState);

  return {
    throttled: blockedUntil > now,
    retryAfterMs: blockedUntil > now ? blockedUntil - now : 0,
    strikes: nextEvents.length,
  };
};

const clearAssistantRisk = ({ userId = "", sessionId = "", ip = "" } = {}) => {
  const key = buildKey({ userId, sessionId, ip });
  state.delete(key);
};

module.exports = {
  clearAssistantRisk,
  recordAssistantRisk,
};
