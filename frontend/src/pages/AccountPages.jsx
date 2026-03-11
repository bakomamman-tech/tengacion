import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import QuickAccessLayout from "../components/QuickAccessLayout";
import { useTheme } from "../context/ThemeContext";

const FEEDBACK_STORAGE_KEY = "tengacion_feedback_draft";
const FEEDBACK_TYPES = ["general", "bug", "idea", "safety"];

function SectionCard({ title, action, children }) {
  return (
    <section className="card quick-section-card">
      <div className="quick-section-head">
        <h2>{title}</h2>
        {action || null}
      </div>
      {children}
    </section>
  );
}

function StatusGrid({ items }) {
  return (
    <div className="account-kpi-grid">
      {items.map((item) => (
        <article key={item.label} className="account-kpi-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.note}</small>
        </article>
      ))}
    </div>
  );
}

function ShortcutGrid({ items, onOpen }) {
  return (
    <div className="account-shortcut-grid">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="account-shortcut-card"
          onClick={() => onOpen(item.path)}
        >
          <strong>{item.label}</strong>
          <p>{item.description}</p>
          <span>{item.note}</span>
        </button>
      ))}
    </div>
  );
}

function humanize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function SettingsHubPage({ user }) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const overview = [
    {
      label: "Theme",
      value: humanize(theme),
      note: "Appearance for your current session",
    },
    {
      label: "Profile visibility",
      value: humanize(user?.privacy?.profileVisibility || "public"),
      note: "Who can discover your profile",
    },
    {
      label: "Default audience",
      value: humanize(user?.privacy?.defaultPostAudience || "friends"),
      note: "Audience used for new posts",
    },
    {
      label: "Messages",
      value: humanize(user?.privacy?.allowMessagesFrom || "everyone"),
      note: "Who can start a chat with you",
    },
  ];

  const shortcuts = [
    {
      id: "security",
      label: "Security settings",
      description: "Passwords, sessions, and verified email status.",
      note: "Open account protection tools",
      path: "/settings/security",
    },
    {
      id: "privacy",
      label: "Privacy settings",
      description: "Profile visibility, message permissions, and list controls.",
      note: "Manage who can reach you",
      path: "/settings/privacy",
    },
    {
      id: "notifications",
      label: "Notification settings",
      description: "Choose which alerts you want to receive.",
      note: "Tune updates across the app",
      path: "/settings/notifications",
    },
    {
      id: "display",
      label: "Display & accessibility",
      description: "Appearance mode and accessibility guidance.",
      note: "Adjust how Tengacion looks",
      path: "/settings/display",
    },
  ];

  const recommendedSteps = [
    "Review your active sessions and revoke any device you do not recognize.",
    "Check your profile visibility before posting new public content.",
    "Tune notifications so important replies and mentions do not get buried.",
  ];

  return (
    <QuickAccessLayout
      user={user}
      title="Settings & Privacy"
      subtitle="A central place for account controls, privacy choices, security tools, and display preferences."
    >
      <SectionCard title="Account overview">
        <StatusGrid items={overview} />
      </SectionCard>

      <SectionCard title="Open a section">
        <ShortcutGrid items={shortcuts} onOpen={navigate} />
      </SectionCard>

      <SectionCard title="Recommended next steps">
        <ul className="quick-timeline">
          {recommendedSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function HelpSupportPage({ user }) {
  const navigate = useNavigate();

  const destinations = [
    {
      id: "help-home",
      label: "Help center",
      description: "Read quick guidance for account, content, and communication issues.",
      note: "Start here for general support",
      path: "/help-support",
    },
    {
      id: "guidelines",
      label: "Community guidelines",
      description: "Understand platform rules and expected behavior.",
      note: "Review moderation standards",
      path: "/community-guidelines",
    },
    {
      id: "privacy-policy",
      label: "Privacy policy",
      description: "See how account data, uploads, and requests are handled.",
      note: "Open privacy information",
      path: "/privacy",
    },
    {
      id: "terms",
      label: "Terms",
      description: "Read platform terms for account ownership and disputes.",
      note: "View legal terms",
      path: "/terms",
    },
  ];

  const faq = [
    {
      title: "Account access",
      description: "Use Security settings to change your password, confirm verified email status, and sign out other devices.",
    },
    {
      title: "Privacy controls",
      description: "Use Privacy settings to choose profile visibility, default post audience, and who can message you.",
    },
    {
      title: "Notifications",
      description: "Notification settings let you turn likes, comments, follows, mentions, messages, reports, and system alerts on or off.",
    },
  ];

  const supportActions = [
    {
      label: "Report a problem",
      detail: "Broken page, upload issue, or something not working as expected.",
      target: "/feedback?type=bug",
    },
    {
      label: "Suggest a feature",
      detail: "Share an idea that would improve the product experience.",
      target: "/feedback?type=idea",
    },
    {
      label: "Safety concern",
      detail: "Send safety-related feedback or review community guidelines before reporting.",
      target: "/feedback?type=safety",
    },
  ];

  return (
    <QuickAccessLayout
      user={user}
      title="Help & Support"
      subtitle="Support resources, policy references, and clear paths for reporting problems or suggesting improvements."
    >
      <SectionCard title="Support destinations">
        <ShortcutGrid items={destinations} onOpen={navigate} />
      </SectionCard>

      <SectionCard title="Quick answers">
        <div className="quick-list-grid">
          {faq.map((item) => (
            <article key={item.title} className="quick-list-item">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Need to contact the team?">
        <div className="quick-list-grid">
          {supportActions.map((item) => (
            <article key={item.label} className="quick-list-item">
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
              <button type="button" onClick={() => navigate(item.target)}>
                Open
              </button>
            </article>
          ))}
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function DisplayAccessibilityPage({ user }) {
  const { theme, setTheme } = useTheme();

  const appearanceChoices = [
    {
      value: "light",
      title: "Light mode",
      description: "Brighter surfaces with warm contrast for daytime browsing.",
    },
    {
      value: "dark",
      title: "Dark mode",
      description: "Deeper surfaces with softer glare for low-light browsing.",
    },
  ];

  const supportNotes = [
    {
      title: "Keyboard support",
      description: "You can tab through controls and use Escape to close active menus and overlays in supported areas.",
    },
    {
      title: "Reduced motion",
      description: "Some interface animations are softened when the device requests reduced motion.",
    },
    {
      title: "Readable layout",
      description: "Use browser zoom together with light or dark mode to improve readability on your device.",
    },
  ];

  const shortcuts = [
    { key: "Tab", meaning: "Move forward through interactive controls" },
    { key: "Shift + Tab", meaning: "Move focus backward" },
    { key: "Enter / Space", meaning: "Activate the focused button or link" },
    { key: "Esc", meaning: "Close supported menus and temporary panels" },
  ];

  return (
    <QuickAccessLayout
      user={user}
      title="Display & Accessibility"
      subtitle="Choose your appearance mode and review the accessibility support that already exists in the interface."
    >
      <SectionCard title="Appearance mode">
        <div className="account-choice-grid">
          {appearanceChoices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className={`account-choice-card ${theme === choice.value ? "active" : ""}`}
              onClick={() => setTheme(choice.value)}
            >
              <strong>{choice.title}</strong>
              <p>{choice.description}</p>
              <span>{theme === choice.value ? "Currently active" : "Switch appearance"}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Accessibility support">
        <div className="quick-list-grid">
          {supportNotes.map((item) => (
            <article key={item.title} className="quick-list-item">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Useful keyboard actions">
        <div className="account-keyboard-list">
          {shortcuts.map((item) => (
            <article key={item.key} className="account-keyboard-item">
              <strong>{item.key}</strong>
              <span>{item.meaning}</span>
            </article>
          ))}
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function FeedbackPage({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = FEEDBACK_TYPES.includes(searchParams.get("type"))
    ? searchParams.get("type")
    : "general";
  const [form, setForm] = useState({
    type: initialType,
    subject: "",
    details: "",
  });
  const [message, setMessage] = useState("");

  const ideas = useMemo(
    () => [
      "Share a bug report with clear steps, what you expected, and what actually happened.",
      "Suggest features that would improve posting, messaging, discovery, or account controls.",
      "Use safety feedback for moderation, abuse, or privacy-related concerns.",
    ],
    []
  );

  useEffect(() => {
    const nextType = FEEDBACK_TYPES.includes(searchParams.get("type"))
      ? searchParams.get("type")
      : "general";
    setForm((current) => ({ ...current, type: nextType }));
  }, [searchParams]);

  const setType = (nextType) => {
    const safeType = FEEDBACK_TYPES.includes(nextType) ? nextType : "general";
    setSearchParams(safeType === "general" ? {} : { type: safeType });
    setForm((current) => ({ ...current, type: safeType }));
  };

  const submit = (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(payload));
      setMessage("Feedback draft saved on this browser.");
      setForm((current) => ({
        ...current,
        subject: "",
        details: "",
      }));
    } catch {
      setMessage("Unable to save feedback on this browser.");
    }
  };

  return (
    <QuickAccessLayout
      user={user}
      title="Give Feedback"
      subtitle="Collect bug reports, feature ideas, and general product feedback from the account menu."
    >
      <SectionCard title="Choose a feedback type">
        <div className="account-chip-row">
          {FEEDBACK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`account-chip ${form.type === type ? "active" : ""}`}
              onClick={() => setType(type)}
            >
              {humanize(type)}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Submit feedback">
        <form className="account-form-grid" onSubmit={submit}>
          <label>
            Subject
            <input
              className="account-input"
              type="text"
              value={form.subject}
              onChange={(event) =>
                setForm((current) => ({ ...current, subject: event.target.value }))
              }
              placeholder="Brief summary"
              required
            />
          </label>

          <label>
            Details
            <textarea
              className="account-textarea"
              value={form.details}
              onChange={(event) =>
                setForm((current) => ({ ...current, details: event.target.value }))
              }
              placeholder="Describe the issue, idea, or feedback clearly."
              rows={6}
              required
            />
          </label>

          <div className="account-button-row">
            <button type="submit">Save feedback</button>
            {message ? <span className="account-inline-message">{message}</span> : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="What to include">
        <ul className="quick-timeline">
          {ideas.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SectionCard>
    </QuickAccessLayout>
  );
}
