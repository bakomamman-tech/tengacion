import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTengaAgentOwnerLeads,
  getTengaAgentOwnerWorkspace,
  saveTengaAgentOwnerWorkspace,
} from "../../services/tengaAgentApi";

import "./tengaagent-owner.css";

const STATUS_FILTERS = [
  "all",
  "new",
  "qualified",
  "contacted",
  "won",
  "lost",
];

const INITIAL_SETUP = {
  name: "",
  website: "",
  industry: "",
  countryCode: "NG",
  timezone: "Africa/Lagos",
};

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const contactLabel = (lead) =>
  lead.email || lead.phone || "No contact method";

export default function TengaAgentOwnerDashboard({
  user,
}) {
  const [workspace, setWorkspace] =
    useState(null);
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] =
    useState(true);
  const [isSaving, setIsSaving] =
    useState(false);
  const [error, setError] = useState("");
  const [needsSetup, setNeedsSetup] =
    useState(false);
  const [setup, setSetup] = useState({
    ...INITIAL_SETUP,
  });

  const loadOwnerData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const workspaceResponse =
        await getTengaAgentOwnerWorkspace();

      setWorkspace(workspaceResponse);
      setNeedsSetup(false);

      const leadsResponse =
        await getTengaAgentOwnerLeads({
          limit: 100,
        });

      setLeads(
        Array.isArray(leadsResponse?.leads)
          ? leadsResponse.leads
          : []
      );
    } catch (requestError) {
      if (requestError?.status === 404) {
        setWorkspace(null);
        setLeads([]);
        setNeedsSetup(true);
      } else {
        setError(
          requestError?.message ||
            "TengaAgent could not load your workspace."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOwnerData();
  }, [loadOwnerData]);

  const counts = useMemo(() => {
    const result = {
      all: leads.length,
      new: 0,
      qualified: 0,
      contacted: 0,
      won: 0,
      lost: 0,
    };

    for (const lead of leads) {
      if (
        Object.prototype.hasOwnProperty.call(
          result,
          lead.status
        )
      ) {
        result[lead.status] += 1;
      }
    }

    return result;
  }, [leads]);

  const visibleLeads = useMemo(
    () =>
      filter === "all"
        ? leads
        : leads.filter(
            (lead) => lead.status === filter
          ),
    [filter, leads]
  );

  const handleSetupChange = (event) => {
    const { name, value } = event.target;

    setSetup((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSetupSubmit = async (event) => {
    event.preventDefault();

    if (isSaving || !setup.name.trim()) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await saveTengaAgentOwnerWorkspace({
        ...setup,
        name: setup.name.trim(),
      });

      await loadOwnerData();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not create your workspace."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <section
      className="tengaagent-owner"
      id="owner-dashboard"
      aria-labelledby="tengaagent-owner-title"
    >
      <div className="tengaagent-owner__header">
        <div>
          <span className="tengaagent-owner__eyebrow">
            OWNER WORKSPACE
          </span>
          <h2 id="tengaagent-owner-title">
            TengaAgent lead inbox
          </h2>
          <p>
            Review enquiries captured by your AI
            receptionist. Tenant isolation is enforced
            by the authenticated owner workspace API.
          </p>
        </div>

        {!needsSetup ? (
          <button
            type="button"
            className="tengaagent-owner__refresh"
            onClick={loadOwnerData}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          className="tengaagent-owner__notice tengaagent-owner__notice--error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="tengaagent-owner__loading">
          Loading your TengaAgent workspace…
        </div>
      ) : null}

      {!isLoading && needsSetup ? (
        <form
          className="tengaagent-owner__setup"
          onSubmit={handleSetupSubmit}
        >
          <div>
            <h3>Create your business workspace</h3>
            <p>
              This links a tenant-isolated TengaAgent
              organization and receptionist to your
              Tengacion account.
            </p>
          </div>

          <label>
            Business name
            <input
              name="name"
              value={setup.name}
              onChange={handleSetupChange}
              maxLength={180}
              required
            />
          </label>

          <label>
            Website
            <input
              name="website"
              value={setup.website}
              onChange={handleSetupChange}
              maxLength={500}
              placeholder="https://example.com"
            />
          </label>

          <label>
            Industry
            <input
              name="industry"
              value={setup.industry}
              onChange={handleSetupChange}
              maxLength={120}
              placeholder="Education, retail, services…"
            />
          </label>

          <div className="tengaagent-owner__setup-row">
            <label>
              Country code
              <input
                name="countryCode"
                value={setup.countryCode}
                onChange={handleSetupChange}
                maxLength={2}
                required
              />
            </label>

            <label>
              Timezone
              <input
                name="timezone"
                value={setup.timezone}
                onChange={handleSetupChange}
                maxLength={100}
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={
              isSaving || !setup.name.trim()
            }
          >
            {isSaving
              ? "Creating workspace…"
              : "Create TengaAgent workspace"}
          </button>
        </form>
      ) : null}

      {!isLoading && workspace ? (
        <>
          <div className="tengaagent-owner__summary">
            <article>
              <span>Business</span>
              <strong>
                {workspace.organization?.name || "—"}
              </strong>
            </article>
            <article>
              <span>Plan</span>
              <strong>
                {workspace.organization?.plan || "—"}
              </strong>
            </article>
            <article>
              <span>Agent</span>
              <strong>
                {workspace.agent?.status || "draft"}
              </strong>
            </article>
            <article>
              <span>Leads</span>
              <strong>{counts.all}</strong>
            </article>
          </div>

          <div
            className="tengaagent-owner__filters"
            role="group"
            aria-label="Lead status filter"
          >
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                className={
                  filter === status ? "active" : ""
                }
                onClick={() => setFilter(status)}
              >
                {status}
                <span>{counts[status]}</span>
              </button>
            ))}
          </div>

          {visibleLeads.length === 0 ? (
            <div className="tengaagent-owner__empty">
              <strong>No leads in this view yet.</strong>
              <span>
                Qualified enquiries captured by
                TengaAgent will appear here.
              </span>
            </div>
          ) : (
            <div className="tengaagent-owner__lead-list">
              {visibleLeads.map((lead) => (
                <article
                  className="tengaagent-owner__lead"
                  key={lead.id}
                >
                  <div className="tengaagent-owner__lead-topline">
                    <div>
                      <strong>
                        {lead.name || "Unnamed lead"}
                      </strong>
                      <span>{contactLabel(lead)}</span>
                    </div>
                    <span
                      className={`tengaagent-owner__status tengaagent-owner__status--${lead.status}`}
                    >
                      {lead.status}
                    </span>
                  </div>

                  {lead.company ? (
                    <div className="tengaagent-owner__company">
                      {lead.company}
                    </div>
                  ) : null}

                  {lead.projectSummary ? (
                    <p>{lead.projectSummary}</p>
                  ) : (
                    <p className="tengaagent-owner__muted">
                      No project summary supplied.
                    </p>
                  )}

                  <div className="tengaagent-owner__lead-meta">
                    <span>Source: {lead.source}</span>
                    <span>
                      Captured: {formatDate(
                        lead.lastCapturedAt ||
                          lead.createdAt
                      )}
                    </span>
                    <span>
                      Consent: {lead.consentToContact
                        ? "yes"
                        : "no"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
