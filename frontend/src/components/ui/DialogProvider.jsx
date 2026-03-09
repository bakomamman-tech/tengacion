import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import Button from "./Button";
import { DialogContext } from "./DialogContext";

const isBrowser = typeof document !== "undefined";

const DEFAULT_COPY = {
  alert: {
    title: "Notice",
    confirmLabel: "Okay",
  },
  confirm: {
    title: "Please confirm",
    confirmLabel: "Continue",
    cancelLabel: "Cancel",
  },
  prompt: {
    title: "Complete this action",
    confirmLabel: "Continue",
    cancelLabel: "Cancel",
    label: "Response",
  },
};

function normalizeDialogConfig(type, config) {
  if (typeof config === "string") {
    return {
      ...DEFAULT_COPY[type],
      description: config,
      type,
    };
  }

  return {
    ...DEFAULT_COPY[type],
    cancelable: true,
    required: false,
    trim: true,
    confirmVariant: "primary",
    defaultValue: "",
    inputMode: "text",
    options: [],
    ...config,
    type,
  };
}

function getDismissResult(dialog) {
  if (!dialog) {
    return undefined;
  }

  if (dialog.type === "prompt") {
    return null;
  }

  if (dialog.type === "confirm") {
    return false;
  }

  return undefined;
}

function getChoiceLabel(option) {
  if (typeof option === "string") {
    return option;
  }

  return option?.label || option?.value || "";
}

function getChoiceValue(option) {
  if (typeof option === "string") {
    return option;
  }

  return option?.value || option?.label || "";
}

export function DialogProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const queueRef = useRef([]);
  const panelRef = useRef(null);
  const primaryActionRef = useRef(null);
  const cancelActionRef = useRef(null);
  const inputRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const activeDialog = queue[0] || null;

  const closeDialog = useCallback((result) => {
    const currentDialog = queueRef.current[0];
    if (!currentDialog) {
      return;
    }

    currentDialog.resolve(result);
    setQueue((currentQueue) => currentQueue.slice(1));
  }, []);

  const enqueueDialog = useCallback((type, config = {}) => {
    const normalized = normalizeDialogConfig(type, config);

    return new Promise((resolve) => {
      setQueue((currentQueue) => [...currentQueue, { ...normalized, resolve }]);
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      alert: (config) => enqueueDialog("alert", config),
      confirm: (config) => enqueueDialog("confirm", config),
      prompt: (config) => enqueueDialog("prompt", config),
    }),
    [enqueueDialog]
  );

  useEffect(() => {
    if (!activeDialog) {
      return;
    }

    setInputValue(String(activeDialog.defaultValue || ""));
  }, [activeDialog]);

  useEffect(() => {
    if (!activeDialog || !isBrowser) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add("tg-dialog-open");

    const focusTarget = window.setTimeout(() => {
      if (activeDialog.type === "prompt" && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
        return;
      }

      if (activeDialog.cancelLabel && cancelActionRef.current) {
        cancelActionRef.current.focus();
        return;
      }

      primaryActionRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTarget);
      document.body.classList.remove("tg-dialog-open");
      previouslyFocusedRef.current?.focus?.();
    };
  }, [activeDialog]);

  useEffect(() => {
    if (!activeDialog) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && activeDialog.cancelable !== false) {
        event.preventDefault();
        closeDialog(getDismissResult(activeDialog));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDialog, closeDialog]);

  const handleBackdropMouseDown = (event) => {
    if (
      event.target === event.currentTarget &&
      activeDialog?.cancelable !== false
    ) {
      closeDialog(getDismissResult(activeDialog));
    }
  };

  const handlePanelKeyDown = (event) => {
    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = panelRef.current?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements?.length) {
      event.preventDefault();
      return;
    }

    const focusable = Array.from(focusableElements);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const normalizedInput = activeDialog?.trim === false ? inputValue : inputValue.trim();
  const inputIsValid = !activeDialog?.required || Boolean(normalizedInput);

  const submitPrompt = () => {
    if (!activeDialog) {
      return;
    }

    if (activeDialog.type !== "prompt") {
      closeDialog(activeDialog.type === "confirm" ? true : undefined);
      return;
    }

    if (!inputIsValid) {
      return;
    }

    closeDialog(normalizedInput);
  };

  const dialogToneClass =
    activeDialog?.confirmVariant === "destructive"
      ? "tg-dialog--danger"
      : activeDialog?.type === "prompt"
        ? "tg-dialog--prompt"
        : activeDialog?.type === "confirm"
          ? "tg-dialog--confirm"
          : "tg-dialog--alert";

  const dialogMarkup =
    activeDialog && isBrowser
      ? createPortal(
          <div
            className="tg-dialog-backdrop"
            role="presentation"
            onMouseDown={handleBackdropMouseDown}
          >
            <div
              ref={panelRef}
              className={`tg-dialog ${dialogToneClass}`}
              role={activeDialog.type === "prompt" ? "dialog" : "alertdialog"}
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              onKeyDown={handlePanelKeyDown}
            >
              <div className="tg-dialog__badge" aria-hidden="true">
                {activeDialog.type === "prompt"
                  ? "?"
                  : activeDialog.confirmVariant === "destructive"
                    ? "!"
                    : activeDialog.type === "confirm"
                      ? "?"
                      : "i"}
              </div>

              <div className="tg-dialog__copy">
                <h2 id={titleId} className="tg-dialog__title">
                  {activeDialog.title}
                </h2>
                <p id={descriptionId} className="tg-dialog__description">
                  {activeDialog.description}
                </p>
              </div>

              {activeDialog.type === "prompt" && (
                <form
                  className="tg-dialog__form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitPrompt();
                  }}
                >
                  <label className="tg-dialog__field">
                    <span className="tg-dialog__label">{activeDialog.label}</span>
                    <input
                      ref={inputRef}
                      className="tg-dialog__input"
                      type="text"
                      inputMode={activeDialog.inputMode || "text"}
                      autoComplete="off"
                      value={inputValue}
                      placeholder={activeDialog.placeholder || ""}
                      onChange={(event) => setInputValue(event.target.value)}
                    />
                  </label>

                  {Array.isArray(activeDialog.options) && activeDialog.options.length > 0 && (
                    <div className="tg-dialog__choices" role="list">
                      {activeDialog.options.map((option) => {
                        const optionValue = getChoiceValue(option);
                        const isActive = optionValue === inputValue;

                        return (
                          <Button
                            key={optionValue}
                            variant="tab"
                            size="sm"
                            type="button"
                            pressed={isActive}
                            className="tg-dialog__choice"
                            onClick={() => setInputValue(optionValue)}
                          >
                            {getChoiceLabel(option)}
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  {activeDialog.hint ? (
                    <p className="tg-dialog__hint">{activeDialog.hint}</p>
                  ) : null}

                  <div className="tg-dialog__actions">
                    {activeDialog.cancelLabel ? (
                      <Button
                        ref={cancelActionRef}
                        variant="secondary"
                        onClick={() => closeDialog(null)}
                      >
                        {activeDialog.cancelLabel}
                      </Button>
                    ) : null}
                    <Button
                      ref={primaryActionRef}
                      type="submit"
                      variant={activeDialog.confirmVariant}
                      disabled={!inputIsValid}
                    >
                      {activeDialog.confirmLabel}
                    </Button>
                  </div>
                </form>
              )}

              {activeDialog.type !== "prompt" && (
                <div className="tg-dialog__actions">
                  {activeDialog.cancelLabel ? (
                    <Button
                      ref={cancelActionRef}
                      variant="secondary"
                      onClick={() => closeDialog(getDismissResult(activeDialog))}
                    >
                      {activeDialog.cancelLabel}
                    </Button>
                  ) : null}
                  <Button
                    ref={primaryActionRef}
                    variant={activeDialog.confirmVariant}
                    onClick={() =>
                      closeDialog(activeDialog.type === "confirm" ? true : undefined)
                    }
                  >
                    {activeDialog.confirmLabel}
                  </Button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      {dialogMarkup}
    </DialogContext.Provider>
  );
}
