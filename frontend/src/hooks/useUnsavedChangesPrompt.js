import { useEffect } from "react";

export function useUnsavedChangesPrompt(isDirty, message = "") {
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = message || "";
      return message || "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, message]);
}