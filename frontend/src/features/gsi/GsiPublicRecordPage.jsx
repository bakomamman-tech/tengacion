import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SeoHead from "../../components/seo/SeoHead";
import GsiIcon from "./GsiIcons";
import { getGsiRecord } from "./gsiApi";
import { formatCountry, formatNumber } from "./gsiFormatters";
import "./gsi.css";

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short" }).format(date);
};

export default function GsiPublicRecordPage() {
  const { recordId } = useParams();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getGsiRecord(recordId)
      .then((result) => {
        if (active) {
          setPayload(result);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [recordId]);

  const record = payload?.record;
  const impactEvidence = record?.impactEvidence;
  return (
    <div className="gsi-app-shell gsi-record-page">
      <SeoHead title={record ? `${record.journal.displayName} | GSI Journal Record` : "GSI Journal Record"} description="A permanent journal record with a transparent GSI Score, OpenAlex provenance, and disclosed local-impact evidence." canonical={`/gsi/records/${recordId}`} robots="index,follow" />
      <header className="gsi-header">
        <Link className="gsi-brand" to="/gsi"><span className="gsi-brand-mark"><GsiIcon name="book" size={24} /></span><span><strong>Global South Index</strong><small>Journal Registry</small></span></Link>
        <Link className="gsi-secondary-button gsi-header-action" to="/gsi">Index another journal</Link>
      </header>
      <main className="gsi-record-main">
        {loading ? <div className="gsi-record-loading"><span className="gsi-spinner gsi-spinner-dark" /><h1>Retrieving the permanent record…</h1><p>This can take a moment immediately after publication.</p></div> : null}
        {!loading && error ? <div className="gsi-record-loading"><span className="gsi-error-icon"><GsiIcon name="info" size={28} /></span><h1>Record not available yet</h1><p>{error}</p><button type="button" className="gsi-primary-button" onClick={() => window.location.reload()}>Try again</button></div> : null}
        {record ? (
          <>
            <div className="gsi-record-verified"><GsiIcon name="shield" size={17} /> Verified permanent journal record</div>
            <section className="gsi-public-record-hero">
              <div><span>Global South Index · Journal record</span><h1>{record.journal.displayName}</h1><p>{record.journal.publisher || "Publisher not listed"}</p><dl><div><dt>ISSN</dt><dd>{record.journal.issnL || "Not listed"}</dd></div><div><dt>Country</dt><dd>{formatCountry(record.journal.countryCode)}</dd></div><div><dt>Indexed works</dt><dd>{formatNumber(record.provenance.totalWorks)}</dd></div></dl></div>
              <div className="gsi-public-score"><strong>{record.gsiScore.total}</strong><span>out of 100</span><small>GSI Score</small></div>
            </section>

            <section className="gsi-public-record-grid">
              <div className="gsi-score-breakdown gsi-public-score-breakdown">
                <div className="gsi-card-heading"><div><span>Transparent score</span><h2>Evidence breakdown</h2></div><b>{record.gsiScore.total}/100</b></div>
                {record.gsiScore.components.map((component) => <div className="gsi-public-component" key={component.key}><div><strong>{component.label}</strong><span>{component.explanation}</span></div><b>{component.score}<small>/{component.weight}</small></b></div>)}
                {record.gsiScore.methodologyNote ? <div className="gsi-public-methodology"><GsiIcon name="info" size={17} /><div><strong>Scoring sample</strong><p>{record.gsiScore.methodologyNote}{record.gsiScore.context?.excludedPublications ? ` ${formatNumber(record.gsiScore.context.excludedPublications)} non-research ${record.gsiScore.context.excludedPublications === 1 ? "record was" : "records were"} excluded.` : ""}</p></div></div> : null}
                <div className="gsi-public-fairness"><GsiIcon name="shield" /><p>{record.gsiScore.fairnessNote}</p></div>
              </div>
              <aside className="gsi-record-certificate">
                <span><GsiIcon name="archive" size={23} /></span><small>Record certificate</small><h2>Source and integrity</h2>
                <dl><div><dt>Created</dt><dd>{formatDate(record.createdAt)}</dd></div><div><dt>OpenAlex source</dt><dd>{record.journal.openAlexId}</dd></div><div><dt>Publications retained</dt><dd>{formatNumber(record.provenance.archivedPublications)}</dd></div><div><dt>Integrity reference</dt><dd>{payload.contentHash}</dd></div></dl>
                <a href={payload.permanentUrl} target="_blank" rel="noreferrer">View independent copy <GsiIcon name="external" size={15} /></a>
              </aside>
            </section>

            <section className="gsi-public-impact-card">
              <div className="gsi-public-impact-heading">
                <div><span>Proof of local impact</span><h2>Policy and practice evidence</h2></div>
                <span className={`gsi-impact-verification ${impactEvidence?.verificationStatus === "self-reported" ? "is-reported" : ""}`}><GsiIcon name="shield" size={15} /> {impactEvidence?.verificationStatus === "self-reported" ? "Self-reported" : "Not provided"}</span>
              </div>
              {impactEvidence?.verificationStatus === "self-reported" ? (
                <>
                  <div className="gsi-public-impact-metrics">
                    <div><span>Government policy mentions</span><strong>{formatNumber(impactEvidence.policyMentions)}</strong></div>
                    <div><span>NGO / programme adoptions</span><strong>{formatNumber(impactEvidence.ngoAdoptions)}</strong></div>
                    <div><span>Local open-access citations</span><strong>{formatNumber(impactEvidence.localCitations)}</strong></div>
                  </div>
                  {impactEvidence.summary ? <p>{impactEvidence.summary}</p> : null}
                  <a href={impactEvidence.sourceUrl} target="_blank" rel="noreferrer">Review the submitted public source <GsiIcon name="external" size={15} /></a>
                  <small>These counts were attested by the submitter and contribute to the score, but have not yet been independently verified by GSI.</small>
                </>
              ) : <p>No local-impact evidence was submitted. The score assigns zero points to this category instead of estimating impact from global citations.</p>}
            </section>

            <section className="gsi-publications-card gsi-public-record-publications">
              <div className="gsi-card-heading"><div><span>Archived evidence</span><h2>Reviewed publications</h2></div><span className="gsi-source-badge">Source: OpenAlex</span></div>
              <div className="gsi-publication-list">{record.publications.slice(0, 20).map((work) => <article key={work.id}><div className="gsi-publication-icon"><GsiIcon name="file" size={18} /></div><div className="gsi-publication-main"><h3>{work.title}</h3><p>{work.authors?.slice(0, 3).map((author) => author.displayName).join(", ") || "Authors not listed"}</p></div><div className="gsi-publication-meta"><span>{work.publicationYear || "—"}</span><small>{work.doi ? "DOI present" : "No DOI returned"}</small></div></article>)}</div>
            </section>
          </>
        ) : null}
      </main>
      <footer className="gsi-footer"><span>Built by <strong>Team Archive</strong> for GSI Buildathon 2026</span><span>Evidence imported from OpenAlex · Hosted by Tengacion</span></footer>
    </div>
  );
}
