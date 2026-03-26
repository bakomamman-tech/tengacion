const requirePermissions = require("./requirePermissions");

const requireModerationPermission = (requiredPermissions = [], options = {}) =>
  requirePermissions(requiredPermissions, options);

module.exports = requireModerationPermission;
