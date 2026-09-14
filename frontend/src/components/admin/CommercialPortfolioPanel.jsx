import {useState} from "react";
import {apiRequest, API_BASE} from "../../api";
const label = value => String(value || "").replaceAll("_", " ");
export function CommercialRevisionPanel({recordId}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true); setError("");
    try { setData(await apiRequest(API_BASE + "/external-readiness/records/" + encodeURIComponent(recordId) + "/revisions")); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <section aria-label="Commercial revision history">
    <h3>Prior saved versions</h3>
    <button type="button" onClick={load} disabled={busy}>{busy ? "Loading prior versions..." : "Load prior saved versions"}</button>
    {error && <p role="alert">{error}</p>}
    {data && <>
      {!data.revisions.length && <p>No prior saved versions.</p>}
      {data.truncated && <p>Showing the latest 100 prior versions.</p>}
      {data.revisions.map(revision => <details key={revision.version}><summary>Version {revision.version}: {revision.snapshot.title}</summary>
        <p>{revision.snapshot.commercial?.hypothesis}</p>
        <p>State: {label(revision.snapshot.commercial?.state)}. Budget: {revision.snapshot.commercial?.budgetLimit ?? "Unknown"} {revision.snapshot.commercial?.currency}</p>
        <pre>{JSON.stringify({workflow: revision.snapshot.commercial, financial: revision.snapshot.financial, evidence: revision.snapshot.evidence}, null, 2)}</pre>
      </details>)}
    </>}
  </section>;
}
export default function CommercialPortfolioPanel({portfolios = [], onOpen}) {
  if (!portfolios.length) { return null; }
  return <section aria-label="Commercial portfolio">
    <h3>Capital, Distribution and Revenue portfolio</h3>
    {portfolios.map(portfolio => <details key={portfolio.cycle}><summary>{label(portfolio.cycle)}: {portfolio.reviewedRecords} reviewed of {portfolio.records} records</summary>
      {portfolio.missingCandidates.length > 0 && <p>Candidates awaiting reviewed scorecards: {portfolio.missingCandidates.map(label).join(", ")}.</p>}
      {portfolio.limitations.map(message => <p key={message}>{message}</p>)}
      {portfolio.ranking.length > 0 && <ol>{portfolio.ranking.map(candidate => <li key={candidate.recordId}>
        <button type="button" onClick={() => onOpen(candidate.recordId)}>{candidate.subject}</button>: {candidate.score ?? "Awaiting review"}
      </li>)}</ol>}
      {portfolio.pilots.length > 0 && <table>
        <thead><tr>{["Pilot", "Effective state", "Decision", "Budget", "Spend", "Blockers"].map(title => <th key={title}>{title}</th>)}</tr></thead>
        <tbody>{portfolio.pilots.map(pilot => <tr key={pilot.recordId}>
          <td><button type="button" onClick={() => onOpen(pilot.recordId)}>{pilot.subject}</button></td>
          <td>{label(pilot.effectiveState)}</td><td>{label(pilot.decision) || "Pending"}</td>
          <td>{pilot.budgetLimit ?? "Unknown"} {pilot.currency}</td><td>{pilot.spendToDate ?? "Unknown"} {pilot.currency}</td>
          <td>{pilot.blockers.map(label).join("; ") || "None recorded"}</td>
        </tr>)}</tbody>
      </table>}
    </details>)}
  </section>;
}