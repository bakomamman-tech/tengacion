import { useNavigate } from "react-router-dom";

import QuickAccessLayout from "../components/QuickAccessLayout";
import { SUPPORT_EMAIL, buildMailto } from "../config/businessContact";
import { useTheme } from "../context/ThemeContext";
import { normalizeWelcomeVoicePrefs } from "../services/welcomeVoice";
import { getThemeLabel } from "../themeConfig";

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
  const audioPrefs = normalizeWelcomeVoicePrefs(user?.audioPrefs);

  const overview = [
    {
      label: "Theme",
      value: getThemeLabel(theme),
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
    {
      label: "Welcome voice",
      value: audioPrefs.welcomeVoiceEnabled ? "On" : "Off",
      note: `Ambient voice at ${Math.round(audioPrefs.welcomeVoiceVolume * 100)}% volume`,
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
    {
      id: "sound",
      label: "Sound & welcome voice",
      description: "Ambient greeting, quiet volume controls, and audio behavior.",
      note: "Shape the spoken Tengacion welcome",
      path: "/settings/sound",
    },
    {
      id: "account-deletion",
      label: "Delete account",
      description: "Permanently delete your account and associated personal content.",
      note: "Open account deletion controls",
      path: "/account-deletion",
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
          <article className="quick-list-item">
            <strong>Email support</strong>
            <span>{SUPPORT_EMAIL}</span>
            <a href={buildMailto(SUPPORT_EMAIL, "Tengacion support request")}>
              Email
            </a>
          </article>
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
      value: "blue-ray",
      title: "Blue Ray",
      description: "Luminous cobalt accents, cool pearl surfaces, and layered blue depth.",
    },
    {
      value: "nature-green",
      title: "Nature Green",
      description: "Fresh organic greens, cream surfaces, and leafy calm across Tengacion.",
    },
    {
      value: "peaceful",
      title: "Peaceful Mode",
      description: "Luminous ivory surfaces with soft gold framing and calm violet accents.",
    },
    {
      value: "dark",
      title: "Dark mode",
      description: "Deeper surfaces with softer glare for low-light browsing.",
    },
    {
      value: "royalty",
      title: "Royalty Mode",
      description: "Midnight navy surfaces framed with luminous gold and refined violet accents.",
    },
    {
      value: "afro-gold",
      title: "Afro Gold",
      description: "Deep black surfaces, luminous gold, and culture-rich premium accents.",
    },
    {
      value: "terra-minimal",
      title: "Terra Minimal",
      description: "Warm ivory glass, terracotta accents, and earthy creator-studio calm.",
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
      description: "Use browser zoom together with any Tengacion display mode to improve readability on your device.",
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
  return (
    <QuickAccessLayout
      user={user}
      title="Give Feedback"
      subtitle="This surface is being prepared for a future Tengacion release."
    >
      <section className="card quick-preview-state" aria-labelledby="feedback-preview-title">
        <span className="feature-lifecycle-badge">Preview</span>
        <h2 id="feedback-preview-title">Web feedback submission is not available yet</h2>
        <p>
          Tengacion does not currently send this form to a production support system.
          This page will not claim that a browser-only draft has been submitted.
        </p>
        <p>For product or safety support now, contact the published support address.</p>
        <a
          className="quick-preview-link"
          href={buildMailto(SUPPORT_EMAIL, "Tengacion feedback or support request")}
        >
          Email {SUPPORT_EMAIL}
        </a>
      </section>
    </QuickAccessLayout>
  );
}
