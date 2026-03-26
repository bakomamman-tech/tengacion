const { buildRestrictedPreviewPath } = require("./moderationPolicyService");

const buildBlurredDerivative = ({ req, category = "", severity = "HIGH" } = {}) => ({
  url: buildRestrictedPreviewPath({ req, category, severity }),
  kind: "placeholder_blurred",
});

module.exports = {
  buildBlurredDerivative,
};
