import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EcosystemNetworkOperatingPanels from "../EcosystemNetworkOperatingPanels";

describe("EcosystemNetworkOperatingPanels", () => {
  it("renders the twenty-five packages and bounded network state", () => {
    render(<EcosystemNetworkOperatingPanels payload={{
      summary: { roadmapPackagesComplete: 25, ecosystemDecision: "hold_or_repeat_with_measurement", networkState: "defined_not_launched" },
      roadmapPackages: Array.from({ length: 25 }, (_, index) => ({ key: `NEXT-${index + 1}`, title: "Package", status: "COMPLETE" })),
      ecosystem: {
        creatorServices: { summary: {}, programs: [], enrollments: [] },
        communityLoops: { summary: {}, catalog: [], programs: [] },
        partnerIntegrations: { summary: {}, integrations: [] },
        marketReadiness: { summary: {}, markets: [] },
      },
      platform: { scaleValidation: { drills: [] } },
      readiness: { platform: { decision: "hold_for_evidence", blockers: ["scale_drills_missing"] } },
      network: { creatorBusinessNetworkModel: { status: "defined_not_launched", objects: [], launchBoundary: "Definition only; no network is launched." } },
    }} />);

    expect(screen.getByTestId("ecosystem-network-operating-system")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getAllByText("Defined Not Launched").length).toBeGreaterThan(0);
    expect(screen.getByText(/private fan rows are never exposed/i)).toBeInTheDocument();
    expect(screen.getByText(/no network is launched/i)).toBeInTheDocument();
  });
});
