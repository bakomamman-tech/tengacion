
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import config from "../../../../backend/config/capitalPaths";
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("../../api", () => ({ API_BASE: "http://example.test/api", apiRequest: mocks.apiRequest }));
vi.mock("../../components/AdminShell", () => ({ default: ({ children }) => <div>{children}</div> }));
import ExternalReadiness from "../ExternalReadiness";
const record = {
  id: "capital-011", _id: "capital-011", __v: 2, packageKey: "CAPITAL-011", title: "Human capital choice",
  owner: "owner-1", domain: "external_reporting", scope: "Internal review",
  dueAt: "2026-10-01T12:00:00.000Z", expiresAt: "2026-10-10T12:00:00.000Z",
  audience: "internal", classification: "restricted", status: "draft", readiness: "evidence_needed",
  evidence: [{ source: "Current packet", summary: "Reviewed source", confidence: "current", observedAt: "2026-09-09T12:00:00.000Z", expiresAt: "2026-10-10T12:00:00.000Z" }],
  responses: [], dependencies: [], findingIds: [], relatedControlKeys: [], blockers: [],
  decision: "No external capital", alternatives: "Prove milestones", reversalCondition: "Review new evidence",
  capitalPathDecision: { path: "no_external_capital_yet", rationale: "Prove milestones first", timeline: "Review in thirty days",
    evidenceRequirements: ["Current packet"], packetSections: [] },
  capitalPathAnalysis: { path: "no_external_capital_yet", state: "incomplete_or_on_hold",
    blockers: ["capital_path_packet_missing:financial_model"], humanDecisionRecorded: false,
    noGoIsValidStrategicDecision: true, capitalPathChosenBySoftware: false, outreachAuthorized: false,
    fundraisingAuthorized: false, partnerTermsAccepted: false, spendingAuthorized: false, moneyMovementAuthorized: false },
};
const report = {
  summary: { packageCount: 48, records: 1, readyRecords: 0, alerts: 0, decision: "hold_for_evidence" },
  limits: { scope: "Internal inventory", truncated: false },
  packages: [{ key: "CAPITAL-011", title: "Make The Capital Path Decision", cycle: "capital", kind: "decision",
    requirements: [], acceptanceCriteria: [], operationalStatus: "evidence_needed" }],
  domains: ["external_reporting"], financialKeys: [],
  records: [record], calendar: [], alerts: [], shares: [], questions: [], capitalPathConfig: config,
};
beforeEach(() => { mocks.apiRequest.mockReset(); mocks.apiRequest.mockResolvedValue(report); });
const open = async () => {
  render(<ExternalReadiness user={{_id:"owner-1",role:"admin"}} />);
  await screen.findByText("Operating report");
  fireEvent.change(screen.getByLabelText("Roadmap package"), {target:{value:"CAPITAL-011"}});
  fireEvent.click(screen.getByRole("button", {name:"Human capital choice"}));
  await screen.findByText(/Review saved version 2/i);
};
test("renders all authoritative paths and packet sections with no-go and delay", async () => {
  await open();
  const select=screen.getByLabelText("Capital path");
  expect(within(select).getAllByRole("option")).toHaveLength(10);
  for(const path of config.paths) {expect(within(select).getByRole("option",{name:path.label})).toHaveValue(path.key);}
  for(const section of config.packetSections) {expect(screen.getByRole("group",{name:section.label})).toBeInTheDocument();}
  expect(screen.getByLabelText("Decision")).toHaveValue(record.decision);
  expect(screen.getByLabelText("Alternatives")).toHaveValue(record.alternatives);
  expect(screen.getByLabelText("Reversal Condition")).toHaveValue(record.reversalCondition);
});
test("edits path, rationale, timeline and multiple evidence requirements and links evidence", async () => {
  await open();
  fireEvent.change(screen.getByLabelText("Capital path"),{target:{value:"defer_and_prove_milestones"}});
  fireEvent.change(screen.getByLabelText("Path rationale"),{target:{value:"Wait for proof"}});
  fireEvent.change(screen.getByLabelText("Execution and review timeline"),{target:{value:"Review next month"}});
  const requirements=screen.getByLabelText("Evidence requirements (one per line)");
  fireEvent.change(requirements,{target:{value:" First proof \nSecond proof\nFirst proof"}});
  fireEvent.blur(requirements);
  expect(requirements).toHaveValue("First proof\nSecond proof");
  const checkbox=within(screen.getByRole("group",{name:"Financial model"})).getByRole("checkbox");
  fireEvent.click(checkbox); expect(checkbox).toBeChecked();
  fireEvent.change(screen.getByLabelText("Reason for this action"),{target:{value:"Save new evidence"}});
  const saved = { ...record, capitalPathDecision: { ...record.capitalPathDecision, path: "defer_and_prove_milestones",
    rationale: "Wait for proof", timeline: "Review next month", evidenceRequirements: ["First proof", "Second proof"],
    packetSections: [{key:"financial_model", evidenceIndexes:[0]}] }, __v: 3 };
  mocks.apiRequest.mockResolvedValueOnce(saved).mockResolvedValue({ ...report, records: [saved] });
  fireEvent.click(screen.getByRole("button",{name:/Save draft/i}));
  await screen.findByText("Draft saved; evidence must be attested and reviewed.");
  expect(screen.getByText(/Review saved version 3/i)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Reason for this action"), {target:{value:"Review saved version"}});
  expect(screen.getByRole("button",{name:"Approve"})).toBeEnabled();
  const call=mocks.apiRequest.mock.calls.find(([,options])=>options?.method==="PATCH" || options?.method==="POST");
  expect(call).toBeDefined();
  const body=JSON.parse(call[1].body);
  expect(body.capitalPathDecision).toMatchObject({path:"defer_and_prove_milestones",rationale:"Wait for proof",timeline:"Review next month",evidenceRequirements:["First proof","Second proof"]});
  expect(body.capitalPathDecision.packetSections).toContainEqual({key:"financial_model",evidenceIndexes:[0]});
  expect(body.decision).toBe(record.decision);
});
test("shows saved analysis, blockers, no-go validity and all human-only boundaries", async () => {
  await open();
  expect(screen.getByText(/Human review only/)).toHaveTextContent(/No-go and delay remain legitimate/);
  expect(screen.getByText("State: incomplete_or_on_hold")).toBeInTheDocument();
  expect(screen.getByText("capital_path_packet_missing:financial_model")).toBeInTheDocument();
  expect(screen.getByText("Human decision recorded: No")).toBeInTheDocument();
  expect(screen.getByText("No-go is a valid strategic decision: Yes")).toBeInTheDocument();
  for(const label of ["Path chosen","Outreach authorized","Fundraising authorized","Partner terms accepted","Spending authorized","Money movement authorized"])
    {expect(screen.getByText(label+" by software: No")).toBeInTheDocument();}
});
test.each([
  ["Path rationale","New rationale"], ["Execution and review timeline","New timeline"],
  ["Decision","Updated human decision"], ["Alternatives","New alternative"], ["Reversal Condition","New reversal"],
  ["Owner","owner-2"], ["Source","Changed source"],
  ["Dependencies (one per line)","dependency-1"], ["Finding Ids (one per line)","finding-1"],
  ["Related Control Keys (one per line)","control-1"], ["Due At (UTC)","2026-10-02T12:00"],
])("governance edit %s locks review until saved where governed", async (label,value) => {
  await open();
  fireEvent.change(screen.getByLabelText("Reason for this action"),{target:{value:"Review saved decision"}});
  const approve=screen.getByRole("button",{name:"Approve"});
  expect(approve).toBeEnabled();
  fireEvent.change(screen.getByLabelText(label),{target:{value}});
  expect(approve).toBeDisabled();
  expect(screen.getByRole("button",{name:"Submit"})).toBeDisabled();
});

test("record expiry changes lock review independently of evidence expiry", async () => {
  await open();
  fireEvent.change(screen.getByLabelText("Reason for this action"),{target:{value:"Review current packet"}});
  expect(screen.getByRole("button",{name:"Approve"})).toBeEnabled();
  fireEvent.change(screen.getAllByLabelText("Expires At (UTC)")[0],{target:{value:"2026-10-11T12:00"}});
  expect(screen.getByRole("button",{name:"Approve"})).toBeDisabled();
});
test("packet evidence can be unlinked and no path is preselected on a new record", async () => {
  await open();
  const checkbox=within(screen.getByRole("group",{name:"Financial model"})).getByRole("checkbox");
  fireEvent.click(checkbox); expect(checkbox).toBeChecked();
  fireEvent.click(checkbox); expect(checkbox).not.toBeChecked();
  fireEvent.click(screen.getByRole("button",{name:"New record"}));
  expect(screen.getByLabelText("Capital path")).toHaveValue("");
});
