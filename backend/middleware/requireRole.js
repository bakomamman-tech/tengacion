const normalizeRoles = (allowedRoles = []) =>
  (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles])
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean);

const requireRole = (...allowedRoles) => {
  const normalized = normalizeRoles(allowedRoles.length === 1 ? allowedRoles[0] : allowedRoles);

  return (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const role = String(req.user.role || "").trim().toLowerCase();
    if (!role || !normalized.includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
};

requireRole.requireAdmin = () => requireRole(["admin", "super_admin"]);
requireRole.requireSuperAdmin = () => requireRole(["super_admin"]);
requireRole.normalizeRoles = normalizeRoles;

module.exports = requireRole;
