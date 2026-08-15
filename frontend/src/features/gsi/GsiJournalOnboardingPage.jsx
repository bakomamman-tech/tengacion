import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SeoHead from "../../components/seo/SeoHead";
import GsiIcon from "./GsiIcons";
import {
  calculateGsiJournalScore,
  importGsiJournal,
  publishGsiJournal,
  searchGsiJournals,
} from "./gsiApi";
import { formatCountry, formatNumber } from "./gsiFormatters";
import "./gsi.css";

const STEPS = [
  { label: "Find journal", short: "Find" },
  { label: "Review information", short: "Review" },
  { label: "Understand score", short: "Score" },
  { label: "Confirm record", short: "Confirm" },
  { label: "Record saved", short: "Saved" },
];

const formatDate = (value) => {
  if (!value) {
    return "Date unavailable";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
};

const EMPTY_IMPACT_EVIDENCE = {
  policyMentions: "",
  ngoAdoptions: "",
  localCitations: "",
  summary: "",
  sourceUrl: "",
  attested: false,
};

const hasImpactEvidence = (value) => Boolean(
  Number(value.policyMentions) ||
  Number(value.ngoAdoptions) ||
  Number(value.localCitations) ||
  value.summary.trim() ||
  value.sourceUrl.trim()
);

const isPublicEvidenceUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

function StepRail({ activeStep }) {
  return (
    <aside className="gsi-step-rail" aria-label="Journal onboarding progress">
      <div className="gsi-rail-kicker">Onboarding progress</div>
      <ol>
        {STEPS.map((step, index) => {
          const complete = index < activeStep;
          const active = index === activeStep;
          return (
            <li className={`${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`} key={step.label}>
              <span className="gsi-step-marker">
                {complete ? <GsiIcon name="check" size={15} /> : String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <small>{complete ? "Completed" : active ? "Current step" : "Next"}</small>
                <strong>{step.label}</strong>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="gsi-rail-note">
        <GsiIcon name="shield" />
        <div>
          <strong>Private by default</strong>
          <span>Nothing is published until your final confirmation.</span>
        </div>
      </div>
    </aside>
  );
}

function MobileProgress({ activeStep }) {
  return (
    <div className="gsi-mobile-progress" aria-label={`Step ${activeStep + 1} of ${STEPS.length}`}>
      <div>
        <span>Step {activeStep + 1} of {STEPS.length}</span>
        <strong>{STEPS[activeStep].label}</strong>
      </div>
      <div className="gsi-mobile-progress-track">
        <span style={{ width: `${((activeStep + 1) / STEPS.length) * 100}%` }} />
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="gsi-header">
      <Link className="gsi-brand" to="/gsi" aria-label="Global South Index journal onboarding home">
        <span className="gsi-brand-mark"><GsiIcon name="book" size={24} /></span>
        <span><strong>Global South Index</strong><small>Journal Registry</small></span>
      </Link>
      <div className="gsi-header-meta">
        <span className="gsi-team-pill"><span /> Team Archive</span>
        <Link to="/gsi/research">Browse research</Link>
        <Link to="/gsi/papers/new">Submit a paper</Link>
      </div>
    </header>
  );
}

function Notice({ type = "info", title, children, onRetry }) {
  return (
    <div className={`gsi-notice gsi-notice-${type}`} role={type === "error" ? "alert" : "status"}>
      <GsiIcon name={type === "error" ? "info" : type === "success" ? "check" : "info"} />
      <div><strong>{title}</strong><span>{children}</span></div>
      {onRetry ? <button type="button" className="gsi-text-button" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

function SearchStep({ onImported }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState("");
  const [error, setError] = useState("");
  const searchInput = useRef(null);

  useEffect(() => searchInput.current?.focus(), []);

  const submitSearch = async (event) => {
    event?.preventDefault();
    if (query.trim().length < 2) {
      setError("Enter at least two characters from the journal name, ISSN, publisher, or website.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const payload = await searchGsiJournals(query.trim());
      setResults(payload.results || []);
      setSearched(true);
    } catch (requestError) {
      setError(requestError.message);
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const chooseJournal = async (source) => {
    setImportingId(source.id);
    setError("");
    try {
      const payload = await importGsiJournal(source.id);
      onImported(payload);
    } catch (requestError) {
      setError(requestError.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setImportingId("");
    }
  };

  return (
    <section className="gsi-stage gsi-search-stage">
      <div className="gsi-stage-heading gsi-stage-heading-wide">
        <div className="gsi-eyebrow"><GsiIcon name="spark" size={16} /> Journal onboarding</div>
        <h1>Bring your journal into the global research record.</h1>
        <p>Find your journal and we’ll import its publication history from OpenAlex. You will review every detail before anything is saved.</p>
      </div>

      <form className="gsi-search-panel" onSubmit={submitSearch}>
        <label htmlFor="gsi-journal-search">Journal name, ISSN, publisher, or website</label>
        <div className="gsi-search-control">
          <GsiIcon name="search" size={22} />
          <input
            id="gsi-journal-search"
            ref={searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. African Journal of Primary Health Care"
            autoComplete="off"
          />
          <button className="gsi-primary-button" type="submit" disabled={loading}>
            {loading ? <span className="gsi-spinner" /> : null}
            {loading ? "Searching…" : "Find journal"}
          </button>
        </div>
        <div className="gsi-search-hint"><GsiIcon name="lock" size={15} /> Searches use live academic data. No account is required.</div>
      </form>

      {error ? <Notice type="error" title="We couldn’t complete the search" onRetry={searched ? () => submitSearch() : null}>{error}</Notice> : null}

      {!searched && !loading ? (
        <div className="gsi-trust-grid">
          <article><span><GsiIcon name="search" /></span><strong>Find the right record</strong><p>Search by journal name or use an ISSN for an exact match.</p></article>
          <article><span><GsiIcon name="file" /></span><strong>Review real publications</strong><p>Inspect the current OpenAlex record and correct journal details.</p></article>
          <article><span><GsiIcon name="shield" /></span><strong>Save with confidence</strong><p>Create a permanent academic reference only after you confirm it.</p></article>
        </div>
      ) : null}

      {searched && !loading && !error ? (
        <div className="gsi-results" aria-live="polite">
          <div className="gsi-results-heading">
            <div><span>{results.length ? `${results.length} likely matches` : "No matching journals"}</span><h2>{results.length ? "Select your journal" : "Try another search"}</h2></div>
            {results.length ? <small>Check the publisher and ISSN before continuing.</small> : null}
          </div>
          {results.length ? results.map((source) => (
            <article className="gsi-result-card" key={source.id}>
              <div className="gsi-result-monogram" aria-hidden="true">{source.displayName.charAt(0).toUpperCase()}</div>
              <div className="gsi-result-body">
                <div className="gsi-result-title-row">
                  <div><h3>{source.displayName}</h3><p>{source.publisher || "Publisher not listed"}</p></div>
                  {source.isInDoaj ? <span className="gsi-verified-badge"><GsiIcon name="check" size={14} /> DOAJ listed</span> : null}
                </div>
                <dl>
                  <div><dt>ISSN</dt><dd>{source.issnL || source.issns?.[0] || "Not listed"}</dd></div>
                  <div><dt>Country</dt><dd>{formatCountry(source.countryCode)}</dd></div>
                  <div><dt>Works indexed</dt><dd>{formatNumber(source.worksCount)}</dd></div>
                </dl>
              </div>
              <button className="gsi-select-button" type="button" disabled={Boolean(importingId)} onClick={() => chooseJournal(source)}>
                {importingId === source.id ? <><span className="gsi-spinner" /> Importing…</> : <>This is my journal <GsiIcon name="arrow" size={17} /></>}
              </button>
            </article>
          )) : (
            <div className="gsi-empty-state">
              <span><GsiIcon name="search" size={28} /></span>
              <h3>We didn’t find a journal for “{query}”</h3>
              <p>Check the spelling, try the journal’s ISSN, or search using only the most distinctive words in its title.</p>
              <button className="gsi-secondary-button" type="button" onClick={() => { setSearched(false); setQuery(""); searchInput.current?.focus(); }}>Change search</button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ReviewStep({
  data,
  editorialReview,
  setEditorialReview,
  impactEvidence,
  setImpactEvidence,
  scoreError,
  scoring,
  onBack,
  onContinue,
}) {
  const [showAll, setShowAll] = useState(false);
  const works = data.publications || [];
  const visibleWorks = showAll ? works : works.slice(0, 6);

  const updateField = (field) => (event) =>
    setEditorialReview((current) => ({ ...current, [field]: event.target.value }));
  const updateImpactField = (field) => (event) =>
    setImpactEvidence((current) => ({ ...current, [field]: event.target.value }));
  const hasEvidence = hasImpactEvidence(impactEvidence);
  const evidenceReady = !hasEvidence || (
    isPublicEvidenceUrl(impactEvidence.sourceUrl) && impactEvidence.attested
  );

  return (
    <section className="gsi-stage">
      <div className="gsi-stage-heading">
        <div className="gsi-eyebrow">Imported from OpenAlex</div>
        <h1>Review the journal information.</h1>
        <p>Correct the journal-level details if needed. Publication evidence remains linked to its source record.</p>
      </div>
      <Notice type="success" title="Import complete">
        The OpenAlex source reports {formatNumber(data.source.worksCount)} works. Its primary-source query matched {formatNumber(data.importSummary.totalWorks)}, and this MVP reviewed the {formatNumber(data.importSummary.reviewedWorks)} most recent records as a reproducible evidence sample.
      </Notice>

      <div className="gsi-journal-summary">
        <div className="gsi-summary-monogram">{data.source.displayName.charAt(0).toUpperCase()}</div>
        <div><span>OpenAlex source {data.source.id}</span><h2>{data.source.displayName}</h2><p>{data.source.publisher || "Publisher not listed"}</p></div>
        <a href={data.source.openAlexUrl} target="_blank" rel="noreferrer">View source <GsiIcon name="external" size={15} /></a>
      </div>

      <div className="gsi-review-grid">
        <div className="gsi-form-card">
          <div className="gsi-card-heading"><div><span>Journal details</span><h2>Confirm the public information</h2></div><GsiIcon name="file" /></div>
          <div className="gsi-field-grid">
            <label className="gsi-field gsi-field-full"><span>Journal title</span><input value={editorialReview.displayName} onChange={updateField("displayName")} /></label>
            <label className="gsi-field"><span>Publisher</span><input value={editorialReview.publisher} onChange={updateField("publisher")} placeholder="Not listed" /></label>
            <label className="gsi-field"><span>Primary ISSN</span><input value={editorialReview.issnL} onChange={updateField("issnL")} placeholder="0000-0000" /></label>
            <label className="gsi-field"><span>Country code</span><input value={editorialReview.countryCode} onChange={updateField("countryCode")} maxLength={2} placeholder="NG" /></label>
            <label className="gsi-field"><span>Journal website</span><input type="url" value={editorialReview.homepageUrl} onChange={updateField("homepageUrl")} placeholder="https://" /></label>
          </div>
          <p className="gsi-form-note"><GsiIcon name="info" size={16} /> Corrections appear in the saved journal record without altering OpenAlex.</p>
        </div>

        <aside className="gsi-import-facts">
          <span>Imported evidence</span>
          <dl>
            <div><dt>OpenAlex source works</dt><dd>{formatNumber(data.source.worksCount)}</dd></div>
            <div><dt>Primary-source query</dt><dd>{formatNumber(data.importSummary.totalWorks)}</dd></div>
            <div><dt>Recent records reviewed</dt><dd>{formatNumber(data.importSummary.reviewedWorks)}</dd></div>
            <div><dt>Citations recorded</dt><dd>{formatNumber(data.source.citedByCount)}</dd></div>
            <div><dt>Open-access journal</dt><dd>{data.source.isOpenAccess ? "Yes" : "Not indicated"}</dd></div>
          </dl>
          <small>Imported {formatDate(data.importSummary.importedAt)}</small>
        </aside>
      </div>

      <div className="gsi-impact-card">
        <div className="gsi-card-heading">
          <div><span>Proof of local impact · Optional</span><h2>Add evidence OpenAlex cannot see</h2></div>
          <span className="gsi-impact-weight">10 score points</span>
        </div>
        <p className="gsi-impact-intro">Global citation databases often miss how research changes policy and practice. Add only claims you can support with a public institutional, government, NGO, or repository link.</p>
        <div className="gsi-impact-fields">
          <label className="gsi-field"><span>Government policy mentions</span><input type="number" min="0" max="100000" inputMode="numeric" value={impactEvidence.policyMentions} onChange={updateImpactField("policyMentions")} placeholder="0" /></label>
          <label className="gsi-field"><span>NGO or programme adoptions</span><input type="number" min="0" max="100000" inputMode="numeric" value={impactEvidence.ngoAdoptions} onChange={updateImpactField("ngoAdoptions")} placeholder="0" /></label>
          <label className="gsi-field"><span>Local open-access citations</span><input type="number" min="0" max="100000" inputMode="numeric" value={impactEvidence.localCitations} onChange={updateImpactField("localCitations")} placeholder="0" /></label>
          <label className="gsi-field gsi-field-full"><span>Public evidence link</span><input type="url" value={impactEvidence.sourceUrl} onChange={updateImpactField("sourceUrl")} placeholder="https://government.example/policy-document" /></label>
          <label className="gsi-field gsi-field-full"><span>Impact context</span><textarea value={impactEvidence.summary} onChange={updateImpactField("summary")} maxLength="700" placeholder="Briefly explain what adopted or cited the research and where it was used." /></label>
        </div>
        {hasEvidence ? (
          <label className="gsi-impact-attestation">
            <input type="checkbox" checked={impactEvidence.attested} onChange={(event) => setImpactEvidence((current) => ({ ...current, attested: event.target.checked }))} />
            <span><GsiIcon name="check" size={14} /></span>
            <strong>I confirm these claims are accurate, publicly supportable, and may appear as self-reported evidence in the permanent record.</strong>
          </label>
        ) : null}
        <div className={`gsi-impact-status ${hasEvidence ? "has-evidence" : ""}`}>
          <GsiIcon name={hasEvidence ? "shield" : "info"} size={17} />
          <span>{hasEvidence ? "Evidence is clearly labeled self-reported until independently verified. A valid public link and confirmation are required." : "Leave this section blank if no evidence is available. The score will show zero instead of estimating local impact from global citations."}</span>
        </div>
      </div>

      <div className="gsi-publications-card">
        <div className="gsi-card-heading">
          <div><span>Recent review sample</span><h2>{formatNumber(data.importSummary.reviewedWorks)} of {formatNumber(data.source.worksCount)} source works</h2></div>
          <span className="gsi-source-badge">Source: OpenAlex</span>
        </div>
        <div className="gsi-publication-list">
          {visibleWorks.map((work) => (
            <article key={work.id}>
              <div className="gsi-publication-icon"><GsiIcon name="file" size={18} /></div>
              <div className="gsi-publication-main"><h3>{work.title}</h3><p>{work.authors?.slice(0, 3).map((author) => author.displayName).join(", ") || "Authors not listed"}{work.authors?.length > 3 ? ` +${work.authors.length - 3} more` : ""}</p></div>
              <div className="gsi-publication-meta"><span>{work.publicationYear || "—"}</span><span className={work.isOpenAccess ? "is-open" : ""}>{work.isOpenAccess ? "Open access" : "Access not listed"}</span><small>{work.doi ? "DOI present" : "No DOI returned"}</small></div>
            </article>
          ))}
        </div>
        {works.length > 6 ? <button type="button" className="gsi-list-toggle" onClick={() => setShowAll((value) => !value)}>{showAll ? "Show fewer publications" : `Show all ${works.length} reviewed publications`} <GsiIcon name="chevron" size={16} className={showAll ? "is-rotated" : ""} /></button> : null}
      </div>

      {scoreError ? <Notice type="error" title="We couldn’t calculate the score" onRetry={evidenceReady ? onContinue : null}>{scoreError}</Notice> : null}
      <StageActions onBack={onBack} onContinue={onContinue} continueLabel={scoring ? "Calculating score…" : "Calculate GSI Score"} continueDisabled={!evidenceReady || scoring} />
    </section>
  );
}

function ScoreRing({ score }) {
  return (
    <div className="gsi-score-ring" style={{ "--score": score }} role="img" aria-label={`GSI Score ${score} out of 100`}>
      <div><strong>{score}</strong><span>/ 100</span></div>
    </div>
  );
}

function ScoreStep({ data, onBack, onContinue }) {
  const { score } = data;
  const [expanded, setExpanded] = useState(score.components[0]?.key || "");

  return (
    <section className="gsi-stage">
      <div className="gsi-stage-heading">
        <div className="gsi-eyebrow">Transparent evaluation</div>
        <h1>Your journal’s GSI Score, explained.</h1>
        <p>Every point comes from visible publication evidence. Expand any category to inspect the calculation.</p>
      </div>

      <div className="gsi-score-hero">
        <ScoreRing score={score.total} />
        <div className="gsi-score-narrative">
          <span>GSI Score · {score.version}</span>
          <h2>{editorialTitle(data)}</h2>
          <p>{score.summary}</p>
          <div className="gsi-score-context"><span><GsiIcon name="file" size={16} /> {formatNumber(score.sampleSize)} research records scored</span><span><GsiIcon name="globe" size={16} /> {formatNumber(score.context.countries.length || 0)} countries identified</span><span><GsiIcon name="shield" size={16} /> Local impact: {score.context.impactEvidenceStatus === "self-reported" ? "self-reported" : "not provided"}</span></div>
          {score.context.excludedPublications ? <p className="gsi-score-methodology">{formatNumber(score.context.excludedPublications)} non-research {score.context.excludedPublications === 1 ? "record was" : "records were"} retained as evidence but excluded from scoring.</p> : null}
        </div>
      </div>

      <div className="gsi-score-layout">
        <div className="gsi-score-breakdown">
          <div className="gsi-card-heading"><div><span>Score breakdown</span><h2>How {score.total} points were earned</h2></div><span className="gsi-weight-total">100 points total</span></div>
          {score.components.map((component) => {
            const isExpanded = expanded === component.key;
            return (
              <article className={`gsi-score-component ${isExpanded ? "is-expanded" : ""}`} key={component.key}>
                <button type="button" onClick={() => setExpanded(isExpanded ? "" : component.key)} aria-expanded={isExpanded}>
                  <div className="gsi-component-top"><div><strong>{component.label}</strong><span>{component.explanation}</span></div><b>{component.score}<small>/{component.weight}</small></b></div>
                  <div className="gsi-score-bar"><span style={{ width: `${(component.score / component.weight) * 100}%` }} /></div>
                  <GsiIcon name="chevron" size={17} className={isExpanded ? "is-rotated" : ""} />
                </button>
                {isExpanded ? (
                  <div className="gsi-metrics-grid">
                    {component.metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.percent}% coverage</small></div>)}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        <aside className="gsi-fairness-card">
          <span className="gsi-fairness-icon"><GsiIcon name="shield" size={22} /></span>
          <span>Fair by design</span>
          <h2>Visibility, not prestige</h2>
          <p>{score.fairnessNote}</p>
          <ul><li><GsiIcon name="check" size={15} /> No impact-factor ranking</li><li><GsiIcon name="check" size={15} /> No country-income penalty</li><li><GsiIcon name="check" size={15} /> Missing data stays visible</li></ul>
        </aside>
      </div>

      <StageActions onBack={onBack} onContinue={onContinue} continueLabel="Continue to confirmation" />
    </section>
  );
}

const editorialTitle = (data) => data.editorialReview?.displayName || data.source.displayName;

function ConfirmStep({ data, editorialReview, impactEvidence, onBack, onPublished }) {
  const [checked, setChecked] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const publish = async () => {
    if (!checked || publishing) {
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const payload = await publishGsiJournal(data.source.id, editorialReview, impactEvidence);
      onPublished(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="gsi-stage">
      <div className="gsi-stage-heading">
        <div className="gsi-eyebrow">Final review</div>
        <h1>Confirm the academic record.</h1>
        <p>This is the last step. Once saved, this version becomes a permanent, publicly verifiable journal record.</p>
      </div>
      {error ? <Notice type="error" title="The record was not saved" onRetry={publish}>{error}</Notice> : null}

      <div className="gsi-confirm-layout">
        <div className="gsi-confirm-record">
          <div className="gsi-confirm-title"><span className="gsi-summary-monogram">{editorialReview.displayName.charAt(0).toUpperCase()}</span><div><span>Journal record</span><h2>{editorialReview.displayName}</h2><p>{editorialReview.publisher || "Publisher not listed"}</p></div></div>
          <dl>
            <div><dt>Primary ISSN</dt><dd>{editorialReview.issnL || "Not listed"}</dd></div>
            <div><dt>Country</dt><dd>{formatCountry(editorialReview.countryCode)}</dd></div>
            <div><dt>OpenAlex source works</dt><dd>{formatNumber(data.source.worksCount)}</dd></div>
            <div><dt>Recent records reviewed</dt><dd>{formatNumber(data.importSummary.reviewedWorks)}</dd></div>
            <div><dt>Research records scored</dt><dd>{formatNumber(data.score.context?.scoredPublications ?? data.score.sampleSize)}</dd></div>
            <div><dt>GSI Score</dt><dd><strong>{data.score.total}/100</strong></dd></div>
          </dl>
          <div className="gsi-confirm-breakdown">
            {data.score.components.map((component) => <div key={component.key}><span>{component.label}</span><b>{component.score}/{component.weight}</b></div>)}
          </div>
          <div className="gsi-confirm-impact">
            <div><span>Policy mentions</span><strong>{formatNumber(data.impactEvidence?.policyMentions || 0)}</strong></div>
            <div><span>NGO / programme adoptions</span><strong>{formatNumber(data.impactEvidence?.ngoAdoptions || 0)}</strong></div>
            <div><span>Local citations</span><strong>{formatNumber(data.impactEvidence?.localCitations || 0)}</strong></div>
            <small>{data.impactEvidence?.verificationStatus === "self-reported" ? "Linked evidence · self-reported" : "No local-impact evidence provided"}</small>
          </div>
          <div className="gsi-record-provenance"><GsiIcon name="shield" /><div><strong>Source evidence retained</strong><span>The record includes its OpenAlex reference, recent yearly publication counts, import time, score formula, and the publication sample used.</span></div></div>
        </div>

        <aside className="gsi-save-card">
          <span className="gsi-save-icon"><GsiIcon name="archive" size={25} /></span>
          <span>One clear action</span>
          <h2>Create the permanent record</h2>
          <p>Tengacion handles the archival process in the background. There are no extra accounts, fees, or technical steps for the editor.</p>
          <label className="gsi-confirm-check"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span><GsiIcon name="check" size={15} /></span><strong>I have reviewed the journal details and confirm they are ready to publish.</strong></label>
          <button className="gsi-publish-button" type="button" onClick={publish} disabled={!checked || publishing}>{publishing ? <><span className="gsi-spinner" /> Saving your journal record…</> : <><GsiIcon name="archive" size={19} /> Publish Journal Record</>}</button>
          <small><GsiIcon name="lock" size={14} /> The publication record cannot be silently changed after confirmation.</small>
        </aside>
      </div>
      <StageActions onBack={onBack} hideContinue />
    </section>
  );
}

export function SuccessStep({ payload }) {
  const { archive, record } = payload;
  const [copied, setCopied] = useState(false);
  const publicUrl = `${window.location.origin}${archive.publicRecordPath}`;
  const registryPending = payload.registry?.status === "pending" || payload.registryIndexed === false;

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="gsi-stage gsi-success-stage">
      <div className="gsi-success-mark"><GsiIcon name="check" size={34} /></div>
      <div className="gsi-eyebrow">{registryPending ? "Permanent record saved" : "Indexing complete"}</div>
      <h1>{registryPending ? "Journal permanently published." : "Journal successfully indexed."}</h1>
      <p>{record.journal.displayName} now has a permanent academic record with a transparent GSI Score and traceable source evidence.{registryPending ? " Its Browse Research listing is still pending." : ""}</p>

      {registryPending ? <div className="gsi-success-warning" role="status"><GsiIcon name="info" size={19} /><div><strong>Discovery indexing is pending</strong><span>{payload.warning || payload.registry?.message || "The IPFS record is safe. An operator can retry the registry index using this CID without republishing or changing the permanent record."}</span></div></div> : null}

      <div className="gsi-success-record">
        <div className="gsi-success-record-top"><div><span>Permanent record reference</span><strong>{archive.id}</strong></div><button type="button" onClick={copyReference}><GsiIcon name={copied ? "check" : "copy"} size={17} /> {copied ? "Copied" : "Copy link"}</button></div>
        <div className="gsi-success-journal"><span className="gsi-summary-monogram">{record.journal.displayName.charAt(0).toUpperCase()}</span><div><h2>{record.journal.displayName}</h2><p>{record.journal.publisher || "Publisher not listed"} · {record.journal.issnL || "ISSN not listed"}</p></div><div className="gsi-mini-score"><strong>{record.gsiScore.total}</strong><span>GSI Score</span></div></div>
        <dl><div><dt>Saved</dt><dd>{formatDate(archive.savedAt)}</dd></div><div><dt>Records reviewed</dt><dd>{formatNumber(record.provenance.reviewedWorks)}</dd></div><div><dt>Research records scored</dt><dd>{formatNumber(record.provenance.scoredPublications ?? record.gsiScore.sampleSize)}</dd></div><div><dt>Publications retained</dt><dd>{formatNumber(archive.archivedPublications)}</dd></div><div><dt>Integrity reference</dt><dd>{archive.contentHash.slice(0, 22)}…</dd></div></dl>
      </div>

      <div className="gsi-success-actions">
        <Link className="gsi-primary-button" to={archive.publicRecordPath}>View public journal record <GsiIcon name="arrow" size={17} /></Link>
        <button className="gsi-secondary-button" type="button" onClick={copyReference}><GsiIcon name="copy" size={17} /> Copy shareable link</button>
      </div>
      <div className="gsi-success-note"><GsiIcon name="shield" /><div><strong>Independent and verifiable</strong><span>The source evidence, score calculation, and record fingerprint travel together so future readers can verify this exact version.</span></div></div>
    </section>
  );
}

function StageActions({ onBack, onContinue, continueLabel, continueDisabled = false, hideContinue = false }) {
  return (
    <div className="gsi-stage-actions">
      <button className="gsi-back-button" type="button" onClick={onBack}><GsiIcon name="back" size={17} /> Back</button>
      {!hideContinue ? <button className="gsi-primary-button" type="button" onClick={onContinue} disabled={continueDisabled}>{continueLabel} <GsiIcon name="arrow" size={17} /></button> : null}
    </div>
  );
}

export default function GsiJournalOnboardingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [data, setData] = useState(null);
  const [editorialReview, setEditorialReview] = useState({ displayName: "", publisher: "", homepageUrl: "", countryCode: "", issnL: "" });
  const [impactEvidence, setImpactEvidence] = useState(EMPTY_IMPACT_EVIDENCE);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [successPayload, setSuccessPayload] = useState(null);

  const pageTitle = useMemo(() => `${STEPS[activeStep].label} | GSI Journal Registry`, [activeStep]);
  const goTo = (step) => { setActiveStep(step); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const handleImported = (payload) => {
    setData(payload);
    setEditorialReview({
      displayName: payload.source.displayName || "",
      publisher: payload.source.publisher || "",
      homepageUrl: payload.source.homepageUrl || "",
      countryCode: payload.source.countryCode || "",
      issnL: payload.source.issnL || payload.source.issns?.[0] || "",
    });
    setImpactEvidence(EMPTY_IMPACT_EVIDENCE);
    setScoreError("");
    goTo(1);
  };

  const handleScore = async () => {
    setScoring(true);
    setScoreError("");
    try {
      const payload = await calculateGsiJournalScore(data.source.id, impactEvidence);
      setData((current) => ({
        ...current,
        score: payload.score,
        impactEvidence: payload.impactEvidence,
      }));
      goTo(2);
    } catch (requestError) {
      setScoreError(requestError.message);
    } finally {
      setScoring(false);
    }
  };

  const dataWithReview = data ? { ...data, editorialReview } : null;

  return (
    <div className="gsi-app-shell">
      <SeoHead title={pageTitle} description="Import OpenAlex journal data, add sourced local-impact evidence, understand a transparent GSI Score, and create a permanent academic record." canonical="/gsi" robots="index,follow" />
      <PageHeader />
      <MobileProgress activeStep={activeStep} />
      <div className="gsi-shell-grid">
        <StepRail activeStep={activeStep} />
        <main className="gsi-main">
          {activeStep === 0 ? <SearchStep onImported={handleImported} /> : null}
          {activeStep === 1 && data ? <ReviewStep data={data} editorialReview={editorialReview} setEditorialReview={setEditorialReview} impactEvidence={impactEvidence} setImpactEvidence={setImpactEvidence} scoreError={scoreError} scoring={scoring} onBack={() => goTo(0)} onContinue={handleScore} /> : null}
          {activeStep === 2 && data ? <ScoreStep data={dataWithReview} onBack={() => goTo(1)} onContinue={() => goTo(3)} /> : null}
          {activeStep === 3 && data ? <ConfirmStep data={dataWithReview} editorialReview={editorialReview} impactEvidence={impactEvidence} onBack={() => goTo(2)} onPublished={(payload) => { setSuccessPayload(payload); goTo(4); }} /> : null}
          {activeStep === 4 && successPayload ? <SuccessStep payload={successPayload} /> : null}
        </main>
      </div>
      <footer className="gsi-footer"><span>Built by <strong>Team Archive</strong> for GSI Buildathon 2026</span><span>Academic data by OpenAlex · Hosted by Tengacion</span></footer>
    </div>
  );
}
