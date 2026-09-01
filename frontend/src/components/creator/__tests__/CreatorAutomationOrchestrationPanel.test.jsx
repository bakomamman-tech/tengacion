import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import CreatorAutomationOrchestrationPanel from "../CreatorAutomationOrchestrationPanel";
import { updateCreatorAutomationRunControl, updateCreatorWorkflowRunControl } from "../../../api";

vi.mock("../../../api", () => ({
  updateCreatorAutomationRunControl: vi.fn(),
  updateCreatorWorkflowRunControl: vi.fn(),
}));

describe("CreatorAutomationOrchestrationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCreatorAutomationRunControl.mockResolvedValue({ success: true });
    updateCreatorWorkflowRunControl.mockResolvedValue({ success: true });
  });

  it("shows calm owned status and saves bounded user controls", async () => {
    const onRefresh = vi.fn();
    render(<CreatorAutomationOrchestrationPanel payload={{
      summary: { activeWorkflows: 1 },
      automations: [{ id: "automation-1", automationKey: "catalog_reminder", userVisibleMessage: "Review one item with missing catalog details.", status: "suggested", riskClass: "low_risk_action", ownerName: "Creator Ops", triggerSummary: "A catalog check found missing metadata.", sourceSignals: [{ key: "catalog_quality" }] }],
      workflows: [{ id: "workflow-1", workflowKey: "creator_launch_readiness", currentState: "blocked", userVisibleStatus: "Launch checks need one update.", waitingOn: "Catalog review", nextStep: "Complete the missing metadata.", ownerName: "Launch Lead", dependencies: [{ type: "catalog_quality", blocking: true, userVisibleCopy: "Catalog checks are pending." }] }],
      privacyBoundary: "Only your records are shown.", authorityBoundary: "Controls do not approve transitions.",
    }} onRefresh={onRefresh} />);

    expect(screen.getByText("Review one item with missing catalog details.")).toBeInTheDocument();
    expect(screen.getByText("Launch checks need one update.")).toBeInTheDocument();
    expect(screen.getByText(/Catalog checks are pending/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(updateCreatorAutomationRunControl).toHaveBeenCalledWith("automation-1", { state: "dismissed", feedback: "not_relevant" }));
    expect(onRefresh).toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Request help" })[1]);
    await waitFor(() => expect(updateCreatorWorkflowRunControl).toHaveBeenCalledWith("workflow-1", { state: "help_requested" }));
  });

  it("does not invent empty workflow evidence", () => {
    render(<CreatorAutomationOrchestrationPanel payload={{ authorityBoundary: "No transition authority." }} />);
    expect(screen.getByText(/No governed automation or workflow is active/i)).toBeInTheDocument();
    expect(screen.getByText("No transition authority.")).toBeInTheDocument();
  });
});
