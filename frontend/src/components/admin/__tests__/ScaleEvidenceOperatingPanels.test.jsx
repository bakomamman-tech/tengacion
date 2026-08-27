import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScaleEvidenceOperatingPanels from "../ScaleEvidenceOperatingPanels";

describe("ScaleEvidenceOperatingPanels", () => {
  it("renders the ten-package scale evidence surface and privacy boundary", () => {
    render(<ScaleEvidenceOperatingPanels navigate={vi.fn()} payload={{
      summary: { roadmapPackagesComplete: 10, decision: "expand" },
      roadmapPackages: Array.from({ length: 10 }, (_, index) => ({ key: `SCALE-${index + 1}`, title: "Package", status: "COMPLETE" })),
      partnerReporting: { privacyBoundary: { aggregationOnly: true, excludedFields: ["user identity"] }, commerce: {} },
      sloBudgets: { summary: {}, policies: [] },
    }} />);

    expect(screen.getByTestId("scale-evidence-operating-system")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText(/user identity/i)).toBeInTheDocument();
    expect(screen.getByText("Production SLOs And Error Budgets")).toBeInTheDocument();
    expect(screen.getByText("Expansion Scorecard")).toBeInTheDocument();
  });
});
