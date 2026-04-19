module.exports = (req, res, next) => {
  const role = String(req.user?.role || "").trim().toLowerCase();
  if (!["admin", "super_admin"].includes(role)) {
    return res.status(403).json({ error: "Marketplace admin access required" });
  }

  return next();
};
