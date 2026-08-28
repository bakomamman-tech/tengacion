import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorLaunchPlannerPanel from "../CreatorLaunchPlannerPanel";
import {
  createCreatorLaunchPlan,
  updateCreatorLaunchPlan,
} from "../../../api";

vi.mock("../../../api", () => ({
  createCreatorLaunchPlan: vi.fn(),
  createCreatorReferral: vi.fn(),
  updateCreatorLaunchPlan: vi.fn(),
}));

const playbook = {
  key: "first_paid_music_drop",
  title: "First paid music drop",
  offerTypes: ["paid_drop", "bundle"],
  pricingGuidance: "Review the current catalog range.",
  readinessState: "ready",
  blockers: [],
  postLaunchReviewMetric: "paid_unlocks",
};

describe("CreatorLaunchPlannerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCreatorLaunchPlan.mockResolvedValue({ success: true, plan: { id: "plan-1" } });
    updateCreatorLaunchPlan.mockResolvedValue({ success: true });
  });

  it("creates a governed launch plan from the creator workspace", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockResolvedValue();
    render(<CreatorLaunchPlannerPanel businessSuite={{ playbooks: [playbook], offerTypes: ["paid_drop"], plans: [], summary: {} }} creatorProfile={{}} onRefresh={onRefresh} />);

    await user.type(screen.getByLabelText("Launch title"), "Friday drop");
    await user.type(screen.getByLabelText("Launch date"), "2026-09-01T12:00");
    await user.type(screen.getByLabelText("Price (NGN)"), "2000");
    await user.type(screen.getByLabelText("Announcement draft"), "A truthful reviewed fan announcement.");
    await user.type(screen.getByLabelText("Fan update plan"), "One consent-aware creator update.");
    await user.click(screen.getByLabelText("Cover ready"));
    await user.click(screen.getByLabelText("Preview ready"));
    await user.click(screen.getByRole("button", { name: "Create launch plan" }));

    await waitFor(() => expect(createCreatorLaunchPlan).toHaveBeenCalledWith(expect.objectContaining({
      title: "Friday drop",
      playbookType: "first_paid_music_drop",
      offerType: "paid_drop",
      price: 2000,
      coverReady: true,
      previewReady: true,
    })));
    expect(onRefresh).toHaveBeenCalled();
    expect(screen.getByText(/launch plan created/i)).toBeInTheDocument();
  });

  it("persists checklist progress and keeps elevated review explicit", async () => {
    const user = userEvent.setup();
    render(<CreatorLaunchPlannerPanel businessSuite={{
      playbooks: [playbook],
      plans: [{ id: "plan-1", title: "Live night", offerType: "live_event_pass", status: "planning", riskLevel: "elevated", price: 5000, currency: "NGN", checklist: [{ key: "capacity", label: "Confirm capacity", complete: false }] }],
      summary: { activePlans: 1 },
    }} creatorProfile={{}} />);

    await user.click(screen.getByRole("button", { name: "Complete next step" }));
    await waitFor(() => expect(updateCreatorLaunchPlan).toHaveBeenCalledWith("plan-1", {
      checklist: [{ key: "capacity", complete: true }],
    }));
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeInTheDocument();
    expect(screen.getByText(/stays human-reviewed/i)).toBeInTheDocument();
  });
});
