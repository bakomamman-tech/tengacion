import { useCallback, useEffect, useMemo, useState } from "react";

import { getTengaAgentOwnerFollowUps } from "../../services/tengaAgentFollowUpApi";
import "./tengaagent-next-action.css";

const ACTION_ORDER = {
  call: 0,
  email: 1,
  reschedule: 2,
  close: 3,
  wait: 4,
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const signalSummary = (recommendation) => {
  const signals = recommendation?.signals || {};
  const parts = [];

  if (signals.followUpDue) parts.push("due now");
  else if (signals.followUpAt) parts.push(`due ${formatDate(signals.followUpAt)}`);

  if (Number.isFinite(signals.activityCount)) {
    parts.push(
      `${signals.activityCount} contact ${signals.activityCount === 1 ? "event" : "events"}`
    );
  }

  if (signals.latestActivity?.channel) {
    const direction = signals.latestActivity.direction || "contact";
    parts.push(`latest: ${direction} ${signals.latestActivity.channel}`);
  }

  return parts.join(" · ");
};

export default function TengaAgentNextBestActionPanel({ user }) {
  const [followUps, setFollowUps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecommendations = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await getTengaAgentOwnerFollowUps({ filter: "all", limit: 100 });
      setFollowUps(Array.isArray(response?.followUps) ? response.followUps : []);
    } catch (requestError) {
      if (requestError?.status === 404) {
        setFollowUps([]);
      } else {
        setError(
          requestError?.message ||
            "TengaAgent could not load next-best-action recommendations."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const recommendations = useMemo(
    () =>
      followUps
        .filter((followUp) => followUp?.recommendation?.action)
        .sort((left, right) => {
          if (Boolean(left.overdue) !== Boolean(right.overdue)) {
            return left.overdue ? -1 : 1;
          }
          const leftAction = ACTION_ORDER[left.recommendation.action] ?? 99;
          const rightAction = ACTION_ORDER[right.recommendation.action] ?? 99;
          if (leftAction !== rightAction) return leftAction - rightAction;
          return new Date(left.followUpAt || 0).getTime() - new Date(right.followUpAt || 0).getTime();
        })
        .slice(0, 8),
    [followUps]
  );

  const reviewQueue = () => {
    document.getElementById("tengaagent-follow-up-title")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (!user) return null;

  return (
    <section
      className="tengaagent-next-action"
      aria-labelledby="tengaagent-next-action-title"
    >
      <div className="tengaagent-next-action__header">
        <div>
          <span>NEXT-BEST-ACTION INTELLIGENCE</span>
          <h3 id="tengaagent-next-action-title">What should happen next?</h3>
          <p>
            TengaAgent evaluates the recorded outcome, follow-up timing, contact
            history, delivery failures and available contact channels. These are
            recommendations only; nothing is sent, closed or rescheduled automatically.
          </p>
        </div>
        <button type="button" onClick={loadRecommendations} disabled={isLoading}>
          {isLoading ? "Refreshing…" : "Refresh recommendations"}
        </button>
      </div>

      {error ? (
        <div className="tengaagent-next-action__error" role="alert">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="tengaagent-next-action__empty">Evaluating open follow-ups…</div>
      ) : recommendations.length === 0 ? (
        <div className="tengaagent-next-action__empty">
          <strong>No open recommendations right now.</strong>
          <span>Recommendations appear when an owner follow-up is active.</span>
        </div>
      ) : (
        <div className="tengaagent-next-action__list">
          {recommendations.map((followUp) => {
            const recommendation = followUp.recommendation;
            return (
              <article
                key={followUp.appointmentId}
                className={`tengaagent-next-action__card action-${recommendation.action}`}
              >
                <div className="tengaagent-next-action__topline">
                  <div>
                    <strong>{followUp.name || "Unnamed customer"}</strong>
                    <span>{followUp.company || followUp.purpose || "Follow-up"}</span>
                  </div>
                  <span className="tengaagent-next-action__badge">
                    {recommendation.label || recommendation.action}
                  </span>
                </div>

                <p>{recommendation.rationale}</p>

                <div className="tengaagent-next-action__signals">
                  <span>
                    Outcome: {String(followUp.outcomeDisposition || "unreviewed").replaceAll("_", " ")}
                  </span>
                  {signalSummary(recommendation) ? (
                    <span>{signalSummary(recommendation)}</span>
                  ) : null}
                  {recommendation.waitUntil ? (
                    <span>Suggested wait until: {formatDate(recommendation.waitUntil)}</span>
                  ) : null}
                </div>

                <div className="tengaagent-next-action__footer">
                  <span>
                    Advisory only · {String(recommendation.strength || "contextual")} signal
                  </span>
                  <button type="button" className="secondary" onClick={reviewQueue}>
                    Review in follow-up queue
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
