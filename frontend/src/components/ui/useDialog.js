import { useContext } from "react";

import { DialogContext } from "./DialogContext";

export function useDialog() {
  const value = useContext(DialogContext);

  if (!value) {
    throw new Error("useDialog must be used within a DialogProvider");
  }

  return value;
}
