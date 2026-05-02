import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorEarningsPage from "../CreatorEarningsPage";
import CreatorPayoutsPage from "../CreatorPayoutsPage";
import { useCreatorWorkspace } from "../../../components/creator/useCreatorWorkspace";

vi.mock("../../../components/creator/useCreatorWorkspace", () => ({
  useCreatorWorkspace: vi.fn(),
}));

const baseWorkspace = {
  creatorProfile: {
    accountNumber: "0048044805",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
  },
  dashboard: {
    summary: {
      grossRevenue: 2500,
      totalEarnings: 1000,
      availableBalance: 1000,
      pendingBalance: 0,
      withdrawn: 0,
      walletBacked: true,
    },
    wallet: {
      walletBacked: true,
      settlementSource: "wallet",
      summary: {
        grossRevenue: 2500,
        totalEarnings: 1000,
        availableBalance: 1000,
        pendingBalance: 0,
        withdrawn: 0,
        walletBacked: true,
      },
      payoutReadiness: {
        ready: true,
        status: "ready",
        label: "Ready",
        nextStep: "Your creator payout profile is ready for settlement review.",
        accountNumberMasked: "******4805",
        checks: [
          { key: "account_number", label: "Account number", complete: true },
          { key: "country", label: "Country", complete: true },
        ],
      },
      breakdown: [
        {
          key: "track",
          label: "Music",
          grossRevenue: 2500,
          creatorEarnings: 1000,
          transactions: 1,
        },
      ],
      recentEntries: [
        {
          id: "entry-1",
          entryType: "sale_credit",
          label: "Sale credited",
          amount: 1000,
          grossAmount: 2500,
          bucket: "available",
          direction: "credit",
          itemLabel: "Music",
          effectiveAt: "2026-04-08T05:18:26.928Z",
          providerRef: "TGN_TRACK_TEST",
        },
      ],
    },
    categories: {
      music: { earnings: 1000 },
      bookPublishing: { earnings: 0 },
      podcast: { earnings: 0 },
    },
  },
};

describe("Creator wallet pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreatorWorkspace.mockReturnValue(baseWorkspace);
  });

  it("renders wallet-backed earnings details", () => {
    render(
      <MemoryRouter>
        <CreatorEarningsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Wallet settlement breakdown")).toBeInTheDocument();
    expect(screen.getByText(/live wallet ledger is active/i)).toBeInTheDocument();
    expect(screen.getByText("Recent wallet activity")).toBeInTheDocument();
    expect(screen.getAllByText(/₦1,000/i).length).toBeGreaterThan(0);
  });

  it("renders payout readiness and recent settlement activity", () => {
    render(
      <MemoryRouter>
        <CreatorPayoutsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Payout readiness")).toBeInTheDocument();
    expect(screen.getByText("Settlement source")).toBeInTheDocument();
    expect(screen.getByText("Live wallet ledger")).toBeInTheDocument();
    expect(screen.getByText("******4805")).toBeInTheDocument();
    expect(screen.getByText("Next step")).toBeInTheDocument();
    expect(screen.getByText("Recent settlement activity")).toBeInTheDocument();
    expect(screen.getByText("Sale credited")).toBeInTheDocument();
  });
});
