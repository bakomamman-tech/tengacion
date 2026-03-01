import { Navigate } from "react-router-dom";

export default function AdminRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = String(user?.role || "").toLowerCase();
  if (!["admin", "super_admin"].includes(role)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
