import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import {
  createKadahiveEvent,
  createKadahiveResource,
  deleteKadahiveEvent,
  deleteKadahiveResource,
  loadKadahiveAdmin,
  loadKadahiveMembers,
  updateKadahiveBooking,
  updateKadahiveEvent,
  updateKadahiveMember,
  updateKadahiveResource,
} from "../../api";
import { useAuth } from "../../context/AuthContext";
import KadahiveBrand from "./KadahiveBrand";
import "./kadahive.css";

const ADMIN_TABS = [
  ["overview", "Overview", "⌂"],
  ["members", "Members", "◎"],
  ["events", "Events", "◫"],
  ["resources", "Resources", "◇"],
  ["bookings", "Bookings", "□"],
];

const emptyEvent = {
  title: "",
  summary: "",
  description: "",
  category: "community",
  dateLabel: "",
  startsAt: "",
  endsAt: "",
  location: "KADA Hive Innovation & Tech Hub, 11B Sambo Road, Kaduna",
  capacity: 0,
  status: "draft",
  featured: false,
};

const emptyResource = {
  title: "",
  description: "",
  category: "technology",
  resourceType: "guide",
  url: "",
  accessLevel: "member",
  progressLabel: "",
  isPublished: true,
};

const formatDate = (value, withTime = false) => {
  if (!value) {
    return "Not scheduled";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
};

const toInputDate = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const memberInitials = (name = "") =>
  String(name || "K")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

function AdminStat({ label, value, note, accent = false }) {
  return (
    <article className={`kh-admin-stat ${accent ? "kh-admin-stat--accent" : ""}`}>
      <span>{label}</span>
      <strong>{Number(value || 0).toLocaleString()}</strong>
      <small>{note}</small>
    </article>
  );
}

function AdminEmpty({ title, text }) {
  return (
    <div className="kh-admin-empty">
      <span>◇</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function EventEditor({ value, onChange, onSave, onClose, saving }) {
  const update = (event) => {
    const { name, value: nextValue, type, checked } = event.target;
    onChange((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : nextValue,
    }));
  };
  return (
    <div className="kh-admin-modal" role="presentation" onMouseDown={onClose}>
      <form
        className="kh-admin-modal__panel"
        onSubmit={onSave}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Programme management</span>
            <h2>{value._id ? "Edit event" : "Create a new event"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close event editor">
            ×
          </button>
        </header>
        <div className="kh-admin-form-grid">
          <label className="is-wide">
            Event title
            <input name="title" value={value.title} onChange={update} required />
          </label>
          <label className="is-wide">
            Short summary
            <textarea name="summary" value={value.summary} onChange={update} rows="3" required />
          </label>
          <label className="is-wide">
            Full description
            <textarea name="description" value={value.description} onChange={update} rows="5" />
          </label>
          <label>
            Category
            <select name="category" value={value.category} onChange={update}>
              {["workshop", "bootcamp", "community", "training", "conference", "other"].map(
                (option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                )
              )}
            </select>
          </label>
          <label>
            Publication status
            <select name="status" value={value.status} onChange={update}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            Starts
            <input type="datetime-local" name="startsAt" value={value.startsAt} onChange={update} />
          </label>
          <label>
            Ends
            <input type="datetime-local" name="endsAt" value={value.endsAt} onChange={update} />
          </label>
          <label>
            Display date
            <input
              name="dateLabel"
              value={value.dateLabel}
              onChange={update}
              placeholder="e.g. 12–13 September 2026"
            />
          </label>
          <label>
            Capacity
            <input type="number" min="0" name="capacity" value={value.capacity} onChange={update} />
          </label>
          <label className="is-wide">
            Location
            <input name="location" value={value.location} onChange={update} />
          </label>
          <label className="kh-admin-check is-wide">
            <input type="checkbox" name="featured" checked={value.featured} onChange={update} />
            Feature this event on the public Kadahive page
          </label>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : value._id ? "Save changes" : "Create event"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ResourceEditor({ value, onChange, onSave, onClose, saving }) {
  const update = (event) => {
    const { name, value: nextValue, type, checked } = event.target;
    onChange((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : nextValue,
    }));
  };
  return (
    <div className="kh-admin-modal" role="presentation" onMouseDown={onClose}>
      <form
        className="kh-admin-modal__panel kh-admin-modal__panel--resource"
        onSubmit={onSave}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Member library</span>
            <h2>{value._id ? "Edit resource" : "Add a resource"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close resource editor">
            ×
          </button>
        </header>
        <div className="kh-admin-form-grid">
          <label className="is-wide">
            Title
            <input name="title" value={value.title} onChange={update} required />
          </label>
          <label className="is-wide">
            Description
            <textarea name="description" value={value.description} onChange={update} rows="4" required />
          </label>
          <label>
            Category
            <select name="category" value={value.category} onChange={update}>
              {["technology", "business", "career", "funding", "community", "other"].map(
                (option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                )
              )}
            </select>
          </label>
          <label>
            Type
            <select name="resourceType" value={value.resourceType} onChange={update}>
              {["guide", "course", "template", "report", "link", "video"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Access
            <select name="accessLevel" value={value.accessLevel} onChange={update}>
              <option value="public">Public</option>
              <option value="member">Member</option>
              <option value="premium">Premium</option>
            </select>
          </label>
          <label>
            Label
            <input
              name="progressLabel"
              value={value.progressLabel}
              onChange={update}
              placeholder="e.g. Self-paced"
            />
          </label>
          <label className="is-wide">
            Resource URL
            <input
              type="url"
              name="url"
              value={value.url}
              onChange={update}
              placeholder="https://…"
            />
          </label>
          <label className="kh-admin-check is-wide">
            <input
              type="checkbox"
              name="isPublished"
              checked={value.isPublished}
              onChange={update}
            />
            Make this resource available
          </label>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : value._id ? "Save changes" : "Add resource"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export default function KadahiveAdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eventEditor, setEventEditor] = useState(null);
  const [resourceEditor, setResourceEditor] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await loadKadahiveAdmin();
      setData(payload);
      if (activeTab === "members") {
        const memberPayload = await loadKadahiveMembers(search);
        setMembers(memberPayload?.members || []);
      }
    } catch (error) {
      toast.error(error?.message || "Unable to load Kadahive administration");
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (activeTab !== "members") {
      return undefined;
    }
    const timer = setTimeout(() => {
      loadKadahiveMembers(search)
        .then((payload) => setMembers(payload?.members || []))
        .catch((error) => toast.error(error?.message || "Unable to search members"));
    }, 250);
    return () => clearTimeout(timer);
  }, [activeTab, search]);

  const isSuperAdmin = data?.scope === "super_admin";
  const pendingBookings = useMemo(
    () => (data?.bookings || []).filter((booking) => booking.status === "pending"),
    [data?.bookings]
  );

  const selectTab = (key) => {
    setActiveTab(key);
    setMenuOpen(false);
  };

  const saveEvent = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...eventEditor,
        capacity: Number(eventEditor.capacity || 0),
        startsAt: eventEditor.startsAt || null,
        endsAt: eventEditor.endsAt || null,
      };
      if (eventEditor._id) {
        await updateKadahiveEvent(eventEditor._id, payload);
      } else {
        await createKadahiveEvent(payload);
      }
      toast.success(eventEditor._id ? "Event updated" : "Event created");
      setEventEditor(null);
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Unable to save this event");
    } finally {
      setSaving(false);
    }
  };

  const saveResource = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (resourceEditor._id) {
        await updateKadahiveResource(resourceEditor._id, resourceEditor);
      } else {
        await createKadahiveResource(resourceEditor);
      }
      toast.success(resourceEditor._id ? "Resource updated" : "Resource added");
      setResourceEditor(null);
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Unable to save this resource");
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (event) => {
    if (!window.confirm(`Delete “${event.title}”? This also removes its registrations.`)) {
      return;
    }
    try {
      await deleteKadahiveEvent(event._id);
      toast.success("Event deleted");
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Unable to delete this event");
    }
  };

  const removeResource = async (resource) => {
    if (!window.confirm(`Delete “${resource.title}”?`)) {
      return;
    }
    try {
      await deleteKadahiveResource(resource._id);
      toast.success("Resource deleted");
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Unable to delete this resource");
    }
  };

  const updateBookingStatus = async (booking, status) => {
    try {
      await updateKadahiveBooking(booking._id, { status });
      toast.success(`Booking ${status}`);
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Unable to update this booking");
    }
  };

  const updateMember = async (member, patch) => {
    try {
      await updateKadahiveMember(member._id, patch);
      toast.success("Membership updated");
      const payload = await loadKadahiveMembers(search);
      setMembers(payload?.members || []);
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Unable to update this membership");
    }
  };

  if (loading && !data) {
    return (
      <div className="kh-portal-loading kh-portal-loading--admin">
        <KadahiveBrand />
        <span />
        <p>Opening the institution console…</p>
      </div>
    );
  }

  return (
    <div className="kh-admin">
      <aside className={`kh-admin__sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="kh-admin__brand">
          <KadahiveBrand />
          <span>Institution console</span>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            ×
          </button>
        </div>
        <nav aria-label="Kadahive administration">
          <span>Manage Kadahive</span>
          {ADMIN_TABS.map(([key, label, icon]) => (
            <button
              type="button"
              key={key}
              className={activeTab === key ? "is-active" : ""}
              onClick={() => selectTab(key)}
            >
              <i>{icon}</i>
              {label}
              {key === "bookings" && pendingBookings.length ? <b>{pendingBookings.length}</b> : null}
            </button>
          ))}
        </nav>
        <div className="kh-admin__sidebar-links">
          {isSuperAdmin ? <Link to="/admin/institutions/kadahive">Tengacion super admin</Link> : null}
          <Link to="/kadahive/portal">Member portal</Link>
          <Link to="/kadahive">Public website</Link>
          <button type="button" onClick={() => logout({ remote: true })}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="kh-admin__main">
        <header className="kh-admin__header">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open admin menu">
            ☰
          </button>
          <div>
            <span>{isSuperAdmin ? "Tengacion super-admin view" : "Kadahive administration"}</span>
            <h1>{ADMIN_TABS.find(([key]) => key === activeTab)?.[1] || "Overview"}</h1>
          </div>
          <div className="kh-admin__profile">
            <span>{memberInitials(user?.name || user?.username)}</span>
            <div>
              <strong>{user?.name || user?.username || "Administrator"}</strong>
              <small>{isSuperAdmin ? "Tengacion super admin" : "Kadahive admin"}</small>
            </div>
          </div>
        </header>

        <div className="kh-admin__content">
          {activeTab === "overview" ? (
            <>
              <section className="kh-admin-welcome">
                <div>
                  <span>Institution pulse</span>
                  <h2>Keep Kaduna&apos;s builder community moving.</h2>
                  <p>
                    Manage members, publish programmes, curate resources and review space
                    requests from one focused workspace.
                  </p>
                </div>
                <button type="button" onClick={() => setEventEditor({ ...emptyEvent })}>
                  Create event <span>＋</span>
                </button>
              </section>
              <section className="kh-admin-stats">
                <AdminStat
                  label="Total members"
                  value={data?.stats?.totalMembers}
                  note={`${data?.stats?.activeMembers || 0} active`}
                  accent
                />
                <AdminStat
                  label="Events"
                  value={data?.stats?.eventCount}
                  note={`${data?.stats?.publishedEvents || 0} published`}
                />
                <AdminStat
                  label="Resources"
                  value={data?.stats?.resourceCount}
                  note="Across the member library"
                />
                <AdminStat
                  label="Booking queue"
                  value={data?.stats?.pendingBookings}
                  note="Awaiting review"
                />
              </section>
              <div className="kh-admin-overview-grid">
                <section className="kh-admin-panel">
                  <header>
                    <div>
                      <span>Needs attention</span>
                      <h2>Pending bookings</h2>
                    </div>
                    <button type="button" onClick={() => setActiveTab("bookings")}>
                      View all
                    </button>
                  </header>
                  {pendingBookings.length ? (
                    <div className="kh-admin-booking-list">
                      {pendingBookings.slice(0, 5).map((booking) => (
                        <article key={booking._id}>
                          <span>{memberInitials(booking.userId?.name)}</span>
                          <div>
                            <strong>{booking.userId?.name || "Kadahive member"}</strong>
                            <small>
                              {booking.space?.replaceAll("-", " ")} ·{" "}
                              {formatDate(booking.startsAt, true)}
                            </small>
                          </div>
                          <button type="button" onClick={() => updateBookingStatus(booking, "approved")}>
                            Approve
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <AdminEmpty title="Booking queue cleared" text="There are no requests awaiting review." />
                  )}
                </section>
                <section className="kh-admin-panel">
                  <header>
                    <div>
                      <span>Community growth</span>
                      <h2>Newest members</h2>
                    </div>
                    <button type="button" onClick={() => setActiveTab("members")}>
                      View all
                    </button>
                  </header>
                  <div className="kh-admin-member-list">
                    {(data?.recentMembers || []).slice(0, 6).map((member) => (
                      <article key={member._id}>
                        <span>{memberInitials(member.name)}</span>
                        <div>
                          <strong>{member.name}</strong>
                          <small>@{member.username}</small>
                        </div>
                        <i className={`kh-status kh-status--${member.status}`}>{member.role}</i>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : null}

          {activeTab === "members" ? (
            <section className="kh-admin-page">
              <div className="kh-admin-page__heading">
                <div>
                  <span>Community directory</span>
                  <h2>Kadahive members</h2>
                  <p>
                    Institution admins can pause member access. Tengacion super admins can also
                    appoint Kadahive administrators.
                  </p>
                </div>
                <label>
                  <span>⌕</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, username or email"
                  />
                </label>
              </div>
              <div className="kh-admin-table-wrap">
                <table className="kh-admin-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Contact</th>
                      <th>Joined</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member._id}>
                        <td>
                          <div className="kh-admin-table__member">
                            <span>{memberInitials(member.name)}</span>
                            <div>
                              <strong>{member.name}</strong>
                              <small>@{member.username}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong className="kh-admin-table__email">{member.email}</strong>
                          <small>{member.phone || "No phone"}</small>
                        </td>
                        <td>{formatDate(member.joinedAt)}</td>
                        <td>
                          {isSuperAdmin ? (
                            <select
                              value={member.role}
                              onChange={(event) => updateMember(member, { role: event.target.value })}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className="kh-role-pill">{member.role}</span>
                          )}
                        </td>
                        <td>
                          <select
                            value={member.status}
                            disabled={!isSuperAdmin && member.role === "admin"}
                            onChange={(event) => updateMember(member, { status: event.target.value })}
                          >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "events" ? (
            <section className="kh-admin-page">
              <div className="kh-admin-page__heading">
                <div>
                  <span>Programme publishing</span>
                  <h2>Events &amp; programmes</h2>
                  <p>Draft, publish and archive what the community can discover.</p>
                </div>
                <button type="button" onClick={() => setEventEditor({ ...emptyEvent })}>
                  ＋ New event
                </button>
              </div>
              <div className="kh-admin-card-list">
                {(data?.events || []).map((event) => (
                  <article key={event._id}>
                    <div className="kh-admin-card-list__date">
                      <strong>{event.dateLabel || formatDate(event.startsAt)}</strong>
                      <span>{event.category}</span>
                    </div>
                    <div className="kh-admin-card-list__copy">
                      <span className={`kh-status kh-status--${event.status}`}>{event.status}</span>
                      <h3>{event.title}</h3>
                      <p>{event.summary}</p>
                      <small>
                        {event.registrationCount || 0} registrations
                        {event.capacity ? ` · ${event.capacity} capacity` : ""}
                      </small>
                    </div>
                    <div className="kh-admin-card-list__actions">
                      <button
                        type="button"
                        onClick={() =>
                          setEventEditor({
                            ...event,
                            startsAt: toInputDate(event.startsAt),
                            endsAt: toInputDate(event.endsAt),
                          })
                        }
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => removeEvent(event)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "resources" ? (
            <section className="kh-admin-page">
              <div className="kh-admin-page__heading">
                <div>
                  <span>Learning library</span>
                  <h2>Member resources</h2>
                  <p>Curate the guides, templates and learning paths members can access.</p>
                </div>
                <button type="button" onClick={() => setResourceEditor({ ...emptyResource })}>
                  ＋ Add resource
                </button>
              </div>
              <div className="kh-admin-resource-grid">
                {(data?.resources || []).map((resource) => (
                  <article key={resource._id}>
                    <div>
                      <span>{resource.resourceType?.slice(0, 1)?.toUpperCase()}</span>
                      <i className={`kh-status kh-status--${resource.isPublished ? "active" : "draft"}`}>
                        {resource.isPublished ? "published" : "hidden"}
                      </i>
                    </div>
                    <small>
                      {resource.category} · {resource.accessLevel}
                    </small>
                    <h3>{resource.title}</h3>
                    <p>{resource.description}</p>
                    <footer>
                      <button type="button" onClick={() => setResourceEditor({ ...resource })}>
                        Edit
                      </button>
                      <button type="button" onClick={() => removeResource(resource)}>
                        Delete
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "bookings" ? (
            <section className="kh-admin-page">
              <div className="kh-admin-page__heading">
                <div>
                  <span>Hub operations</span>
                  <h2>Space bookings</h2>
                  <p>Review requests and keep members informed with a clear status.</p>
                </div>
              </div>
              {(data?.bookings || []).length ? (
                <div className="kh-admin-bookings">
                  {data.bookings.map((booking) => (
                    <article key={booking._id}>
                      <div className="kh-admin-bookings__person">
                        <span>{memberInitials(booking.userId?.name)}</span>
                        <div>
                          <strong>{booking.userId?.name || "Kadahive member"}</strong>
                          <small>{booking.userId?.email || ""}</small>
                        </div>
                      </div>
                      <div>
                        <strong>{booking.space?.replaceAll("-", " ")}</strong>
                        <small>
                          {formatDate(booking.startsAt, true)} · {booking.durationHours}h ·{" "}
                          {booking.attendees} attendee{booking.attendees === 1 ? "" : "s"}
                        </small>
                      </div>
                      <p>{booking.purpose}</p>
                      <select
                        value={booking.status}
                        onChange={(event) => updateBookingStatus(booking, event.target.value)}
                      >
                        {["pending", "approved", "declined", "cancelled", "completed"].map(
                          (status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          )
                        )}
                      </select>
                    </article>
                  ))}
                </div>
              ) : (
                <AdminEmpty title="No bookings yet" text="Member space requests will appear here." />
              )}
            </section>
          ) : null}
        </div>
      </main>

      {eventEditor ? (
        <EventEditor
          value={eventEditor}
          onChange={setEventEditor}
          onSave={saveEvent}
          onClose={() => setEventEditor(null)}
          saving={saving}
        />
      ) : null}
      {resourceEditor ? (
        <ResourceEditor
          value={resourceEditor}
          onChange={setResourceEditor}
          onSave={saveResource}
          onClose={() => setResourceEditor(null)}
          saving={saving}
        />
      ) : null}
    </div>
  );
}
