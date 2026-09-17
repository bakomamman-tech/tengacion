import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getTengaAgentOwnerBilling,
} from "../../services/tengaAgentBillingApi";
import TengaAgentPilotReadinessPanel from "./TengaAgentPilotReadinessPanel";

const formatLimit = (value) =>
  value === null || value === undefined
    ? "Unlimited"
    : Number(value).toLocaleString();

export default function TengaAgentBillingPanel({ user }) {
  const [billing, setBilling] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadBilling = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await getTengaAgentOwnerBilling();
      setBilling(response?.billing || null);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent billing status could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  if (!user) {
    return null;
  }

  if (isLoading && !billing) {
    return (
      <div className="tengaagent-owner__loading">
        Loading plan usage…
      </div>
    );
  }

  if (error && !billing) {
    return (
      <div
        className="tengaagent-owner__notice tengaagent-owner__notice--error"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!billing) {
    return null;
  }

  const conversationsUsed =
    Number(billing.usage?.conversationsStarted || 0);
  const conversationLimit =
    billing.entitlements?.monthlyConversations ?? null;
  const agentsUsed = Number(billing.usage?.agentsUsed || 0);
  const agentLimit = billing.entitlements?.agents ?? null;

  return (
    <>
      <section
        className="tengaagent-owner__publication"
        aria-labelledby="tengaagent-billing-title"
      >
        <div>
          <span className="tengaagent-owner__publication-label">
            PLAN & USAGE
          </span>
          <strong id="tengaagent-billing-title">
            {billing.planCode} · {billing.subscriptionStatus}
          </strong>
          <p>
            Monthly limits are enforced by the backend before a new
            conversation or gated channel is accepted.
          </p>
          <div className="tengaagent-owner__lead-meta">
            <span>
              Conversations: {conversationsUsed.toLocaleString()} / {formatLimit(
                conversationLimit
              )}
            </span>
            <span>
              Agents: {agentsUsed.toLocaleString()} / {formatLimit(agentLimit)}
            </span>
            <span>
              WhatsApp: {billing.entitlements?.whatsapp ? "included" : "not included"}
            </span>
            <span>
              Voice notes: {billing.entitlements?.voice ? "included" : "not included"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={loadBilling}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing…" : "Refresh usage"}
        </button>
      </section>

      <TengaAgentPilotReadinessPanel user={user} />
    </>
  );
}
