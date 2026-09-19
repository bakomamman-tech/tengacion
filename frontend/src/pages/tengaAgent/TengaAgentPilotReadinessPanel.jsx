import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTengaAgentOwnerPilotReadiness,
} from "../../services/tengaAgentPilotReadinessApi";
import "./tengaagent-pilot-readiness.css";

const STATUS_LABELS = {
  workspace: "Workspace created",
  subscription: "Subscription allows service",
  hasAgent: "AI agent exists",
  hasPublishedAgent: "Public agent published",
  coreEnvironment: "Core server configuration",
  whatsappEnvironment: "WhatsApp server configuration",
  whatsappTenantConnection: "WhatsApp tenant connection",
  voiceEnvironment: "Voice-note transcription configuration",
  emailEnvironment: "Email notification configuration",
};

const REQUIREMENT_STATUS_LABELS = {
  configured: "Configured",
  missing: "Missing",
  invalid: "Invalid",
  disabled: "Disabled",
  not_in_plan: "Not in plan",
};

const formatLimit = (value) =>
  value === null || value === undefined
    ? "Unlimited"
    : Number(value).toLocaleString();

export default function TengaAgentPilotReadinessPanel({
  user,
}) {
  const [readiness, setReadiness] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReadiness = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError("");

    try {
      const response =
        await getTengaAgentOwnerPilotReadiness();
      setReadiness(response?.readiness || null);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not load pilot readiness."
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  const checks = useMemo(
    () => Object.entries(readiness?.checks || {}),
    [readiness]
  );

  const requirementGroups = useMemo(
    () => Object.entries(readiness?.requirements || {}),
    [readiness]
  );

  if (!user) return null;

  return (
    <section
      className="tengaagent-owner__pilot-readiness"
      aria-labelledby="tengaagent-pilot-readiness-title"
    >
      <div className="tengaagent-owner__pilot-readiness-header">
        <div>
          <span className="tengaagent-owner__eyebrow">
            PILOT READINESS
          </span>
          <h3 id="tengaagent-pilot-readiness-title">
            Deployment and channel readiness
          </h3>
          <p>
            This view checks configuration without exposing
            secret values. Missing or invalid requirements
            remain closed until their server-side setup is complete.
          </p>
        </div>
        <button
          type="button"
          onClick={loadReadiness}
          disabled={isLoading}
        >
          {isLoading ? "Checking…" : "Refresh readiness"}
        </button>
      </div>

      {error ? (
        <div
          className="tengaagent-owner__notice tengaagent-owner__notice--error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {readiness ? (
        <>
          <div className="tengaagent-owner__pilot-channels">
            <article>
              <span>Web pilot</span>
              <strong>{readiness.channelReady?.web ? "Ready" : "Blocked"}</strong>
            </article>
            <article>
              <span>WhatsApp</span>
              <strong>
                {readiness.billing?.entitlements?.whatsapp
                  ? readiness.channelReady?.whatsapp
                    ? "Ready"
                    : "Blocked"
                  : "Not in plan"}
              </strong>
            </article>
            <article>
              <span>Voice notes</span>
              <strong>
                {readiness.billing?.entitlements?.voice
                  ? readiness.channelReady?.voiceNotes
                    ? "Ready"
                    : "Blocked"
                  : "Not in plan"}
              </strong>
            </article>
            <article>
              <span>Monthly conversations</span>
              <strong>
                {Number(
                  readiness.billing?.usage?.conversationsStarted || 0
                ).toLocaleString()}
                {" / "}
                {formatLimit(
                  readiness.billing?.entitlements?.monthlyConversations
                )}
              </strong>
            </article>
          </div>

          <div className="tengaagent-owner__pilot-checks">
            {checks.map(([key, passed]) => (
              <div
                className={`tengaagent-owner__pilot-check ${
                  passed
                    ? "tengaagent-owner__pilot-check--pass"
                    : "tengaagent-owner__pilot-check--fail"
                }`}
                key={key}
              >
                <span aria-hidden="true">{passed ? "✓" : "!"}</span>
                <div>
                  <strong>{STATUS_LABELS[key] || key}</strong>
                  <small>
                    {passed ? "Ready" : "Configuration required"}
                  </small>
                </div>
              </div>
            ))}
          </div>

          {requirementGroups.map(([group, requirements]) => (
            <div
              className="tengaagent-owner__pilot-requirements"
              key={group}
            >
              <strong>{group.toUpperCase()} ENVIRONMENT</strong>
              <div>
                {(Array.isArray(requirements) ? requirements : []).map(
                  (requirement) => (
                    <span key={`${group}-${requirement.key}`}>
                      <code>{requirement.key}</code>
                      {" — "}
                      {REQUIREMENT_STATUS_LABELS[requirement.status] ||
                        requirement.status}
                    </span>
                  )
                )}
              </div>
            </div>
          ))}

          <p className="tengaagent-owner__pilot-note">
            Only environment-variable names and readiness states are returned.
            API keys, tokens, passwords, and secret values never reach the browser.
          </p>
        </>
      ) : null}
    </section>
  );
}
