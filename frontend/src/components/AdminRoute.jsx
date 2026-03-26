import { Navigate } from "react-router-dom";

const normalizePermissions = (permissions = []) =>
  Array.isArray(permissions)
    ? [...new Set(
      permissions
        .map((entry) => String(entry || "").trim().toLowerCase())
        .filter(Boolean)
    )]
    : [];

export default function AdminRoute({ user, children, requiredPermissions = [] }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = String(user?.role || "").toLowerCase();
  const permissions = normalizePermissions(user?.permissions);
  const needs = normalizePermissions(requiredPermissions);
  const hasRequiredPermissions = needs.every((entry) => permissions.includes(entry));

  if (!["admin", "super_admin", "trust_safety_admin"].includes(role) && permissions.length === 0) {
    return <Navigate to="/home" replace />;
  }

  if (!hasRequiredPermissions) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
