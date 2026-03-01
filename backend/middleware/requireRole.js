const requireRole = (allowedRoles = []) => {
  const normalized = Array.isArray(allowedRoles)
    ? allowedRoles.map((entry) => String(entry || "").trim().toLowerCase())
    : [];

  return (req, res, next) => {
    const role = String(req.user?.role || "").trim().toLowerCase();
    if (!role) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!normalized.includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
};

module.exports = requireRole;
