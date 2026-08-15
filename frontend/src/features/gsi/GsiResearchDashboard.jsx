import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SeoHead from "../../components/seo/SeoHead";
import GsiIcon from "./GsiIcons";
import { listGsiResearch } from "./gsiApi";
import { formatCountry, formatNumber } from "./gsiFormatters";
import "./gsi.css";

const EMPTY_FILTERS = { q: "", type: "", field: "", country: "" };
const RECORD_KIND_LABELS = {
  journal: "Journal",
  paper: "Submitted paper",
  "journal-work": "Journal publication",
};

export default function GsiResearchDashboard() {
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState({
    results: [],
    pagination: { total: 0, pages: 1 },
    counts: { totalPublicRecords: 0, journals: 0, papers: 0, journalWorks: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setPayload(await listGsiResearch({ ...filters, page })); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const search = (event) => {
    event.preventDefault();
    setPage(1);
    setFilters({ ...draft });
  };
  const clear = () => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(1); };
  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));
  const hasFilters = Object.values(filters).some(Boolean);
  const counts = payload.counts || {
    totalPublicRecords: payload.pagination.total,
    journals: 0,
    papers: 0,
    journalWorks: 0,
  };

  return (
    <div className="gsi-app-shell gsi-dashboard-page">
      <SeoHead title="Browse Global South Research | GSI" description="Search and browse public paper and journal records in the Global South Index." canonical="/gsi/research" robots="index,follow" />
      <header className="gsi-header"><Link className="gsi-brand" to="/gsi"><span className="gsi-brand-mark"><GsiIcon name="book" size={24} /></span><span><strong>Global South Index</strong><small>Research Registry</small></span></Link><nav className="gsi-header-meta" aria-label="GSI actions"><Link to="/gsi">Index a journal</Link><Link className="gsi-primary-button gsi-header-submit" to="/gsi/papers/new">Submit a paper</Link></nav></header>
      <main className="gsi-dashboard-main">
        <section className="gsi-dashboard-hero"><div><div className="gsi-eyebrow"><GsiIcon name="globe" size={15} /> Public research dashboard</div><h1>Research you can find, understand, and trace.</h1><p>Browse submitted papers, journal records, and publications retained in permanent journal evidence - with no prestige-based ranking.</p></div><div className="gsi-dashboard-counts" aria-label="Public registry totals"><div className="gsi-dashboard-total"><strong>{formatNumber(counts.totalPublicRecords)}</strong><span>Total public entries</span></div><div><strong>{formatNumber(counts.journals)}</strong><span>Indexed journals</span></div><div><strong>{formatNumber(counts.papers)}</strong><span>Submitted papers</span></div><div><strong>{formatNumber(counts.journalWorks)}</strong><span>Journal publications</span></div></div></section>
        <form className="gsi-dashboard-filters" onSubmit={search}>
          <label className="gsi-dashboard-search"><GsiIcon name="search" size={19} /><input value={draft.q} onChange={update("q")} placeholder="Search title, author, journal, topic, country, or DOI" aria-label="Search research" /></label>
          <select value={draft.type} onChange={update("type")} aria-label="Record type"><option value="">All record types</option><option value="paper">Submitted papers</option><option value="journal-work">Journal publications</option><option value="journal">Journals</option></select>
          <input value={draft.field} onChange={update("field")} placeholder="Research field" aria-label="Research field" />
          <input value={draft.country} onChange={update("country")} maxLength={2} placeholder="Country code" aria-label="Country code" />
          <button className="gsi-primary-button" type="submit">Search</button>
        </form>
        {hasFilters ? <div className="gsi-active-filter-row"><span>{formatNumber(payload.pagination.total)} matching records</span><button type="button" onClick={clear}>Clear filters</button></div> : null}
        {loading ? <div className="gsi-dashboard-state"><span className="gsi-spinner gsi-spinner-dark" /><h2>Loading public research…</h2></div> : null}
        {!loading && error ? <div className="gsi-dashboard-state"><GsiIcon name="info" size={28} /><h2>Could not load the registry</h2><p>{error}</p><button className="gsi-secondary-button" type="button" onClick={load}>Try again</button></div> : null}
        {!loading && !error && !payload.results.length ? <div className="gsi-dashboard-state"><GsiIcon name="search" size={30} /><h2>{hasFilters ? "No records match those filters" : "The public registry is ready"}</h2><p>{hasFilters ? "Try a broader keyword or clear one of the filters." : "Submit the first paper, or publish a journal record from the onboarding flow."}</p><Link className="gsi-primary-button" to="/gsi/papers/new">Submit a paper</Link></div> : null}
        {!loading && !error && payload.results.length ? <section className="gsi-research-grid" aria-label="Research records">{payload.results.map((record) => {
          const isJournalWork = record.recordKind === "journal-work";
          return <article className="gsi-research-card" key={record.archiveId}><div className="gsi-research-card-top"><span className={`gsi-record-kind is-${record.recordKind}`}><GsiIcon name={record.recordKind === "journal" ? "book" : "file"} size={14} /> {RECORD_KIND_LABELS[record.recordKind] || record.recordKind}</span><div className="gsi-card-score"><strong>{record.gsiScore}</strong><small>{isJournalWork ? "/100 journal" : "/100"}</small></div></div><h2><Link to={record.publicRecordPath}>{record.title}</Link></h2><p className="gsi-research-byline">{record.subtitle || (record.recordKind === "journal" ? "Publisher not listed" : "Authors not listed")}</p>{isJournalWork && record.journalName ? <p className="gsi-research-journal">Published in {record.journalName}</p> : null}{record.abstract ? <p className="gsi-research-abstract">{record.abstract}</p> : null}<dl><div><dt>Field</dt><dd>{record.field || "Multidisciplinary"}</dd></div><div><dt>Country</dt><dd>{formatCountry(record.countryCode)}</dd></div>{record.publicationYear ? <div><dt>Year</dt><dd>{record.publicationYear}</dd></div> : null}</dl><div className="gsi-research-card-footer"><span><GsiIcon name="shield" size={14} /> {isJournalWork ? "OpenAlex - parent journal evidence" : record.impactEvidenceStatus === "self-reported" ? "Impact evidence disclosed" : "No impact claim"}</span><Link to={record.publicRecordPath}>{isJournalWork ? "View journal evidence" : "View record"} <GsiIcon name="arrow" size={14} /></Link></div></article>;
        })}</section> : null}
        {!loading && payload.pagination.pages > 1 ? <nav className="gsi-pagination" aria-label="Research result pages"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {payload.pagination.pages}</span><button type="button" disabled={page >= payload.pagination.pages} onClick={() => setPage((value) => value + 1)}>Next</button></nav> : null}
      </main>
      <footer className="gsi-footer"><span>Built by <strong>Team Archive</strong> for GSI Buildathon 2026</span><span>Transparent discovery · Hosted by Tengacion</span></footer>
    </div>
  );
}
