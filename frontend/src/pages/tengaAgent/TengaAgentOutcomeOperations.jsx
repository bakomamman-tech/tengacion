import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTengaAgentOwnerAppointmentOutcomes,
  updateTengaAgentOwnerAppointmentOutcome,
} from "../../services/tengaAgentOutcomeApi";
import "./tengaagent-outcomes.css";

const DISPOSITIONS = [
  "unreviewed",
  "converted",
  "qualified",
  "not_interested",
  "reschedule_requested",
  "other",
];

const FILTERS = ["all", "follow_up", "overdue", "unreviewed"];

const EMPTY_METRICS = {
  terminalAppointments: 0,
  completed: 0,
  noShow: 0,
  reviewedOutcomes: 0,
  converted: 0,
  qualified: 0,
  notInterested: 0,
  rescheduleRequested: 0,
  followUpNeeded: 0,
  followUpOverdue: 0,
  followUpDueNext7Days: 0,
};

const label = (value) =>
  String(value || "").replaceAll("_", " ");

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const pad = (value) => String(value).padStart(2, "0");

const toDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const contactLabel = (outcome) =>
  outcome.email || outcome.phone || "No contact method";

export default function TengaAgentOutcomeOperations({ user }) {
  const [outcomes, setOutcomes] = useState([]);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState(null);
  const [savingId, setSavingId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOutcomes = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await getTengaAgentOwnerAppointmentOutcomes({
        limit: 100,
      });
      setOutcomes(
        Array.isArray(response?.outcomes) ? response.outcomes : []
      );
      setMetrics(response?.metrics || EMPTY_METRICS);
    } catch (requestError) {
      if (requestError?.status === 404) {
        setOutcomes([]);
        setMetrics(EMPTY_METRICS);
      } else {
        setError(
          requestError?.message ||
            "TengaAgent could not load post-appointment outcomes."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOutcomes();
  }, [loadOutcomes]);

  const visibleOutcomes = useMemo(
    () =>
      outcomes.filter((outcome) => {
        if (filter === "follow_up") return outcome.followUpNeeded;
        if (filter === "overdue") return outcome.followUpOverdue;
        if (filter === "unreviewed") {
          return outcome.outcomeDisposition === "unreviewed";
        }
        return true;
      }),
    [filter, outcomes]
  );

  const openEditor = (outcome) => {
    setEditingId(outcome.appointmentId);
    setError("");
    setDraft({
      disposition: outcome.outcomeDisposition || "unreviewed",
      notes: outcome.outcomeNotes || "",
      followUpNeeded: Boolean(outcome.followUpNeeded),
      followUpAt: toDateTimeLocal(outcome.followUpAt),
    });
  };

  const saveOutcome = async (outcome, override = null) => {
    if (!outcome?.appointmentId || savingId) return;

    const payload = override || draft;
    if (!payload) return;

    if (payload.followUpNeeded && !payload.followUpAt) {
      setError("Choose a follow-up due date before saving.");
      return;
    }

    const parsedFollowUp = payload.followUpNeeded
      ? new Date(payload.followUpAt)
      : null;

    if (
      payload.followUpNeeded &&
      Number.isNaN(parsedFollowUp?.getTime())
    ) {
      setError("Choose a valid follow-up due date before saving.");
      return;
    }

    setSavingId(outcome.appointmentId);
    setError("");

    try {
      await updateTengaAgentOwnerAppointmentOutcome({
        appointmentId: outcome.appointmentId,
        disposition: payload.disposition,
        notes: payload.notes,
        followUpNeeded: Boolean(payload.followUpNeeded),
        followUpAt: payload.followUpNeeded
          ? parsedFollowUp.toISOString()
          : null,
      });
      setEditingId("");
      setDraft(null);
      await loadOutcomes();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not save that appointment outcome."
      );
    } finally {
      setSavingId("");
    }
  };

  if (!user) return null;

  return (
    <section className="tengaagent-outcomes" aria-labelledby="tengaagent-outcomes-title">
      <div className="tengaagent-outcomes__header">
        <div>
          <span>POST-APPOINTMENT</span>
          <h3 id="tengaagent-outcomes-title">Follow-up & outcome intelligence</h3>
          <p>
            Record what happened after completed or missed meetings, keep
            follow-ups visible, and track conversion signals without reopening
            the appointment lifecycle.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOutcomes}
          disabled={isLoading || Boolean(savingId)}
        >
          {isLoading ? "Refreshing…" : "Refresh outcomes"}
        </button>
      </div>

      {error ? (
        <div className="tengaagent-outcomes__error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="tengaagent-outcomes__metrics">
        <article>
          <span>Completed</span>
          <strong>{metrics.completed}</strong>
        </article>
        <article>
          <span>No-show</span>
          <strong>{metrics.noShow}</strong>
        </article>
        <article>
          <span>Converted</span>
          <strong>{metrics.converted}</strong>
        </article>
        <article className={metrics.followUpOverdue ? "attention" : ""}>
          <span>Follow-up overdue</span>
          <strong>{metrics.followUpOverdue}</strong>
        </article>
        <article>
          <span>Due next 7 days</span>
          <strong>{metrics.followUpDueNext7Days}</strong>
        </article>
      </div>

      <div
        className="tengaagent-outcomes__filters"
        role="group"
        aria-label="Outcome filter"
      >
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label(value)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="tengaagent-outcomes__empty">Loading outcomes…</div>
      ) : visibleOutcomes.length === 0 ? (
        <div className="tengaagent-outcomes__empty">
          <strong>No post-appointment items in this view.</strong>
          <span>
            Completed and no-show meetings will appear here for review.
          </span>
        </div>
      ) : (
        <div className="tengaagent-outcomes__list">
          {visibleOutcomes.map((outcome) => {
            const isEditing = editingId === outcome.appointmentId;
            const isSaving = savingId === outcome.appointmentId;

            return (
              <article
                className={`tengaagent-outcomes__card${
                  outcome.followUpOverdue ? " is-overdue" : ""
                }`}
                key={outcome.appointmentId}
              >
                <div className="tengaagent-outcomes__topline">
                  <div>
                    <strong>{outcome.name || "Unnamed visitor"}</strong>
                    <span>{contactLabel(outcome)}</span>
                  </div>
                  <div className="tengaagent-outcomes__badges">
                    <span>{label(outcome.status)}</span>
                    <span>{label(outcome.outcomeDisposition)}</span>
                  </div>
                </div>

                <p>{outcome.purpose || "No meeting purpose supplied."}</p>

                {outcome.outcomeNotes ? (
                  <p className="tengaagent-outcomes__notes">
                    {outcome.outcomeNotes}
                  </p>
                ) : null}

                <div className="tengaagent-outcomes__meta">
                  <span>Meeting: {formatDate(outcome.preferredStartAt)}</span>
                  {outcome.followUpNeeded ? (
                    <span
                      className={
                        outcome.followUpOverdue ? "overdue" : "due"
                      }
                    >
                      {outcome.followUpOverdue
                        ? "Overdue follow-up"
                        : "Follow-up due"}
                      {`: ${formatDate(outcome.followUpAt)}`}
                    </span>
                  ) : (
                    <span>No open follow-up</span>
                  )}
                </div>

                <div className="tengaagent-outcomes__actions">
                  <button
                    type="button"
                    onClick={() =>
                      isEditing
                        ? (setEditingId(""), setDraft(null))
                        : openEditor(outcome)
                    }
                    disabled={Boolean(savingId)}
                  >
                    {isEditing ? "Close editor" : "Edit outcome"}
                  </button>
                  {outcome.followUpNeeded ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={Boolean(savingId)}
                      onClick={() =>
                        saveOutcome(outcome, {
                          disposition: outcome.outcomeDisposition,
                          notes: outcome.outcomeNotes,
                          followUpNeeded: false,
                          followUpAt: null,
                        })
                      }
                    >
                      Mark follow-up done
                    </button>
                  ) : null}
                  {isSaving ? <span aria-live="polite">Saving…</span> : null}
                </div>

                {isEditing && draft ? (
                  <div className="tengaagent-outcomes__editor">
                    <label>
                      Disposition
                      <select
                        value={draft.disposition}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            disposition: event.target.value,
                          }))
                        }
                      >
                        {DISPOSITIONS.map((value) => (
                          <option key={value} value={value}>
                            {label(value)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Outcome notes
                      <textarea
                        value={draft.notes}
                        maxLength={4000}
                        rows={4}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="tengaagent-outcomes__check">
                      <input
                        type="checkbox"
                        checked={draft.followUpNeeded}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            followUpNeeded: event.target.checked,
                            followUpAt: event.target.checked
                              ? current.followUpAt
                              : "",
                          }))
                        }
                      />
                      Follow-up needed
                    </label>

                    {draft.followUpNeeded ? (
                      <label>
                        Follow-up due
                        <input
                          type="datetime-local"
                          value={draft.followUpAt}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              followUpAt: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ) : null}

                    <button
                      type="button"
                      disabled={Boolean(savingId)}
                      onClick={() => saveOutcome(outcome)}
                    >
                      Save outcome
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
