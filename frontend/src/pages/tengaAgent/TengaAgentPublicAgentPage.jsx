import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";

import {
  getPublicTengaAgent,
  sendPublicTengaAgentMessage,
  submitPublicTengaAgentAppointment,
  submitPublicTengaAgentLead,
} from "../../services/tengaAgentApi";

import TengaAgentAppointmentForm from "./TengaAgentAppointmentForm";
import TengaAgentLeadCaptureForm from "./TengaAgentLeadCaptureForm";
import "./tengaagent-public.css";

const createSessionId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `tengaagent-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
};

const readSessionId = (storageKey) => {
  if (typeof window === "undefined") {
    return createSessionId();
  }

  try {
    const existing =
      window.sessionStorage.getItem(storageKey);

    if (existing) {
      return existing;
    }

    const created = createSessionId();
    window.sessionStorage.setItem(
      storageKey,
      created
    );
    return created;
  } catch {
    return createSessionId();
  }
};

function PublicMessage({ sender, content }) {
  return (
    <div
      className={`tengaagent-public__message tengaagent-public__message--${sender}`}
    >
      <strong>
        {sender === "agent" ? "AI" : "You"}
      </strong>
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
    readSessionId(storageKey)
  );
  const [publicAgent, setPublicAgent] =
    useState(null);
  const [messages, setMessages] = useState([]);
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
  const endRef = useRef(null);

  const businessName =
    publicAgent?.organization?.name ||
    "this business";

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
          {
            id: "welcome",
            sender: "agent",
            content:
              response?.agent?.greeting ||
              `Hi! I'm ${response?.agent?.name || "TengaAgent"}. How can I help you today?`,
          },
        ]);
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
  }, [organizationSlug, agentKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages, activeAction, isSending]);

  const appendAgent = (content, prefix = "agent") => {
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
        id: `customer-${Date.now()}`,
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
    } catch (error) {
      appendAgent(
        error?.message ||
          "I couldn't complete that request. Please try again.",
        "error"
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

      setActiveAction(null);
      appendAgent(
        response?.message ||
          `Thanks. ${businessName} can follow up with you.`,
        "lead-saved"
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

      setActiveAction(null);
      appendAgent(
        response?.message ||
          `Your preferred meeting time was sent to ${businessName} for confirmation.`,
        "appointment-saved"
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
              TengaAgent is replying…
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
              placeholder={`Ask ${publicAgent.agent?.name || "TengaAgent"} a question…`}
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
