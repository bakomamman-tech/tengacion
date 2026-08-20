import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  createKadahiveBooking,
  joinKadahive,
  loadKadahiveMember,
  registerForKadahiveEvent,
} from "../../api";
import { useAuth } from "../../context/AuthContext";
import KadahiveBrand from "./KadahiveBrand";
import "./kadahive.css";

const TABS = [
  ["overview", "Overview", "⌂"],
  ["events", "Events", "◫"],
  ["book", "Book a space", "□"],
  ["resources", "Resource library", "◈"],
  ["profile", "My profile", "○"],
];

const SPACE_LABELS = {
  "coworking-desk": "Co-working desk",
  "meeting-room": "Meeting room",
  "training-hall": "Training hall",
  "event-space": "Event space",
};

const formatDate = (value, options = {}) => {
  if (!value) {
    return "Date to be announced";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date to be announced";
  }
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
};

const initials = (value = "") =>
  String(value || "K")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

function PortalCard({ title, action, children, className = "" }) {
  return (
    <section className={`kh-portal-card ${className}`}>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="kh-empty">
      <span>◇</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export default function KadahiveMemberDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [booking, setBooking] = useState({
    space: "coworking-desk",
    startsAt: "",
    durationHours: 2,
    attendees: 1,
    purpose: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await joinKadahive();
      const payload = await loadKadahiveMember();
      setDashboard(payload);
    } catch (error) {
      toast.error(error?.message || "Unable to load the Kadahive portal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const registeredIds = useMemo(
    () => new Set((dashboard?.registrations || []).map((entry) => String(entry.eventId))),
    [dashboard?.registrations]
  );
  const publishedEvents = useMemo(
    () => (dashboard?.events || []).filter((event) => event.status === "published"),
    [dashboard?.events]
  );
  const archivedEvents = useMemo(
    () => (dashboard?.events || []).filter((event) => event.status === "archived"),
    [dashboard?.events]
  );
  const canAdmin = ["institution_admin", "super_admin"].includes(dashboard?.scope);

  const selectTab = (key) => {
    setActiveTab(key);
    setMenuOpen(false);
  };

  const handleRegister = async (eventId) => {
    setActionLoading(`event:${eventId}`);
    try {
      await registerForKadahiveEvent(eventId);
      toast.success("Your place is reserved");
      await load();
    } catch (error) {
      toast.error(error?.message || "Unable to register");
    } finally {
      setActionLoading("");
    }
  };

  const handleBooking = async (event) => {
    event.preventDefault();
    setActionLoading("booking");
    try {
      await createKadahiveBooking(booking);
      toast.success("Your booking request was sent");
      setBooking({
        space: "coworking-desk",
        startsAt: "",
        durationHours: 2,
        attendees: 1,
        purpose: "",
      });
      await load();
      setActiveTab("overview");
    } catch (error) {
      toast.error(error?.message || "Unable to request this booking");
    } finally {
      setActionLoading("");
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="kh-portal-loading">
        <KadahiveBrand />
        <span />
        <p>Preparing your workspace…</p>
      </div>
    );
  }

  const displayName = dashboard?.user?.name || user?.name || "Kadahive member";
  const firstName = displayName.split(" ")[0];

  return (
    <div className="kh-workspace">
      <aside className={`kh-workspace__sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="kh-workspace__brand">
          <KadahiveBrand />
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            ×
          </button>
        </div>
        <nav aria-label="Member workspace">
          <span className="kh-workspace__nav-label">My workspace</span>
          {TABS.map(([key, label, icon]) => (
            <button
              type="button"
              key={key}
              className={activeTab === key ? "is-active" : ""}
              onClick={() => selectTab(key)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
          {canAdmin ? (
            <>
              <span className="kh-workspace__nav-label">Management</span>
              <button type="button" onClick={() => navigate("/kadahive/admin")}>
                <span>⌘</span>
                Institution admin
              </button>
            </>
          ) : null}
        </nav>
        <div className="kh-workspace__sidebar-bottom">
          <Link to="/kadahive">← Back to public site</Link>
          <button type="button" onClick={() => logout({ remote: true })}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="kh-workspace__main">
        <header className="kh-workspace__header">
          <button
            type="button"
            className="kh-workspace__menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open workspace menu"
          >
            ☰
          </button>
          <div>
            <span>Member portal</span>
            <strong>
              {TABS.find(([key]) => key === activeTab)?.[1] || "Overview"}
            </strong>
          </div>
          <div className="kh-workspace__profile">
            <span>{initials(displayName)}</span>
            <div>
              <strong>{displayName}</strong>
              <small>{dashboard?.membership?.role === "admin" ? "Hub administrator" : "Member"}</small>
            </div>
          </div>
        </header>

        <div className="kh-workspace__content">
          {activeTab === "overview" ? (
            <>
              <section className="kh-welcome">
                <div>
                  <span className="kh-welcome__eyebrow">Good to see you, {firstName}</span>
                  <h1>What will you move forward today?</h1>
                  <p>
                    Your events, workspace requests and member resources are gathered here.
                  </p>
                </div>
                <button type="button" onClick={() => setActiveTab("book")}>
                  Book a space <span>↗</span>
                </button>
              </section>

              <section className="kh-member-stats">
                <article>
                  <span>Upcoming events</span>
                  <strong>{dashboard?.stats?.upcomingEvents || 0}</strong>
                  <small>Published programmes</small>
                </article>
                <article>
                  <span>Active bookings</span>
                  <strong>{dashboard?.stats?.activeBookings || 0}</strong>
                  <small>Pending or approved</small>
                </article>
                <article>
                  <span>Member resources</span>
                  <strong>{dashboard?.stats?.availableResources || 0}</strong>
                  <small>Guides, courses and tools</small>
                </article>
              </section>

              <div className="kh-workspace-grid">
                <PortalCard
                  title="Your booking requests"
                  action={
                    <button className="kh-inline-action" type="button" onClick={() => setActiveTab("book")}>
                      New request
                    </button>
                  }
                >
                  {(dashboard?.bookings || []).length ? (
                    <div className="kh-booking-list">
                      {dashboard.bookings.slice(0, 4).map((entry) => (
                        <article key={entry._id}>
                          <span className={`kh-status kh-status--${entry.status}`}>
                            {entry.status}
                          </span>
                          <div>
                            <strong>{SPACE_LABELS[entry.space] || entry.space}</strong>
                            <small>
                              {formatDate(entry.startsAt, { hour: "numeric", minute: "2-digit" })} ·{" "}
                              {entry.durationHours} hour{entry.durationHours === 1 ? "" : "s"}
                            </small>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No booking requests yet"
                      text="Reserve a desk, meeting room, training hall or event space."
                    />
                  )}
                </PortalCard>

                <PortalCard
                  title="Resource library"
                  action={
                    <button
                      className="kh-inline-action"
                      type="button"
                      onClick={() => setActiveTab("resources")}
                    >
                      View all
                    </button>
                  }
                >
                  <div className="kh-resource-preview">
                    {(dashboard?.resources || []).slice(0, 3).map((resource) => (
                      <article key={resource._id}>
                        <span>{resource.resourceType?.slice(0, 1)?.toUpperCase() || "R"}</span>
                        <div>
                          <strong>{resource.title}</strong>
                          <small>{resource.progressLabel || resource.category}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </PortalCard>
              </div>
            </>
          ) : null}

          {activeTab === "events" ? (
            <section className="kh-workspace-page">
              <div className="kh-workspace-page__heading">
                <span>Community calendar</span>
                <h1>Events &amp; programmes</h1>
                <p>Reserve your place in upcoming sessions or explore the programme archive.</p>
              </div>
              <h2 className="kh-workspace-subtitle">Registration open</h2>
              {publishedEvents.length ? (
                <div className="kh-member-event-grid">
                  {publishedEvents.map((event) => {
                    const registered = registeredIds.has(String(event._id));
                    return (
                      <article key={event._id}>
                        <span className="kh-member-event-grid__category">{event.category}</span>
                        <strong>{event.dateLabel || formatDate(event.startsAt)}</strong>
                        <h3>{event.title}</h3>
                        <p>{event.summary}</p>
                        <button
                          type="button"
                          disabled={registered || actionLoading === `event:${event._id}`}
                          onClick={() => handleRegister(event._id)}
                        >
                          {registered
                            ? "Registered"
                            : actionLoading === `event:${event._id}`
                              ? "Reserving…"
                              : "Reserve my place"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No open registrations right now"
                  text="New Kadahive sessions will appear here as soon as they are published."
                />
              )}
              <h2 className="kh-workspace-subtitle">Programme archive</h2>
              <div className="kh-archive-list">
                {archivedEvents.map((event) => (
                  <article key={event._id}>
                    <span>{event.dateLabel || formatDate(event.startsAt)}</span>
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.summary}</p>
                    </div>
                    <small>Archived</small>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "book" ? (
            <section className="kh-workspace-page">
              <div className="kh-workspace-page__heading">
                <span>Use the hub</span>
                <h1>Book a Kadahive space</h1>
                <p>Tell the hub team what you need. Every request is reviewed before confirmation.</p>
              </div>
              <div className="kh-book-layout">
                <form className="kh-book-form" onSubmit={handleBooking}>
                  <label>
                    Space
                    <select
                      value={booking.space}
                      onChange={(event) =>
                        setBooking((current) => ({ ...current, space: event.target.value }))
                      }
                    >
                      {Object.entries(SPACE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <label>
                      Date and time
                      <input
                        type="datetime-local"
                        value={booking.startsAt}
                        onChange={(event) =>
                          setBooking((current) => ({ ...current, startsAt: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Duration
                      <select
                        value={booking.durationHours}
                        onChange={(event) =>
                          setBooking((current) => ({
                            ...current,
                            durationHours: Number(event.target.value),
                          }))
                        }
                      >
                        {[1, 2, 3, 4, 6, 8, 12].map((hours) => (
                          <option key={hours} value={hours}>
                            {hours} hour{hours === 1 ? "" : "s"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Expected attendees
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={booking.attendees}
                      onChange={(event) =>
                        setBooking((current) => ({
                          ...current,
                          attendees: Number(event.target.value),
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    What are you planning?
                    <textarea
                      value={booking.purpose}
                      onChange={(event) =>
                        setBooking((current) => ({ ...current, purpose: event.target.value }))
                      }
                      placeholder="Share enough context for the hub team to prepare the right space."
                      rows="5"
                      maxLength="500"
                      required
                    />
                  </label>
                  <button type="submit" disabled={actionLoading === "booking"}>
                    {actionLoading === "booking" ? "Sending request…" : "Send booking request"}
                  </button>
                </form>
                <aside className="kh-book-guide">
                  <span>Before you send</span>
                  <h2>A few useful details</h2>
                  <ul>
                    <li>Requests are reviewed by the Kadahive team.</li>
                    <li>Submitting a request does not guarantee availability.</li>
                    <li>You will see approval or feedback in this portal.</li>
                    <li>For large public events, include your setup and audience needs.</li>
                  </ul>
                  <a href="mailto:sady9043@gmail.com">Need help? Email the hub team →</a>
                </aside>
              </div>
            </section>
          ) : null}

          {activeTab === "resources" ? (
            <section className="kh-workspace-page">
              <div className="kh-workspace-page__heading">
                <span>Learn at your pace</span>
                <h1>Member resource library</h1>
                <p>Guides, templates and learning paths selected for Kadahive members.</p>
              </div>
              <div className="kh-resource-grid">
                {(dashboard?.resources || []).map((resource) => (
                  <article key={resource._id}>
                    <div className="kh-resource-grid__icon">
                      {resource.resourceType?.slice(0, 1)?.toUpperCase() || "R"}
                    </div>
                    <span>
                      {resource.category} · {resource.resourceType}
                    </span>
                    <h3>{resource.title}</h3>
                    <p>{resource.description}</p>
                    {resource.url ? (
                      <a href={resource.url} target="_blank" rel="noreferrer">
                        Open resource <span>↗</span>
                      </a>
                    ) : (
                      <button type="button" onClick={() => toast("This resource is available at the hub.")}>
                        Ask the hub team <span>→</span>
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "profile" ? (
            <section className="kh-workspace-page">
              <div className="kh-workspace-page__heading">
                <span>One connected account</span>
                <h1>Your member profile</h1>
                <p>Your Tengacion identity securely powers your Kadahive membership.</p>
              </div>
              <div className="kh-profile-card">
                <span className="kh-profile-card__avatar">{initials(displayName)}</span>
                <div>
                  <span>Active Kadahive member</span>
                  <h2>{displayName}</h2>
                  <p>@{dashboard?.user?.username || user?.username}</p>
                </div>
                <dl>
                  <div>
                    <dt>Email</dt>
                    <dd>{dashboard?.user?.email || user?.email}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{dashboard?.user?.phone || user?.phone || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Membership role</dt>
                    <dd>{dashboard?.membership?.role || "member"}</dd>
                  </div>
                </dl>
                <button type="button" onClick={() => navigate("/settings")}>
                  Manage account on Tengacion <span>↗</span>
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
