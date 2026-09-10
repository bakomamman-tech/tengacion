export default function CapitalPathDecisionWorkspace({
  value = {}, onChange, config, evidence = [], analysis, dirty,
}) {
  const change = (field, next) => onChange({ ...value, [field]: next });
  const link = (key, index, checked) => {
    const sections = value.packetSections || [];
    const indexes = sections.find((section) => section.key === key)?.evidenceIndexes || [];
    const updated = checked ? [...new Set([...indexes, index])] : indexes.filter((entry) => entry !== index);
    change("packetSections", [
      ...sections.filter((section) => section.key !== key),
      { key, evidenceIndexes: updated },
    ]);
  };

  return (
    <section aria-label="CAPITAL-011 Capital Path Decision workspace">
      <h3>CAPITAL-011 Capital Path Decision</h3>
      <p>
        Human review only. Recording or approving this record does not automatically choose a
        financing path, authorize fundraising, investor outreach or strategic-partner outreach,
        accept investor or partner terms, authorize spending, or move money.
        No-go and delay remain legitimate strategic decisions. Software completion is not
        actual capital readiness or external legal, tax, audit, financial, investment,
        security, or compliance approval. Akuso has no capital decision authority.
      </p>
      {dirty && <p role="status">Save CAPITAL-011 governance changes before independent review. Analysis below describes the saved record.</p>}
      {!config ? <p role="alert">Capital path configuration is unavailable. Reload before editing the decision packet.</p> : (
        <>
          <label>
            Capital path
            <select value={value.path || ""} onChange={(event) => change("path", event.target.value || undefined)}>
              <option value="">Select a human-chosen path</option>
              {config.paths.map((path) => <option key={path.key} value={path.key}>{path.label}</option>)}
            </select>
          </label>
          <label>
            Path rationale
            <textarea value={value.rationale || ""} onChange={(event) => change("rationale", event.target.value)} />
          </label>
          <label>
            Execution and review timeline
            <textarea value={value.timeline || ""} onChange={(event) => change("timeline", event.target.value)} />
          </label>
          <label>
            Evidence requirements (one per line)
            <textarea value={(value.evidenceRequirements || []).join("\n")}
              onChange={(event) => change("evidenceRequirements", event.target.value.split("\n"))}
              onBlur={() => change("evidenceRequirements", [...new Set((value.evidenceRequirements || []).map((entry) => entry.trim()).filter(Boolean))])} />
          </label>
          <h4>Decision packet</h4>
          {config.packetSections.map((section) => (
            <fieldset key={section.key}>
              <legend>{section.label}</legend>
              {!evidence.length && <p>Add evidence below, then link it to this section.</p>}
              {evidence.map((entry, index) => (
                <label key={index}>
                  <input type="checkbox"
                    checked={(value.packetSections || []).find((packet) => packet.key === section.key)?.evidenceIndexes?.includes(index) || false}
                    onChange={(event) => link(section.key, index, event.target.checked)} />
                  {index + 1}. {entry.source || "Untitled evidence"}
                </label>
              ))}
            </fieldset>
          ))}
        </>
      )}
      <h4>Saved CAPITAL-011 analysis</h4>
      {analysis ? (
        <div>
          <p>Saved path: {config?.paths.find((path) => path.key === analysis.path)?.label || analysis.path || "Not selected"}</p>
          <p>State: {analysis.state}</p>
          <p>Human decision recorded: {analysis.humanDecisionRecorded ? "Yes" : "No"}</p>
          <p>No-go is a valid strategic decision: {analysis.noGoIsValidStrategicDecision ? "Yes" : "No"}</p>
          {analysis.blockers?.length ? <ul>{analysis.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p>No structural packet blockers. Independent human governance is still required.</p>}
        </div>
      ) : <p>No saved CAPITAL-011 analysis yet.</p>}
      <p>Path chosen by software: No</p>
      <p>Outreach authorized by software: No</p>
      <p>Fundraising authorized by software: No</p>
      <p>Partner terms accepted by software: No</p>
      <p>Spending authorized by software: No</p>
      <p>Money movement authorized by software: No</p>
    </section>
  );
}
