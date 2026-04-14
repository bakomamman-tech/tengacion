import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { executeAssistantActions, isSafeAssistantRoute } from "../../services/assistantActionExecutor";
import { buildAssistantContext, getAssistantSuggestions, resolveAssistantSurface } from "../../services/assistantRoutes";
import {
  fetchAssistantHints,
  sendAssistantFeedback,
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
  feedbackStatus: extras.feedbackStatus || "unrated",
});

const defaultWritingPreferences = {
  tone: "warm",
  audience: "fans",
  length: "short",
  simplicity: "standard",
  language: "English",
};

export default function TengacionAssistantDock() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const launcherRef = useRef(null);
  const composerRef = useRef(null);
  const prevOpenRef = useRef(false);
  const lastQueryRef = useRef("");

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [assistantMode, setAssistantMode] = useState("copilot");
  const [writingPreferences, setWritingPreferences] = useState(defaultWritingPreferences);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [streamingLabel, setStreamingLabel] = useState("");
  const [streamingResponseId, setStreamingResponseId] = useState("");
  const [routeHints, setRouteHints] = useState([]);

  const assistantContext = useMemo(() => buildAssistantContext(location), [location]);
  const surface = useMemo(() => resolveAssistantSurface(location.pathname), [location.pathname]);
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
    if (!open && !pendingAction) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.classList.add("tg-assistant-open");
    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove("tg-assistant-open");
      document.body.style.overflow = previousOverflow;
    };
  }, [open, pendingAction]);

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
    setPendingAction(null);
    setError("");
    setStreamingLabel("");
    setStreamingResponseId("");
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId("");
    setPendingAction(null);
    setError("");
    setFeedbackMap({});
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

  const executeAndMaybeClose = useCallback(
    (actions = []) => {
      const outcomes = executeAssistantActions(actions, {
        navigate: (target, state) => {
          navigate(target, { state: state || {} });
        },
      });

      if (outcomes.some((outcome) => outcome.executed && isSafeAssistantRoute(outcome.action?.target))) {
        closePanel();
      }

      const blocked = outcomes.filter((outcome) => !outcome.executed);
      if (blocked.length > 0) {
        toast.error("Akuso could only open safe in-app destinations.");
      }

      return outcomes;
    },
    [closePanel, navigate]
  );

  const submitMessage = useCallback(
    async (rawText) => {
      const text = String(rawText || "").trim();
      if (!text || loading) {
        return;
      }

      if (!open) {
        setOpen(true);
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
        let assistantMessage = null;

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

          assistantMessage = nextMessage;

          if (index === -1) {
            return [...current, nextMessage];
          }

          const next = [...current];
          next[index] = {
            ...nextMessage,
            id: current[index].id,
          };
          assistantMessage = next[index];
          return next;
        });

        if (response.requiresConfirmation && response.pendingAction) {
          setPendingAction(response.pendingAction);
        } else {
          executeAndMaybeClose(response.actions);
        }

        setFeedbackMap((current) => ({
          ...current,
          [assistantMessage.id]: "unrated",
        }));
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
      executeAndMaybeClose,
      loading,
      open,
      upsertStreamingAssistantReply,
      writingPreferences,
    ]
  );

  const handleCardAction = useCallback(
    (card) => {
      if (!card || typeof card !== "object") {
        return;
      }

      const route = String(card.route || "").trim();
      const suggestedText = String(
        card?.payload?.text || card?.payload?.prompt || card?.description || ""
      ).trim();

      if (route && isSafeAssistantRoute(route)) {
        navigate(route);
        closePanel();
        return;
      }

      if (card.type === "draft" && suggestedText) {
        setComposerValue(suggestedText);
        composerRef.current?.focus?.();
        return;
      }

      if (suggestedText) {
        setComposerValue(suggestedText);
      }
    },
    [closePanel, navigate]
  );

  const handleFollowUpClick = useCallback(
    (prompt) => {
      if (!prompt) {
        return;
      }
      setOpen(true);
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
        closePanel();
        return;
      }

      closePanel();
      toast.error("That action is not available yet.");
    },
    [closePanel, navigate]
  );

  const handleLauncherClick = useCallback(() => {
    setOpen((current) => !current);
    if (open) {
      setPendingAction(null);
    }
  }, [open]);

  const handleFeedback = useCallback(
    async (message, rating) => {
      if (!message || message.role !== "assistant" || !message.id) {
        return;
      }

      if (feedbackMap[message.id] && feedbackMap[message.id] !== "unrated") {
        return;
      }

      setFeedbackMap((current) => ({
        ...current,
        [message.id]: rating,
      }));

      try {
        await sendAssistantFeedback({
          conversationId,
          responseId: message.responseId,
          feedbackToken: message.feedbackToken,
          rating,
          mode: message.mode || assistantMode,
          category: message.category || "",
        });
        toast.success(rating === "helpful" ? "Thanks for the feedback." : "Feedback saved.");
      } catch (err) {
        toast.error(err?.message || "Feedback could not be saved.");
      }
    },
    [assistantMode, conversationId, feedbackMap]
  );

  const handleModeChange = useCallback((nextMode) => {
    setAssistantMode(nextMode);
  }, []);

  const handlePreferenceChange = useCallback((key, value) => {
    setWritingPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const visibleMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        feedbackStatus: feedbackMap[message.id] || message.feedbackStatus || "unrated",
      })),
    [feedbackMap, messages]
  );

  if (!canRender) {
    return null;
  }

  return (
    <>
      <TengacionAssistantLauncher
        ref={launcherRef}
        open={open}
        hint={proactiveSuggestion}
        onClick={handleLauncherClick}
      />

      <TengacionAssistantPanel
        open={open}
        onClose={closePanel}
        onClearHistory={clearConversation}
        assistantContext={assistantContext}
        surface={surface}
        suggestions={suggestions}
        proactiveSuggestions={routeHints}
        assistantMode={assistantMode}
        onModeChange={handleModeChange}
        writingPreferences={writingPreferences}
        onPreferenceChange={handlePreferenceChange}
        messages={visibleMessages}
        loading={loading && !streamingResponseId}
        streamingLabel={streamingLabel}
        error={error}
        onRetry={handleRetry}
        composerValue={composerValue}
        onComposerChange={setComposerValue}
        onComposerSubmit={submitMessage}
        onCardAction={handleCardAction}
        onFollowUpClick={handleFollowUpClick}
        onFeedback={user ? handleFeedback : null}
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
