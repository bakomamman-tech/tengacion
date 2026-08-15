import { useLocation } from "react-router-dom";

import App from "./App";
import TengaHarvestRootRoutes from "./features/tengaharvest/TengaHarvestRootRoutes";
import { isTengaHarvestPath } from "./features/tengaharvest/tengaHarvestRoutes";

export default function RootApplication() {
  const { pathname } = useLocation();
  return isTengaHarvestPath(pathname) ? <TengaHarvestRootRoutes /> : <App />;
}
