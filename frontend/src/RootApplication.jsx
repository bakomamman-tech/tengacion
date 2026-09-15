import { Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";

import App from "./App";
import AdminRoute from "./components/AdminRoute";
import { useAuth } from "./context/AuthContext";
import TengaHarvestRootRoutes from "./features/tengaharvest/TengaHarvestRootRoutes";
import { isTengaHarvestPath } from "./features/tengaharvest/tengaHarvestRoutes";

const LoriettaPortfolio = lazy(() => import("./features/lorietta/LoriettaPortfolio"));
const AdminVoiceBridgeDiagnostics = lazy(() => import("./pages/AdminVoiceBridgeDiagnostics"));

export default function RootApplication() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const normalizedPath = pathname.replace(/\/+$/, "").toLowerCase();

  if (normalizedPath === "/lorietta-billys-portfolio") {
    return <Suspense fallback={<div role="status" style={{ padding: "3rem", background: "#faf9f6", color: "#172d40" }}>Loading portfolio...</div>}><LoriettaPortfolio /></Suspense>;
  }

  if (normalizedPath === "/admin/voicebridge") {
    if (loading) {
      return <div role="status" style={{ padding: "3rem" }}>Loading admin session...</div>;
    }
    return (
      <Suspense fallback={<div role="status" style={{ padding: "3rem" }}>Loading VoiceBridge diagnostics...</div>}>
        <AdminRoute user={user} allowedRoles={["admin", "super_admin"]}>
          <AdminVoiceBridgeDiagnostics user={user} />
        </AdminRoute>
      </Suspense>
    );
  }

  return isTengaHarvestPath(pathname) ? <TengaHarvestRootRoutes /> : <App />;
}
