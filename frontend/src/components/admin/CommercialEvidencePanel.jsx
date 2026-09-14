import {useState} from "react";
import {apiRequest, API_BASE} from "../../api";
export default function CommercialEvidencePanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true); setError("");
    try { setData(await apiRequest(API_BASE + "/external-readiness/commercial/evidence")); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <section aria-label="Commercial operating evidence">
    <h3>Server operating evidence</h3>
    <button type="button" disabled={busy} onClick={load}>{busy ? "Loading operating evidence..." : "Load current operating evidence"}</button>
    {error && <p role="alert">{error}</p>}
    {data && <>
      <p>Generated {new Date(data.generatedAt).toLocaleString()}. {data.completeness.complete ? "Bounded source reads are complete." : "Source reads are incomplete; use the reported limits."}</p>
      <h4>Purchase cohorts by currency and category</h4>
      {!data.revenue.length ? <p>No purchase evidence in this window.</p> : <table>
        <thead><tr>{["Currency", "Category", "Paid orders", "Gross paid amount", "Creator share estimate", "Platform share estimate", "Refunded orders", "Failed orders"].map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{data.revenue.map(row => <tr key={row.currency + row.category}>
          <td>{row.currency}</td><td>{row.category}</td><td>{row.paidOrders}</td><td>{row.grossPaidAmount ?? "Unknown"}</td>
          <td>{row.creatorEarningsEstimate ?? "Unknown"}</td><td>{row.platformRevenueEstimate ?? "Unknown"}</td><td>{row.refundedOrders}</td><td>{row.failedOrders}</td>
        </tr>)}</tbody>
      </table>}
      <p>Share estimates use stored purchase rates and require finance reconciliation before external use.</p>
      <h4>Fan retention</h4>
      {[1, 7, 14, 30].map(day => {
        const eligible = data.retention.summary?.["d" + day + "Eligible"] || 0;
        const rate = data.retention.summary?.["d" + day + "RetentionRate"];
        return <p key={day}>D{day}: {eligible > 0 && Number.isFinite(rate) ? (rate * 100).toFixed(1) + "%" : "No mature evidence"} ({eligible} eligible cohort entries)</p>;
      })}
      <h4>Referral source evidence</h4>
      <p>{data.referrals.scope}</p>
      <ul>{(data.referrals.bySource || []).map(source => <li key={source.sourceType}>
        {source.sourceType}: {source.linkOpened} opens, {source.firstPurchase} purchase milestones, {source.d7Return} D7 return milestones
      </li>)}</ul>
      <h4>Measurement limits</h4>
      <ul>{data.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
    </>}
  </section>;
}