const { detectPromptInjectionAttempt } = require("../services/akusoClassifierService");

const akusoPromptInjectionGuard = (req, _res, next) => {
  const text =
    req.akusoInput?.message ||
    req.akusoInput?.prompt ||
    req.akusoInput?.query ||
    req.body?.message ||
    req.body?.prompt ||
    req.query?.query ||
    "";

  req.akusoPromptGuard = detectPromptInjectionAttempt(text);
  return next();
};

module.exports = akusoPromptInjectionGuard;
