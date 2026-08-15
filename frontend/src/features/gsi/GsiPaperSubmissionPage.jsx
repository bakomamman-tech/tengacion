import { useState } from "react";
import { Link } from "react-router-dom";
import SeoHead from "../../components/seo/SeoHead";
import GsiIcon from "./GsiIcons";
import { calculateGsiPaperScore, publishGsiPaper } from "./gsiApi";
import "./gsi.css";

const EMPTY_PAPER = {
  title: "", abstract: "", field: "", authors: "", institution: "",
  countryCode: "", publicationYear: String(new Date().getFullYear()),
  doi: "", openAccessUrl: "", journalName: "",
};
const EMPTY_IMPACT = {
  policyMentions: "", ngoAdoptions: "", localCitations: "",
  sourceUrl: "", summary: "", attested: false,
};

function PaperHeader() {
  return (
    <header className="gsi-header">
      <Link className="gsi-brand" to="/gsi"><span className="gsi-brand-mark"><GsiIcon name="book" size={24} /></span><span><strong>Global South Index</strong><small>Research Registry</small></span></Link>
      <nav className="gsi-header-meta" aria-label="GSI sections"><Link to="/gsi/research">Browse research</Link><Link to="/gsi">Index a journal</Link></nav>
    </header>
  );
}

export default function GsiPaperSubmissionPage() {
  const [paper, setPaper] = useState(EMPTY_PAPER);
  const [impactEvidence, setImpactEvidence] = useState(EMPTY_IMPACT);
  const [scorePayload, setScorePayload] = useState(null);
  const [saved, setSaved] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updatePaper = (key) => (event) => setPaper((current) => ({ ...current, [key]: event.target.value }));
  const updateImpact = (key) => (event) => setImpactEvidence((current) => ({
    ...current,
    [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
  }));

  const calculate = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const payload = await calculateGsiPaperScore(paper, impactEvidence);
      setScorePayload(payload);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  };

  const publish = async () => {
    setBusy(true); setError("");
    try {
      const payload = await publishGsiPaper(scorePayload.paper, scorePayload.impactEvidence);
      setSaved(payload);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="gsi-app-shell gsi-portal-page">
      <SeoHead title="Submit a Paper | Global South Index" description="Add paper-level research metadata, see its transparent GSI Score, and publish it to the public research registry." canonical="/gsi/papers/new" robots="index,follow" />
      <PaperHeader />
      <main className="gsi-portal-main">
        {saved ? (
          <section className="gsi-paper-success">
            <span className="gsi-success-mark"><GsiIcon name="check" size={34} /></span>
            <div className="gsi-eyebrow">Paper indexed</div>
            <h1>Your research is now discoverable.</h1>
            <p>The public record preserves the submitted metadata, score breakdown, and any disclosed local-impact evidence.</p>
            <div className="gsi-success-actions"><Link className="gsi-primary-button" to={saved.publicRecordPath}>View paper record <GsiIcon name="arrow" size={17} /></Link><Link className="gsi-secondary-button" to="/gsi/research">Browse the registry</Link></div>
          </section>
        ) : !scorePayload ? (
          <>
            <section className="gsi-portal-hero"><div className="gsi-eyebrow">Paper-level submission</div><h1>Make one research paper visible on its own terms.</h1><p>Submit public scholarly metadata, document local use where evidence exists, and review the score before anything becomes public.</p></section>
            <form className="gsi-paper-form" onSubmit={calculate}>
              <section className="gsi-form-section"><div className="gsi-card-heading"><div><span>Core record</span><h2>Paper details</h2></div><small>Required fields are marked *</small></div><div className="gsi-field-grid gsi-paper-fields">
                <label className="gsi-field gsi-field-full"><span>Paper title *</span><input value={paper.title} onChange={updatePaper("title")} required minLength={8} /></label>
                <label className="gsi-field gsi-field-full"><span>Abstract *</span><textarea value={paper.abstract} onChange={updatePaper("abstract")} required minLength={80} maxLength={5000} placeholder="At least 80 characters" /></label>
                <label className="gsi-field"><span>Research field *</span><input value={paper.field} onChange={updatePaper("field")} required placeholder="Public health, agriculture, education…" /></label>
                <label className="gsi-field"><span>Publication year *</span><input type="number" min="1900" max={new Date().getFullYear() + 1} value={paper.publicationYear} onChange={updatePaper("publicationYear")} required /></label>
                <label className="gsi-field gsi-field-full"><span>Authors *</span><input value={paper.authors} onChange={updatePaper("authors")} required placeholder="Separate names with commas" /></label>
                <label className="gsi-field"><span>Institution</span><input value={paper.institution} onChange={updatePaper("institution")} /></label>
                <label className="gsi-field"><span>Research country code *</span><input value={paper.countryCode} onChange={updatePaper("countryCode")} maxLength={2} required placeholder="NG" /></label>
                <label className="gsi-field"><span>DOI</span><input value={paper.doi} onChange={updatePaper("doi")} placeholder="10.1234/example" /></label>
                <label className="gsi-field"><span>Journal or venue</span><input value={paper.journalName} onChange={updatePaper("journalName")} /></label>
                <label className="gsi-field gsi-field-full"><span>Public full-text link</span><input type="url" value={paper.openAccessUrl} onChange={updatePaper("openAccessUrl")} placeholder="https://repository.example/paper" /></label>
              </div></section>
              <section className="gsi-form-section"><div className="gsi-card-heading"><div><span>Optional evidence</span><h2>Documented local impact</h2></div><b>30 points</b></div><p className="gsi-section-intro">Add claims only when one public source supports them. They remain visibly marked as self-reported.</p><div className="gsi-field-grid">
                <label className="gsi-field"><span>Policy mentions</span><input type="number" min="0" value={impactEvidence.policyMentions} onChange={updateImpact("policyMentions")} /></label>
                <label className="gsi-field"><span>NGO / programme adoptions</span><input type="number" min="0" value={impactEvidence.ngoAdoptions} onChange={updateImpact("ngoAdoptions")} /></label>
                <label className="gsi-field"><span>Local citations</span><input type="number" min="0" value={impactEvidence.localCitations} onChange={updateImpact("localCitations")} /></label>
                <label className="gsi-field gsi-field-full"><span>Public evidence link</span><input type="url" value={impactEvidence.sourceUrl} onChange={updateImpact("sourceUrl")} placeholder="https://" /></label>
                <label className="gsi-field gsi-field-full"><span>Impact context</span><textarea value={impactEvidence.summary} onChange={updateImpact("summary")} maxLength={700} /></label>
              </div><label className="gsi-impact-attestation"><input type="checkbox" checked={impactEvidence.attested} onChange={updateImpact("attested")} /><span><GsiIcon name="check" size={15} /></span><strong>I confirm that any impact claims are accurate and supported by the linked public source.</strong></label></section>
              {error ? <div className="gsi-notice gsi-notice-error" role="alert"><GsiIcon name="info" /><div><strong>Check the submission</strong><span>{error}</span></div></div> : null}
              <div className="gsi-paper-form-actions"><Link className="gsi-secondary-button" to="/gsi/research">Cancel</Link><button className="gsi-primary-button" disabled={busy} type="submit">{busy ? <><span className="gsi-spinner" /> Calculating…</> : <>Review transparent score <GsiIcon name="arrow" size={17} /></>}</button></div>
            </form>
          </>
        ) : (
          <section className="gsi-paper-review">
            <div className="gsi-portal-hero"><div className="gsi-eyebrow">Review before publishing</div><h1>{scorePayload.paper.title}</h1><p>{scorePayload.score.summary}</p></div>
            <div className="gsi-score-hero"><div className="gsi-score-ring" style={{ "--score": scorePayload.score.total }}><div><strong>{scorePayload.score.total}</strong><span>out of 100</span></div></div><div className="gsi-score-narrative"><span>Paper-level GSI Score</span><h2>Every point is traceable.</h2><p>{scorePayload.score.methodologyNote}</p></div></div>
            <div className="gsi-score-breakdown gsi-paper-score-breakdown"><div className="gsi-card-heading"><div><span>Score breakdown</span><h2>How the score was earned</h2></div><b>{scorePayload.score.total}/100</b></div>{scorePayload.score.components.map((component) => <div className="gsi-public-component" key={component.key}><div><strong>{component.label}</strong><span>{component.explanation}</span></div><b>{component.score}<small>/{component.weight}</small></b></div>)}<div className="gsi-public-fairness"><GsiIcon name="shield" /><p>{scorePayload.score.fairnessNote}</p></div></div>
            <div className="gsi-public-consent"><GsiIcon name="globe" size={22} /><div><strong>This is a public research record</strong><p>The title, abstract, authors, score, and submitted evidence will be visible in the GSI registry. You can go back and edit before publishing.</p></div></div>
            <label className="gsi-confirm-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><GsiIcon name="check" size={15} /></span><strong>I reviewed these details and have permission to add them to the public registry.</strong></label>
            {error ? <div className="gsi-notice gsi-notice-error" role="alert"><GsiIcon name="info" /><div><strong>Could not publish</strong><span>{error}</span></div></div> : null}
            <div className="gsi-paper-form-actions"><button className="gsi-secondary-button" type="button" onClick={() => { setScorePayload(null); setConfirmed(false); }}>Back to edit</button><button className="gsi-publish-button" type="button" onClick={publish} disabled={!confirmed || busy}>{busy ? <><span className="gsi-spinner" /> Publishing…</> : <><GsiIcon name="globe" size={18} /> Publish paper record</>}</button></div>
          </section>
        )}
      </main>
      <footer className="gsi-footer"><span>Built by <strong>Team Archive</strong> for GSI Buildathon 2026</span><span>Public research discovery · Hosted by Tengacion</span></footer>
    </div>
  );
}
