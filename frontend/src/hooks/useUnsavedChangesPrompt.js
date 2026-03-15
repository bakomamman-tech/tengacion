import { useEffect } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";

export function useUnsavedChangesPrompt(isDirty, message = "You have unsaved changes. Leave this page anyway?") {
  const blocker = useBlocker(isDirty);

  useBeforeUnload((event) => {
    if (!isDirty) {
      return;
    }
    event.preventDefault();
    event.returnValue = message;
  });

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }

    const shouldLeave = window.confirm(message);
    if (shouldLeave) {
      blocker.proceed();
      return;
    }
    blocker.reset();
  }, [blocker, message]);
}
