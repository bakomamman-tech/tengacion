import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  acceptFriendRequest,
  getFriendRequests,
  rejectFriendRequest,
  resolveImage,
  submitAdminComplaint,
} from "./api";
import { useAuth } from "./context/AuthContext";
import { connectSocket } from "./socket";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=E3EFE7&color=1B5838`;

const formatSourceLabel = (pathname = "") => {
  const normalized = String(pathname || "").trim().replace(/^\/+/, "");
  if (!normalized || normalized === "home") {
    return "Home";
  }

  return normalized
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[-_]/g, " "))
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" / ");
};

export default function FriendRequests() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportForm, setReportForm] = useState({
    subject: "",
    details: "",
    category: "general",
  });

  const sourcePath = `${String(location.pathname || "/home")}${String(location.search || "")}`;
  const sourceLabel = formatSourceLabel(location.pathname || "/home");

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getFriendRequests();
      setRequests(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err?.message || "Failed to load friend requests");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    const socket = connectSocket({ userId: user._id });
    if (!socket) {
      return undefined;
    }

    const refresh = () => {
      loadRequests();
    };

    socket.on("friend:request", refresh);
    socket.on("friend:accepted", refresh);

    return () => {
      socket.off("friend:request", refresh);
      socket.off("friend:accepted", refresh);
    };
  }, [loadRequests, user?._id]);

  useEffect(() => {
    if (!reportOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setReportOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [reportOpen]);

  const handleDecision = async (userId, action) => {
    if (!userId || busyId) {
      return;
    }

    try {
      setBusyId(userId);
      setError("");

      if (action === "accept") {
        await acceptFriendRequest(userId);
      } else {
        await rejectFriendRequest(userId);
      }

      setRequests((current) => current.filter((item) => item._id !== userId));
    } catch (err) {
      setError(err?.message || "Action failed");
    } finally {
      setBusyId("");
    }
  };

  const submitComplaint = async (event) => {
    event.preventDefault();

    if (reportBusy) {
      return;
    }

    try {
      setReportBusy(true);
      setReportError("");

      await submitAdminComplaint({
        subject: reportForm.subject,
        details: reportForm.details,
        category: reportForm.category,
        sourcePath,
        sourceLabel,
      });

      setReportOpen(false);
      setReportForm({
        subject: "",
        details: "",
        category: "general",
      });
      toast.success("Complaint sent to Admin");
    } catch (err) {
      setReportError(err?.message || "Failed to send complaint");
    } finally {
      setReportBusy(false);
    }
  };

  const closeReport = () => {
    setReportOpen(false);
    setReportError("");
  };

  return (
    <section className="card friend-requests-card">
      <div className="friend-requests-head">
        <h3>Friend requests</h3>
        <button type="button" className="btn-link" onClick={loadRequests}>
          Refresh
        </button>
      </div>

      {loading && <p className="friend-requests-state">Loading requests...</p>}
      {!loading && error && <p className="friend-requests-error">{error}</p>}

      <div className="friend-requests-body">
        {!loading && !error && requests.length === 0 && (
          <p className="friend-requests-state">No pending friend requests.</p>
        )}

        {!loading &&
          !error &&
          requests.map((entry) => (
            <article key={entry._id} className="friend-request-item">
              <button
                type="button"
                className="friend-request-profile"
                onClick={() => navigate(`/profile/${entry.username}`)}
              >
                <img
                  src={resolveImage(entry.avatar) || fallbackAvatar(entry.name)}
                  alt={entry.name}
                />
                <div>
                  <strong>{entry.name}</strong>
                  <span>@{entry.username}</span>
                </div>
              </button>

              <div className="friend-request-actions">
                <button
                  type="button"
                  className="friend-request-btn confirm"
                  onClick={() => handleDecision(entry._id, "accept")}
                  disabled={busyId === entry._id}
                >
                  {busyId === entry._id ? "Confirming..." : "Confirm"}
                </button>
                <button
                  type="button"
                  className="friend-request-btn delete"
                  onClick={() => handleDecision(entry._id, "reject")}
                  disabled={busyId === entry._id}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
      </div>

      <div className="friend-requests-footer">
        <div className="friend-requests-footer-copy">
          <strong>Need help or need a review?</strong>
          <span>Send a private complaint straight to the Admin inbox.</span>
        </div>
        <button
          type="button"
          className="friend-request-btn report-admin"
          onClick={() => {
            setReportError("");
            setReportOpen(true);
          }}
        >
          Report To Admin
        </button>
      </div>

      {reportOpen ? (
        <div
          className="report-admin-modal"
          role="presentation"
          onMouseDown={closeReport}
        >
          <div
            className="report-admin-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-admin-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="report-admin-modal__head">
              <div>
                <h4 id="report-admin-title">Report To Admin</h4>
                <p>Your complaint goes straight to the Admin dashboard and stays tied to this page.</p>
              </div>
              <button
                type="button"
                className="report-admin-modal__close"
                onClick={closeReport}
                aria-label="Close report dialog"
              >
                X
              </button>
            </div>

            <form className="report-admin-modal__form" onSubmit={submitComplaint}>
              <div className="report-admin-modal__grid">
                <label>
                  Subject
                  <input
                    value={reportForm.subject}
                    onChange={(event) =>
                      setReportForm((current) => ({ ...current, subject: event.target.value }))
                    }
                    placeholder="Short summary"
                    maxLength={160}
                    required
                  />
                </label>
                <label>
                  Type
                  <select
                    value={reportForm.category}
                    onChange={(event) =>
                      setReportForm((current) => ({ ...current, category: event.target.value }))
                    }
                  >
                    <option value="general">General complaint</option>
                    <option value="safety">Safety issue</option>
                    <option value="abuse">Abuse or harassment</option>
                    <option value="privacy">Privacy concern</option>
                    <option value="bug">Bug or app issue</option>
                    <option value="account">Account issue</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>

              <label>
                Complaint
                <textarea
                  value={reportForm.details}
                  onChange={(event) =>
                    setReportForm((current) => ({ ...current, details: event.target.value }))
                  }
                  placeholder="Describe the issue clearly so Admin can act fast."
                  rows={6}
                  maxLength={2000}
                  required
                />
              </label>

              <div className="report-admin-modal__note">
                <strong>Source:</strong> {sourceLabel}
                <span>{sourcePath}</span>
              </div>

              {reportError ? <p className="report-admin-modal__error">{reportError}</p> : null}

              <div className="report-admin-modal__actions">
                <button
                  type="button"
                  className="friend-request-btn delete"
                  onClick={closeReport}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="friend-request-btn confirm"
                  disabled={reportBusy}
                >
                  {reportBusy ? "Sending..." : "Send to Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
