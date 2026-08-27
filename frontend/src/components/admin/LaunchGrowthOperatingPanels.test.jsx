import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LaunchGrowthOperatingPanels from "./LaunchGrowthOperatingPanels";

const payload = {
  summary: {
    packagesAvailable: 10,
    packagesImplemented: 10,
    launchDecision: "controlled_expansion_allowed",
    payoutPreflightEligible: 2,
    creatorCohortCandidates: 1,
    fanRenewalRisk: 1,
    supportSlaBreaches: 0,
  },
  roadmapPackages: Array.from({ length: 10 }, (_, index) => ({
    id: `ROADMAP-${index + 1}`,
    title: `Package ${index + 1}`,
    status: "COMPLETE",
  })),
  payoutAutomation: {
    policy: { enabled: true },
    summary: { evaluated: 3, eligible: 2, humanReview: 1, blocked: 0 },
  },
  creatorLifecycle: {
    summary: { launchReady: 1 },
    programSummary: [{ key: "first_paid_drop", title: "First Paid Drop", active: 1 }],
    launchCohortCandidates: [{
      creatorProfileId: "creator-1",
      displayName: "Launch Creator",
      launchReadinessState: "ready",
      lifecycleStage: "first_sale_recovery",
      recommendedProgramKey: "first_paid_drop",
      program: { title: "First Paid Drop" },
      metrics: { catalogItems: 2, paidSales: 0 },
    }],
  },
  fanLifecycle: {
    summary: { renewalRisk: 1, stageCounts: { renewal_risk: 1 } },
    subscriptionDiagnostics: {
      failedRenewals: 1,
      cancellationScheduled: 0,
      gracePeriodRecoveries: 0,
      renewalAfterCreatorActivity: 0,
    },
  },
  firstWeekActivation: {
    summary: { entrants: 4, meaningfulActionRate: 0.75, firstWeekReturnRate: 0.5, paidActivationRate: 0.25 },
    states: [{ key: "followed", count: 3 }],
    bySource: [{ source: "creator_share", activationRate: 0.75 }],
  },
  revenueCampaigns: {
    summary: { ready: 1, active: 0 },
    campaigns: [{
      id: "campaign-1",
      name: "Creator Drop Week",
      status: "ready",
      readinessState: "ready",
      ledgerTrackingKey: "creator_drop_week",
      discountPercent: 10,
      rollbackPlan: "Pause campaign placements",
    }],
  },
  supportTrust: {
    summary: { breached: 0 },
    macros: [{ key: "payment_access" }],
    queues: [{
      key: "content_report",
      title: "Content Reports",
      status: "ready",
      open: 0,
      breached: 0,
      targetHours: 24,
      escalationOwner: "Trust and safety",
      actionPath: "/admin/reports",
    }],
  },
  launchGovernance: {
    readinessState: "ready",
    decision: "controlled_expansion_allowed",
    launchReport: { knownRisks: [] },
  },
};

describe("LaunchGrowthOperatingPanels", () => {
  it("renders all ten roadmap packages and the connected operating views", () => {
    render(<LaunchGrowthOperatingPanels payload={payload} navigate={vi.fn()} />);

    expect(screen.getByTestId("next-ten-roadmap-operations")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /launch and growth operating system/i })).toBeInTheDocument();
    expect(screen.getByText("ROADMAP-10 · COMPLETE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /controlled payout automation/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /creator lifecycle and first cohort/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /fan lifecycle and subscription retention/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /first-week fan activation/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /reversible revenue campaigns/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /public support and trust operations/i })).toBeInTheDocument();
  });

  it("routes operators to authoritative payout, assurance, creator, campaign, and support surfaces", () => {
    const navigate = vi.fn();
    render(<LaunchGrowthOperatingPanels payload={payload} navigate={navigate} />);

    fireEvent.click(screen.getByRole("button", { name: /open payout operations/i }));
    fireEvent.click(screen.getByRole("button", { name: /open command center/i }));
    fireEvent.click(screen.getByRole("button", { name: /launch creator/i }));
    fireEvent.click(screen.getByRole("button", { name: /creator drop week/i }));
    fireEvent.click(screen.getByRole("button", { name: /content reports/i }));

    expect(navigate).toHaveBeenNthCalledWith(1, "/admin/creator-earnings");
    expect(navigate).toHaveBeenNthCalledWith(2, "/admin/assurance");
    expect(navigate).toHaveBeenNthCalledWith(3, "/admin/creators/creator-1");
    expect(navigate).toHaveBeenNthCalledWith(4, "/admin/campaigns");
    expect(navigate).toHaveBeenNthCalledWith(5, "/admin/reports");
  });
});
