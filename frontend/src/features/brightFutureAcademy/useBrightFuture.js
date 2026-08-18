import { useContext } from "react";

import BrightFutureContext from "./brightFutureContextValue";

export default function useBrightFuture() {
  const value = useContext(BrightFutureContext);
  if (!value) {
    throw new Error("useBrightFuture must be used inside BrightFutureProvider");
  }
  return value;
}
