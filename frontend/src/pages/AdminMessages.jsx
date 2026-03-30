import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import AdminShell from "../components/AdminShell";
import {
  adminGetComplaints,
  adminGetMessagesOverview,
  adminUpdateComplaint,
  sendChatMessageDirect,
} from "../api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const number = (value) => Number(value || 0).toLocaleString();
const dateTime = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const titleCase = (value = "") =>
  String(value || "")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

export default function AdminMessagesPage({ user }) {
  const navigate = useNavigate();
  const [range, setRange] = useState("30d");
  const [payload, setPayload] = useState({
    summary: {},
    series: [],
    recentConversations: [],
    complaintSummary: {},
    complaints: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [messages, complaints] = await Promise.all([
        adminGetMessagesOverview({ range, interval: "daily" }),
        adminGetComplaints({ limit: 8 }),
      ]);
      setPayload({
        summary: messages?.summary || {},
        series: messages?.series || [],
        recentConversations: messages?.recentConversations || [],
        complaintSummary: complaints?.summary || {},
        complaints: complaints?.complaints || [],
      });
    } catch (err) {
      setError(err?.message || "Failed to load message analytics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!replyTarget) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setReplyTarget(null);
        setReplyText("");
        setReplyError("");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [replyTarget]);

  const cards = useMemo(
    () => [
      ["Messages", payload.summary?.totalMessages],
      ["Conversations", payload.summary?.conversations],
      ["Active Senders", payload.summary?.activeSenders],
      ["Unread", payload.summary?.unreadMessages],
      ["Read", payload.summary?.readMessages],
      ["Avg / Conversation", payload.summary?.averagePerConversation],
      ["Open Complaints", payload.complaintSummary?.open],
      ["Resolved Complaints", payload.complaintSummary?.resolved],
      ["Critical Complaints", payload.complaintSummary?.critical],
    ],
    [payload.summary, payload.complaintSummary]
  );

  const complaintBadgeClass = (status = "") => {
    const value = String(status || "").toLowerCase();
    if (value === "resolved") {
      return "adminx-badge--good";
    }
    if (value === "dismissed") {
      return "adminx-badge--danger";
    }
    return "adminx-badge--warn";
  };

  const priorityBadgeClass = (priority = "") => {
    const value = String(priority || "").toLowerCase();
    if (value === "critical") {
      return "adminx-badge--danger";
    }
    if (value === "high") {
      return "adminx-badge--warn";
    }
    return "";
  };

  const handleComplaintStatus = async (complaintId, status) => {
    if (!complaintId || busyId) {
      return;
    }

    try {
      setBusyId(`${complaintId}:${status}`);
      await adminUpdateComplaint(complaintId, { status });
      toast.success(`Complaint marked ${status}`);
      await load();
    } catch (err) {
      setError(err?.message || "Failed to update complaint");
    } finally {
      setBusyId("");
    }
  };

  const openReplyComposer = useCallback((complaint) => {
    if (!complaint?.reporter?._id) {
      return;
    }

    const reporterName = complaint.reporter.name || complaint.reporter.username || "user";
    setReplyTarget(complaint);
    setReplyText(`Hi ${reporterName}, `);
    setReplyError("");
  }, []);

  const closeReplyComposer = useCallback(() => {
    setReplyTarget(null);
    setReplyText("");
    setReplyError("");
    setReplyBusy(false);
  }, []);

  const sendReply = useCallback(
    async (event) => {
      event.preventDefault();

      if (!replyTarget?.reporter?._id || replyBusy) {
        return;
      }

      const message = String(replyText || "").trim();
      if (!message) {
        setReplyError("Message is required");
        return;
      }

      try {
        setReplyBusy(true);
        setReplyError("");
        await sendChatMessageDirect({
          receiverId: replyTarget.reporter._id,
          text: message,
        });
        toast.success("Reply sent to user");
        closeReplyComposer();
      } catch (err) {
        setReplyError(err?.message || "Failed to send reply");
      } finally {
        setReplyBusy(false);
      }
    },
    [closeReplyComposer, replyBusy, replyTarget, replyText]
  );

  return (
    <AdminShell
      title="Messages"
      subtitle="Live message volume, recent conversation activity, and user complaints sent through Report To Admin."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`adminx-tab ${range === option.value ? "is-active" : ""}`}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading message insights...</div> : null}

      {!loading ? (
        <>
          <div className="adminx-stats-grid">
            {cards.map(([label, value]) => (
              <article key={label} className="adminx-stat-card">
                <div className="adminx-kpi-label">{label}</div>
                <div className="adminx-kpi-value">{number(value)}</div>
              </article>
            ))}
          </div>

          <div className="adminx-analytics-grid">
            <section className="adminx-panel adminx-panel--span-7">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Daily Message Volume</h2>
                <span className="adminx-section-meta">Messages sent per day</span>
              </div>
              <div className="adminx-chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={payload.series || []}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="date" stroke="#9ec4ad" />
                    <YAxis stroke="#9ec4ad" />
                    <Tooltip />
                    <Line type="monotone" dataKey="messagesSent" stroke="#4de586" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="adminx-panel adminx-panel--span-5">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Recent Conversations</h2>
                <span className="adminx-section-meta">Latest active threads</span>
              </div>
              <div className="adminx-leaderboard">
                {(payload.recentConversations || []).map((entry) => (
                  <article key={entry.conversationId} className="adminx-leaderboard-item">
                    <div className="adminx-row">
                      <strong>{(entry.participantNames || []).join(", ") || entry.lastSenderName || "Conversation"}</strong>
                      <span className="adminx-badge">{number(entry.messagesCount)} msgs</span>
                    </div>
                    <div className="adminx-muted">{entry.lastPreview}</div>
                    <div className="adminx-muted">{dateTime(entry.lastMessageAt)}</div>
                  </article>
                ))}
                {!(payload.recentConversations || []).length ? (
                  <div className="adminx-empty">No message conversations in this range.</div>
                ) : null}
              </div>
            </section>
          </div>

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Report To Admin Inbox</h2>
              <span className="adminx-section-meta">User complaints waiting for review or resolution</span>
            </div>
            <div className="adminx-leaderboard">
              {(payload.complaints || []).map((complaint) => (
                <article key={complaint._id} className="adminx-leaderboard-item">
                  <div className="adminx-row" style={{ alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <strong>{complaint.subject || "Complaint"}</strong>
                      <div className="adminx-muted">
                        From {(complaint.reporter?.name || complaint.reporter?.username || "Unknown user")}
                        {complaint.reporter?.username ? ` @${complaint.reporter.username}` : ""}
                      </div>
                    </div>
                    <div className="adminx-pill-row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span className={`adminx-badge ${complaintBadgeClass(complaint.status)}`}>
                        {titleCase(complaint.status || "open")}
                      </span>
                      <span className={`adminx-badge ${priorityBadgeClass(complaint.priority)}`}>
                        {titleCase(complaint.priority || "medium")}
                      </span>
                      {complaint.category ? <span className="adminx-badge">{complaint.category}</span> : null}
                    </div>
                  </div>

                  <div className="adminx-muted">{complaint.details}</div>
                  <div className="adminx-row" style={{ flexWrap: "wrap" }}>
                    <span className="adminx-muted">
                      {dateTime(complaint.createdAt)}
                      {complaint.sourceLabel ? ` - ${complaint.sourceLabel}` : ""}
                    </span>
                    <div className="adminx-action-row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {complaint.sourcePath ? (
                        <button
                          type="button"
                          className="adminx-link-btn"
                          onClick={() => navigate(complaint.sourcePath)}
                        >
                          Open source
                        </button>
                      ) : null}
                      {complaint.reporter?._id ? (
                        <button
                          type="button"
                          className="adminx-btn adminx-btn--primary"
                          onClick={() => openReplyComposer(complaint)}
                        >
                          Reply user
                        </button>
                      ) : null}
                      {complaint.status !== "reviewing" ? (
                        <button
                          type="button"
                          className="adminx-btn"
                          disabled={busyId === `${complaint._id}:reviewing`}
                          onClick={() => handleComplaintStatus(complaint._id, "reviewing")}
                        >
                          {busyId === `${complaint._id}:reviewing` ? "Updating..." : "Mark reviewing"}
                        </button>
                      ) : null}
                      {complaint.status !== "resolved" ? (
                        <button
                          type="button"
                          className="adminx-btn adminx-btn--primary"
                          disabled={busyId === `${complaint._id}:resolved`}
                          onClick={() => handleComplaintStatus(complaint._id, "resolved")}
                        >
                          {busyId === `${complaint._id}:resolved` ? "Resolving..." : "Resolve"}
                        </button>
                      ) : null}
                      {complaint.status !== "dismissed" ? (
                        <button
                          type="button"
                          className="adminx-btn"
                          disabled={busyId === `${complaint._id}:dismissed`}
                          onClick={() => handleComplaintStatus(complaint._id, "dismissed")}
                        >
                          {busyId === `${complaint._id}:dismissed` ? "Dismissing..." : "Dismiss"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
              {!(payload.complaints || []).length ? (
                <div className="adminx-empty">No complaints have been sent to Admin yet.</div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {replyTarget ? (
        <div className="adminx-modal" role="presentation" onMouseDown={closeReplyComposer}>
          <div
            className="adminx-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adminx-reply-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="adminx-modal__head">
              <div>
                <h3 id="adminx-reply-title">Reply to user</h3>
                <p>
                  Send a message straight to{" "}
                  {replyTarget.reporter?.name || replyTarget.reporter?.username || "this user"}
                  {" "}and it will appear in their Messenger.
                </p>
              </div>
              <button type="button" className="adminx-modal__close" onClick={closeReplyComposer} aria-label="Close reply composer">
                X
              </button>
            </div>

            <div className="adminx-modal__meta">
              <span>
                <strong>Complaint:</strong> {replyTarget.subject || "Complaint"}
              </span>
              <span>
                <strong>Recipient:</strong>{" "}
                {replyTarget.reporter?.name || replyTarget.reporter?.username || "Unknown user"}
                {replyTarget.reporter?.username ? ` @${replyTarget.reporter.username}` : ""}
              </span>
            </div>

            <form className="adminx-modal__form" onSubmit={sendReply}>
              <label className="adminx-modal__field">
                Message
                <textarea
                  className="adminx-textarea"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Write back to the user..."
                  rows={6}
                  maxLength={2000}
                  required
                />
              </label>

              {replyError ? <p className="adminx-modal__error">{replyError}</p> : null}

              <div className="adminx-modal__actions">
                <button type="button" className="adminx-btn" onClick={closeReplyComposer}>
                  Cancel
                </button>
                <button type="submit" className="adminx-btn adminx-btn--primary" disabled={replyBusy}>
                  {replyBusy ? "Sending..." : "Send reply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
