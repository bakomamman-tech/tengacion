import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import Button from "../ui/Button";
import { isSafeAssistantRoute } from "../../services/assistantActionExecutor";

const isBrowser = typeof document !== "undefined";

export default function AssistantConfirmDialog({
  open = false,
  pendingAction = null,
  onConfirm,
  onCancel,
}) {
  const confirmButtonRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      confirmButtonRef.current?.focus?.();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  if (!open || !isBrowser) {
    return null;
  }

  const route = String(pendingAction?.route || "").trim();
  const canContinue = isSafeAssistantRoute(route);
  const title = pendingAction?.label
    ? `Open ${pendingAction.label}`
    : "Confirm with Akuso";
  const description =
    pendingAction?.description ||
    "Akuso only confirms safe in-app navigation. It never performs sensitive actions by itself.";
  const confirmLabel = canContinue
    ? pendingAction?.label
      ? `Open ${pendingAction.label}`
      : "Continue"
    : "Okay";

  return createPortal(
    <div
      className="tg-assistant-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel?.();
        }
      }}
    >
      <div
        className="tg-assistant-confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="tg-assistant-confirm-card__badge" aria-hidden="true">
          !
        </div>
        <div className="tg-assistant-confirm-card__copy">
          <h3 id={titleId}>{title}</h3>
          <p id={descriptionId}>{description}</p>
          {canContinue ? (
            <p className="tg-assistant-confirm-card__hint">
              Akuso will take you to {route}.
            </p>
          ) : null}
        </div>
        <div className="tg-assistant-confirm-card__actions">
          <Button type="button" variant="secondary" onClick={() => onCancel?.()}>
            Cancel
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            variant="primary"
            onClick={() => onConfirm?.(pendingAction)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
