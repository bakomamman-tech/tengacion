import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ExpansionPlatformOperatingPanels from "../ExpansionPlatformOperatingPanels";

describe("ExpansionPlatformOperatingPanels", () => {
  it("renders the twenty-package operating surface and privacy/economics boundaries", () => {
    render(<ExpansionPlatformOperatingPanels navigate={vi.fn()} payload={{
      summary: { roadmapPackagesComplete: 20, unitEconomicsCompleteness: "partial", nextPrimaryFocus: "data_platform_and_experimentation" },
      roadmapPackages: Array.from({ length: 20 }, (_, index) => ({ key: `NEXT-${index + 1}`, title: "Package", status: "COMPLETE" })),
      referralAttribution: { summary: { inviteSent: 3, linkOpened: 2 }, bySource: [], privacyBoundary: { userIdsExposed: false } },
      unitEconomics: { summary: { grossRevenue: 1000, knownCreatorEarnings: 800, knownContribution: 150, completenessState: "partial" }, instrumentationGaps: ["Support cost proxy is not instrumented."], topLevers: [] },
      platform: { objectModel: [{ key: "campaign", authority: "RevenueCampaign", statuses: ["draft", "active"] }] },
    }} />);

    expect(screen.getByTestId("expansion-platform-operating-system")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText(/fan-level rows exposed: no/i)).toBeInTheDocument();
    expect(screen.getByText(/support cost proxy is not instrumented/i)).toBeInTheDocument();
    expect(screen.getByText("Shared Platform Objects")).toBeInTheDocument();
    expect(screen.getByText(/RevenueCampaign/i)).toBeInTheDocument();
  });
});
