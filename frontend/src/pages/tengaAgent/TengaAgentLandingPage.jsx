import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  sendTengaAgentMessage,
} from "../../services/tengaAgentApi";

import "./tengaagent.css";

const AGENT_ID = "tengacion-demo";
const SESSION_STORAGE_KEY =
  "tengaagent:tengacion-demo:session";

const INITIAL_MESSAGE = {
  id: "welcome",
  sender: "agent",
  content:
    "Hi! I'm TengaAgent, Tengacion's AI receptionist. Ask me about websites, mobile products, AI solutions, or starting a software project.",
};

const SUGGESTIONS = [
  "Do you build websites?",
  "Can Tengacion build an AI product?",
  "How much does a software project cost?",
  "I want to speak with someone.",
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

    const generated =
      createLocalSessionId();

    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      generated
    );

    return generated;
  } catch {
    return createLocalSessionId();
  }
};

function ChatMessage({
  sender,
  content,
}) {
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

function PricingCard({
  plan,
}) {
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
        {plan.features.map(
          (feature) => (
            <li key={feature}>
              <span aria-hidden="true">
                ✓
              </span>
              {feature}
            </li>
          )
        )}
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
  const [draft, setDraft] =
    useState("");

  const [messages, setMessages] =
    useState([
      INITIAL_MESSAGE,
    ]);

  const [isSending, setIsSending] =
    useState(false);

  const [market, setMarket] =
    useState("nigeria");

  const [sessionId] =
    useState(getSessionId);

  const chatEndRef =
    useRef(null);

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
  ]);

  const sendMessage = async (
    rawMessage
  ) => {
    const message =
      String(rawMessage || "")
        .trim();

    if (
      !message ||
      isSending
    ) {
      return;
    }

    setDraft("");

    setMessages(
      (current) => [
        ...current,
        {
          id:
            `customer-${Date.now()}`,
          sender: "customer",
          content: message,
        },
      ]
    );

    setIsSending(true);

    try {
      const response =
        await sendTengaAgentMessage({
          agentId: AGENT_ID,
          message,
          sessionId,
        });

      setMessages(
        (current) => [
          ...current,
          {
            id:
              `agent-${Date.now()}`,
            sender: "agent",
            content:
              response.reply,
          },
        ]
      );
    } catch (error) {
      setMessages(
        (current) => [
          ...current,
          {
            id:
              `error-${Date.now()}`,
            sender: "agent",
            content:
              error?.message ||
              "I couldn't complete that request. Please try again.",
          },
        ]
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (
    event
  ) => {
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
          <span className="tengaagent-brand-mark">
            T
          </span>

          <span>
            <strong>
              TengaAgent
            </strong>
            <small>
              by Tengacion
            </small>
          </span>
        </a>

        <nav
          className="tengaagent-nav-links"
          aria-label="TengaAgent navigation"
        >
          <a href="#how-it-works">
            How it works
          </a>

          <a href="#pricing">
            Pricing
          </a>

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
            <span>
              {" "}customer.
            </span>
          </h1>

          <p className="tengaagent-hero-lead">
            TengaAgent answers
            enquiries, qualifies
            leads and helps businesses
            turn conversations into
            bookings — 24/7.
          </p>

          <div className="tengaagent-hero-actions">
            <a
              href="#live-demo"
              className="tengaagent-primary-button"
            >
              Talk to TengaAgent
            </a>

            <a
              href="#pricing"
              className="tengaagent-secondary-button"
            >
              View pricing
            </a>
          </div>

          <div className="tengaagent-proof-row">
            <span>
              ✓ Web chat
            </span>
            <span>
              ✓ WhatsApp roadmap
            </span>
            <span>
              ✓ Multilingual
            </span>
            <span>
              ✓ Human handoff
            </span>
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
                <strong>
                  TengaAgent
                </strong>
                <span>
                  AI Receptionist
                </span>
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
            {messages.map(
              (message) => (
                <ChatMessage
                  key={
                    message.id
                  }
                  sender={
                    message.sender
                  }
                  content={
                    message.content
                  }
                />
              )
            )}

            {isSending ? (
              <div className="tengaagent-typing">
                <span />
                <span />
                <span />
              </div>
            ) : null}

            <div
              ref={chatEndRef}
            />
          </div>

          <div className="tengaagent-suggestions">
            {SUGGESTIONS.map(
              (suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  disabled={
                    isSending
                  }
                  onClick={() =>
                    sendMessage(
                      suggestion
                    )
                  }
                >
                  {suggestion}
                </button>
              )
            )}
          </div>

          <form
            className="tengaagent-composer"
            onSubmit={
              handleSubmit
            }
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
                setDraft(
                  event.target.value
                )
              }
            />

            <button
              type="submit"
              disabled={
                isSending ||
                !draft.trim()
              }
              aria-label="Send message"
            >
              →
            </button>
          </form>

          <div className="tengaagent-demo-note">
            Live MVP · conversations are
            handled by the TengaAgent
            backend
          </div>
        </div>
      </section>

      <section
        className="tengaagent-outcome-strip"
        aria-label="TengaAgent capabilities"
      >
        <article>
          <strong>
            24/7
          </strong>
          <span>
            Customer response
          </span>
        </article>

        <article>
          <strong>
            Leads
          </strong>
          <span>
            Captured automatically
          </span>
        </article>

        <article>
          <strong>
            Bookings
          </strong>
          <span>
            Coming in MVP
          </span>
        </article>

        <article>
          <strong>
            Voice
          </strong>
          <span>
            Built for multilingual growth
          </span>
        </article>
      </section>

      <section
        className="tengaagent-section"
        id="how-it-works"
      >
        <div className="tengaagent-section-heading">
          <span>
            HOW IT WORKS
          </span>

          <h2>
            An AI front desk that
            moves the conversation
            forward.
          </h2>

          <p>
            TengaAgent is being built
            to do more than answer
            FAQs. It understands the
            customer, retrieves the
            right business information,
            and safely performs
            approved actions.
          </p>
        </div>

        <div className="tengaagent-steps">
          <article>
            <span>01</span>
            <h3>
              Learn your business
            </h3>
            <p>
              Add your website,
              services, FAQs and
              documents.
            </p>
          </article>

          <article>
            <span>02</span>
            <h3>
              Talk to every customer
            </h3>
            <p>
              Start with web chat,
              then WhatsApp, voice
              notes and telephone.
            </p>
          </article>

          <article>
            <span>03</span>
            <h3>
              Turn intent into action
            </h3>
            <p>
              Capture leads, book
              meetings and hand off
              sensitive conversations
              to humans.
            </p>
          </article>
        </div>
      </section>

      <section
        className="tengaagent-section tengaagent-pricing-section"
        id="pricing"
      >
        <div className="tengaagent-section-heading">
          <span>
            REGIONAL PRICING
          </span>

          <h2>
            Built for businesses
            where they actually operate.
          </h2>

          <p>
            Nigeria receives localized
            NGN pricing. International
            customers use global SaaS
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
              market ===
              "nigeria"
                ? "active"
                : ""
            }
            onClick={() =>
              setMarket(
                "nigeria"
              )
            }
          >
            🇳🇬 Nigeria
          </button>

          <button
            type="button"
            className={
              market ===
              "international"
                ? "active"
                : ""
            }
            onClick={() =>
              setMarket(
                "international"
              )
            }
          >
            🌍 International
          </button>
        </div>

        <div
          className={`tengaagent-pricing-grid tengaagent-pricing-grid--${market}`}
        >
          {pricing.map(
            (plan) => (
              <PricingCard
                key={plan.name}
                plan={plan}
              />
            )
          )}
        </div>

        <p className="tengaagent-pricing-footnote">
          Usage limits protect service
          quality and infrastructure
          costs. Enterprise pricing and
          additional usage will be
          quoted separately.
        </p>
      </section>

      <section className="tengaagent-final-cta">
        <span>
          TENGAAGENT
        </span>

        <h2>
          Your next customer
          should always get an answer.
        </h2>

        <p>
          Start with the live Tengacion
          demo today. Business onboarding,
          knowledge ingestion and lead
          qualification are next in the
          MVP.
        </p>

        <a
          href="#live-demo"
          className="tengaagent-primary-button"
        >
          Try TengaAgent now
        </a>
      </section>

      <footer className="tengaagent-footer">
        <strong>
          TengaAgent
        </strong>

        <span>
          A product of Tengacion
          Technologies Limited.
        </span>
      </footer>
    </main>
  );
}
