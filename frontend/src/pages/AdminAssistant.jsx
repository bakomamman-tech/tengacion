import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import AdminShell from "../components/AdminShell";
import {
  adminGetAssistantMetrics,
  adminGetAssistantReviews,
  adminUpdateAssistantReview,
} from "../api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const REVIEW_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const REVIEW_CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "feedback", label: "Feedback" },
  { value: "quality", label: "Quality" },
  { value: "safety", label: "Safety" },
  { value: "abuse", label: "Abuse" },
];

const VIEW_PATHS = {
  metrics: "/admin/assistant/metrics",
  reviews: "/admin/assistant/reviews",
};

const EMPTY_REVIEWS = {
  items: [],
  total: 0,
  page: 1,
  limit: 25,
  hasMore: false,
};

const number = (value) => Number(value || 0).toLocaleString();

const percent = (value) => {
  const safeValue = Number(value || 0);
  return `${(safeValue * 100).toFixed(safeValue >= 0.1 ? 1 : 2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
};

const titleCase = (value = "") =>
  String(value || "")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

const dateTime = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString();
};

const dateOnly = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString();
};

const badgeToneClass = ({ status = "", severity = "", type = "status" } = {}) => {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedSeverity = String(severity || "").trim().toLowerCase();

  if (type === "status") {
    if (normalizedStatus === "resolved") {
      return "adminx-badge--good";
    }
    if (normalizedStatus === "dismissed") {
      return "";
    }
    if (normalizedStatus === "under_review") {
      return "adminx-badge--warn";
    }
    return "adminx-badge--danger";
  }

  if (normalizedSeverity === "high") {
    return "adminx-badge--danger";
  }
  if (normalizedSeverity === "medium") {
    return "adminx-badge--warn";
  }
  return "adminx-badge--good";
};

function InsightList({ title, meta = "", items = [] }) {
  return (
    <section className="adminx-panel adminx-panel--span-6">
      <div className="adminx-panel-head">
        <h2 className="adminx-panel-title">{title}</h2>
        {meta ? <span className="adminx-section-meta">{meta}</span> : null}
      </div>
      <div className="adminx-leaderboard">
        {items.map((item) => (
          <article key={item.label} className="adminx-leaderboard-item">
            <div className="adminx-row">
              <strong>{item.label}</strong>
              <span>{item.value}</span>
            </div>
            {item.note ? <div className="adminx-muted">{item.note}</div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ReviewCard({ item, isActive, onSelect }) {
  const title =
    String(item?.requestSummary || "").trim() ||
    String(item?.reason || "").trim() ||
    String(item?.responseSummary || "").trim() ||
    "Untitled assistant review";

  return (
    <button
      type="button"
      className="adminx-leaderboard-item"
      onClick={() => onSelect(item)}
      style={{
        width: "100%",
        textAlign: "left",
        borderColor: isActive ? "rgba(63, 218, 122, 0.36)" : undefined,
        background: isActive
          ? "linear-gradient(180deg, rgba(30, 66, 47, 0.94), rgba(14, 31, 22, 0.94))"
          : undefined,
      }}
    >
      <div className="adminx-row" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", lineHeight: 1.35 }}>{title}</strong>
          <div className="adminx-muted" style={{ marginTop: 6 }}>
            {titleCase(item?.mode || "general")} | {titleCase(item?.surface || "general")} | {dateTime(item?.createdAt)}
          </div>
        </div>
      </div>
      <div className="adminx-row" style={{ justifyContent: "flex-start", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span className={`adminx-badge ${badgeToneClass({ status: item?.status, type: "status" })}`}>
          {titleCase(item?.status || "open")}
        </span>
        <span className={`adminx-badge ${badgeToneClass({ severity: item?.severity, type: "severity" })}`}>
          {titleCase(item?.severity || "medium")}
        </span>
        <span className="adminx-badge">{titleCase(item?.category || "feedback")}</span>
      </div>
      {item?.reason ? (
        <div className="adminx-muted" style={{ marginTop: 10 }}>
          {item.reason}
        </div>
      ) : null}
    </button>
  );
}

export default function AdminAssistantPage({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = location.pathname.includes("/reviews") ? "reviews" : "metrics";

  const [range, setRange] = useState("30d");
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewCategory, setReviewCategory] = useState("");
  const [metricsPayload, setMetricsPayload] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState("");
  const [reviewsPayload, setReviewsPayload] = useState(EMPTY_REVIEWS);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [reviewDraft, setReviewDraft] = useState({ status: "open", resolutionNote: "" });
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [reviewActionError, setReviewActionError] = useState("");
  const [reviewActionNotice, setReviewActionNotice] = useState("");

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError("");

    try {
      const payload = await adminGetAssistantMetrics({ range });
      setMetricsPayload(payload || null);
    } catch (error) {
      setMetricsError(error?.message || "Failed to load Akuso metrics.");
    } finally {
      setMetricsLoading(false);
    }
  }, [range]);

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError("");

    try {
      const payload = await adminGetAssistantReviews({
        status: reviewStatus,
        category: reviewCategory,
        limit: 25,
      });
      setReviewsPayload({
        ...EMPTY_REVIEWS,
        ...(payload || {}),
        items: Array.isArray(payload?.items) ? payload.items : [],
      });
    } catch (error) {
      setReviewsError(error?.message || "Failed to load assistant reviews.");
    } finally {
      setReviewsLoading(false);
    }
  }, [reviewCategory, reviewStatus]);

  const refreshAll = useCallback(() => {
    setReviewActionNotice("");
    void Promise.all([loadMetrics(), loadReviews()]);
  }, [loadMetrics, loadReviews]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const reviews = useMemo(
    () => (Array.isArray(reviewsPayload?.items) ? reviewsPayload.items : []),
    [reviewsPayload?.items]
  );
  const selectedReview = useMemo(
    () => reviews.find((item) => item?._id === selectedReviewId) || reviews[0] || null,
    [reviews, selectedReviewId]
  );

  useEffect(() => {
    if (!reviews.length) {
      setSelectedReviewId("");
      return;
    }

    if (!reviews.some((item) => item?._id === selectedReviewId)) {
      setSelectedReviewId(reviews[0]?._id || "");
    }
  }, [reviews, selectedReviewId]);

  useEffect(() => {
    if (!selectedReview) {
      setReviewDraft({ status: "open", resolutionNote: "" });
      return;
    }

    setReviewDraft({
      status: String(selectedReview.status || "open"),
      resolutionNote: String(selectedReview.resolutionNote || ""),
    });
  }, [selectedReview]);

  const stats = useMemo(() => {
    const live = metricsPayload?.live || {};
    const historical = metricsPayload?.historical || {};
    const queueLabel = reviewStatus
      ? `${titleCase(reviewStatus)} Reviews`
      : "Queue Items";

    return [
      {
        label: "Live Responses",
        value: number(live?.responses?.total),
        helper: "Processed in the current server snapshot",
      },
      {
        label: "Denial Rate",
        value: percent(historical?.rates?.denialRate),
        helper: "Historical policy denials in the selected window",
      },
      {
        label: "Negative Feedback",
        value: percent(historical?.feedback?.quality?.negativeRate),
        helper: "Not helpful plus report ratings",
      },
      {
        label: "Prompt Injection",
        value: number(historical?.security?.promptInjectionAttempts),
        helper: "Detected attempts in the selected window",
      },
      {
        label: "OpenAI Failures",
        value: percent(historical?.rates?.openAIFailureRate),
        helper: "Failure rate across model attempts",
      },
      {
        label: queueLabel,
        value: number(reviewsPayload?.total),
        helper: "Current filtered review queue volume",
      },
    ];
  }, [metricsPayload, reviewStatus, reviewsPayload?.total]);

  const liveInsights = useMemo(() => {
    const live = metricsPayload?.live || {};
    return [
      { label: "Snapshot Taken", value: dateTime(live.snapshotAt), note: `Server uptime ${number(live.uptimeSec)} sec` },
      { label: "Chat Requests", value: number(live?.requests?.chat), note: "Core assistant chat executions" },
      { label: "Hints Requests", value: number(live?.requests?.hints), note: "Dock hint fetches" },
      { label: "Feedback Events", value: number(live?.requests?.feedback), note: "Feedback submissions recorded live" },
      { label: "Template Jobs", value: number(live?.requests?.templates), note: "Creator writing template generations" },
      { label: "Policy Denials", value: number(live?.policy?.denials?.total), note: "Denied or escalated live decisions" },
      { label: "OpenAI Responses", value: number(live?.responses?.providers?.openai), note: "Model-backed completions" },
      { label: "Local Fallbacks", value: number(live?.responses?.providers?.local_fallback), note: "Fallback answers without model output" },
    ];
  }, [metricsPayload]);

  const historicalInsights = useMemo(() => {
    const historical = metricsPayload?.historical || {};
    return [
      {
        label: "Window",
        value: titleCase(historical?.window?.range || range),
        note: `${dateOnly(historical?.window?.startDate)} to ${dateOnly(historical?.window?.endDate)}`,
      },
      {
        label: "Policy Decisions",
        value: number(historical?.requests?.policyDecisions),
        note: "Requests that passed through policy classification",
      },
      {
        label: "Model Attempts",
        value: number(historical?.requests?.modelAttempts),
        note: "OpenAI attempt count in this window",
      },
      {
        label: "Local Fallback Rate",
        value: percent(historical?.rates?.localFallbackRate),
        note: "Share of responses served via local fallback",
      },
      {
        label: "Prompt Injection Rate",
        value: percent(historical?.rates?.promptInjectionRate),
        note: "Prompt injection share across policy decisions",
      },
      {
        label: "Helpful Rate",
        value: percent(historical?.feedback?.quality?.helpfulRate),
        note: "Helpful feedback as a share of all ratings",
      },
      {
        label: "Negative Ratings",
        value: number(
          Number(historical?.feedback?.notHelpful || 0) + Number(historical?.feedback?.report || 0)
        ),
        note: "Not helpful plus report counts",
      },
      {
        label: "Rate Limit Hits",
        value: number(historical?.security?.rateLimitHits),
        note: "Akuso requests throttled in this window",
      },
    ];
  }, [metricsPayload, range]);

  const policyBreakdown = useMemo(() => {
    const buckets = metricsPayload?.historical?.policy?.buckets || {};
    return [
      { label: "Safe Answer", value: number(buckets.SAFE_ANSWER), note: "Normal safe completions" },
      { label: "Safe With Caution", value: number(buckets.SAFE_WITH_CAUTION), note: "Cautious but allowed answers" },
      { label: "App Guidance", value: number(buckets.APP_GUIDANCE), note: "Grounded in Tengacion routes and features" },
      { label: "Sensitive Action", value: number(buckets.SENSITIVE_ACTION_REQUIRES_AUTH), note: "Requires protected in-app flow" },
      { label: "Disallowed", value: number(buckets.DISALLOWED), note: "Refused unsafe or forbidden requests" },
      { label: "Emergency Escalation", value: number(buckets.EMERGENCY_ESCALATION), note: "Escalated crisis or emergency guidance" },
      { label: "Prompt Injection Attempts", value: number(buckets.PROMPT_INJECTION_ATTEMPT), note: "Jailbreak or exfiltration patterns" },
    ];
  }, [metricsPayload]);

  const reliabilityInsights = useMemo(() => {
    const historical = metricsPayload?.historical || {};
    const responses = historical?.responses || {};
    const security = historical?.security || {};
    return [
      { label: "OpenAI Provider Responses", value: number(responses?.providers?.openai), note: "Responses completed through OpenAI" },
      { label: "Policy Engine Responses", value: number(responses?.providers?.policy_engine), note: "Served directly from policy decisions" },
      { label: "OpenAI Failures", value: number(security?.openAIFailures), note: "Model failures recorded historically" },
      { label: "OpenAI Failure Rate", value: percent(historical?.rates?.openAIFailureRate), note: "Failure share across model attempts" },
      { label: "Router Local Fallbacks", value: number(responses?.localFallbackReasons?.model_router_local), note: "Router stayed local by design" },
      { label: "Payload Fallbacks", value: number(responses?.localFallbackReasons?.invalid_model_payload), note: "Fallback caused by invalid model output" },
      { label: "OpenAI Error Fallbacks", value: number(responses?.localFallbackReasons?.openai_error), note: "Fallback triggered by provider errors" },
      { label: "Template Route Responses", value: number(responses?.routeBreakdown?.template), note: "Template generation responses" },
    ];
  }, [metricsPayload]);

  const handleSaveReview = async () => {
    if (!selectedReview?._id) {
      return;
    }

    setReviewActionLoading(true);
    setReviewActionError("");
    setReviewActionNotice("");

    try {
      await adminUpdateAssistantReview(selectedReview._id, {
        status: reviewDraft.status,
        resolutionNote: reviewDraft.resolutionNote,
      });

      setReviewActionNotice("Assistant review updated.");
      await loadReviews();
    } catch (error) {
      setReviewActionError(error?.message || "Failed to update the assistant review.");
    } finally {
      setReviewActionLoading(false);
    }
  };

  return (
    <AdminShell
      title="Akuso Assistant Ops"
      subtitle="Track assistant safety, model reliability, and the feedback queue that needs admin review."
      user={user}
      actions={(
        <div className="adminx-action-row">
          <label>
            <span className="adminx-section-meta" style={{ display: "block", marginBottom: 6 }}>Time range</span>
            <select
              className="adminx-select"
              aria-label="Time range"
              value={range}
              onChange={(event) => setRange(event.target.value)}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="adminx-btn" onClick={refreshAll}>
            Refresh
          </button>
        </div>
      )}
    >
      <section className="adminx-stats-grid">
        {stats.map((item) => (
          <article key={item.label} className="adminx-stat-card">
            <div className="adminx-kpi-label">{item.label}</div>
            <div className="adminx-kpi-value">{item.value}</div>
            <div className="adminx-muted">{item.helper}</div>
          </article>
        ))}
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Operations Focus</h2>
            <span className="adminx-section-meta">
              Alerts come from Akuso security, fallback, and feedback signals.
            </span>
          </div>
          <div className="adminx-tab-row" role="tablist" aria-label="Assistant operations views">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "metrics"}
              className={`adminx-tab ${activeView === "metrics" ? "is-active" : ""}`}
              onClick={() => navigate(VIEW_PATHS.metrics)}
            >
              Metrics
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "reviews"}
              className={`adminx-tab ${activeView === "reviews" ? "is-active" : ""}`}
              onClick={() => navigate(VIEW_PATHS.reviews)}
            >
              Reviews
            </button>
          </div>
        </div>

        {metricsError ? <div className="adminx-error">{metricsError}</div> : null}

        {!metricsLoading && !metricsPayload?.alerts?.length ? (
          <div className="adminx-empty">No Akuso alerts are active for this range.</div>
        ) : null}

        {metricsPayload?.alerts?.length ? (
          <div className="adminx-leaderboard">
            {metricsPayload.alerts.map((alert) => (
              <button
                key={alert.key}
                type="button"
                className="adminx-leaderboard-item"
                onClick={() => navigate(alert.actionPath || VIEW_PATHS.metrics)}
              >
                <div className="adminx-row">
                  <strong>{alert.title}</strong>
                  <span className={`adminx-badge ${badgeToneClass({ severity: alert.severity, type: "severity" })}`}>
                    {titleCase(alert.severity || "medium")}
                  </span>
                </div>
                <div className="adminx-muted" style={{ marginTop: 8 }}>
                  Signal value: {typeof alert.value === "number" && alert.value <= 1 ? percent(alert.value) : number(alert.value)}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {activeView === "metrics" ? (
        <>
          {metricsLoading ? <div className="adminx-loading">Loading Akuso metrics...</div> : null}
          {!metricsLoading ? (
            <div className="adminx-analytics-grid">
              <InsightList title="Live Snapshot" meta="Current in-process counters" items={liveInsights} />
              <InsightList title="Historical Window" meta="Aggregated analytics event history" items={historicalInsights} />
              <InsightList title="Policy Breakdown" meta="Safety buckets used by Akuso" items={policyBreakdown} />
              <InsightList title="Reliability Signals" meta="Provider mix, fallbacks, and failures" items={reliabilityInsights} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="adminx-analytics-grid">
          <section className="adminx-panel adminx-panel--span-7">
            <div className="adminx-panel-head">
              <div>
                <h2 className="adminx-panel-title">Review Queue</h2>
                <span className="adminx-section-meta">
                  {number(reviewsPayload?.total)} item{Number(reviewsPayload?.total || 0) === 1 ? "" : "s"} match the current filters.
                </span>
              </div>
              <div className="adminx-action-row">
                <label>
                  <span className="adminx-section-meta" style={{ display: "block", marginBottom: 6 }}>Queue status</span>
                  <select
                    className="adminx-select"
                    aria-label="Queue status"
                    value={reviewStatus}
                    onChange={(event) => setReviewStatus(event.target.value)}
                  >
                    {REVIEW_STATUS_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="adminx-section-meta" style={{ display: "block", marginBottom: 6 }}>Queue category</span>
                  <select
                    className="adminx-select"
                    aria-label="Queue category"
                    value={reviewCategory}
                    onChange={(event) => setReviewCategory(event.target.value)}
                  >
                    {REVIEW_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="adminx-btn" onClick={() => void loadReviews()}>
                  Refresh Queue
                </button>
              </div>
            </div>

            {reviewsError ? <div className="adminx-error">{reviewsError}</div> : null}
            {reviewsLoading ? <div className="adminx-loading">Loading assistant review queue...</div> : null}

            {!reviewsLoading && !reviews.length ? (
              <div className="adminx-empty">No assistant reviews match the current filters.</div>
            ) : null}

            {reviews.length ? (
              <div className="adminx-leaderboard">
                {reviews.map((item) => (
                  <ReviewCard
                    key={item._id}
                    item={item}
                    isActive={item._id === selectedReview?._id}
                    onSelect={(next) => {
                      setReviewActionNotice("");
                      setReviewActionError("");
                      setSelectedReviewId(next?._id || "");
                    }}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <section className="adminx-panel adminx-panel--span-5">
            <div className="adminx-panel-head">
              <div>
                <h2 className="adminx-panel-title">Selected Review</h2>
                <span className="adminx-section-meta">
                  Update triage status and capture the admin decision.
                </span>
              </div>
            </div>

            {!selectedReview ? (
              <div className="adminx-empty">Select a review item to inspect its request, response, and trust data.</div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <div className="adminx-row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <span className={`adminx-badge ${badgeToneClass({ status: selectedReview.status, type: "status" })}`}>
                    {titleCase(selectedReview.status || "open")}
                  </span>
                  <span className={`adminx-badge ${badgeToneClass({ severity: selectedReview.severity, type: "severity" })}`}>
                    {titleCase(selectedReview.severity || "medium")}
                  </span>
                  <span className="adminx-badge">{titleCase(selectedReview.category || "feedback")}</span>
                </div>

                <div className="adminx-leaderboard">
                  <article className="adminx-leaderboard-item">
                    <div className="adminx-row">
                      <strong>Submitted</strong>
                      <span>{dateTime(selectedReview.createdAt)}</span>
                    </div>
                    <div className="adminx-muted">Response ID: {selectedReview.responseId || "-"}</div>
                  </article>
                  <article className="adminx-leaderboard-item">
                    <div className="adminx-row">
                      <strong>User Request</strong>
                    </div>
                    <div className="adminx-muted" style={{ marginTop: 8 }}>
                      {selectedReview.requestSummary || "No request summary was captured."}
                    </div>
                  </article>
                  <article className="adminx-leaderboard-item">
                    <div className="adminx-row">
                      <strong>Assistant Response</strong>
                    </div>
                    <div className="adminx-muted" style={{ marginTop: 8 }}>
                      {selectedReview.responseSummary || "No response summary was captured."}
                    </div>
                  </article>
                  <article className="adminx-leaderboard-item">
                    <div className="adminx-row">
                      <strong>Trust Signals</strong>
                    </div>
                    <div className="adminx-muted" style={{ marginTop: 8 }}>
                      Provider: {titleCase(selectedReview?.trust?.provider || "unknown")} | Mode: {titleCase(selectedReview?.trust?.mode || "unknown")}
                    </div>
                    <div className="adminx-muted" style={{ marginTop: 6 }}>
                      Grounded: {selectedReview?.trust?.grounded ? "Yes" : "No"} | Used model: {selectedReview?.trust?.usedModel ? "Yes" : "No"} | Confidence: {titleCase(selectedReview?.trust?.confidenceLabel || "unknown")}
                    </div>
                  </article>
                </div>

                <label>
                  <span className="adminx-section-meta" style={{ display: "block", marginBottom: 6 }}>Review status</span>
                  <select
                    className="adminx-select"
                    aria-label="Review status"
                    value={reviewDraft.status}
                    onChange={(event) =>
                      setReviewDraft((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    {REVIEW_STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="adminx-section-meta" style={{ display: "block", marginBottom: 6 }}>Resolution note</span>
                  <textarea
                    className="adminx-textarea"
                    aria-label="Resolution note"
                    value={reviewDraft.resolutionNote}
                    onChange={(event) =>
                      setReviewDraft((current) => ({
                        ...current,
                        resolutionNote: event.target.value,
                      }))
                    }
                    placeholder="Explain the triage decision or link it to the Akuso quality backlog."
                  />
                </label>

                {reviewActionError ? <div className="adminx-error">{reviewActionError}</div> : null}
                {reviewActionNotice ? <div className="adminx-muted">{reviewActionNotice}</div> : null}

                <div className="adminx-action-row">
                  <button
                    type="button"
                    className="adminx-btn adminx-btn--primary"
                    onClick={() => void handleSaveReview()}
                    disabled={reviewActionLoading}
                  >
                    {reviewActionLoading ? "Saving..." : "Save Review State"}
                  </button>
                  <button
                    type="button"
                    className="adminx-btn"
                    onClick={() =>
                      setReviewDraft((current) => ({
                        ...current,
                        status: "under_review",
                      }))
                    }
                    disabled={reviewActionLoading}
                  >
                    Mark Under Review
                  </button>
                  <button
                    type="button"
                    className="adminx-btn"
                    onClick={() =>
                      setReviewDraft((current) => ({
                        ...current,
                        status: "resolved",
                      }))
                    }
                    disabled={reviewActionLoading}
                  >
                    Set Resolved
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
