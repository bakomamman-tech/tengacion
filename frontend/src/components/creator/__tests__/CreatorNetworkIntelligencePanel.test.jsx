import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { updateCreatorIntelligencePrompt } from "../../../api";
import CreatorNetworkIntelligencePanel from "../CreatorNetworkIntelligencePanel";

vi.mock("../../../api", () => ({
  updateCreatorIntelligencePrompt: vi.fn(),
}));

describe("CreatorNetworkIntelligencePanel", () => {
  it("shows explainable prompts and records creator controls", async () => {
    updateCreatorIntelligencePrompt.mockResolvedValue({ success: true });
    const onRefresh = vi.fn();
    render(<CreatorNetworkIntelligencePanel payload={{
      intelligence: {
        summary: { available: 1 },
        prompts: [{
          id: "prompt-1",
          title: "Improve your preview",
          explanation: "Listeners completed more items with a clear preview.",
          sourceLabel: "Catalog health",
          sourceMetricKeys: ["creator_program_outcomes"],
          timeframeLabel: "Last 30 days",
          confidence: 0.72,
          limitations: "Your catalog is small, so treat this as directional.",
          suggestedAction: "Review one preview.",
        }],
      },
      networkPrograms: { programs: [] },
      privacyBoundary: "No private fan rows are exposed.",
    }} onRefresh={onRefresh} />);

    expect(screen.getByText((_, element) =>
      element?.tagName === "SMALL" && element.textContent.includes("72% confidence")
    )).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not relevant" }));
    await waitFor(() => expect(updateCreatorIntelligencePrompt).toHaveBeenCalledWith("prompt-1", {
      status: "dismissed",
      feedback: "not_relevant",
    }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("states the no-guess and opt-in boundaries when empty", () => {
    render(<CreatorNetworkIntelligencePanel payload={{ intelligence: {}, networkPrograms: {} }} />);
    expect(screen.getByText(/guessed benchmarks or private fan data/i)).toBeInTheDocument();
    expect(screen.getByText(/participation is never automatic/i)).toBeInTheDocument();
  });
});
