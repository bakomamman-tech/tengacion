import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorDashboardPage from "../CreatorDashboardPage";
import { useCreatorWorkspace } from "../../../components/creator/useCreatorWorkspace";

vi.mock("../../../components/creator/useCreatorWorkspace", () => ({
  useCreatorWorkspace: vi.fn(),
}));

describe("CreatorDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows upload launch cards with upload-only actions", () => {
    useCreatorWorkspace.mockReturnValue({
      creatorProfile: {
        displayName: "Creator Example",
        creatorTypes: ["music", "bookPublishing", "podcast"],
      },
      dashboard: {
        summary: {
          totalEarnings: 0,
          availableBalance: 0,
          pendingBalance: 0,
          withdrawn: 0,
        },
        categories: {
          music: { uploads: 2, drafts: 1, earnings: 0, underReview: 0 },
          bookPublishing: { uploads: 1, drafts: 0, earnings: 0, underReview: 0 },
          podcast: { uploads: 3, drafts: 1, earnings: 0, underReview: 1 },
        },
        verificationOverview: {},
        recentActivity: [],
        activation: {
          completedCount: 3,
          totalSteps: 6,
          progressPercent: 50,
          nextStep: {
            key: "first_upload_started",
            label: "First upload started",
            actionLabel: "Start first upload",
            actionTo: "/creator/music/upload",
          },
          steps: [
            {
              key: "account_created",
              label: "Account created",
              description: "Your creator profile exists in Tengacion.",
              complete: true,
            },
            {
              key: "creator_lane_selected",
              label: "Creator lane selected",
              description: "Music, book publishing, or podcast lanes are enabled.",
              complete: true,
            },
            {
              key: "profile_ready",
              label: "Profile ready",
              description: "Identity, creator terms, and publishing basics are saved.",
              complete: true,
            },
            {
              key: "first_upload_started",
              label: "First upload started",
              description: "A draft or submitted creator upload exists.",
              complete: false,
            },
          ],
        },
      },
    });

    render(
      <MemoryRouter>
        <CreatorDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("link", { name: /music uploads/i })[0]).toHaveAttribute("href", "/creator/music/upload");
    expect(screen.getAllByRole("link", { name: /book publishing uploads/i })[0]).toHaveAttribute("href", "/creator/books/upload");
    expect(screen.getAllByRole("link", { name: /podcast uploads/i })[0]).toHaveAttribute("href", "/creator/podcasts/upload");
    expect(screen.getByText(/3 of 6 steps complete/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start first upload/i })).toHaveAttribute("href", "/creator/music/upload");
    expect(screen.queryByRole("link", { name: /open music/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open book publishing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open podcast/i })).not.toBeInTheDocument();
  }, 15000);
});
