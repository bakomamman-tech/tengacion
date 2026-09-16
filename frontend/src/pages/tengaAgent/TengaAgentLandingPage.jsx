import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";
import {
  sendTengaAgentMessage,
  submitTengaAgentAppointment,
  submitTengaAgentLead,
} from "../../services/tengaAgentApi";

import TengaAgentAppointmentForm from "./TengaAgentAppointmentForm";
import TengaAgentLeadCaptureForm from "./TengaAgentLeadCaptureForm";
import TengaAgentOwnerDashboard from "./TengaAgentOwnerDashboard";
import "./tengaagent.css";

const AGENT_ID = "tengacion-demo";
const SESSION_STORAGE_KEY =
  "tengaagent:tengacion-demo:session";

const INITIAL_MESSAGE = {
  id: "welcome",
  sender: "agent",
  content:
    "Hi! I'm TengaAgent, Tengacion's AI receptionist. Ask me about websites, mobile products, AI solutions, starting a software project, or requesting a meeting.",
};

const SUGGESTIONS = [
  "Do you build websites?",
  "Can Tengacion build an AI product?",
  "How much does a software project cost?",
  "I want to speak with someone.",
  "Book a meeting with the team.",
];

const NIGERIA_PRICING = [
  {
    name: "Solo",
    price: "₦9,900",
    description:
      "For solo entrepreneurs testing AI customer service.",
    features: [
      "1 AI receptionist",
      "100 AI conversations",
      "Website chat",
      "FAQ knowledge",
      "Lead collection",
    ],
  },
  {
    name: "Starter",
    price: "₦19,900",
    description:
      "For small businesses ready to automate enquiries.",
    features: [
      "1 AI receptionist",
      "300 AI conversations",
      "Website chat",
      "Business knowledge base",
      "Lead capture",
      "Conversation history",
    ],
  },
  {
    name: "Growth",
    price: "₦59,900",
    popular: true,
    description:
      "For growing businesses that want an AI front desk.",
    features: [
      "Up to 3 AI agents",
      "1,500 AI conversations",
      "WhatsApp",
      "Voice notes",
      "Lead qualification",
      "Appointment booking",
      "Human handoff",
    ],
  },
  {
    name: "Business",
    price: "₦149,900",
    description:
      "For teams with higher customer volume.",
    features: [
      "Up to 10 AI agents",
      "5,000 AI conversations",
      "Advanced analytics",
      "Team access",
      "Integrations",
      "Priority support",
    ],
  },
];

const INTERNATIONAL_PRICING = [
  {
    name: "Starter",
    price: "$49",
    description:
      "For small businesses starting with AI customer service.",
    features: [
      "1 AI receptionist",
      "300 AI conversations",
      "Website chat",
      "Business knowledge base",
      "Lead capture",
    ],
  },
  {
    name: "Growth",
    price: "$149",
    popular: true,
    description:
      "For businesses turning conversations into revenue.",
    features: [
      "Up to 3 AI agents",
      "1,500 AI conversations",
      "WhatsApp",
      "Voice notes",
      "Lead qualification",
      "Appointment booking",
      "Human handoff",
    ],
  },
  {
    name: "Business",
    price: "$399",
    description:
      "For teams handling serious customer volume.",
    features: [
      "Up to 10 AI agents",
      "5,000 AI conversations",
      "Advanced analytics",
      "Team access",
      "Integrations",
      "Priority support",
    ],
  },
];

const createLocalSessionId = () => {
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

const getSessionId = () => {
  if (typeof window === "undefined") {
    return createLocalSessionId();
  }

  try {
    const existing =
      window.sessionStorage.getItem(
        SESSION_STORAGE_KEY
      );

    if (existing) {
      return existing;
    }

    const generated = createLocalSessionId();

    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      generated
    );

    return generated;
  } catch {
    return createLocalSessionId();
  }
};

function ChatMessage({ sender, content }) {
  return (
    <div
      className={`tengaagent-message tengaagent-message--${sender}`}
    >
      <div className="tengaagent-message-avatar">
        {sender === "agent" ? "TA" : "You"}
      </div>
      <div className="tengaagent-message-bubble">
        {content}
      </div>
    </div>
  );
}

function PricingCard({ plan }) {
  return (
    <article
      className={`tengaagent-pricing-card ${
        plan.popular
          ? "tengaagent-pricing-card--popular"
          : ""
      }`}
    >
      {plan.popular ? (
        <div className="tengaagent-popular-label">
          Most Popular
        </div>
      ) : null}

      <h3>{plan.name}</h3>
      <div className="tengaagent-price">
        {plan.price}
        <span>/month</span>
      </div>
      <p>{plan.description}</p>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>
            <span aria-hidden="true">✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <a
        href="#live-demo"
        className="tengaagent-plan-button"
      >
        Start with {plan.name}
      </a>
    </article>
  );
}

export default function TengaAgentLandingPage() {
  const auth = useAuth();
  const user = auth?.user || null;

  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([
    INITIAL_MESSAGE,
  ]);
  const [isSending, setIsSending] = useState(false);
  const [market, setMarket] = useState("nigeria");
  const [sessionId] = useState(getSessionId);
  const [leadAction, setLeadAction] = useState(null);
  const [isSubmittingLead, setIsSubmittingLead] =
    useState(false);
  const [leadError, setLeadError] = useState("");
  const [bookingAction, setBookingAction] = useState(null);
  const [isSubmittingBooking, setIsSubmittingBooking] =
    useState(false);
  const [bookingError, setBookingError] = useState("");

  const chatEndRef = useRef(null);

  useEffect(() => {
    const chatEnd = chatEndRef.current;

    if (
      chatEnd &&
      typeof chatEnd.scrollIntoView === "function"
    ) {
      chatEnd.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [
    messages,
    isSending,
    leadAction,
    bookingAction,
  ]);

  const appendAgentMessage = (
    content,
    prefix = "agent"
  ) => {
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

    if (!message || isSending) {
      return;
    }

    setDraft("");
    setLeadError("");
    setBookingError("");

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
      const response = await sendTengaAgentMessage({
        agentId: AGENT_ID,
        message,
        sessionId,
      });

      appendAgentMessage(response.reply);

      const actions = Array.isArray(
        response.actions
      )
        ? response.actions
        : [];

      const captureAction = actions.find(
        (action) =>
          action?.type === "capture_lead"
      );

      const appointmentAction = actions.find(
        (action) =>
          action?.type === "book_appointment"
      );

      setBookingAction(
        appointmentAction || null
      );
      setLeadAction(
        appointmentAction
          ? null
          : captureAction || null
      );
    } catch (error) {
      appendAgentMessage(
        error?.message ||
          "I couldn't complete that request. Please try again.",
        "error"
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleLeadSubmit = async (lead) => {
    if (isSubmittingLead) {
      return;
    }

    setIsSubmittingLead(true);
    setLeadError("");

    try {
      const response = await submitTengaAgentLead({
        agentId: AGENT_ID,
        sessionId,
        ...lead,
      });

      setLeadAction(null);

      appendAgentMessage(
        response?.message ||
          "Thanks. Your details have been saved for Tengacion follow-up.",
        "lead-saved"
      );
    } catch (error) {
      setLeadError(
        error?.message ||
          "I couldn't save your details. Please check them and try again."
      );
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const handleAppointmentSubmit = async (
    appointment
  ) => {
    if (isSubmittingBooking) {
      return;
    }

    setIsSubmittingBooking(true);
    setBookingError("");

    try {
      const response =
        await submitTengaAgentAppointment({
          agentId: AGENT_ID,
          sessionId,
          ...appointment,
        });

      setBookingAction(null);

      appendAgentMessage(
        response?.message ||
          "Your preferred meeting time was requested. The team still needs to confirm it.",
        "appointment-requested"
      );
    } catch (error) {
      setBookingError(
        error?.message ||
          "I couldn't save that appointment request. Please check the details and try again."
      );
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(draft);
  };

  const pricing =
    market === "nigeria"
      ? NIGERIA_PRICING
      : INTERNATIONAL_PRICING;

  return (
    <main className="tengaagent-page">
      <header className="tengaagent-nav">
        <a
          className="tengaagent-brand"
          href="/tengaagent"
        >
          <span className="tengaagent-brand-mark">T</span>
          <span>
            <strong>TengaAgent</strong>
            <small>by Tengacion</small>
          </span>
        </a>

        <nav
          className="tengaagent-nav-links"
          aria-label="TengaAgent navigation"
        >
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          {user ? (
            <>
              <a href="#owner-dashboard">Owner inbox</a>
              <a href="#owner-appointments">Appointments</a>
            </>
          ) : null}
          <a
            href="#live-demo"
            className="tengaagent-nav-cta"
          >
            Try the demo
          </a>
        </nav>
      </header>

      <section className="tengaagent-hero">
        <div className="tengaagent-hero-copy">
          <div className="tengaagent-eyebrow">
            AI RECEPTIONIST · SALES · SUPPORT
          </div>
          <h1>
            Never miss another
            <span>{" "}customer.</span>
          </h1>
          <p className="tengaagent-hero-lead">
            TengaAgent answers enquiries, qualifies
            leads and helps businesses turn conversations
            into appointment requests — 24/7.
          </p>

          <div className="tengaagent-hero-actions">
            <a
              href="#live-demo"
              className="tengaagent-primary-button"
            >
              Talk to TengaAgent
            </a>
            {user ? (
              <a
                href="#owner-dashboard"
                className="tengaagent-secondary-button"
              >
                Open owner inbox
              </a>
            ) : (
              <a
                href="#pricing"
                className="tengaagent-secondary-button"
              >
                View pricing
              </a>
            )}
          </div>

          <div className="tengaagent-proof-row">
            <span>✓ Web chat</span>
            <span>✓ Lead capture</span>
            <span>✓ Meeting requests</span>
            <span>✓ Human handoff</span>
          </div>
        </div>

        <div
          className="tengaagent-demo-shell"
          id="live-demo"
        >
          <div className="tengaagent-demo-header">
            <div className="tengaagent-agent-identity">
              <div className="tengaagent-agent-avatar">
                TA
              </div>
              <div>
                <strong>TengaAgent</strong>
                <span>AI Receptionist</span>
              </div>
            </div>
            <div className="tengaagent-online">
              <span />
              Online
            </div>
          </div>

          <div
            className="tengaagent-chat"
            aria-live="polite"
          >
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                sender={message.sender}
                content={message.content}
              />
            ))}

            {isSending ? (
              <div className="tengaagent-typing">
                <span />
                <span />
                <span />
              </div>
            ) : null}

            <div ref={chatEndRef} />
          </div>

          {leadAction ? (
            <TengaAgentLeadCaptureForm
              isSubmitting={isSubmittingLead}
              error={leadError}
              onSubmit={handleLeadSubmit}
              onDismiss={() => {
                if (!isSubmittingLead) {
                  setLeadAction(null);
                  setLeadError("");
                }
              }}
            />
          ) : null}

          {bookingAction ? (
            <TengaAgentAppointmentForm
              isSubmitting={isSubmittingBooking}
              error={bookingError}
              onSubmit={handleAppointmentSubmit}
              onDismiss={() => {
                if (!isSubmittingBooking) {
                  setBookingAction(null);
                  setBookingError("");
                }
              }}
            />
          ) : null}

          <div className="tengaagent-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                disabled={isSending}
                onClick={() => sendMessage(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <form
            className="tengaagent-composer"
            onSubmit={handleSubmit}
          >
            <label
              htmlFor="tengaagent-message"
              className="tengaagent-sr-only"
            >
              Message TengaAgent
            </label>
            <input
              id="tengaagent-message"
              value={draft}
              maxLength={2000}
              disabled={isSending}
              placeholder="Ask TengaAgent anything..."
              onChange={(event) =>
                setDraft(event.target.value)
              }
            />
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              aria-label="Send message"
            >
              →
            </button>
          </form>

          <div className="tengaagent-demo-note">
            Live MVP · conversations, lead capture and
            appointment requests are handled by the
            TengaAgent backend
          </div>
        </div>
      </section>

      <section
        className="tengaagent-outcome-strip"
        aria-label="TengaAgent capabilities"
      >
        <article>
          <strong>24/7</strong>
          <span>Customer response</span>
        </article>
        <article>
          <strong>Leads</strong>
          <span>Captured automatically</span>
        </article>
        <article>
          <strong>Bookings</strong>
          <span>Appointment requests</span>
        </article>
        <article>
          <strong>Voice</strong>
          <span>Built for multilingual growth</span>
        </article>
      </section>

      {user ? (
        <TengaAgentOwnerDashboard user={user} />
      ) : null}

      <section
        className="tengaagent-section"
        id="how-it-works"
      >
        <div className="tengaagent-section-heading">
          <span>HOW IT WORKS</span>
          <h2>
            An AI front desk that moves the
            conversation forward.
          </h2>
          <p>
            TengaAgent is being built to do more than
            answer FAQs. It understands the customer,
            retrieves the right business information,
            and safely performs approved actions.
          </p>
        </div>

        <div className="tengaagent-steps">
          <article>
            <span>01</span>
            <h3>Learn your business</h3>
            <p>
              Add your website, services, FAQs and
              documents.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Talk to every customer</h3>
            <p>
              Start with web chat, then WhatsApp,
              voice notes and telephone.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Turn intent into action</h3>
            <p>
              Capture leads, request meeting times,
              review them in the owner inbox, and hand
              conversations to people when needed.
            </p>
          </article>
        </div>
      </section>

      <section
        className="tengaagent-section tengaagent-pricing-section"
        id="pricing"
      >
        <div className="tengaagent-section-heading">
          <span>REGIONAL PRICING</span>
          <h2>
            Built for businesses where they actually
            operate.
          </h2>
          <p>
            Nigeria receives localized NGN pricing.
            International customers use global SaaS
            pricing.
          </p>
        </div>

        <div
          className="tengaagent-market-toggle"
          role="group"
          aria-label="Pricing market"
        >
          <button
            type="button"
            className={
              market === "nigeria" ? "active" : ""
            }
            onClick={() => setMarket("nigeria")}
          >
            🇳🇬 Nigeria
          </button>
          <button
            type="button"
            className={
              market === "international"
                ? "active"
                : ""
            }
            onClick={() => setMarket("international")}
          >
            🌍 International
          </button>
        </div>

        <div
          className={`tengaagent-pricing-grid tengaagent-pricing-grid--${market}`}
        >
          {pricing.map((plan) => (
            <PricingCard
              key={plan.name}
              plan={plan}
            />
          ))}
        </div>

        <p className="tengaagent-pricing-footnote">
          Usage limits protect service quality and
          infrastructure costs. Enterprise pricing and
          additional usage will be quoted separately.
        </p>
      </section>

      <section className="tengaagent-final-cta">
        <span>TENGAAGENT</span>
        <h2>
          Your next customer should always get an answer.
        </h2>
        <p>
          Business onboarding, knowledge ingestion,
          consent-based lead capture, lead workflows,
          appointment requests and the owner inbox are
          now part of the MVP. Calendar availability
          integrations are a later step.
        </p>
        <a
          href="#live-demo"
          className="tengaagent-primary-button"
        >
          Try TengaAgent now
        </a>
      </section>

      <footer className="tengaagent-footer">
        <strong>TengaAgent</strong>
        <span>
          A product of Tengacion Technologies Limited.
        </span>
      </footer>
    </main>
  );
}
