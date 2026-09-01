import { render, screen } from "@testing-library/react";

import NetworkIntelligenceOperatingPanels from "../NetworkIntelligenceOperatingPanels";

describe("NetworkIntelligenceOperatingPanels", () => {
  it("renders trust blockers and the no-execution automation boundary", () => {
    render(<NetworkIntelligenceOperatingPanels payload={{
      summary: {
        roadmapPackagesComplete: 30,
        intelligenceDecision: "hold_for_trusted_evidence",
        automationDecision: "registry_established_no_execution",
      },
      roadmapPackages: [{ key: "AUTOMATION-001", title: "Automation registry", status: "COMPLETE" }],
      network: { programs: { summary: {}, programs: [] }, partnerGraduation: { summary: {}, assessments: [] } },
      intelligence: {
        metricContracts: { summary: { configured: 1, required: 15, blocked: 14 }, contracts: [{ metricKey: "gmv", title: "Gross merchandise value", trustState: "disputed", configured: true, canDriveDecision: false, trustReason: "Reconciliation mismatch" }] },
        products: { summary: {}, products: [] },
        predictiveOperations: { summary: {}, warnings: [] },
      },
      automation: { registry: { summary: { executionEnabled: 0 }, entries: [], launchBoundary: "No execution authority." } },
      readiness: { network: { decision: "hold_or_repeat_with_measurement", blockers: [] }, intelligence: { blockers: ["metric_contracts_incomplete"] } },
    }} />);

    expect(screen.getByTestId("network-intelligence-operating-system")).toBeInTheDocument();
    expect(screen.getByText("Reconciliation mismatch · decision use blocked")).toBeInTheDocument();
    expect(screen.getByText("No execution authority.")).toBeInTheDocument();
  });
});
