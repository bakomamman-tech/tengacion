const ApiError = require("../../apps/api/utils/ApiError");
const { STEP_UP_COOKIE_NAME, verifyStepUpToken } = require("../services/authTokens");
const { getCookieValue } = require("../utils/requestCookies");
const User = require("../models/User");

const shouldRequireStepUp = (user, { adminOnly = false } = {}) => {
  const role = String(user?.role || "").toLowerCase();
  const hasMfa = Boolean(user?.twoFactor?.enabled && user?.twoFactor?.method !== "none");
  if (adminOnly) {
    return role === "admin" || role === "super_admin";
  }
  return hasMfa || role === "admin" || role === "super_admin";
};

const requireStepUp = ({ adminOnly = false } = {}) => {
  return async (req, _res, next) => {
    const user = await User.findById(req.user?.id).select("role twoFactor");
    if (!user || !shouldRequireStepUp(user, { adminOnly })) {
      return next();
    }

    const cookieHeader = req.headers.cookie || "";
    const token = getCookieValue(cookieHeader, STEP_UP_COOKIE_NAME);
    if (!token) {
      return next(
        ApiError.conflict("Step-up authentication required", {
          code: "STEP_UP_REQUIRED",
          method:
            user?.twoFactor?.enabled && user?.twoFactor?.method
              ? user.twoFactor.method
              : "totp",
        })
      );
    }

    try {
      const decoded = verifyStepUpToken(token);
      if (
        String(decoded?.id || "") !== String(req.user?.id || "") ||
        String(decoded?.sid || "") !== String(req.user?.sessionId || "")
      ) {
        throw new Error("Session mismatch");
      }
      return next();
    } catch {
      return next(
        ApiError.conflict("Step-up authentication required", {
          code: "STEP_UP_REQUIRED",
          method:
            user?.twoFactor?.enabled && user?.twoFactor?.method
              ? user.twoFactor.method
              : "totp",
        })
      );
    }
  };
};

module.exports = requireStepUp;
