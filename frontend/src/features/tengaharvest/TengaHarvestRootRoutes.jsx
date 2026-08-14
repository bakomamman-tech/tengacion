import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminRoute from "../../components/AdminRoute";
import { useAuth } from "../../context/AuthContext";
import TengaHarvestLandingPage from "./TengaHarvestLandingPage";
import TengaHarvestFarmerPage from "./TengaHarvestFarmerPage";
import TengaHarvestProviderPage from "./TengaHarvestProviderPage";
import TengaHarvestAdminPage from "./TengaHarvestAdminPage";

export const isTengaHarvestPath = (pathname = "") =>
  pathname === "/tengaharvest" ||
  pathname.startsWith("/tengaharvest/") ||
  pathname === "/admin/tengaharvest";

export default function TengaHarvestRootRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname === "/admin/tengaharvest";

  if (isAdminRoute && loading) {
    return (
      <div className="th-page">
        <div className="th-admin-shell">
          <p>Restoring your Tengacion admin session…</p>
        </div>
      </div>
    );
  }

  return (
    <Routes location={location}>
      <Route path="/tengaharvest" element={<TengaHarvestLandingPage />} />
      <Route path="/tengaharvest/" element={<TengaHarvestLandingPage />} />
      <Route path="/tengaharvest/farmer" element={<TengaHarvestFarmerPage />} />
      <Route path="/tengaharvest/provider" element={<TengaHarvestProviderPage />} />
      <Route
        path="/admin/tengaharvest"
        element={
          <AdminRoute user={user} allowedRoles={["admin", "super_admin"]}>
            <TengaHarvestAdminPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/tengaharvest" replace />} />
    </Routes>
  );
}
