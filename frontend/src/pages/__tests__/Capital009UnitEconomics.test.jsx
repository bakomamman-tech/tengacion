import { createRequire } from "node:module";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import ExternalReadiness from "../ExternalReadiness";
import { apiRequest } from "../../api";
const require = createRequire(import.meta.url);
const config = require("../../../../backend/config/unitEconomics.js");
vi.mock("../../api", () => ({ API_BASE: "/api", apiRequest: vi.fn() }));
vi.mock("../../components/AdminShell", () => ({ default: ({ children }) => <div>{children}</div> }));
const inventory = (records = []) => ({ packages: [{ key: "AUDIT-012", title: "Retest", kind: "retest", requirements: [], acceptanceCriteria: [] }, { key: "CAPITAL-009", title: "Validate Unit Economics And Capital Allocation", kind: "unit_economics", requirements: [], acceptanceCriteria: ["Assumptions have owners and confidence states"] }], unitEconomicsConfig: config, domains: ["external_reporting"], financialKeys: [], records, shares: [], questions: [], alerts: [], calendar: [], summary: { packageCount: 46, records: records.length, readyRecords: 0, alerts: 0, decision: "hold_for_evidence" }, limits: { scope: "All-time inventory" } });
const saved = (extra = {}) => ({ id: "record1", _id: "record1", __v: 3, packageKey: "CAPITAL-009", title: "Economics review", owner: "owner1", domain: "external_reporting", scope: "Monthly cohort", dueAt: "2030-01-01T00:00:00Z", expiresAt: "2030-02-01T00:00:00Z", status: "draft", readiness: "evidence_needed", blockers: [], evidence: [], responses: [], dependencies: [], findingIds: [], relatedControlKeys: [], audience: "internal", classification: "restricted", unitEconomics: { period: "2026-09", currency: "NGN", assumptions: [], milestones: [], riskTriggers: [], allocationGates: [] }, ...extra });
const analysis = { state: "incomplete_or_on_hold", assumptionRegister: [], blockers: ["economics_assumption_incomplete:conversion"], base: null, sensitivity: [{ scenario: "conversion:low", result: null }], milestones: [{ key: "break_even", state: "incomplete", requiredSubscribers: null }], riskTriggers: [{ key: "burn", state: "triggered", projectedValue: 1340 }], allocationGates: [{ key: "growth", state: "hold", budgetChange: -5000 }], currency: "NGN", method: "One input at a time" };
async function open(records = []) {
  apiRequest.mockResolvedValue(inventory(records)); render(<ExternalReadiness user={{ _id: "owner1" }} />);
  await screen.findByLabelText("Roadmap package"); fireEvent.change(screen.getByLabelText("Roadmap package"), { target: { value: "CAPITAL-009" } });
}
beforeEach(() => vi.resetAllMocks());
test("creates a scoped assumption with owner, confidence, evidence and sensitivity bounds", async () => {
  await open(); expect(screen.getByRole("heading", { name: "CAPITAL-009 Unit Economics" })).toBeInTheDocument();
  for (const input of config.inputs.slice(0, 11)) { expect(screen.getByText(`${input.label} (${input.unit}) - incomplete`)).toBeInTheDocument(); }
  fireEvent.change(screen.getByLabelText("Economics period (monthly)"), { target: { value: "2026-09" } });
  fireEvent.change(screen.getByLabelText("Economics currency"), { target: { value: "ngn" } });
  fireEvent.click(screen.getByText("Creator acquisition cost (currency/creator) - incomplete"));
  const assumption = within(screen.getByRole("group", { name: "Creator acquisition cost" }));
  for (const [bound, value] of [["low", "50"], ["base", "100"], ["high", "150"]]) { fireEvent.change(assumption.getByLabelText(`Creator acquisition cost ${bound}`), { target: { value } }); }
  fireEvent.change(assumption.getByLabelText("Confidence"), { target: { value: "assumption" } });
  fireEvent.change(assumption.getByLabelText("Assumption rationale"), { target: { value: "Cohort pilot estimate" } });
  fireEvent.click(screen.getByRole("button", { name: "Add evidence" })); fireEvent.change(screen.getByLabelText("Source"), { target: { value: "Pilot costs" } });
  fireEvent.click(assumption.getByLabelText("Evidence 1: Pilot costs"));
  for (const [label, value] of [["Title", "Economics review"], ["Scope", "Monthly cohort"], ["Due At (UTC)", "2030-01-01T00:00"], ["Expires At (UTC)", "2030-02-01T00:00"], ["Reason for this action", "Register assumptions"]]) { fireEvent.change(screen.getAllByLabelText(label)[0], { target: { value } }); }
  apiRequest.mockImplementation(async (url, options) => options?.method === "POST" ? saved() : inventory([saved()]));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/external-readiness/records", expect.objectContaining({ method: "POST" })));
  const body = JSON.parse(apiRequest.mock.calls.find((call) => call[1]?.method === "POST")[1].body);
  expect(body.unitEconomics).toMatchObject({ period: "2026-09", currency: "NGN", assumptions: [{ key: "creator_acquisition", owner: "owner1", confidence: "assumption", low: 50, base: 100, high: 150, evidenceIndexes: [0] }] });
  expect(body.unitEconomicsAnalysis).toBeUndefined();
});
test("adds break-even, risk and revised allocation gates linked to sensitivity", async () => {
  await open(); fireEvent.click(screen.getByRole("button", { name: "Add break-even milestones" }));
  const milestone = within(screen.getByRole("group", { name: "milestones_1" })); fireEvent.change(milestone.getByLabelText("Title"), { target: { value: "Break even" } }); fireEvent.change(milestone.getByLabelText("Target paying subscribers"), { target: { value: "40" } });
  fireEvent.click(screen.getByRole("button", { name: "Add risk triggers" })); const risk = within(screen.getByRole("group", { name: "risktriggers_1" })); fireEvent.change(risk.getByLabelText("Title"), { target: { value: "Burn ceiling" } });
  fireEvent.click(screen.getByRole("button", { name: "Add revised use-of-funds gates" })); const gate = within(screen.getByRole("group", { name: "allocationgates_1" }));
  expect(within(gate.getByLabelText("Scenario")).queryByRole("option", { name: "base", exact: true })).not.toBeInTheDocument();
  fireEvent.change(gate.getByLabelText("Scenario"), { target: { value: "fan_acquisition:high" } });
  fireEvent.change(gate.getByLabelText("Break-even milestone"), { target: { value: "milestones_1" } }); fireEvent.click(gate.getByLabelText("Burn ceiling"));
  fireEvent.change(gate.getByLabelText("Previous maximum budget"), { target: { value: "10000" } }); fireEvent.change(gate.getByLabelText("Proposed maximum budget"), { target: { value: "5000" } });
  expect(gate.getByLabelText("Scenario")).toHaveValue("fan_acquisition:high"); expect(gate.getByLabelText("Burn ceiling")).toBeChecked(); expect(gate.getByLabelText("Proposed maximum budget")).toHaveValue(5000);
  fireEvent.click(gate.getByRole("button", { name: "Remove allocationgates_1" })); expect(screen.queryByRole("group", { name: "allocationgates_1" })).not.toBeInTheDocument();
});
test("shows incomplete projections and triggered holds without claiming financial authority", async () => {
  const row = saved({ unitEconomicsAnalysis: analysis }); await open([row]); fireEvent.click(screen.getByRole("button", { name: "Economics review" }));
  expect(screen.getAllByText("Incomplete / unavailable").length).toBeGreaterThan(0); expect(screen.getByText(/burn: triggered/)).toHaveTextContent("human review only");
  expect(screen.getByText(/growth: hold/)).toHaveTextContent("Spending is not authorized");
  expect(screen.getByText(/achievement not observed/)).toBeInTheDocument();
});
test("editing evidence hides stale calculations and disables approval until saved", async () => {
  await open([saved({ status: "approved", unitEconomicsAnalysis: analysis })]); fireEvent.click(screen.getByRole("button", { name: "Economics review" }));
  fireEvent.change(screen.getByLabelText("Reason for this action"), { target: { value: "Changed source" } });
  fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));
  expect(screen.getByRole("button", { name: "Approve", exact: true })).toBeDisabled(); expect(screen.getByText(/Unsaved changes have no reviewed result/)).toBeInTheDocument(); expect(screen.queryByText(/burn: triggered/)).not.toBeInTheDocument();
});
test("submits the saved version and preserves edits when the server reports a conflict", async () => {
  const row = saved(); await open([row]); fireEvent.click(screen.getByRole("button", { name: "Economics review" }));
  fireEvent.change(screen.getByLabelText("Economics currency"), { target: { value: "USD" } }); fireEvent.change(screen.getByLabelText("Reason for this action"), { target: { value: "Correct currency" } });
  apiRequest.mockRejectedValue(new Error("This record changed. Reload before editing.")); fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Reload before editing"); expect(screen.getByLabelText("Economics currency")).toHaveValue("USD");
  const call = apiRequest.mock.calls.find((c) => c[1]?.method === "PATCH"); expect(call[0]).toBe("/api/external-readiness/records/record1"); expect(JSON.parse(call[1].body)).toMatchObject({ version: 3, unitEconomics: { currency: "USD" } });
});
