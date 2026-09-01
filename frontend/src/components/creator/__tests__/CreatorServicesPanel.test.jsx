import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CreatorServicesPanel from "../CreatorServicesPanel";

describe("CreatorServicesPanel", () => {
  it("renders explicit service participation and does not imply premium enrollment", () => {
    render(<CreatorServicesPanel creatorServices={{
      summary: { active: 1 },
      programs: [{ key: "launch_coaching", title: "Launch coaching", expectedOutcome: "A reviewed launch", supportOwner: "Creator growth" }],
      enrollments: [{ id: "one", programKey: "launch_coaching", status: "active", serviceTier: "basic_support", ownerName: "Creator Lead", progress: { completedSteps: 2, totalSteps: 5 }, reviewAt: "2026-09-10T00:00:00.000Z" }],
    }} />);

    expect(screen.getByTestId("creator-services-panel")).toBeInTheDocument();
    expect(screen.getByText("Launch Coaching")).toBeInTheDocument();
    expect(screen.getByText(/2 of 5 steps/i)).toBeInTheDocument();
    expect(screen.getByText("Basic Support")).toBeInTheDocument();
  });
});
