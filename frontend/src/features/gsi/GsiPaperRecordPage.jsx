import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SeoHead from "../../components/seo/SeoHead";
import GsiIcon from "./GsiIcons";
import { getGsiPaperRecord } from "./gsiApi";
import { formatCountry, formatNumber } from "./gsiFormatters";
import "./gsi.css";

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(date);
};

export default function GsiPaperRecordPage() {
  const { recordId } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    getGsiPaperRecord(recordId)
      .then((payload) => { if (active) { setRecord(payload.record); } })
      .catch((requestError) => { if (active) { setError(requestError.message); } })
      .finally(() => { if (active) { setLoading(false); } });
    return () => { active = false; };
  }, [recordId]);

  const paper = record?.paper;
  const impact = record?.impactEvidence;
  return (
    <div className="gsi-app-shell gsi-record-page">
      <SeoHead title={paper ? `${paper.title} | GSI Paper Record` : "GSI Paper Record"} description="A public paper-level record with transparent GSI scoring and disclosed local-impact evidence." canonical={`/gsi/papers/${recordId}`} robots="index,follow" />
      <header className="gsi-header"><Link className="gsi-brand" to="/gsi"><span className="gsi-brand-mark"><GsiIcon name="book" size={24} /></span><span><strong>Global South Index</strong><small>Paper Record</small></span></Link><nav className="gsi-header-meta"><Link to="/gsi/research">Browse research</Link><Link className="gsi-secondary-button gsi-header-action" to="/gsi/papers/new">Submit a paper</Link></nav></header>
      <main className="gsi-record-main">
        {loading ? <div className="gsi-record-loading"><span className="gsi-spinner gsi-spinner-dark" /><h1>Loading the paper record…</h1></div> : null}
        {!loading && error ? <div className="gsi-record-loading"><GsiIcon name="info" size={30} /><h1>Paper record not available</h1><p>{error}</p><Link className="gsi-primary-button" to="/gsi/research">Browse research</Link></div> : null}
        {record ? <>
          <div className="gsi-record-verified"><GsiIcon name="globe" size={17} /> Public paper-level record</div>
          <section className="gsi-public-record-hero gsi-paper-record-hero"><div><span>Global South Index · Paper record</span><h1>{paper.title}</h1><p>{paper.authors.join(", ")}</p><dl><div><dt>Field</dt><dd>{paper.field}</dd></div><div><dt>Country</dt><dd>{formatCountry(paper.countryCode)}</dd></div><div><dt>Year</dt><dd>{paper.publicationYear}</dd></div></dl></div><div className="gsi-public-score"><strong>{record.gsiScore.total}</strong><span>out of 100</span><small>GSI Score</small></div></section>
          <section className="gsi-paper-record-summary"><div><span>Abstract</span><h2>About this research</h2><p>{paper.abstract}</p></div><aside><dl><div><dt>Institution</dt><dd>{paper.institution || "Not provided"}</dd></div><div><dt>Journal / venue</dt><dd>{paper.journalName || "Not provided"}</dd></div><div><dt>DOI</dt><dd>{paper.doi || "Not provided"}</dd></div><div><dt>Added to GSI</dt><dd>{formatDate(record.confirmedAt)}</dd></div><div><dt>Record reference</dt><dd>{record.publicId}</dd></div></dl>{paper.openAccessUrl ? <a href={paper.openAccessUrl} target="_blank" rel="noreferrer">Read public full text <GsiIcon name="external" size={15} /></a> : null}{paper.doi ? <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">Open DOI <GsiIcon name="external" size={15} /></a> : null}</aside></section>
          <section className="gsi-public-record-grid"><div className="gsi-score-breakdown gsi-public-score-breakdown"><div className="gsi-card-heading"><div><span>Transparent score</span><h2>Evidence breakdown</h2></div><b>{record.gsiScore.total}/100</b></div>{record.gsiScore.components.map((component) => <div className="gsi-public-component" key={component.key}><div><strong>{component.label}</strong><span>{component.explanation}</span></div><b>{component.score}<small>/{component.weight}</small></b></div>)}<div className="gsi-public-fairness"><GsiIcon name="shield" /><p>{record.gsiScore.fairnessNote}</p></div></div><aside className="gsi-record-certificate"><span><GsiIcon name="file" size={23} /></span><small>Record context</small><h2>What this record means</h2><p>This is submitter-provided paper metadata published to the GSI research registry after an explicit review step.</p><dl><div><dt>Scoring method</dt><dd>{record.gsiScore.version}</dd></div><div><dt>Local impact status</dt><dd>{impact?.verificationStatus === "self-reported" ? "Self-reported with public source" : "Not provided"}</dd></div></dl></aside></section>
          <section className="gsi-public-impact-card"><div className="gsi-public-impact-heading"><div><span>Proof of local impact</span><h2>Policy and practice evidence</h2></div><span className={`gsi-impact-verification ${impact?.verificationStatus === "self-reported" ? "is-reported" : ""}`}><GsiIcon name="shield" size={15} /> {impact?.verificationStatus === "self-reported" ? "Self-reported" : "Not provided"}</span></div>{impact?.verificationStatus === "self-reported" ? <><div className="gsi-public-impact-metrics"><div><span>Policy mentions</span><strong>{formatNumber(impact.policyMentions)}</strong></div><div><span>NGO / programme adoptions</span><strong>{formatNumber(impact.ngoAdoptions)}</strong></div><div><span>Local citations</span><strong>{formatNumber(impact.localCitations)}</strong></div></div>{impact.summary ? <p>{impact.summary}</p> : null}<a href={impact.sourceUrl} target="_blank" rel="noreferrer">Review the submitted source <GsiIcon name="external" size={15} /></a><small>Claims are submitter-attested and have not yet been independently verified by GSI.</small></> : <p>No local-impact evidence was submitted. The score assigns zero points to this category rather than estimating impact from global citations.</p>}</section>
        </> : null}
      </main>
      <footer className="gsi-footer"><span>Built by <strong>Team Archive</strong> for GSI Buildathon 2026</span><span>Public research discovery · Hosted by Tengacion</span></footer>
    </div>
  );
}
