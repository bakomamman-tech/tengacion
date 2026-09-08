import { Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";

import App from "./App";
import TengaHarvestRootRoutes from "./features/tengaharvest/TengaHarvestRootRoutes";
import { isTengaHarvestPath } from "./features/tengaharvest/tengaHarvestRoutes";

const LoriettaPortfolio = lazy(() => import("./features/lorietta/LoriettaPortfolio"));

export default function RootApplication() {
  const { pathname } = useLocation();
  if (pathname.replace(/\/+$/, "").toLowerCase() === "/lorietta-billys-portfolio") {
    return <Suspense fallback={<div role="status" style={{ padding: "3rem", background: "#faf9f6", color: "#172d40" }}>Loading portfolio...</div>}><LoriettaPortfolio /></Suspense>;
  }
  return isTengaHarvestPath(pathname) ? <TengaHarvestRootRoutes /> : <App />;
}
