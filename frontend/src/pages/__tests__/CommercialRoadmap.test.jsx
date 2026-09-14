import {useState} from "react";
import CommercialRoadmapWorkspace from "../../components/admin/CommercialRoadmapWorkspace";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import config from "../../../../backend/config/commercialRoadmap";
import packages from "../../../../backend/config/commercialRoadmapPackages.json";
const mocks = vi.hoisted(() => ({apiRequest: vi.fn()}));
vi.mock("../../api", () => ({API_BASE: "http://example.test/api", apiRequest: mocks.apiRequest}));
vi.mock("../../components/AdminShell", () => ({default: ({children}) => <div>{children}</div>}));
import ExternalReadiness from "../ExternalReadiness";
const spec = packages.find(item => item.key === "DISTRIBUTION-001");
const record = {id: "commercial-1", _id: "commercial-1", __v: 2, packageKey: spec.key, title: "Organic creator pilot",
  owner: "owner-1", domain: "external_reporting", scope: "Internal review", dueAt: "2027-01-01T12:00:00Z", expiresAt: "2027-02-01T12:00:00Z",
  audience: "internal", classification: "restricted", status: "draft", readiness: "evidence_needed",
  evidence: [{source: "Pilot report", summary: "Observed pilot evidence", confidence: "current", observedAt: "2026-09-01T12:00:00Z", expiresAt: "2027-01-01T12:00:00Z"}],
  responses: [], dependencies: [], findingIds: [], relatedControlKeys: [], blockers: [],
  commercial: {subject: "Organic creator", hypothesis: "Measure repeat behavior", state: "research", details: [], scores: [], gates: [], metrics: [], steps: [], acceptance: []},
  commercialAnalysis: {effectiveState: "not_ready", blockers: ["commercial_score_required:creator_value"]}};
const report = {summary: {packageCount: 88, records: 1, readyRecords: 0, alerts: 0, decision: "hold_for_evidence"},
  limits: {scope: "Internal inventory"}, packages: [{...spec, operationalStatus: "evidence_needed"}], domains: ["external_reporting"], financialKeys: [],
  records: [record], calendar: [], alerts: [], shares: [], questions: [], commercialConfig: config};
beforeEach(() => {mocks.apiRequest.mockReset(); mocks.apiRequest.mockResolvedValue(report);});
async function open() {
  render(<ExternalReadiness user={{_id: "owner-1", role: "admin"}} />);
  await screen.findByText("Operating report");
  fireEvent.change(screen.getByLabelText("Roadmap package"), {target: {value: spec.key}});
  fireEvent.click(screen.getByRole("button", {name: record.title}));
  await screen.findByText(/Review saved version 2/i);
  return within(screen.getByRole("region", {name: "Commercial roadmap workflow"}));
}
test("renders operating controls, source-linked requirements and acceptance criteria", async () => {
  const workspace = await open();
  expect(workspace.getByLabelText("Subject")).toHaveValue("Organic creator");
  expect(workspace.getByRole("group", {name: "Finance"})).toBeInTheDocument();
  for (const criterion of spec.acceptanceCriteria) { expect(workspace.getByRole("group", {name: criterion})).toBeInTheDocument(); }
  expect(workspace.getByText(/Effective state: Not ready/)).toBeInTheDocument();
});
test("unsaved changes block governance and hide stale saved analysis", async () => {
  const workspace = await open();
  fireEvent.change(screen.getByLabelText("Reason for this action"), {target: {value: "Record change"}});
  expect(screen.getByRole("button", {name: "Approve"})).toBeEnabled();
  fireEvent.change(workspace.getByLabelText("Hypothesis"), {target: {value: "Measure a new cohort"}});
  expect(screen.getByRole("button", {name: "Approve"})).toBeDisabled();
  expect(screen.getByRole("button", {name: "Attest"})).toBeDisabled();
  expect(workspace.queryByRole("region", {name: "Saved workflow analysis"})).not.toBeInTheDocument();
});
test("saves linked scores with optimistic version and reloads server result", async () => {
  const workspace = await open();
  const score = within(workspace.getByRole("group", {name: "Creator value"}));
  fireEvent.change(score.getByLabelText("Score"), {target: {value: "3"}});
  fireEvent.click(score.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Reason for this action"), {target: {value: "Save scored evidence"}});
  const saved = {...record, __v: 3, commercial: {...record.commercial, scores: [{key: "creator_value", value: 3, evidenceIndexes: [0]}]}};
  mocks.apiRequest.mockResolvedValueOnce(saved).mockResolvedValue({...report, records: [saved]});
  fireEvent.click(screen.getByRole("button", {name: /Save draft/i}));
  await screen.findByText("Draft saved; evidence must be attested and reviewed.");
  const call = mocks.apiRequest.mock.calls.find(([, options]) => options?.method === "PATCH");
  expect(JSON.parse(call[1].body)).toMatchObject({version: 2, commercial: {scores: [{key: "creator_value", value: 3, evidenceIndexes: [0]}]}});
  expect(screen.getByText(/Review saved version 3/i)).toBeInTheDocument();
});
test("failed save retains the user's draft and leaves review disabled", async () => {
  const workspace = await open();
  fireEvent.change(workspace.getByLabelText("Hypothesis"), {target: {value: "Keep this draft"}});
  fireEvent.change(screen.getByLabelText("Reason for this action"), {target: {value: "Save edited hypothesis"}});
  mocks.apiRequest.mockRejectedValueOnce(new Error("This record changed. Reload before editing."));
  fireEvent.click(screen.getByRole("button", {name: /Save draft/i}));
  expect(await screen.findByRole("alert")).toHaveTextContent("This record changed");
  expect(workspace.getByLabelText("Hypothesis")).toHaveValue("Keep this draft");
  expect(screen.getByRole("button", {name: "Approve"})).toBeDisabled();
});
test("unknown measurement input remains absent instead of becoming zero", async () => {
  const workspace = await open();
  fireEvent.click(workspace.getByRole("button", {name: "Add measurement"}));
  const measurement = within(workspace.getByRole("group", {name: "Measurement 1"}));
  fireEvent.change(measurement.getByLabelText("Value"), {target: {value: "4"}});
  fireEvent.change(measurement.getByLabelText("Value"), {target: {value: ""}});
  expect(measurement.getByLabelText("Value")).toHaveValue(null);
  fireEvent.click(workspace.getByRole("button", {name: "Remove measurement 1"}));
  expect(workspace.queryByRole("group", {name: "Measurement 1"})).not.toBeInTheDocument();
});
test("outreach editor preserves recipient access and advisor evidence together", () => {
  const outreachSpec = packages.find(item => item.key === "CAPITAL-012");
  const changed = vi.fn();
  function Harness() {
    const [value, setValue] = useState({});
    return <CommercialRoadmapWorkspace value={value} onChange={next => {changed(next); setValue(next);}}
      config={config} spec={outreachSpec} evidence={record.evidence} dirty />;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", {name: "Add outreach target"}));
  const target = within(screen.getByRole("group", {name: "Outreach target 1"}));
  fireEvent.change(target.getByLabelText("Recipient"), {target: {value: "recipient-account"}});
  fireEvent.change(target.getByLabelText("Grant"), {target: {value: "approved-grant"}});
  fireEvent.change(target.getByLabelText("Requested Terms"), {target: {value: "Partner exclusivity"}});
  fireEvent.change(target.getByLabelText("Advisor Review State"), {target: {value: "reviewed"}});
  fireEvent.click(within(target.getByRole("group", {name: "Advisor review evidence"})).getByRole("checkbox"));
  fireEvent.change(target.getByLabelText("Review At (UTC)"), {target: {value: "2026-10-01T12:00"}});
  expect(changed.mock.lastCall[0].outreachTargets[0]).toMatchObject({
    recipient: "recipient-account", grant: "approved-grant", requestedTerms: "Partner exclusivity",
    advisorReviewState: "reviewed", advisorReviewEvidenceIndexes: [0], reviewAt: "2026-10-01T12:00Z",
  });
});
test('capital feedback revisions expose financial scenario and allocation controls', async () => {
  const capitalSpec = packages.find(item => item.key === 'CAPITAL-013');
  const capitalRecord = {...record, packageKey: capitalSpec.key};
  mocks.apiRequest.mockResolvedValue({...report, packages: [capitalSpec], records: [capitalRecord]});
  render(<ExternalReadiness user={{_id: 'owner-1', role: 'admin'}} />);
  await screen.findByText('Operating report');
  fireEvent.change(screen.getByLabelText('Roadmap package'), {target: {value: capitalSpec.key}});
  fireEvent.click(screen.getByRole('button', {name: record.title}));
  expect(screen.getByRole('group', {name: 'Financial scenario'})).toBeInTheDocument();
  expect(screen.getByLabelText('Minimum')).toBeInTheDocument();
  expect(screen.getByLabelText('Maximum')).toBeInTheDocument();
  expect(screen.getByLabelText('Decision')).toBeInTheDocument();
  expect(screen.getByLabelText('Reversal Condition')).toBeInTheDocument();
});
