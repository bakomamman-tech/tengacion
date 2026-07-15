import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { discoverMock, statusMock } = vi.hoisted(() => ({
  discoverMock: vi.fn(),
  statusMock: vi.fn(),
}));

vi.mock("../../api", () => ({
  discoverTopUpPromoChest: discoverMock,
  getTopUpPromoStatus: statusMock,
}));

import TopUpPromoDiscovery from "../TopUpPromoDiscovery";

const user = {
  _id: "user-1",
  name: "Amina Yusuf",
  username: "amina",
  role: "user",
};

const campaign = {
  title: "Top-Up Bank Account Promo",
  totalChests: 15,
  prizeChests: 2,
  prizeAmount: 5000,
  customerCarePhone: "08164649980",
  artworkUrl: "/assets/promos/top-up-bank-account-promo.png",
};

describe("TopUpPromoDiscovery", () => {
  const renderDiscovery = (props = {}, route = "/home") =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <TopUpPromoDiscovery user={user} onExploreTip={vi.fn()} {...props} />
      </MemoryRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("scrollTo", vi.fn());
    statusMock.mockResolvedValue({
      campaign,
      visibility: { visible: true, reason: "available" },
      hasPlayed: false,
      play: null,
    });
  });

  it("shows only the three strategically assigned Home stars after campaign status allows them", async () => {
    renderDiscovery();

    const stars = await screen.findAllByRole("button", { name: /open discovery star/i });
    expect(stars).toHaveLength(3);
    expect(stars.map((star) => star.getAttribute("aria-label"))).toEqual(expect.arrayContaining([
      expect.stringContaining("star 4 of 15 near Stories tray"),
      expect.stringContaining("star 5 of 15 near Post composer"),
      expect.stringContaining("star 7 of 15 near Right quick-navigation sidebar"),
    ]));
  });

  it("distributes checkpoints by route and excludes Creator and Marketplace", async () => {
    const messagesView = renderDiscovery({}, "/messages");
    expect(await screen.findByRole("button", { name: /star 2 of 15 near Conversation sidebar/i })).toBeInTheDocument();
    messagesView.unmount();

    renderDiscovery({}, "/creator/dashboard");
    await waitFor(() => expect(statusMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /open discovery star/i })).not.toBeInTheDocument();

    renderDiscovery({}, "/marketplace");
    expect(screen.queryByRole("button", { name: /open discovery star/i })).not.toBeInTheDocument();
  });

  it("reveals and preserves a server-issued winning passcode", async () => {
    discoverMock.mockResolvedValue({
      campaign,
      hasPlayed: true,
      play: {
        id: "play-1",
        chestNumber: 4,
        outcome: "win",
        won: true,
        prizeAmount: 5000,
        passcode: "K9P2QX7A",
        discoveredAt: "2026-07-15T17:20:00.000Z",
      },
    });

    renderDiscovery();
    fireEvent.click(await screen.findByRole("button", { name: /Open discovery star 4 of 15/i }));

    await waitFor(() => expect(discoverMock).toHaveBeenCalledWith(4));
    expect(await screen.findByText("K9P2QX7A")).toBeInTheDocument();
    expect(screen.getByText("You won ₦5,000!")).toBeInTheDocument();
    expect(screen.getByText(/Congratulations, Amina Yusuf/i)).toBeInTheDocument();
  });

  it("does not load or render promo stars for administrator accounts", async () => {
    renderDiscovery({ user: { ...user, role: "admin" } });
    await waitFor(() => expect(statusMock).not.toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /open discovery star/i })).not.toBeInTheDocument();
  });
});
