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
  setTengaAgentOwnerPublication,
  updateTengaAgentOwnerLeadStatus,
} from "../../services/tengaAgentApi";

import TengaAgentAppointmentInbox from "./TengaAgentAppointmentInbox";
import TengaAgentBillingPanel from "./TengaAgentBillingPanel";
import TengaAgentFollowUpInbox from "./TengaAgentFollowUpInbox";
import TengaAgentKnowledgeWorkspace from "./TengaAgentKnowledgeWorkspace";
import TengaAgentNextBestActionPanel from "./TengaAgentNextBestActionPanel";
import TengaAgentOutcomeOperations from "./TengaAgentOutcomeOperations";
import "./tengaagent-owner.css";

const LEAD_STATUSES = [
  "new",
  "qualified",
  "contacted",
  "won",
  "lost",
];

const STATUS_FILTERS = [
  "all",
  ...LEAD_STATUSES,
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
  const [workspace, setWorkspace] = useState(null);
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] =
    useState(false);
  const [updatingLeadId, setUpdatingLeadId] =
    useState("");
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

  const handlePublicationChange = async () => {
    if (!workspace?.agent || isPublishing) {
      return;
    }

    setIsPublishing(true);
    setError("");

    try {
      const response =
        await setTengaAgentOwnerPublication({
          published: !workspace.agent.published,
        });

      setWorkspace(response);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not update publication status."
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleLeadStatusChange = async (
    lead,
    status
  ) => {
    if (
      !lead?.id ||
      !LEAD_STATUSES.includes(status) ||
      status === lead.status ||
      updatingLeadId
    ) {
      return;
    }

    setUpdatingLeadId(lead.id);
    setError("");

    try {
      const response =
        await updateTengaAgentOwnerLeadStatus({
          leadId: lead.id,
          status,
        });

      if (response?.lead) {
        setLeads((current) =>
          current.map((entry) =>
            entry.id === response.lead.id
              ? response.lead
              : entry
          )
        );
      }
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not update that lead."
      );
    } finally {
      setUpdatingLeadId("");
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
            TengaAgent owner inbox
          </h2>
          <p>
            Review enquiries and appointment requests
            captured by your AI receptionist. Tenant
            isolation is enforced by the authenticated
            owner API.
          </p>
        </div>

        {!needsSetup ? (
          <button
            type="button"
            className="tengaagent-owner__refresh"
            onClick={loadOwnerData}
            disabled={
              isLoading ||
              Boolean(updatingLeadId) ||
              isPublishing
            }
          >
            {isLoading ? "Refreshing…" : "Refresh leads"}
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

          <TengaAgentBillingPanel user={user} />

          <div className="tengaagent-owner__publication">
            <div>
              <span className="tengaagent-owner__publication-label">
                PUBLIC BUSINESS AGENT
              </span>
              <strong>
                {workspace.agent?.published
                  ? "Published"
                  : "Not public"}
              </strong>
              <p>
                Publishing makes this business agent
                available through its own tenant-isolated
                TengaAgent link. Pausing removes public
                access immediately.
              </p>
              {workspace.agent?.publicPath ? (
                <a
                  href={workspace.agent.publicPath}
                  target="_blank"
                  rel="noreferrer"
                >
                  {workspace.agent.publicPath}
                </a>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handlePublicationChange}
              disabled={isPublishing}
            >
              {isPublishing
                ? "Saving…"
                : workspace.agent?.published
                  ? "Pause public agent"
                  : "Publish agent"}
            </button>
          </div>

          <TengaAgentKnowledgeWorkspace
            workspace={workspace}
            onWorkspaceChange={setWorkspace}
          />

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
              {visibleLeads.map((lead) => {
                const isUpdating =
                  updatingLeadId === lead.id;

                return (
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

                    <div className="tengaagent-owner__workflow">
                      <label
                        htmlFor={`tengaagent-lead-status-${lead.id}`}
                      >
                        Lead status
                      </label>
                      <select
                        id={`tengaagent-lead-status-${lead.id}`}
                        value={lead.status}
                        disabled={
                          Boolean(updatingLeadId)
                        }
                        onChange={(event) =>
                          handleLeadStatusChange(
                            lead,
                            event.target.value
                          )
                        }
                      >
                        {LEAD_STATUSES.map((status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>
                        ))}
                      </select>
                      {isUpdating ? (
                        <span
                          className="tengaagent-owner__workflow-saving"
                          aria-live="polite"
                        >
                          Saving…
                        </span>
                      ) : null}
                    </div>

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
                );
              })}
            </div>
          )}

          <TengaAgentNextBestActionPanel user={user} />
          <TengaAgentFollowUpInbox user={user} />
          <TengaAgentOutcomeOperations user={user} />
          <TengaAgentAppointmentInbox user={user} />
        </>
      ) : null}
    </section>
  );
}
