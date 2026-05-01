import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { executeAssistantActions, isSafeAssistantRoute } from "../../services/assistantActionExecutor";
import { buildAssistantContext, getAssistantSuggestions } from "../../services/assistantRoutes";
import {
  fetchAssistantHints,
  streamAssistantMessage,
} from "../../services/assistantApi";
import AssistantConfirmDialog from "./AssistantConfirmDialog";
import TengacionAssistantLauncher from "./TengacionAssistantLauncher";
import TengacionAssistantPanel from "./TengacionAssistantPanel";
import "./assistant.css";

const makeId = (prefix) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createAssistantThreadMessage = (role, content, extras = {}) => ({
  id: makeId(role),
  role,
  content,
  responseId: extras.responseId || "",
  feedbackToken: extras.feedbackToken || "",
  category: extras.category || "",
  mode: extras.mode || "general",
  safety: extras.safety || { level: "safe", notice: "", escalation: "" },
  trust: extras.trust || {
    provider: "local-fallback",
    mode: "general",
    grounded: true,
    usedModel: false,
    confidenceLabel: "medium",
    note: "",
  },
  sources: Array.isArray(extras.sources) ? extras.sources : [],
  details: Array.isArray(extras.details) ? extras.details : [],
  followUps: Array.isArray(extras.followUps) ? extras.followUps : [],
  cards: Array.isArray(extras.cards) ? extras.cards : [],
  actions: Array.isArray(extras.actions) ? extras.actions : [],
  requiresConfirmation: Boolean(extras.requiresConfirmation),
  pendingAction: extras.pendingAction || null,
});

const defaultWritingPreferences = {
  tone: "warm",
  audience: "fans",
  length: "short",
  simplicity: "standard",
  language: "English",
};

const FLOATING_MARGIN = 12;
const DRAG_CLICK_THRESHOLD = 6;
const LAUNCHER_POSITION_KEY = "tg_akuso_launcher_position_v1";
const PANEL_POSITION_KEY = "tg_akuso_panel_position_v1";

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const positionsMatch = (a, b) =>
  Boolean(a && b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5);

const clampFloatingPosition = (position, size = {}) => {
  if (typeof window === "undefined") {
    return position;
  }

  const width = Math.max(1, Number(size.width) || 1);
  const height = Math.max(1, Number(size.height) || 1);
  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || width;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || height;
  const maxX = Math.max(FLOATING_MARGIN, viewportWidth - width - FLOATING_MARGIN);
  const maxY = Math.max(FLOATING_MARGIN, viewportHeight - height - FLOATING_MARGIN);

  return {
    x: clampNumber(Number(position?.x) || FLOATING_MARGIN, FLOATING_MARGIN, maxX),
    y: clampNumber(Number(position?.y) || FLOATING_MARGIN, FLOATING_MARGIN, maxY),
  };
};

const readStoredPosition = (key) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
    const x = Number(parsed?.x);
    const y = Number(parsed?.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch {
    return null;
  }
};

const persistPosition = (key, position) => {
  if (typeof window === "undefined" || !position) {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        x: Math.round(Number(position.x) || 0),
        y: Math.round(Number(position.y) || 0),
      })
    );
  } catch {
    // Ignore storage failures; dragging should still work for this session.
  }
};

export default function TengacionAssistantDock() {
  const { loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const launcherRef = useRef(null);
  const launcherWrapRef = useRef(null);
  const panelRef = useRef(null);
  const composerRef = useRef(null);
  const prevOpenRef = useRef(false);
  const lastQueryRef = useRef("");
  const launcherDragRef = useRef({ active: false });
  const panelDragRef = useRef({ active: false });
  const suppressNextLauncherClickRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [assistantMode, setAssistantMode] = useState("copilot");
  const [expanded, setExpanded] = useState(false);
  const [writingPreferences, setWritingPreferences] = useState(defaultWritingPreferences);
  const [streamingLabel, setStreamingLabel] = useState("");
  const [streamingResponseId, setStreamingResponseId] = useState("");
  const [routeHints, setRouteHints] = useState([]);
  const [launcherPosition, setLauncherPosition] = useState(() =>
    readStoredPosition(LAUNCHER_POSITION_KEY)
  );
  const [panelPosition, setPanelPosition] = useState(() =>
    readStoredPosition(PANEL_POSITION_KEY)
  );
  const [draggingLauncher, setDraggingLauncher] = useState(false);
  const [draggingPanel, setDraggingPanel] = useState(false);

  const focusComposerSoon = useCallback(() => {
    window.setTimeout(() => {
      composerRef.current?.focus?.();
    }, 0);
  }, []);

  const assistantContext = useMemo(() => buildAssistantContext(location), [location]);
  const fallbackSuggestions = useMemo(
    () => getAssistantSuggestions(location.pathname),
    [location.pathname]
  );
  const suggestions = useMemo(() => {
    const seen = new Set();
    return [...routeHints, ...fallbackSuggestions].filter((entry) => {
      const prompt = String(entry || "").trim();
      if (!prompt) {
        return false;
      }

      const key = prompt.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [fallbackSuggestions, routeHints]);
  const proactiveSuggestion = routeHints[0] || fallbackSuggestions[0] || "";
  const canRender = !authLoading;

  useEffect(() => {
    if (!pendingAction) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [pendingAction]);

  useEffect(() => {
    persistPosition(LAUNCHER_POSITION_KEY, launcherPosition);
  }, [launcherPosition]);

  useEffect(() => {
    persistPosition(PANEL_POSITION_KEY, panelPosition);
  }, [panelPosition]);

  useEffect(() => {
    const clampStoredPositions = () => {
      setLauncherPosition((current) => {
        if (!current) {
          return current;
        }

        const rect = launcherWrapRef.current?.getBoundingClientRect();
        const next = clampFloatingPosition(current, {
          width: rect?.width || 260,
          height: rect?.height || 72,
        });
        return positionsMatch(current, next) ? current : next;
      });

      setPanelPosition((current) => {
        if (!current) {
          return current;
        }

        const rect = panelRef.current?.getBoundingClientRect();
        const next = clampFloatingPosition(current, {
          width: rect?.width || 480,
          height: rect?.height || 560,
        });
        return positionsMatch(current, next) ? current : next;
      });
    };

    clampStoredPositions();
    window.addEventListener("resize", clampStoredPositions);
    return () => {
      window.removeEventListener("resize", clampStoredPositions);
    };
  }, [expanded, open]);

  useEffect(() => {
    if (!draggingLauncher) {
      return undefined;
    }

    const onPointerMove = (event) => {
      const drag = launcherDragRef.current;
      if (!drag.active) {
        return;
      }

      const deltaX = event.clientX - drag.startPointerX;
      const deltaY = event.clientY - drag.startPointerY;
      if (
        Math.abs(deltaX) > DRAG_CLICK_THRESHOLD ||
        Math.abs(deltaY) > DRAG_CLICK_THRESHOLD
      ) {
        drag.moved = true;
      }

      setLauncherPosition(
        clampFloatingPosition(
          {
            x: drag.startLeft + deltaX,
            y: drag.startTop + deltaY,
          },
          {
            width: drag.width,
            height: drag.height,
          }
        )
      );
    };

    const onPointerEnd = () => {
      const drag = launcherDragRef.current;
      if (!drag.active) {
        return;
      }

      if (drag.moved) {
        suppressNextLauncherClickRef.current = true;
      }
      drag.active = false;
      setDraggingLauncher(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [draggingLauncher]);

  useEffect(() => {
    if (!draggingPanel) {
      return undefined;
    }

    const onPointerMove = (event) => {
      const drag = panelDragRef.current;
      if (!drag.active) {
        return;
      }

      const deltaX = event.clientX - drag.startPointerX;
      const deltaY = event.clientY - drag.startPointerY;
      setPanelPosition(
        clampFloatingPosition(
          {
            x: drag.startLeft + deltaX,
            y: drag.startTop + deltaY,
          },
          {
            width: drag.width,
            height: drag.height,
          }
        )
      );
    };

    const onPointerEnd = () => {
      if (!panelDragRef.current.active) {
        return;
      }
      panelDragRef.current.active = false;
      setDraggingPanel(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [draggingPanel]);

  useEffect(() => {
    if (prevOpenRef.current && !open) {
      launcherRef.current?.focus?.();
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!canRender) {
      return undefined;
    }

    let active = true;
    setRouteHints([]);

    fetchAssistantHints({
      context: assistantContext,
      assistantModeHint: assistantMode,
    })
      .then((payload) => {
        if (!active) {
          return;
        }
        setRouteHints(Array.isArray(payload?.hints) ? payload.hints.slice(0, 6) : []);
      })
      .catch(() => {
        if (active) {
          setRouteHints([]);
        }
      });

    return () => {
      active = false;
    };
  }, [assistantContext, assistantMode, canRender]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setExpanded(false);
    setPendingAction(null);
    setError("");
    setStreamingLabel("");
    setStreamingResponseId("");
  }, []);

  const minimizePanel = useCallback(() => {
    setOpen(false);
    setPendingAction(null);
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId("");
    setPendingAction(null);
    setError("");
    setComposerValue("");
    setStreamingLabel("");
    setStreamingResponseId("");
  }, []);

  const upsertStreamingAssistantReply = useCallback((responseId, updater) => {
    if (!responseId || typeof updater !== "function") {
      return;
    }

    setMessages((current) => {
      const index = current.findIndex(
        (message) => message.role === "assistant" && message.responseId === responseId
      );

      if (index === -1) {
        return [
          ...current,
          updater(
            createAssistantThreadMessage("assistant", "", {
              responseId,
            })
          ),
        ];
      }

      const next = [...current];
      next[index] = updater(next[index]);
      return next;
    });
  }, []);

  const executeAssistantReplyActions = useCallback(
    (actions = []) => {
      const outcomes = executeAssistantActions(actions, {
        navigate: (target, state) => {
          navigate(target, { state: state || {} });
        },
      });

      if (
        outcomes.some(
          (outcome) => outcome.executed && isSafeAssistantRoute(outcome.action?.target)
        )
      ) {
        focusComposerSoon();
      }

      const blocked = outcomes.filter((outcome) => !outcome.executed);
      if (blocked.length > 0) {
        toast.error("Akuso could only open safe in-app destinations.");
      }

      return outcomes;
    },
    [focusComposerSoon, navigate]
  );

  const submitMessage = useCallback(
    async (rawText) => {
      const text = String(rawText || "").trim();
      if (!text || loading) {
        return;
      }

      if (!open) {
        setOpen(true);
        setExpanded(false);
      }

      lastQueryRef.current = text;
      setComposerValue("");
      setLoading(true);
      setError("");
      setPendingAction(null);
      setStreamingLabel("Checking policy and grounding");
      setStreamingResponseId("");

      setMessages((current) => [...current, createAssistantThreadMessage("user", text)]);

      try {
        const response = await streamAssistantMessage({
          message: text,
          conversationId,
          context: assistantContext,
          assistantModeHint: assistantMode,
          preferences: writingPreferences,
          onStatus: (event) => {
            const nextLabel = String(event?.label || "").trim();
            if (nextLabel) {
              setStreamingLabel(nextLabel);
            }
          },
          onStart: (event) => {
            const responseKey = String(event?.responseId || "").trim();
            if (!responseKey) {
              return;
            }

            setStreamingResponseId(responseKey);
            upsertStreamingAssistantReply(responseKey, (message) => ({
              ...message,
              responseId: responseKey,
              category: event?.category || message.category || "",
              mode: event?.mode || message.mode || "general",
            }));
          },
          onDelta: (event) => {
            const responseKey = String(event?.meta?.responseId || "").trim();
            if (!responseKey) {
              return;
            }

            setStreamingResponseId(responseKey);
            setStreamingLabel("Streaming grounded reply");
            upsertStreamingAssistantReply(responseKey, (message) => ({
              ...message,
              responseId: responseKey,
              category: event?.meta?.category || message.category || "",
              mode: event?.meta?.mode || message.mode || "general",
              content: String(event?.content || ""),
            }));
          },
        });

        if (response.conversationId) {
          setConversationId(response.conversationId);
        }

        setStreamingLabel("");
        setStreamingResponseId("");
        setMessages((current) => {
          const index = current.findIndex(
            (message) =>
              message.role === "assistant" && message.responseId === response.responseId
          );

          const nextMessage = createAssistantThreadMessage("assistant", response.message, {
            responseId: response.responseId,
            feedbackToken: response.feedbackToken,
            category: response.category,
            mode: response.mode,
            safety: response.safety,
            trust: response.trust,
            sources: response.sources,
            details: response.details,
            followUps: response.followUps,
            cards: response.cards,
            actions: response.actions,
            requiresConfirmation: response.requiresConfirmation,
            pendingAction: response.pendingAction,
          });

          if (index === -1) {
            return [...current, nextMessage];
          }

          const next = [...current];
          next[index] = {
            ...nextMessage,
            id: current[index].id,
          };
          return next;
        });

        if (response.requiresConfirmation && response.pendingAction) {
          setPendingAction(response.pendingAction);
        } else {
          executeAssistantReplyActions(response.actions);
        }
      } catch (err) {
        setStreamingLabel("");
        setStreamingResponseId("");
        const message = err?.message || "Akuso couldn't answer right now.";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [
      assistantContext,
      assistantMode,
      conversationId,
      executeAssistantReplyActions,
      loading,
      open,
      upsertStreamingAssistantReply,
      writingPreferences,
    ]
  );

  const handleFollowUpClick = useCallback(
    (prompt) => {
      if (!prompt) {
        return;
      }
      setOpen(true);
      setExpanded(false);
      void submitMessage(prompt);
    },
    [submitMessage]
  );

  const handleRetry = useCallback(() => {
    if (lastQueryRef.current) {
      void submitMessage(lastQueryRef.current);
    }
  }, [submitMessage]);

  const handlePendingActionConfirm = useCallback(
    (action) => {
      const target = String(action?.route || "").trim();
      if (action?.type === "navigate" && isSafeAssistantRoute(target)) {
        navigate(target);
        setPendingAction(null);
        focusComposerSoon();
        return;
      }

      closePanel();
      toast.error("That action is not available yet.");
    },
    [closePanel, focusComposerSoon, navigate]
  );

  const handleLauncherClick = useCallback(() => {
    if (suppressNextLauncherClickRef.current) {
      suppressNextLauncherClickRef.current = false;
      return;
    }

    setOpen((current) => {
      const next = !current;
      if (!next) {
        setPendingAction(null);
      }
      return next;
    });
  }, []);

  const handleLauncherPointerDown = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const launcherWrap = launcherWrapRef.current;
    const rect = launcherWrap?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    launcherDragRef.current = {
      active: true,
      moved: false,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      width: rect.width,
      height: rect.height,
    };
    setDraggingLauncher(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handleLauncherPointerEnd = useCallback(() => {
    const drag = launcherDragRef.current;
    if (!drag.active) {
      return;
    }

    if (drag.moved) {
      suppressNextLauncherClickRef.current = true;
    }
    drag.active = false;
    setDraggingLauncher(false);
  }, []);

  const handlePanelHeaderPointerDown = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, textarea, select, [role=\"button\"]")
    ) {
      return;
    }

    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    panelDragRef.current = {
      active: true,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      width: rect.width,
      height: rect.height,
    };
    setDraggingPanel(true);
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handlePanelHeaderPointerEnd = useCallback(() => {
    if (!panelDragRef.current.active) {
      return;
    }
    panelDragRef.current.active = false;
    setDraggingPanel(false);
  }, []);

  const handleToggleExpanded = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  const handleModeChange = useCallback((nextMode) => {
    setAssistantMode(nextMode);
  }, []);

  const handlePreferenceChange = useCallback((key, value) => {
    setWritingPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  if (!canRender) {
    return null;
  }

  const launcherStyle = launcherPosition
    ? {
        left: `${launcherPosition.x}px`,
        top: `${launcherPosition.y}px`,
        right: "auto",
        bottom: "auto",
      }
    : undefined;
  const panelStyle = panelPosition
    ? {
        left: `${panelPosition.x}px`,
        top: `${panelPosition.y}px`,
        right: "auto",
        bottom: "auto",
      }
    : undefined;

  return (
    <>
      <TengacionAssistantLauncher
        ref={launcherRef}
        containerRef={launcherWrapRef}
        containerStyle={launcherStyle}
        dragging={draggingLauncher}
        open={open}
        hint={proactiveSuggestion}
        onClick={handleLauncherClick}
        onPointerDown={handleLauncherPointerDown}
        onPointerUp={handleLauncherPointerEnd}
        onPointerCancel={handleLauncherPointerEnd}
      />

      <TengacionAssistantPanel
        panelRef={panelRef}
        panelStyle={panelStyle}
        dragging={draggingPanel}
        open={open}
        expanded={expanded}
        onMinimize={minimizePanel}
        onClose={closePanel}
        onHeaderPointerDown={handlePanelHeaderPointerDown}
        onHeaderPointerUp={handlePanelHeaderPointerEnd}
        onHeaderPointerCancel={handlePanelHeaderPointerEnd}
        onToggleExpanded={handleToggleExpanded}
        onClearHistory={clearConversation}
        assistantContext={assistantContext}
        suggestions={suggestions}
        proactiveSuggestions={routeHints}
        assistantMode={assistantMode}
        onModeChange={handleModeChange}
        writingPreferences={writingPreferences}
        onPreferenceChange={handlePreferenceChange}
        messages={messages}
        loading={loading && !streamingResponseId}
        streamingLabel={streamingLabel}
        error={error}
        onRetry={handleRetry}
        composerValue={composerValue}
        onComposerChange={setComposerValue}
        onComposerSubmit={submitMessage}
        onFollowUpClick={handleFollowUpClick}
        composerDisabled={loading}
        composerRef={composerRef}
      />

      <AssistantConfirmDialog
        open={Boolean(pendingAction)}
        pendingAction={pendingAction}
        onConfirm={handlePendingActionConfirm}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}
