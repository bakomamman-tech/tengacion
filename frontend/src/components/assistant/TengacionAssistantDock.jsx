import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import {
  executeAssistantActions,
  isSafeAssistantRoute,
} from "../../services/assistantActionExecutor";
import { sendAssistantMessage } from "../../services/assistantApi";
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
  cards: Array.isArray(extras.cards) ? extras.cards : [],
  actions: Array.isArray(extras.actions) ? extras.actions : [],
  requiresConfirmation: Boolean(extras.requiresConfirmation),
  pendingAction: extras.pendingAction || null,
});

const resolveAssistantSurface = (pathname = "") => {
  const route = String(pathname || "").trim().toLowerCase();
  if (!route) return "general";
  if (route.startsWith("/home")) return "home";
  if (route.startsWith("/messages")) return "messages";
  if (route.startsWith("/notifications")) return "notifications";
  if (route.startsWith("/profile/")) return "profile";
  if (route.startsWith("/creator")) {
    return route.includes("/dashboard") ? "creator_dashboard" : "creator";
  }
  if (route.startsWith("/search")) return "search";
  if (route.startsWith("/find-creators") || route.startsWith("/creators")) return "discovery";
  if (route.startsWith("/purchases")) return "purchases";
  if (route.startsWith("/settings")) return "settings";
  return "general";
};

const resolveAssistantPageTitle = (pathname = "") => {
  const surface = resolveAssistantSurface(pathname);
  if (surface === "creator_dashboard") {
    return "Creator dashboard";
  }
  if (surface === "creator") {
    return "Creator workspace";
  }
  if (surface === "discovery") {
    return "Creator discovery";
  }
  return (
    {
      home: "Home",
      messages: "Messages",
      notifications: "Notifications",
      profile: "Profile",
      search: "Search",
      purchases: "Purchases",
      settings: "Settings",
    }[surface] || "Tengacion"
  );
};

const buildAssistantRequestContext = (location = {}) => {
  const currentPath = String(location.pathname || "").trim();
  const currentSearch = String(location.search || "").trim();
  const surface = resolveAssistantSurface(currentPath);
  const searchParams = new URLSearchParams(currentSearch);
  const selectedChatId = surface === "messages" ? String(searchParams.get("chat") || "").trim() : "";
  return {
    currentPath,
    currentSearch,
    surface,
    pageTitle: resolveAssistantPageTitle(currentPath),
    selectedChatId,
    selectedContentId: "",
  };
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
  const assistantContext = useMemo(
    () => buildAssistantRequestContext(location),
    [location.pathname, location.search]
  );

  const canRender = Boolean(user) && !authLoading;

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

  const closePanel = useCallback(() => {
    setOpen(false);
    setPendingAction(null);
    setError("");
  }, []);

  const addAssistantReply = useCallback((response) => {
    const assistantMessage = createAssistantThreadMessage("assistant", response.message, {
      cards: response.cards,
      actions: response.actions,
      requiresConfirmation: response.requiresConfirmation,
      pendingAction: response.pendingAction,
    });
    setMessages((current) => [...current, assistantMessage]);
  }, []);

  const executeAndMaybeClose = useCallback(
    (actions = []) => {
      const outcomes = executeAssistantActions(actions, {
        navigate: (target, state) => {
          navigate(target, {
            state: state || {},
          });
        },
      });

      if (
        outcomes.some(
          (outcome) => outcome.executed && isSafeAssistantRoute(outcome.action?.target)
        )
      ) {
        closePanel();
      }

      const blocked = outcomes.filter((outcome) => !outcome.executed);
      if (blocked.length > 0) {
        toast.error("Akuso could only open a safe in-app destination.");
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

      setMessages((current) => [...current, createAssistantThreadMessage("user", text)]);

      try {
        const response = await sendAssistantMessage({
          message: text,
          conversationId,
          pendingAction: null,
          context: assistantContext,
        });

        if (response.conversationId) {
          setConversationId(response.conversationId);
        }

        addAssistantReply(response);

        if (response.requiresConfirmation && response.pendingAction) {
          setPendingAction(response.pendingAction);
          return;
        }

        executeAndMaybeClose(response.actions);
      } catch (err) {
        const message = err?.message || "Akuso couldn't answer right now.";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [addAssistantReply, assistantContext, conversationId, executeAndMaybeClose, loading, open]
  );

  const handleCardAction = useCallback(
    (card) => {
      if (!card || typeof card !== "object") {
        return;
      }

      const route = String(card.route || "").trim();
      const suggestedText = String(card?.payload?.text || card?.description || "").trim();

      if (route && isSafeAssistantRoute(route)) {
        navigate(route);
        closePanel();
        return;
      }

      if (card.type === "caption" && suggestedText) {
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

  const handleSuggestionClick = useCallback(
    (prompt) => {
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

  const visibleMessages = useMemo(() => messages, [messages]);

  if (!canRender) {
    return null;
  }

  return (
    <>
      <TengacionAssistantLauncher ref={launcherRef} open={open} onClick={handleLauncherClick} />

      <TengacionAssistantPanel
        open={open}
        onClose={closePanel}
        messages={visibleMessages}
        loading={loading}
        error={error}
        onRetry={handleRetry}
        composerValue={composerValue}
        onComposerChange={setComposerValue}
        onComposerSubmit={submitMessage}
        onCardAction={handleCardAction}
        onSuggestionClick={handleSuggestionClick}
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
