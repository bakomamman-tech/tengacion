import { Navigate } from "react-router-dom";

export default function KadahiveAdminRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/kadahive/login?returnTo=/kadahive/admin" replace />;
  }

  const globalRole = String(user.role || "").toLowerCase();
  const membership = (Array.isArray(user.institutionMemberships)
    ? user.institutionMemberships
    : []
  ).find((entry) => String(entry?.institution || "").toLowerCase() === "kadahive");
  const allowed =
    ["admin", "super_admin"].includes(globalRole) ||
    (membership?.role === "admin" && membership?.status === "active");

  if (!allowed) {
    return <Navigate to="/kadahive/portal" replace />;
  }

  return children;
}
