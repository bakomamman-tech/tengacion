const crypto = require("crypto");

const normalizeIp = (value = "") => String(value || "").split(",")[0].trim();

const buildDeviceFingerprint = ({ deviceName = "", userAgent = "" } = {}) =>
  crypto
    .createHash("sha256")
    .update(`${String(deviceName || "").trim()}|${String(userAgent || "").trim()}`)
    .digest("hex");

const extractCountry = (headers = {}) =>
  String(
    headers["cf-ipcountry"] ||
      headers["x-vercel-ip-country"] ||
      headers["x-country-code"] ||
      ""
  )
    .trim()
    .toUpperCase();

const extractCity = (headers = {}) =>
  String(headers["x-vercel-ip-city"] || headers["cf-ipcity"] || "").trim();

const normalizeSessionMeta = ({ deviceName = "", ip = "", userAgent = "", headers = {} } = {}) => ({
  deviceName: String(deviceName || "").trim().slice(0, 180),
  ip: normalizeIp(ip),
  userAgent: String(userAgent || "").trim().slice(0, 400),
  country: extractCountry(headers),
  city: extractCity(headers),
  fingerprint: buildDeviceFingerprint({ deviceName, userAgent }),
});

const scoreLoginRisk = (user, sessionMeta = {}) => {
  const reasons = [];
  let score = 0;

  const trustedDevices = Array.isArray(user?.trustedDevices) ? user.trustedDevices : [];
  const sessions = Array.isArray(user?.sessions) ? user.sessions : [];
  const fingerprint = String(sessionMeta?.fingerprint || "");
  const latestSession = [...sessions]
    .filter((entry) => !entry?.revokedAt)
    .sort((a, b) => new Date(b?.lastSeenAt || b?.createdAt || 0) - new Date(a?.lastSeenAt || a?.createdAt || 0))[0];
  const knownDevice = fingerprint
    ? trustedDevices.some((entry) => String(entry?.fingerprint || "") === fingerprint)
    : false;

  if (trustedDevices.length > 0 && fingerprint && !knownDevice) {
    score += 45;
    reasons.push("new_device");
  }

  if (latestSession?.ip && sessionMeta?.ip && String(latestSession.ip) !== String(sessionMeta.ip)) {
    score += 20;
    reasons.push("new_ip");
  }

  if (
    latestSession?.country &&
    sessionMeta?.country &&
    String(latestSession.country) !== String(sessionMeta.country)
  ) {
    score += 35;
    reasons.push("new_country");
    const lastLoginAt = new Date(user?.lastLoginAt || user?.lastLogin || 0).getTime();
    if (lastLoginAt && Date.now() - lastLoginAt < 6 * 60 * 60 * 1000) {
      score += 50;
      reasons.push("impossible_travel");
    }
  }

  return {
    score,
    reasons,
    shouldNotify: score >= 20 || reasons.length > 0,
    isSuspicious: score >= 60,
  };
};

const updateTrustedDevice = (user, sessionMeta = {}) => {
  if (!user || !sessionMeta?.fingerprint) {
    return;
  }

  user.trustedDevices = Array.isArray(user.trustedDevices) ? user.trustedDevices : [];
  const existing = user.trustedDevices.find(
    (entry) => String(entry?.fingerprint || "") === String(sessionMeta.fingerprint || "")
  );

  if (existing) {
    existing.deviceName = sessionMeta.deviceName || existing.deviceName || "";
    existing.userAgent = sessionMeta.userAgent || existing.userAgent || "";
    existing.lastIp = sessionMeta.ip || existing.lastIp || "";
    existing.lastCountry = sessionMeta.country || existing.lastCountry || "";
    existing.lastSeenAt = new Date();
    return;
  }

  user.trustedDevices.push({
    fingerprint: sessionMeta.fingerprint,
    deviceName: sessionMeta.deviceName || "",
    userAgent: sessionMeta.userAgent || "",
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    lastIp: sessionMeta.ip || "",
    lastCountry: sessionMeta.country || "",
  });

  if (user.trustedDevices.length > 20) {
    user.trustedDevices = user.trustedDevices.slice(-20);
  }
};

module.exports = {
  normalizeSessionMeta,
  scoreLoginRisk,
  updateTrustedDevice,
};
