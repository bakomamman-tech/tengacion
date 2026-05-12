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
        wallet: {
          payoutReadiness: {
            ready: false,
            status: "profile_incomplete",
            label: "Profile incomplete",
            accountNumberMasked: "****7890",
            nextStep: "Add payout account details.",
          },
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
        operatingConsole: {
          funnel: {
            publishedItems: 3,
            paidItems: 2,
            engagement: 120,
            engagementToPurchaseRate: 2.5,
          },
          actionPrompts: [
            {
              key: "metadata_fixes",
              title: "1 content metadata fix",
              description: "Paid Single is missing Cover image.",
              actionLabel: "Fix metadata",
              actionTo: "/creator/music",
              tone: "neutral",
            },
          ],
          topContent: [
            {
              id: "track-1",
              itemType: "track",
              title: "Paid Single",
              earnings: 1200,
              purchases: 3,
              engagement: 99,
              actionTo: "/creator/music",
            },
          ],
          metadataFixes: [
            {
              id: "track-1",
              itemType: "track",
              title: "Paid Single",
              missingFields: ["Cover image", "Paid preview"],
              actionTo: "/creator/music",
            },
          ],
          recentSales: [
            {
              id: "sale-1",
              itemTitle: "Paid Single",
              itemLabel: "Track",
              buyer: { name: "Fan Example" },
              creatorAmount: 1200,
              paidAt: "2026-05-01T00:00:00.000Z",
            },
          ],
          recentSubscribers: [
            {
              id: "sub-1",
              buyer: { name: "Member Example" },
              amount: 2000,
              label: "Active",
              paidAt: "2026-05-02T00:00:00.000Z",
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
    expect(screen.getByText(/operating console/i)).toBeInTheDocument();
    expect(screen.getByText(/1 content metadata fix/i)).toBeInTheDocument();
    expect(screen.getAllByText(/paid single/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/profile incomplete/i)).toBeInTheDocument();
    expect(screen.getByText(/fan example/i)).toBeInTheDocument();
    expect(screen.getByText(/member example/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open music/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open book publishing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open podcast/i })).not.toBeInTheDocument();
  }, 15000);
});
