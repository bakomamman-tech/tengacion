import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ResilienceAssuranceAuditOperatingPanels from "../ResilienceAssuranceAuditOperatingPanels";

describe("ResilienceAssuranceAuditOperatingPanels", () => {
  it("keeps plans, evidence freshness, audit closure, and Akuso authority explicit", () => {
    render(<ResilienceAssuranceAuditOperatingPanels payload={{
      summary: { roadmapPackagesComplete: 40, openIncidents: 1, drillsObserved: 0, assuranceControls: 1, auditControlsTested: 0, openAuditFindings: 1, operatingDecision: "hold_for_evidence" },
      roadmapPackages: [{ key: "RESILIENCE-002", title: "Graceful degradation", status: "COMPLETE" }, { key: "AUDIT-011", title: "Findings report", status: "COMPLETE" }],
      resilience: {
        summary: { criticalIncidents: 0, drillsPlanned: 1, drillsObserved: 0, gatesApproved: 0 },
        incidents: [{ id: "incident-1", incidentClass: "checkout_failure", severity: "degraded", degradedMode: "queue_only", ownerName: "Reliability Lead" }],
        readinessReport: { decision: "hold_for_evidence", externalUseBoundary: "Targets are not outcomes." },
      },
      assurance: {
        summary: { controlsCurrent: 0, controlsConfigured: 1, evidencePacks: 1, openHighCriticalExceptions: 0, externalPacksApproved: 0 },
        controls: [{ id: "control-1", controlKey: "payment_verification", evidenceFreshness: "delayed", ownerName: "Finance Lead", exceptionSeverity: "none" }],
        operatingReport: { decision: "hold_for_assurance_evidence", externalUseBoundary: "Only reviewed evidence may be shared." },
      },
      audit: {
        summary: { domainsTested: 0, controlsTested: 0, failed: 0, retestQueue: 0 },
        findings: [{ id: "finding-1", findingKey: "evidence_gap", severity: "medium", status: "open", retestState: "not_ready" }],
        findingsReport: { decision: "internal_remediation_required" },
      },
    }} />);

    expect(screen.getByTestId("resilience-assurance-audit-operating-system")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText(/scheduled drill is not counted as observed/i)).toBeInTheDocument();
    expect(screen.getByText(/stale, disputed, restricted, or unreviewed evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/owner assertion alone cannot close a finding/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot declare recovery, approve a gate, close a finding, accept risk/i)).toBeInTheDocument();
  });
});
