import { useCallback, useEffect, useState } from "react";

import SeoHead from "../../components/seo/SeoHead";
import BrightFutureLayout from "./BrightFutureLayout";
import { CANONICAL_ROOT, CLASS_GROUPS, NIGERIAN_STATES } from "./brightFutureData";
import { getBrightFutureLeaderboard, getBrightFutureParticipants } from "./brightFutureApi";
import useBrightFuture from "./useBrightFuture";

const formatDuration = (seconds = 0) => {
  const minutes = Math.floor(Number(seconds || 0) / 60);
  return `${minutes}m ${Math.round(Number(seconds || 0) % 60)}s`;
};

export function BrightFutureLeaderboardPage() {
  const { candidate } = useBrightFuture();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ entries: [], total: 0, page: 1, pages: 1, leader: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await getBrightFutureLeaderboard({ search: appliedSearch, page, limit: 25 })); }
    catch (requestError) { setError(requestError.message || "Leaderboard unavailable."); }
    finally { setLoading(false); }
  }, [appliedSearch, page]);
  useEffect(() => { load(); }, [load]);
  return (
    <BrightFutureLayout portal={Boolean(candidate)} activeKey="leaderboard">
      <SeoHead title="CBT Leaderboard | Bright Future Academy" description="View privacy-safe, server-verified standings for the Bright Future Academy National CBT Challenge." canonical={`${CANONICAL_ROOT}/leaderboard`} robots="index,follow" />
      <header className="bfa-public-page-heading"><p className="bfa-eyebrow">Live national standings</p><h1>Competition leaderboard</h1><p>Rankings come only from completed database attempts: highest score, then Mathematics, English and shortest legitimate completion time.</p></header>
      {data.leader ? <section className="bfa-champion-card"><div className="bfa-champion-card__stars" aria-hidden="true">✦ ◆ ✦</div><span>♛</span><div><small>{data.competition?.competitionStatus === "results_published" ? "Bright Future Academy CBT Champion" : "Current Overall Leader"}</small><h2>{data.leader.displayName}</h2><p>{data.leader.classLevel} · {data.leader.schoolName} · {data.leader.state}</p></div><strong>{data.leader.score}<small>/40</small><i>{data.leader.percentage}%</i></strong></section> : null}
      <section className="bfa-leaderboard-panel">
        <div className="bfa-leaderboard-toolbar"><div><h2>Verified rankings</h2><p>{data.total.toLocaleString()} completed candidate{data.total === 1 ? "" : "s"}</p></div><form onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedSearch(search); }}><label><span>⌕</span><input aria-label="Search leaderboard" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, Candidate ID or school" /></label><button type="submit">Search</button></form></div>
        {error ? <div className="bfa-alert" role="alert">{error}</div> : null}
        {loading ? <div className="bfa-table-loader"><span /><p>Loading verified standings…</p></div> : (
          <div className="bfa-leaderboard-table" role="table" aria-label="Competition leaderboard">
            <div className="bfa-leaderboard-row is-head" role="row"><span>Rank</span><span>Candidate</span><span>Class</span><span>School / State</span><span>Score</span><span>Time</span></div>
            {data.entries.map((entry) => <div className={`bfa-leaderboard-row ${entry.rank <= 3 ? `is-top is-place-${entry.rank}` : ""}`} role="row" key={`${entry.rank}-${entry.candidateId}`}><span><i>{entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}</i></span><span><strong>{entry.displayName}</strong><small>{entry.candidateId}</small></span><span>{entry.classLevel}</span><span><strong>{entry.schoolName}</strong><small>{entry.state}</small></span><span><strong>{entry.score}/40</strong><small>{entry.percentage}%</small></span><span>{formatDuration(entry.completionTime)}</span></div>)}
            {!data.entries.length ? <div className="bfa-panel-empty">No completed results match this search yet.</div> : null}
          </div>
        )}
        <div className="bfa-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page {data.page || page} of {data.pages || 1}</span><button type="button" disabled={page >= (data.pages || 1)} onClick={() => setPage((value) => value + 1)}>Next →</button></div>
      </section>
      <div className="bfa-privacy-note"><span>◇</span><p><strong>Privacy-first public rankings</strong>Phone numbers, ages, registration metadata and integrity details are visible only to authorised Tengacion administrators.</p></div>
    </BrightFutureLayout>
  );
}

export function BrightFutureParticipantsPage() {
  const { candidate } = useBrightFuture();
  const [filters, setFilters] = useState({ search: "", classLevel: "", state: "", school: "", completed: "", minScore: "", maxScore: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ participants: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    getBrightFutureParticipants({ ...applied, page, limit: 24 }).then(setData).catch(() => setData({ participants: [], total: 0, pages: 1 })).finally(() => setLoading(false));
  }, [applied, page]);
  const update = (event) => setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  return (
    <BrightFutureLayout portal={Boolean(candidate)}>
      <SeoHead title="Participating Students | Bright Future Academy" description="Discover schools, classes and states represented in the Bright Future Academy National CBT Challenge without exposing private student information." canonical={`${CANONICAL_ROOT}/participants`} robots="index,follow" />
      <header className="bfa-public-page-heading"><p className="bfa-eyebrow">National participation</p><h1>Participating students</h1><p>Explore public competition participation while private information for minors remains protected.</p></header>
      <form className="bfa-participant-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(filters); }}><label className="is-wide">Search<input name="search" value={filters.search} onChange={update} placeholder="Public name, Candidate ID or school" /></label><label>Class<select name="classLevel" value={filters.classLevel} onChange={update}><option value="">All classes</option>{CLASS_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{group.values.map((value) => <option key={value}>{value}</option>)}</optgroup>)}</select></label><label>State<select name="state" value={filters.state} onChange={update}><option value="">All states</option>{NIGERIAN_STATES.map((state) => <option key={state}>{state}</option>)}</select></label><label>Exam status<select name="completed" value={filters.completed} onChange={update}><option value="">Any status</option><option value="true">Completed</option><option value="false">Not completed</option></select></label><label>Min score<input type="number" name="minScore" min="0" max="40" value={filters.minScore} onChange={update} /></label><label>Max score<input type="number" name="maxScore" min="0" max="40" value={filters.maxScore} onChange={update} /></label><button type="submit" className="bfa-button bfa-button--primary">Apply filters</button></form>
      <div className="bfa-participant-summary"><strong>{data.total.toLocaleString()}</strong><span>public participant records</span></div>
      {loading ? <div className="bfa-table-loader"><span /><p>Loading participating students…</p></div> : <div className="bfa-participant-grid">{data.participants.map((entry, index) => <article key={`${entry.candidateId}-${index}`}><div className="bfa-public-avatar">{entry.displayName.slice(0, 1)}</div><span className={`bfa-status-badge is-${entry.completed ? "green" : "gray"}`}><i />{entry.completed ? "Completed" : "Registered"}</span><h2>{entry.displayName}</h2><small>{entry.candidateId}</small><dl><div><dt>Class</dt><dd>{entry.classLevel}</dd></div><div><dt>School</dt><dd>{entry.schoolName}</dd></div><div><dt>State</dt><dd>{entry.state}</dd></div>{entry.completed ? <div><dt>Score</dt><dd>{entry.score}/40 · {entry.percentage}%</dd></div> : null}</dl></article>)}{!data.participants.length ? <div className="bfa-panel-empty">No public participants match these filters.</div> : null}</div>}
      <div className="bfa-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page {page} of {data.pages || 1}</span><button type="button" disabled={page >= (data.pages || 1)} onClick={() => setPage((value) => value + 1)}>Next →</button></div>
    </BrightFutureLayout>
  );
}
