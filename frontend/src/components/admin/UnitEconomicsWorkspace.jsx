const human = (value = "") => value.replace(/_/g, " ").replace(/([A-Z])/g, " $1");
const display = (value) => value === null || value === undefined ? "Incomplete / unavailable" : typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : human(value);

export default function UnitEconomicsWorkspace({ value = {}, onChange, config, evidence = [], defaultOwner, analysis, dirty }) {
  if (!config) { return <p>Unit economics configuration unavailable. Refresh the inventory.</p>; }
  const set = (key, next) => onChange({ ...value, [key]: next });
  const update = (group, key, changes) => {
    const rows = value[group] || [];
    const row = rows.find((r) => r.key === key) || { key, owner: defaultOwner, ...(group === "assumptions" ? { confidence: "incomplete", evidenceIndexes: [] } : {}) };
    set(group, [...rows.filter((r) => r.key !== key), { ...row, ...changes }]);
  };
  const field = (group, row, key, title, type = "text", options = {}) => <label key={key}>{title}<input {...options} type={type} value={row[key] ?? ""} onChange={(e) => update(group, row.key, { [key]: type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value })} /></label>;
  const condition = (group, row) => <div className="readiness-grid">
    <label>Scenario<select value={row.scenario || ""} onChange={(e) => update(group, row.key, { scenario: e.target.value })}><option value="">Select a scenario</option>{config.scenarios.filter((s) => group !== "allocationGates" || s !== "base").map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
    <label>Metric<select value={row.metric || ""} onChange={(e) => update(group, row.key, { metric: e.target.value })}><option value="">Select a metric</option>{config.metrics.map((m) => <option key={m} value={m}>{human(m)}</option>)}</select></label>
    <label>Comparison<select value={row.operator || ""} onChange={(e) => update(group, row.key, { operator: e.target.value })}><option value="">Select</option><option value="gte">At least</option><option value="lte">At most</option></select></label>
    {field(group, row, "threshold", "Threshold", "number", { step: "any" })}
  </div>;
  const add = (group) => {
    let i = 1; while ((value[group] || []).some((r) => r.key === `${group.toLowerCase()}_${i}`)) { i += 1; }
    update(group, `${group.toLowerCase()}_${i}`, {});
  };
  return <section aria-label="CAPITAL-009 Unit Economics workspace">
    <h2>CAPITAL-009 Unit Economics</h2>
    <p>Assumptions and projections support human review. They are not validated economics, audited results or approved capital decisions. No spending or fundraising action occurs.</p>
    <div className="readiness-grid">
      <label>Economics period (monthly)<input type="month" value={value.period || ""} onChange={(e) => set("period", e.target.value)} /></label>
      <label>Economics currency<input maxLength={3} placeholder="NGN" value={value.currency || ""} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></label>
    </div>
    <p>All assumptions, thresholds and proposed budgets share this period and currency. Ratios use 0 to 1. Each input needs an owner, rationale, confidence and linked evidence.</p>
    <details><summary>Calculation scope and limitations</summary><p>Paying subscribers = new fans times conversion + existing subscribers times monthly retention. Retained platform revenue excludes creator earnings and partner contribution. Payout/refund costs cover only additional platform-borne costs. Support, moderation and Akuso are per subscriber; infrastructure, market expansion and other fixed costs are monthly. Acquisition costs multiply new creator and fan counts. Net partner contribution is counted once and may be negative.</p><p>Break-even holds acquisition and fixed costs constant while varying subscriber count. Sensitivity changes one input at a time using its low and high bounds; it does not model correlations or guarantee an outcome. A break-even target remains planned until separately observed and reviewed.</p></details>
    <h3>Assumption register</h3>
    {config.inputs.map((spec) => {
      const row = (value.assumptions || []).find((a) => a.key === spec.key) || { key: spec.key };
      return <details key={spec.key}><summary>{spec.label} ({spec.unit}) - {row.confidence || "incomplete"}</summary><fieldset><legend>{spec.label}</legend>
        {field("assumptions", row, "owner", "Assumption owner account ID")}
        <label>Confidence<select value={row.confidence || "incomplete"} onChange={(e) => update("assumptions", row.key, { confidence: e.target.value })}>{["incomplete", "assumption", "estimated", "actual", "disputed"].map((c) => <option key={c}>{c}</option>)}</select></label>
        <div className="readiness-grid">{["low", "base", "high"].map((bound) => field("assumptions", row, bound, `${spec.label} ${bound}`, "number", { min: spec.min, max: spec.max, step: "any" }))}</div>
        {field("assumptions", row, "rationale", "Assumption rationale")}
        <p>Evidence links</p>{!evidence.length && <p>Add source evidence below, then link it here.</p>}
        {evidence.map((e, i) => <label key={i}><input type="checkbox" checked={(row.evidenceIndexes || []).includes(i)} onChange={(event) => update("assumptions", row.key, { evidenceIndexes: event.target.checked ? [...(row.evidenceIndexes || []), i] : (row.evidenceIndexes || []).filter((n) => n !== i) })} />Evidence {i + 1}: {e.source || "Source needed"}</label>)}
      </fieldset></details>;
    })}
    {[["milestones", "Break-even milestones"], ["riskTriggers", "Risk triggers"], ["allocationGates", "Revised use-of-funds gates"]].map(([group, title]) => <div key={group}><h3>{title}</h3>
      {(value[group] || []).map((row) => <fieldset key={row.key}><legend>{row.title || row.key}</legend>
        <p>Reference: {row.key}</p>{field(group, row, "title", "Title")}{field(group, row, "owner", "Owner account ID")}
        {group === "milestones" ? <>
          {field(group, row, "targetSubscribers", "Target paying subscribers", "number", { min: 0, step: "any" })}
          <label>Target date (UTC)<input type="datetime-local" value={row.targetDate ? new Date(row.targetDate).toISOString().slice(0, 16) : ""} onChange={(e) => update(group, row.key, { targetDate: e.target.value ? `${e.target.value}:00.000Z` : undefined })} /></label>
          {field(group, row, "rationale", "Milestone rationale")}
        </> : condition(group, row)}
        {group === "riskTriggers" && field(group, row, "response", "Human response when triggered")}
        {group === "allocationGates" && <>
          <label>Break-even milestone<select value={row.milestoneKey || ""} onChange={(e) => update(group, row.key, { milestoneKey: e.target.value })}><option value="">Select</option>{(value.milestones || []).map((m) => <option key={m.key} value={m.key}>{m.title || m.key}</option>)}</select></label>
          <p>Required risk checks</p>{(value.riskTriggers || []).map((r) => <label key={r.key}><input type="checkbox" checked={(row.riskTriggerKeys || []).includes(r.key)} onChange={(e) => update(group, row.key, { riskTriggerKeys: e.target.checked ? [...(row.riskTriggerKeys || []), r.key] : (row.riskTriggerKeys || []).filter((k) => k !== r.key) })} />{r.title || r.key}</label>)}
          {field(group, row, "priorMaximum", "Previous maximum budget", "number", { min: 0, max: 1e12, step: "any" })}
          {field(group, row, "revisedMaximum", "Proposed maximum budget", "number", { min: 0, max: 1e12, step: "any" })}
          {field(group, row, "rationale", "Revision rationale and sensitivity evidence")}{field(group, row, "stopLoss", "Stop-loss and reversal condition")}
        </>}
        <button type="button" onClick={() => set(group, (value[group] || []).filter((r) => r.key !== row.key))}>Remove {row.title || row.key}</button>
      </fieldset>)}
      <button type="button" disabled={(value[group] || []).length >= config.maxEntries} onClick={() => add(group)}>Add {title.toLowerCase()}</button>
    </div>)}
    <h3>Sensitivity analysis and review results</h3>
    {dirty || !analysis ? <p>Save the draft to calculate the current inputs. Unsaved changes have no reviewed result.</p> : <>
      <p>{display(analysis.state)}. External use requires current evidence and independent human review.</p>
      <ul>{analysis.blockers.map((b) => <li key={b}>{human(b)}</li>)}</ul>
      <details><summary>Assumption evidence states</summary>{analysis.assumptionRegister.map((a) => <p key={a.key}>{a.label}: {display(a.observationState)}{a.issues.length ? ` - ${a.issues.map(human).join(", ")}` : ""}</p>)}</details>
      <p>{analysis.method}</p>
      <div style={{ overflowX: "auto" }}><table><caption>Monthly projections ({analysis.currency || "currency missing"})</caption><thead><tr><th>Scenario</th><th>Net burn</th><th>Contribution / subscriber</th><th>Runway months</th><th>Break-even subscribers</th></tr></thead><tbody>{[{ scenario: "base", result: analysis.base }, ...analysis.sensitivity].map((s) => <tr key={s.scenario}><th>{s.scenario}</th>{config.metrics.map((m) => <td key={m}>{display(s.result?.[m])}</td>)}</tr>)}</tbody></table></div>
      <h4>Break-even milestones</h4>{analysis.milestones.map((m) => <p key={m.key}>{m.key}: {display(m.state)}; required subscribers: {display(m.requiredSubscribers)}; achievement not observed.</p>)}
      <h4>Risk triggers</h4>{analysis.riskTriggers.map((r) => <p key={r.key}>{r.key}: {display(r.state)}; {display(r.projectedValue)}; human review only.</p>)}
      <h4>Revised use-of-funds gates</h4>{analysis.allocationGates.map((g) => <p key={g.key}>{g.key}: {display(g.state)}; proposed budget change: {display(g.budgetChange)}. Spending is not authorized.</p>)}
    </>}
  </section>;
}
