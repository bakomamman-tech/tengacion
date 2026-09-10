import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import ExternalReadiness from "../ExternalReadiness";
import ReadinessPacket from "../ReadinessPacket";
import { apiRequest } from "../../api";
vi.mock("../../api", () => ({ API_BASE: "/api", apiRequest: vi.fn() }));
vi.mock("../../components/AdminShell", () => ({ default: ({ children }) => <div>{children}</div> }));
const inventory = { packages: [{ key: "AUDIT-012", title: "Retest findings", kind: "retest", requirements: ["Remediation evidence"], acceptanceCriteria: ["Verify fixes"], operationalStatus: "evidence_needed" }], domains: ["external_reporting"], financialKeys: [], records: [], shares: [], questions: [], alerts: [], calendar: [], summary: { packageCount: 45, records: 0, readyRecords: 0, alerts: 0, decision: "hold_for_evidence" }, limits: { scope: "All-time inventory" } };
beforeEach(() => { vi.resetAllMocks(); });
test("shows unobserved inventory and sends a JSON draft to the authenticated API", async () => {
  apiRequest.mockResolvedValue(inventory);
  render(<ExternalReadiness user={{ _id: "owner" }} />);
  expect(await screen.findByText(/45 packages/)).toBeInTheDocument(); expect(screen.getByText(/Hold for evidence/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Retest plan" } });
  fireEvent.change(screen.getByLabelText("Scope"), { target: { value: "External reports" } });
  fireEvent.change(screen.getByLabelText("Due At (UTC)"), { target: { value: "2027-01-01T12:00" } });
  fireEvent.change(screen.getByLabelText("Expires At (UTC)"), { target: { value: "2027-02-01T12:00" } });
  fireEvent.change(screen.getByLabelText("Reason for this action"), { target: { value: "Prepare review" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/external-readiness/records", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } })));
  const body = JSON.parse(apiRequest.mock.calls.find((c) => c[1]?.method === "POST")[1].body); expect(body).toMatchObject({ title: "Retest plan", reason: "Prepare review", owner: "owner", packageKey: "AUDIT-012" });
});
test("displays load errors without claiming readiness", async () => {
  apiRequest.mockRejectedValue(new Error("Forbidden")); render(<ExternalReadiness user={{}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden"); expect(screen.queryByText(/45 packages/)).not.toBeInTheDocument();
});
test("recipient sees approved summary and can ask a question", async () => {
  apiRequest.mockResolvedValue({ packet: { title: "Scoped packet", summary: "Approved summary", scope: "Reports", exclusions: "Private records", expiresAt: "2027-01-01", watermark: "Recipient watermark", withdrawalRule: "Expires on change" }, questions: [] });
  render(<MemoryRouter initialEntries={["/readiness/packets/share1"]}><Routes><Route path="/readiness/packets/:shareId" element={<ReadinessPacket />} /></Routes></MemoryRouter>);
  expect(await screen.findByText("Approved summary")).toBeInTheDocument(); fireEvent.change(screen.getByLabelText("Ask a question"), { target: { value: "Which reporting period?" } }); fireEvent.click(screen.getByRole("button", { name: "Submit question" }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/external-readiness/shares/share1/questions", expect.objectContaining({ method: "POST", body: JSON.stringify({ question: "Which reporting period?" }) })));
});
