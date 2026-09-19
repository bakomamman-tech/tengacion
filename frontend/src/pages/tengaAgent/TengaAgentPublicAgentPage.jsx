import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";

import {
  getPublicTengaAgent,
  getPublicTengaAgentAvailability,
  getPublicTengaAgentConversation,
  sendPublicTengaAgentMessage,
  submitPublicTengaAgentAppointment,
  submitPublicTengaAgentLead,
} from "../../services/tengaAgentApi";

import TengaAgentAppointmentForm from "./TengaAgentAppointmentForm";
import TengaAgentLeadCaptureForm from "./TengaAgentLeadCaptureForm";
import TengaAgentVisitorAppointmentManager from "./TengaAgentVisitorAppointmentManager";
import { readTengaAgentSessionId } from "./sessionId";
import "./tengaagent-public.css";

const buildWelcomeMessage = (agent) => ({
  id: "welcome",
  sender: "agent",
  content:
    agent?.greeting ||
    `Hi! I'm ${agent?.name || "TengaAgent"}. How can I help you today?`,
});

const senderLabel = (sender) => {
  if (sender === "agent") return "AI";
  if (sender === "human") return "Human";
  if (sender === "system") return "System";
  return "You";
};

const shouldPreserveTransient = (message) => {
  const id = String(message?.id || "");
  return [
    "local-error",
    "local-lead",
    "local-appointment",
  ].some((prefix) => id.startsWith(prefix));
};

function PublicMessage({ sender, content }) {
  return (
    <div
      className={`tengaagent-public__message tengaagent-public__message--${sender}`}
    >
      <strong>{senderLabel(sender)}</strong>
      <div>{content}</div>
    </div>
  );
}

export default function TengaAgentPublicAgentPage() {
  const {
    organizationSlug = "",
    agentKey = "",
  } = useParams();

  const storageKey = useMemo(
    () =>
      `tengaagent:public:${organizationSlug}:${agentKey}`,
    [organizationSlug, agentKey]
  );

  const [sessionId] = useState(() =>
    readTengaAgentSessionId(storageKey)
  );
  const [publicAgent, setPublicAgent] =
    useState(null);
  const [messages, setMessages] = useState([]);
  const [conversationStatus, setConversationStatus] =
    useState("");
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] =
    useState(true);
  const [isSending, setIsSending] =
    useState(false);
  const [pageError, setPageError] = useState("");
  const [activeAction, setActiveAction] =
    useState(null);
  const [actionError, setActionError] =
    useState("");
  const [isSubmittingAction, setIsSubmittingAction] =
    useState(false);
  const [appointmentRefreshKey, setAppointmentRefreshKey] =
    useState(0);
  const endRef = useRef(null);

  const businessName =
    publicAgent?.organization?.name ||
    "this business";

  const loadAppointmentAvailability = useCallback(
    ({ durationMinutes }) =>
      getPublicTengaAgentAvailability({
        organizationSlug,
        agentKey,
        durationMinutes,
      }),
    [organizationSlug, agentKey]
  );

  const applyTranscript = useCallback(
    (response, agent = publicAgent?.agent) => {
      setConversationStatus(response?.status || "");

      if (!response?.exists) {
        return;
      }

      setMessages((current) => {
        const transient = current.filter(
          shouldPreserveTransient
        );
        const persisted = Array.isArray(response?.messages)
          ? response.messages.map((message) => ({
              id: String(message.id),
              sender: message.sender,
              content: message.content,
            }))
          : [];

        return [
          buildWelcomeMessage(agent),
          ...persisted,
          ...transient,
        ];
      });
    },
    [publicAgent?.agent]
  );

  const syncConversation = useCallback(async () => {
    if (!publicAgent) {
      return null;
    }

    const response =
      await getPublicTengaAgentConversation({
        organizationSlug,
        agentKey,
        sessionId,
      });

    applyTranscript(response);
    return response;
  }, [
    agentKey,
    applyTranscript,
    organizationSlug,
    publicAgent,
    sessionId,
  ]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setPageError("");

      try {
        const response = await getPublicTengaAgent({
          organizationSlug,
          agentKey,
        });

        if (cancelled) {
          return;
        }

        setPublicAgent(response);
        setMessages([
          buildWelcomeMessage(response?.agent),
        ]);

        try {
          const transcript =
            await getPublicTengaAgentConversation({
              organizationSlug,
              agentKey,
              sessionId,
            });

          if (!cancelled && transcript?.exists) {
            setConversationStatus(
              transcript.status || ""
            );
            setMessages([
              buildWelcomeMessage(response?.agent),
              ...(transcript.messages || []).map(
                (message) => ({
                  id: String(message.id),
                  sender: message.sender,
                  content: message.content,
                })
              ),
            ]);
          }
        } catch {
          // Existing-session restoration is best effort.
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error?.status === 404
              ? "This TengaAgent is not currently public."
              : error?.message ||
                  "TengaAgent could not load this business agent."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [organizationSlug, agentKey, sessionId]);

  useEffect(() => {
    if (!publicAgent) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      syncConversation().catch(() => {});
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [publicAgent, syncConversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages, activeAction, isSending]);

  const appendAgent = (content, prefix = "local-agent") => {
    if (!content) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `${prefix}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        sender: "agent",
        content,
      },
    ]);
  };

  const sendMessage = async (rawMessage) => {
    const message = String(rawMessage || "").trim();

    if (!message || isSending || !publicAgent) {
      return;
    }

    setDraft("");
    setActionError("");
    setActiveAction(null);
    setMessages((current) => [
      ...current,
      {
        id: `local-customer-${Date.now()}`,
        sender: "customer",
        content: message,
      },
    ]);
    setIsSending(true);

    try {
      const response =
        await sendPublicTengaAgentMessage({
          organizationSlug,
          agentKey,
          message,
          sessionId,
        });

      setConversationStatus(response?.status || "");

      if (response?.mode !== "human") {
        appendAgent(response.reply);

        const nextAction = Array.isArray(
          response.actions
        )
          ? response.actions.find((action) =>
              [
                "capture_lead",
                "book_appointment",
              ].includes(action?.type)
            )
          : null;

        setActiveAction(nextAction || null);
      }

      await syncConversation();
    } catch (error) {
      appendAgent(
        error?.message ||
          "I couldn't complete that request. Please try again.",
        "local-error"
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleLeadSubmit = async (lead) => {
    setIsSubmittingAction(true);
    setActionError("");

    try {
      const response =
        await submitPublicTengaAgentLead({
          organizationSlug,
          agentKey,
          sessionId,
          ...lead,
        });

      setConversationStatus(
        response?.conversation?.status ||
          "handoff_requested"
      );
      setActiveAction(null);
      appendAgent(
        response?.message ||
          `Thanks. ${businessName} can follow up with you.`,
        "local-lead"
      );
    } catch (error) {
      setActionError(
        error?.message ||
          "Your contact details could not be saved."
      );
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAppointmentSubmit = async (
    appointment
  ) => {
    setIsSubmittingAction(true);
    setActionError("");

    try {
      const response =
        await submitPublicTengaAgentAppointment({
          organizationSlug,
          agentKey,
          sessionId,
          ...appointment,
        });

      setConversationStatus(
        response?.conversation?.status ||
          "handoff_requested"
      );
      setActiveAction(null);
      setAppointmentRefreshKey((current) => current + 1);
      appendAgent(
        response?.message ||
          `Your preferred meeting time was sent to ${businessName} for confirmation.`,
        "local-appointment"
      );
    } catch (error) {
      setActionError(
        error?.message ||
          "Your appointment request could not be saved."
      );
    } finally {
      setIsSubmittingAction(false);
    }
  };

  if (isLoading) {
    return (
      <main className="tengaagent-public tengaagent-public--centered">
        <div className="tengaagent-public__state">
          Loading TengaAgent…
        </div>
      </main>
    );
  }

  if (pageError || !publicAgent) {
    return (
      <main className="tengaagent-public tengaagent-public--centered">
        <div className="tengaagent-public__state">
          <strong>TengaAgent unavailable</strong>
          <p>{pageError}</p>
          <a href="/tengaagent">About TengaAgent</a>
        </div>
      </main>
    );
  }

  return (
    <main className="tengaagent-public">
      <header className="tengaagent-public__header">
        <a href="/tengaagent" className="tengaagent-public__brand">
          <span>T</span>
          <div>
            <strong>{publicAgent.agent?.name || "TengaAgent"}</strong>
            <small>Powered by TengaAgent</small>
          </div>
        </a>

        <div className="tengaagent-public__business">
          <strong>{businessName}</strong>
          {publicAgent.organization?.industry ? (
            <span>{publicAgent.organization.industry}</span>
          ) : null}
        </div>
      </header>

      <section className="tengaagent-public__shell">
        <div className="tengaagent-public__intro">
          <span>AI RECEPTIONIST</span>
          <h1>How can {businessName} help you?</h1>
          <p>
            Ask a question, request human follow-up, or
            request a meeting time. Do not share passwords,
            OTPs, card details, API keys, or other secrets.
          </p>
        </div>

        {conversationStatus === "human_active" ? (
          <div className="tengaagent-public__handoff-status">
            <strong>Human support is active.</strong>
            <span>
              A person from {businessName} is handling this
              conversation. New messages go to them without
              generating an AI reply.
            </span>
          </div>
        ) : conversationStatus === "handoff_requested" ? (
          <div className="tengaagent-public__handoff-status tengaagent-public__handoff-status--pending">
            <strong>Human follow-up requested.</strong>
            <span>
              TengaAgent can still help until someone from
              {` ${businessName} `}claims the conversation.
            </span>
          </div>
        ) : conversationStatus === "closed" ? (
          <div className="tengaagent-public__handoff-status tengaagent-public__handoff-status--closed">
            <strong>Conversation closed.</strong>
            <span>
              Send a new message if you need more help; the
              AI receptionist will start responding again.
            </span>
          </div>
        ) : null}

        <TengaAgentVisitorAppointmentManager
          organizationSlug={organizationSlug}
          agentKey={agentKey}
          sessionId={sessionId}
          businessName={businessName}
          refreshKey={appointmentRefreshKey}
        />

        <div className="tengaagent-public__chat" aria-live="polite">
          {messages.map((message) => (
            <PublicMessage
              key={message.id}
              sender={message.sender}
              content={message.content}
            />
          ))}

          {isSending ? (
            <div className="tengaagent-public__typing">
              {conversationStatus === "human_active"
                ? "Sending to human support…"
                : "TengaAgent is replying…"}
            </div>
          ) : null}

          <div ref={endRef} />
        </div>

        {activeAction?.type === "capture_lead" ? (
          <TengaAgentLeadCaptureForm
            businessName={businessName}
            isSubmitting={isSubmittingAction}
            error={actionError}
            onSubmit={handleLeadSubmit}
            onDismiss={() => {
              if (!isSubmittingAction) {
                setActiveAction(null);
                setActionError("");
              }
            }}
          />
        ) : null}

        {activeAction?.type === "book_appointment" ? (
          <TengaAgentAppointmentForm
            businessName={businessName}
            isSubmitting={isSubmittingAction}
            error={actionError}
            loadAvailability={loadAppointmentAvailability}
            onSubmit={handleAppointmentSubmit}
            onDismiss={() => {
              if (!isSubmittingAction) {
                setActiveAction(null);
                setActionError("");
              }
            }}
          />
        ) : null}

        <form
          className="tengaagent-public__composer"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(draft);
          }}
        >
          <label htmlFor="tengaagent-public-message">
            Message
          </label>
          <div>
            <input
              id="tengaagent-public-message"
              value={draft}
              maxLength={2000}
              disabled={isSending}
              placeholder={
                conversationStatus === "human_active"
                  ? `Message ${businessName}…`
                  : `Ask ${publicAgent.agent?.name || "TengaAgent"} a question…`
              }
              onChange={(event) =>
                setDraft(event.target.value)
              }
            />
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </section>

      <footer className="tengaagent-public__footer">
        <span>
          AI responses are grounded in business-provided
          information and may require human confirmation.
        </span>
        <a href="/tengaagent">TengaAgent by Tengacion</a>
      </footer>
    </main>
  );
}
