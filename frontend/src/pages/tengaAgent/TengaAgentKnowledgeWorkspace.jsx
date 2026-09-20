import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  archiveTengaAgentOwnerKnowledgeSource,
  getTengaAgentOwnerKnowledge,
  importTengaAgentOwnerWebsite,
  saveTengaAgentOwnerKnowledge,
  updateTengaAgentOwnerBusinessProfile,
  updateTengaAgentOwnerConfiguration,
} from "../../services/tengaAgentOwnerConfigApi";

import "./tengaagent-knowledge-workspace.css";

const KNOWLEDGE_TYPES = [
  ["faq", "FAQ"],
  ["service", "Service"],
  ["hours", "Business hours"],
  ["manual", "Other business knowledge"],
];

const TOOL_OPTIONS = [
  ["lead_capture", "Lead capture"],
  ["appointment_requests", "Appointment requests"],
];

const emptyKnowledge = {
  type: "faq",
  title: "",
  text: "",
};

const buildProfile = (organization) => ({
  name: organization?.name || "",
  website: organization?.website || "",
  industry: organization?.industry || "",
  countryCode: organization?.countryCode || "NG",
  timezone: organization?.timezone || "Africa/Lagos",
});

const buildConfiguration = (agent) => ({
  name: agent?.name || "TengaAgent",
  role: agent?.role || "AI Receptionist",
  greeting:
    agent?.greeting || "Hi! How can I help you today?",
  tone: agent?.tone || "friendly-professional",
  languagesText: Array.isArray(agent?.languages)
    ? agent.languages.join(", ")
    : "English",
  systemInstructions: agent?.systemInstructions || "",
  enabledTools: Array.isArray(agent?.enabledTools)
    ? agent.enabledTools
    : [],
});

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

export default function TengaAgentKnowledgeWorkspace({
  workspace,
  onWorkspaceChange,
}) {
  const [profile, setProfile] = useState(
    () => buildProfile(workspace?.organization)
  );
  const [configuration, setConfiguration] = useState(
    () => buildConfiguration(workspace?.agent)
  );
  const [sources, setSources] = useState([]);
  const [knowledge, setKnowledge] = useState({
    ...emptyKnowledge,
  });
  const [websiteUrl, setWebsiteUrl] = useState(
    workspace?.organization?.website || ""
  );
  const [websiteTitle, setWebsiteTitle] = useState(
    "Business website"
  );
  const [isLoadingKnowledge, setIsLoadingKnowledge] =
    useState(true);
  const [isSavingProfile, setIsSavingProfile] =
    useState(false);
  const [isSavingConfig, setIsSavingConfig] =
    useState(false);
  const [isSavingKnowledge, setIsSavingKnowledge] =
    useState(false);
  const [isImportingWebsite, setIsImportingWebsite] =
    useState(false);
  const [archivingSourceId, setArchivingSourceId] =
    useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setProfile(
      buildProfile(workspace?.organization)
    );
    setConfiguration(
      buildConfiguration(workspace?.agent)
    );
    setWebsiteUrl(
      workspace?.organization?.website || ""
    );
  }, [workspace]);

  const loadKnowledge = async () => {
    setIsLoadingKnowledge(true);
    setError("");

    try {
      const response =
        await getTengaAgentOwnerKnowledge();
      setSources(
        Array.isArray(response?.sources)
          ? response.sources
          : []
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not load business knowledge."
      );
    } finally {
      setIsLoadingKnowledge(false);
    }
  };

  useEffect(() => {
    loadKnowledge();
  }, []);

  const readySources = useMemo(
    () =>
      sources.filter(
        (source) => source.status === "ready"
      ),
    [sources]
  );

  const readiness = useMemo(
    () => [
      {
        label: "Business profile",
        ready: Boolean(
          profile.name.trim() &&
            profile.countryCode.trim() &&
            profile.timezone.trim()
        ),
      },
      {
        label: "Agent identity and greeting",
        ready: Boolean(
          configuration.name.trim() &&
            configuration.role.trim() &&
            configuration.greeting.trim()
        ),
      },
      {
        label: "Business-safe instructions",
        ready:
          configuration.systemInstructions.trim().length >= 40,
      },
      {
        label: "At least one supported language",
        ready: Boolean(
          configuration.languagesText
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean).length
        ),
      },
      {
        label: "At least one ready knowledge source",
        ready: readySources.length > 0,
      },
      {
        label: "Lead or appointment workflow enabled",
        ready: configuration.enabledTools.length > 0,
      },
      {
        label: "Public agent published",
        ready: Boolean(workspace?.agent?.published),
      },
    ],
    [configuration, profile, readySources.length, workspace]
  );

  const updateProfile = (field, value) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
    setNotice("");
  };

  const updateConfiguration = (field, value) => {
    setConfiguration((current) => ({
      ...current,
      [field]: value,
    }));
    setNotice("");
  };

  const toggleTool = (tool) => {
    setConfiguration((current) => ({
      ...current,
      enabledTools: current.enabledTools.includes(tool)
        ? current.enabledTools.filter(
            (entry) => entry !== tool
          )
        : [...current.enabledTools, tool],
    }));
    setNotice("");
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    if (isSavingProfile || !profile.name.trim()) {
      return;
    }

    setIsSavingProfile(true);
    setError("");
    setNotice("");

    try {
      const response =
        await updateTengaAgentOwnerBusinessProfile({
          name: profile.name.trim(),
          website: profile.website.trim(),
          industry: profile.industry.trim(),
          countryCode: profile.countryCode.trim(),
          timezone: profile.timezone.trim(),
        });

      onWorkspaceChange?.(response);

      if (response?.archivedWebsiteSources > 0) {
        await loadKnowledge();
      }

      const messages = [
        response?.unchanged
          ? "Business profile is already up to date."
          : "Business profile saved.",
      ];

      if (response?.archivedWebsiteSources > 0) {
        messages.push(
          `${response.archivedWebsiteSources} previous website source(s) were archived because the registered website changed.`
        );
      }

      if (response?.publicationPaused) {
        messages.push(
          "The public agent was paused so you can review the updated business details before publishing again."
        );
      }

      setNotice(messages.join(" "));
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not save the business profile."
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleConfigurationSubmit = async (event) => {
    event.preventDefault();

    if (isSavingConfig) {
      return;
    }

    setIsSavingConfig(true);
    setError("");
    setNotice("");

    try {
      const response =
        await updateTengaAgentOwnerConfiguration({
          name: configuration.name.trim(),
          role: configuration.role.trim(),
          greeting: configuration.greeting.trim(),
          tone: configuration.tone.trim(),
          languages: configuration.languagesText
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
          systemInstructions:
            configuration.systemInstructions.trim(),
          enabledTools: configuration.enabledTools,
        });

      onWorkspaceChange?.(response);
      setNotice(
        response?.publicationPaused
          ? "Configuration saved. The public agent was paused so you can review the changes before publishing again."
          : "Agent configuration saved."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not save agent configuration."
      );
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleKnowledgeSubmit = async (event) => {
    event.preventDefault();

    if (
      isSavingKnowledge ||
      !knowledge.title.trim() ||
      !knowledge.text.trim()
    ) {
      return;
    }

    setIsSavingKnowledge(true);
    setError("");
    setNotice("");

    try {
      const response =
        await saveTengaAgentOwnerKnowledge({
          type: knowledge.type,
          title: knowledge.title.trim(),
          text: knowledge.text.trim(),
        });

      setNotice(
        response?.unchanged
          ? "That knowledge source is already up to date."
          : `Knowledge saved with ${response?.chunksCreated || 0} searchable chunk(s).`
      );
      setKnowledge({ ...emptyKnowledge });
      await loadKnowledge();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not save that knowledge source."
      );
    } finally {
      setIsSavingKnowledge(false);
    }
  };

  const handleWebsiteImport = async (event) => {
    event.preventDefault();

    if (isImportingWebsite || !websiteUrl.trim()) {
      return;
    }

    setIsImportingWebsite(true);
    setError("");
    setNotice("");

    try {
      const response =
        await importTengaAgentOwnerWebsite({
          url: websiteUrl.trim(),
          title:
            websiteTitle.trim() || "Business website",
        });

      setNotice(
        response?.unchanged
          ? "Website knowledge is already up to date."
          : `Website imported with ${response?.chunksCreated || 0} searchable chunk(s).`
      );
      await loadKnowledge();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not import that website."
      );
    } finally {
      setIsImportingWebsite(false);
    }
  };

  const handleArchiveSource = async (source) => {
    if (!source?.id || archivingSourceId) {
      return;
    }

    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `Archive “${source.title}”? It will stop being used for AI answers and its searchable chunks will be removed.`
      );

    if (!confirmed) {
      return;
    }

    setArchivingSourceId(source.id);
    setError("");
    setNotice("");

    try {
      const response =
        await archiveTengaAgentOwnerKnowledgeSource({
          sourceId: source.id,
        });

      onWorkspaceChange?.(response);
      await loadKnowledge();
      setNotice(
        response?.publicationPaused
          ? `“${source.title}” was archived and removed from searchable knowledge. The public agent was paused for review.`
          : `“${source.title}” was archived and removed from searchable knowledge.`
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not archive that knowledge source."
      );
    } finally {
      setArchivingSourceId("");
    }
  };

  return (
    <section className="tengaagent-knowledge-workspace">
      <div className="tengaagent-knowledge-workspace__header">
        <div>
          <span>AGENT & KNOWLEDGE</span>
          <h3>Train your business receptionist</h3>
          <p>
            Configure your business identity, how your
            agent introduces itself, what actions it can
            offer, and the approved knowledge it can
            retrieve when answering visitors.
          </p>
        </div>
      </div>

      {error ? (
        <div
          className="tengaagent-knowledge-workspace__message tengaagent-knowledge-workspace__message--error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          className="tengaagent-knowledge-workspace__message"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <div className="tengaagent-knowledge-workspace__layout">
        <form
          className="tengaagent-knowledge-workspace__card"
          onSubmit={handleProfileSubmit}
        >
          <div className="tengaagent-knowledge-workspace__card-heading">
            <strong>Business profile</strong>
            <span>
              The public slug stays stable when you edit
              business details. Live changes pause the
              agent for review.
            </span>
          </div>

          <label>
            Business name
            <input
              value={profile.name}
              maxLength={180}
              onChange={(event) =>
                updateProfile("name", event.target.value)
              }
              required
            />
          </label>

          <label>
            Business website
            <input
              type="url"
              value={profile.website}
              maxLength={500}
              onChange={(event) =>
                updateProfile("website", event.target.value)
              }
              placeholder="https://example.com"
            />
          </label>

          <label>
            Industry
            <input
              value={profile.industry}
              maxLength={120}
              onChange={(event) =>
                updateProfile("industry", event.target.value)
              }
              placeholder="Education, retail, services…"
            />
          </label>

          <div className="tengaagent-knowledge-workspace__grid">
            <label>
              Country code
              <input
                value={profile.countryCode}
                maxLength={2}
                onChange={(event) =>
                  updateProfile(
                    "countryCode",
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Timezone
              <input
                value={profile.timezone}
                maxLength={100}
                onChange={(event) =>
                  updateProfile(
                    "timezone",
                    event.target.value
                  )
                }
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSavingProfile}
          >
            {isSavingProfile
              ? "Saving business profile…"
              : "Save business profile"}
          </button>
        </form>

        <aside className="tengaagent-knowledge-workspace__card">
          <div className="tengaagent-knowledge-workspace__card-heading">
            <strong>Readiness</strong>
            <span>
              Review these checks before publishing.
            </span>
          </div>

          <div className="tengaagent-knowledge-workspace__readiness">
            {readiness.map((item) => (
              <div key={item.label}>
                <span aria-hidden="true">
                  {item.ready ? "✓" : "○"}
                </span>
                <strong>{item.label}</strong>
              </div>
            ))}
          </div>

          <p className="tengaagent-knowledge-workspace__safety">
            Keep secrets out of business knowledge. Never
            add passwords, OTPs, API keys, private customer
            records, card details, or internal credentials.
          </p>
        </aside>
      </div>

      <div className="tengaagent-knowledge-workspace__layout">
        <form
          className="tengaagent-knowledge-workspace__card"
          onSubmit={handleConfigurationSubmit}
        >
          <div className="tengaagent-knowledge-workspace__card-heading">
            <strong>Agent configuration</strong>
            <span>
              Saving live-agent changes pauses publication
              until you review and republish.
            </span>
          </div>

          <div className="tengaagent-knowledge-workspace__grid">
            <label>
              Agent name
              <input
                value={configuration.name}
                maxLength={120}
                onChange={(event) =>
                  updateConfiguration(
                    "name",
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Role
              <input
                value={configuration.role}
                maxLength={160}
                onChange={(event) =>
                  updateConfiguration(
                    "role",
                    event.target.value
                  )
                }
                required
              />
            </label>
          </div>

          <label>
            Greeting
            <textarea
              value={configuration.greeting}
              maxLength={600}
              rows={2}
              onChange={(event) =>
                updateConfiguration(
                  "greeting",
                  event.target.value
                )
              }
              required
            />
          </label>

          <div className="tengaagent-knowledge-workspace__grid">
            <label>
              Tone
              <select
                value={configuration.tone}
                onChange={(event) =>
                  updateConfiguration(
                    "tone",
                    event.target.value
                  )
                }
              >
                <option value="friendly-professional">
                  Friendly professional
                </option>
                <option value="warm">Warm</option>
                <option value="concise">Concise</option>
                <option value="formal">Formal</option>
              </select>
            </label>

            <label>
              Languages
              <input
                value={configuration.languagesText}
                onChange={(event) =>
                  updateConfiguration(
                    "languagesText",
                    event.target.value
                  )
                }
                placeholder="English, Hausa"
              />
            </label>
          </div>

          <label>
            System instructions
            <textarea
              value={configuration.systemInstructions}
              maxLength={12000}
              rows={6}
              onChange={(event) =>
                updateConfiguration(
                  "systemInstructions",
                  event.target.value
                )
              }
              placeholder="Describe how the agent should represent your business, what it must never invent, and when it should escalate to a human."
            />
          </label>

          <fieldset>
            <legend>Visitor actions</legend>
            {TOOL_OPTIONS.map(([tool, label]) => (
              <label
                className="tengaagent-knowledge-workspace__check"
                key={tool}
              >
                <input
                  type="checkbox"
                  checked={
                    configuration.enabledTools.includes(tool)
                  }
                  onChange={() => toggleTool(tool)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

          <button type="submit" disabled={isSavingConfig}>
            {isSavingConfig
              ? "Saving configuration…"
              : "Save agent configuration"}
          </button>
        </form>

        <div className="tengaagent-knowledge-workspace__card tengaagent-knowledge-workspace__maintenance-note">
          <div className="tengaagent-knowledge-workspace__card-heading">
            <strong>Knowledge maintenance</strong>
            <span>
              Keep the AI grounded in current information.
            </span>
          </div>
          <p>
            Archive outdated sources below when prices,
            policies, hours or services change. Archived
            sources are removed from searchable chunks and
            no longer participate in AI answers.
          </p>
          <p>
            If you change the registered business website,
            TengaAgent automatically retires previous
            website-derived knowledge before you import the
            new site.
          </p>
        </div>
      </div>

      <div className="tengaagent-knowledge-workspace__layout tengaagent-knowledge-workspace__layout--knowledge">
        <form
          className="tengaagent-knowledge-workspace__card"
          onSubmit={handleKnowledgeSubmit}
        >
          <div className="tengaagent-knowledge-workspace__card-heading">
            <strong>Add approved knowledge</strong>
            <span>
              FAQs, services, hours and other facts are
              embedded into this tenant only.
            </span>
          </div>

          <label>
            Knowledge type
            <select
              value={knowledge.type}
              onChange={(event) =>
                setKnowledge((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
            >
              {KNOWLEDGE_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Title
            <input
              value={knowledge.title}
              maxLength={240}
              onChange={(event) =>
                setKnowledge((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Pricing FAQ, Opening hours…"
              required
            />
          </label>

          <label>
            Knowledge text
            <textarea
              value={knowledge.text}
              maxLength={50000}
              rows={7}
              onChange={(event) =>
                setKnowledge((current) => ({
                  ...current,
                  text: event.target.value,
                }))
              }
              placeholder="Enter only accurate, approved business information."
              required
            />
          </label>

          <button
            type="submit"
            disabled={isSavingKnowledge}
          >
            {isSavingKnowledge
              ? "Saving knowledge…"
              : "Add knowledge source"}
          </button>
        </form>

        <form
          className="tengaagent-knowledge-workspace__card"
          onSubmit={handleWebsiteImport}
        >
          <div className="tengaagent-knowledge-workspace__card-heading">
            <strong>Import your website</strong>
            <span>
              For safety, the URL must match the HTTPS
              hostname saved on this workspace. Redirects
              are checked against the same allowlist.
            </span>
          </div>

          <label>
            Source title
            <input
              value={websiteTitle}
              maxLength={240}
              onChange={(event) =>
                setWebsiteTitle(event.target.value)
              }
            />
          </label>

          <label>
            HTTPS page URL
            <input
              type="url"
              value={websiteUrl}
              maxLength={1000}
              onChange={(event) =>
                setWebsiteUrl(event.target.value)
              }
              placeholder="https://example.com"
              required
            />
          </label>

          <button
            type="submit"
            disabled={isImportingWebsite}
          >
            {isImportingWebsite
              ? "Importing website…"
              : "Import website knowledge"}
          </button>
        </form>
      </div>

      <div className="tengaagent-knowledge-workspace__sources">
        <div className="tengaagent-knowledge-workspace__card-heading">
          <strong>Knowledge sources</strong>
          <span>
            {isLoadingKnowledge
              ? "Loading…"
              : `${readySources.length} ready source(s)`}
          </span>
        </div>

        {!isLoadingKnowledge && sources.length === 0 ? (
          <div className="tengaagent-knowledge-workspace__empty">
            No business knowledge has been added yet.
          </div>
        ) : null}

        <div className="tengaagent-knowledge-workspace__source-list">
          {sources.map((source) => {
            const isArchiving =
              archivingSourceId === source.id;

            return (
              <article key={source.id}>
                <div className="tengaagent-knowledge-workspace__source-copy">
                  <strong>{source.title}</strong>
                  <span>
                    {source.type} · {source.status} · {source.chunkCount || 0} chunk(s)
                  </span>
                  {source.sourceUrl ? (
                    <a
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.sourceUrl}
                    </a>
                  ) : null}
                </div>

                <div className="tengaagent-knowledge-workspace__source-actions">
                  <time dateTime={source.updatedAt || ""}>
                    {formatDate(source.updatedAt)}
                  </time>
                  <button
                    type="button"
                    className="tengaagent-knowledge-workspace__archive"
                    onClick={() => handleArchiveSource(source)}
                    disabled={Boolean(archivingSourceId)}
                    aria-label={`Archive ${source.title}`}
                  >
                    {isArchiving
                      ? "Archiving…"
                      : "Archive source"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
