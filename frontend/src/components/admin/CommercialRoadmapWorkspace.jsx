const label = key => key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, value => value.toUpperCase());
const dateValue = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString().slice(0, 16) : "";
function Field({ name, value, onChange, type = "text", options }) {
  return <label>{label(name)}{type === "datetime-local" ? " (UTC)" : ""}{options ? <select value={value || ""} onChange={event => onChange(event.target.value)}>
    <option value="">Select {label(name).toLowerCase()}</option>
    {options.map(option => <option key={option} value={option}>{label(option)}</option>)}
  </select> : type === "textarea" ? <textarea value={value || ""} onChange={event => onChange(event.target.value)} />
    : <input type={type} step={type === "number" ? "any" : undefined} value={type === "datetime-local" ? dateValue(value) : value ?? ""}
      onChange={event => onChange(type === "number" ? event.target.value === "" ? undefined : Number(event.target.value) : type === "datetime-local" && event.target.value ? event.target.value + "Z" : event.target.value)} />}</label>;
}
function EvidenceLinks({ value = [], evidence, onChange }) {
  return <fieldset><legend>Supporting evidence</legend>
    {!evidence.length && <p>Add evidence below, then link it here.</p>}
    {evidence.map((entry, index) => <label key={index}>
      <input type="checkbox" checked={value.includes(index)} onChange={event => onChange(event.target.checked ? [...value, index] : value.filter(item => item !== index))} />
      {index + 1}. {entry.summary || entry.source || "Untitled evidence"}
    </label>)}
  </fieldset>;
}
export default function CommercialRoadmapWorkspace({ value = {}, onChange, config, spec, evidence = [], analysis, dirty }) {
  if (!config || !spec) { return null; }
  const update = (key, next) => onChange({ ...value, [key]: next });
  const updateRow = (group, key, field, next) => {
    const rows = value[group] || [];
    const existing = rows.find(row => row.key === key);
    update(group, existing ? rows.map(row => row.key === key ? { ...row, [field]: next } : row) : [...rows, { key, [field]: next }]);
  };
  const field = (name, type = "text", options) => <Field key={name} name={name} type={type} options={options} value={value[name]} onChange={next => update(name, next)} />;
  const linkedRows = (group, keys, textForKey = label) => keys.map(key => {
    const row = (value[group] || []).find(item => item.key === key) || { key };
    return <fieldset key={key}><legend>{textForKey(key)}</legend>
      <Field name="Recorded outcome" type="textarea" value={row.value} onChange={next => updateRow(group, key, "value", next)} />
      <EvidenceLinks value={row.evidenceIndexes} evidence={evidence} onChange={next => updateRow(group, key, "evidenceIndexes", next)} />
    </fieldset>;
  });
  const metrics = value.metrics || [];
  const add = group => {
    const rows = value[group] || [];
    let index = rows.length + 1;
    while (rows.some(row => row.key === group + "_" + index)) { index += 1; }
    update(group, [...rows, { key: group + "_" + index }]);
  };
  return <section aria-label="Commercial roadmap workflow">
    <h3>{label(spec.workflowKind)} operating record</h3>
    <p>Save changes before attestation or review. Recorded readiness does not execute outreach, spending, pricing changes, or publication.</p>
    {dirty && <p role="status">Unsaved workflow changes. Save the draft before review.</p>}
    {field("subject")}{field("hypothesis", "textarea")}{field("state", "text", config.states)}
    {field("channel", "text", config.channels)}{field("revenueLine", "text", config.revenueLines)}
    {field("reviewAt", "datetime-local")}{field("rollbackTrigger", "textarea")}
    {field("currency")}{field("budgetLimit", "number")}{field("spendToDate", "number")}
    {field("periodStart", "datetime-local")}{field("periodEnd", "datetime-local")}
    {spec.workflowKind === "scale_decision" && <fieldset><legend>Human decision</legend>
      {field("decision", "text", config.decisions)}{field("learning", "textarea")}{field("nextCohort")}
    </fieldset>}
    {spec.workflowKind === "scorecard" && <fieldset><legend>Readiness scores (0 to 5, higher is better)</legend>
      {config.dimensions.map(key => {
        const row = (value.scores || []).find(item => item.key === key) || {};
        return <fieldset key={key}><legend>{label(key)}</legend>
          <Field name="Score" type="number" value={row.value} onChange={next => updateRow("scores", key, "value", next)} />
          <EvidenceLinks value={row.evidenceIndexes} evidence={evidence} onChange={next => updateRow("scores", key, "evidenceIndexes", next)} />
        </fieldset>;
      })}
    </fieldset>}
    <fieldset><legend>Operating controls</legend>
      {config.controls.map(key => {
        const row = (value.gates || []).find(item => item.key === key) || {};
        return <fieldset key={key}><legend>{label(key)}</legend>
          <Field name="Gate status" options={["missing", "pass", "hold"]} value={row.status} onChange={next => updateRow("gates", key, "status", next)} />
          <EvidenceLinks value={row.evidenceIndexes} evidence={evidence} onChange={next => updateRow("gates", key, "evidenceIndexes", next)} />
        </fieldset>;
      })}
    </fieldset>
    <h4>Workflow details</h4>
    {linkedRows("details", config.detailFields[spec.workflowKind] || [])}
    <h4>Measurements</h4>
    <p>Use one currency and one reporting period. Record unknown measurements as incomplete; do not enter zero for missing data.</p>
    <button type="button" onClick={() => {
      const missing = (config.requiredMetrics[spec.workflowKind] || []).filter(key => !metrics.some(row => row.key === key));
      update("metrics", [...metrics, ...missing.map(key => ({ key, confidence: "incomplete" }))]);
    }}>Add required measurements</button>
    <button type="button" onClick={() => add("metrics")} disabled={metrics.length >= 100}>Add measurement</button>
    {metrics.map((row, index) => <fieldset key={index}><legend>Measurement {index + 1}</legend>
      {["key", "unit", "value", "observedAt", "confidence"].map(name => <Field key={name} name={name} value={row[name]}
        type={name === "value" ? "number" : name === "observedAt" ? "datetime-local" : "text"}
        options={name === "confidence" ? ["actual", "estimated", "disputed", "incomplete"] : undefined}
        onChange={next => update("metrics", metrics.map((item, i) => i === index ? { ...item, [name]: next } : item))} />)}
      <EvidenceLinks value={row.evidenceIndexes} evidence={evidence} onChange={next => update("metrics", metrics.map((item, i) => i === index ? { ...item, evidenceIndexes: next } : item))} />
      <button type="button" onClick={() => update("metrics", metrics.filter((_, i) => i !== index))}>Remove measurement {index + 1}</button>
    </fieldset>)}
    <h4>Stop-loss thresholds</h4>
    <button type="button" onClick={() => add("thresholds")} disabled={(value.thresholds || []).length >= 100}>Add threshold</button>
    {(value.thresholds || []).map((row, index) => <fieldset key={index}><legend>Threshold {index + 1}</legend>
      {["key", "direction", "value"].map(name => <Field key={name} name={name} value={row[name]}
        options={name === "key" ? metrics.map(item => item.key) : name === "direction" ? ["minimum", "maximum"] : undefined}
        type={name === "value" ? "number" : "text"}
        onChange={next => update("thresholds", value.thresholds.map((item, i) => i === index ? { ...item, [name]: next } : item))} />)}
      <button type="button" onClick={() => update("thresholds", value.thresholds.filter((_, i) => i !== index))}>Remove threshold {index + 1}</button>
    </fieldset>)}
    {spec.workflowKind === "outreach" && <section aria-label="Controlled outreach targets">
      <h4>Recipient-bound outreach targets</h4>
      <a href="/admin/audit-logs">Review packet access audit log</a>
      <p>Use an existing recipient account and an approved packet access grant. Saving a target does not send a message.</p>
      <button type="button" onClick={() => add("outreachTargets")} disabled={(value.outreachTargets || []).length >= 50}>Add outreach target</button>
      {(value.outreachTargets || []).map((row, index) => <fieldset key={index}><legend>Outreach target {index + 1}</legend>
        {["key", "recipient", "grant", "status", "followupOwner", "nextStep", "reviewAt", "meetingStatus", "interestLevel", "objections", "diligenceRequests", "requestedTerms", "riskyAsks", "advisorReviewState"].map(name => <Field key={name} name={name} value={row[name]}
          type={name === "reviewAt" ? "datetime-local" : "text"} options={name === "status" ? ["planned", "in_conversation", "followup", "closed"] : name === "meetingStatus" ? ["not_scheduled", "scheduled", "held", "cancelled"] : name === "interestLevel" ? ["unknown", "low", "medium", "high", "declined"] : name === "advisorReviewState" ? ["not_required", "pending", "reviewed"] : undefined}
          onChange={next => update("outreachTargets", value.outreachTargets.map((item, i) => i === index ? {...item, [name]: next} : item))} />)}
        <EvidenceLinks value={row.evidenceIndexes} evidence={evidence} onChange={next => update("outreachTargets", value.outreachTargets.map((item, i) => i === index ? {...item, evidenceIndexes: next} : item))} />
        <fieldset><legend>Advisor review evidence</legend><EvidenceLinks value={row.advisorReviewEvidenceIndexes} evidence={evidence} onChange={next => update("outreachTargets", value.outreachTargets.map((item, i) => i === index ? {...item, advisorReviewEvidenceIndexes: next} : item))} /></fieldset>
        <button type="button" onClick={() => update("outreachTargets", value.outreachTargets.filter((_, i) => i !== index))}>Remove outreach target {index + 1}</button>
      </fieldset>)}
    </section>}
    <h4>Follow-ups and delivery steps</h4>
    <button type="button" onClick={() => add("steps")} disabled={(value.steps || []).length >= 100}>Add operating step</button>
    {(value.steps || []).map((row, index) => <fieldset key={index}><legend>Step {index + 1}</legend>
      {["key", "owner", "dueAt", "status"].map(name => <Field key={name} name={name} value={row[name]}
        type={name === "dueAt" ? "datetime-local" : "text"} options={name === "status" ? ["pending", "done", "blocked"] : undefined}
        onChange={next => update("steps", value.steps.map((item, i) => i === index ? { ...item, [name]: next } : item))} />)}
      <EvidenceLinks value={row.evidenceIndexes} evidence={evidence} onChange={next => update("steps", value.steps.map((item, i) => i === index ? { ...item, evidenceIndexes: next } : item))} />
      <button type="button" onClick={() => update("steps", value.steps.filter((_, i) => i !== index))}>Remove step {index + 1}</button>
    </fieldset>)}
    <h4>Exit criteria verification</h4>
    {linkedRows("acceptance", (spec.acceptanceCriteria || []).map((_, index) => String(index)), key => spec.acceptanceCriteria[Number(key)])}
    {analysis && !dirty && <section aria-label="Saved workflow analysis"><h4>Saved analysis</h4>
      <p>Effective state: {label(analysis.effectiveState)}</p>
      {analysis.blockers?.length > 0 && <ul>{analysis.blockers.map(blocker => <li key={blocker}>{label(blocker)}</li>)}</ul>}
      {analysis.pricing && <p>Proposed effective price: {analysis.pricing.effectivePrice ?? "Unknown"} {analysis.pricing.currency}</p>}
      {analysis.economics && <p>Contribution: {analysis.economics.contribution ?? "Unknown"} {analysis.economics.currency}. Confidence: {label(analysis.economics.confidence)}.</p>}
      {analysis.ai && <p>Cost per useful workflow: {analysis.ai.costPerUsefulWorkflow ?? "Unknown"}</p>}
    </section>}
  </section>;
}