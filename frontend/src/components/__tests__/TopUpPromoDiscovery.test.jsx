import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { discoverMock, socketHandlers, socketMock, statusMock } = vi.hoisted(() => {
  const handlers = new Map();
  return {
    discoverMock: vi.fn(),
    socketHandlers: handlers,
    socketMock: {
      on: vi.fn((eventName, handler) => handlers.set(eventName, handler)),
      off: vi.fn((eventName) => handlers.delete(eventName)),
    },
    statusMock: vi.fn(),
  };
});

vi.mock("../../api", () => ({
  discoverTopUpPromoChest: discoverMock,
  getTopUpPromoStatus: statusMock,
}));

vi.mock("../../socket", () => ({
  getSocket: () => socketMock,
}));

import TopUpPromoDiscovery from "../TopUpPromoDiscovery";
import { DISCOVERY_PLACEMENTS } from "../topUpPromoConfig";

const user = {
  _id: "user-1",
  name: "Amina Yusuf",
  username: "amina",
  role: "user",
};

const campaign = {
  title: "Top-Up Bank Account Promo",
  totalChests: 103,
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
    socketHandlers.clear();
    vi.stubGlobal("scrollTo", vi.fn());
    statusMock.mockResolvedValue({
      campaign,
      visibility: { visible: true, reason: "available" },
      hasPlayed: false,
      play: null,
      discoveredChestNumbers: [],
      remainingChests: 103,
    });
  });

  it("defines 103 permitted placements and shows the twelve assigned Home stars", async () => {
    expect(DISCOVERY_PLACEMENTS).toHaveLength(103);
    expect(new Set(DISCOVERY_PLACEMENTS.map((placement) => placement.id)).size).toBe(103);
    expect(DISCOVERY_PLACEMENTS.every((placement) => !/^\/(admin|creator|marketplace)(?:\/|$)/i.test(placement.route))).toBe(true);

    renderDiscovery();

    const stars = await screen.findAllByRole("button", { name: /open discovery star/i });
    expect(stars).toHaveLength(12);
    expect(stars.map((star) => star.getAttribute("aria-label"))).toEqual(expect.arrayContaining([
      expect.stringContaining("star 4 of 103 near Stories tray"),
      expect.stringContaining("star 5 of 103 near Post composer"),
      expect.stringContaining("star 7 of 103 near Right quick-navigation sidebar"),
    ]));
  });

  it("distributes checkpoints by route and excludes Creator and Marketplace", async () => {
    const messagesView = renderDiscovery({}, "/messages");
    expect(await screen.findByRole("button", { name: /star 2 of 103 near Conversation sidebar/i })).toBeInTheDocument();
    messagesView.unmount();

    renderDiscovery({}, "/creator/dashboard");
    await waitFor(() => expect(statusMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /open discovery star/i })).not.toBeInTheDocument();

    renderDiscovery({}, "/marketplace");
    expect(screen.queryByRole("button", { name: /open discovery star/i })).not.toBeInTheDocument();
  });

  it("removes every globally discovered position from the star map", async () => {
    statusMock.mockResolvedValue({
      campaign,
      visibility: { visible: true, reason: "available" },
      hasPlayed: false,
      play: null,
      discoveredChestNumbers: [4, 7, 16],
      remainingChests: 100,
    });

    renderDiscovery();

    const stars = await screen.findAllByRole("button", { name: /open discovery star/i });
    expect(stars).toHaveLength(9);
    expect(screen.queryByRole("button", { name: /star 4 of 103/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /star 7 of 103/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /star 16 of 103/i })).not.toBeInTheDocument();
  });

  it("removes a newly revealed position immediately for other connected users", async () => {
    renderDiscovery();
    expect(await screen.findByRole("button", { name: /Open discovery star 4 of 103/i })).toBeInTheDocument();

    act(() => {
      socketHandlers.get("top-up-promo:discovered")?.({
        chestNumber: 4,
        discoveredChestNumbers: [4],
        remainingChests: 102,
      });
    });

    expect(screen.queryByRole("button", { name: /Open discovery star 4 of 103/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /open discovery star/i })).toHaveLength(11);
  });

  it("keeps every other available star blinking after this user reveals water", async () => {
    statusMock.mockResolvedValue({
      campaign,
      visibility: { visible: true, reason: "available" },
      hasPlayed: true,
      play: {
        id: "water-play-1",
        chestNumber: 4,
        outcome: "water",
        won: false,
        prizeAmount: 0,
        passcode: "",
        discoveredAt: "2026-07-15T17:20:00.000Z",
      },
      discoveredChestNumbers: [4],
      remainingChests: 102,
    });

    renderDiscovery();

    const availableStars = await screen.findAllByRole("button", {
      name: /available discovery star/i,
    });
    expect(availableStars).toHaveLength(11);
    expect(screen.queryByRole("button", { name: /star 4 of 103/i })).not.toBeInTheDocument();
    availableStars.forEach((star) => {
      expect(star).toBeDisabled();
      expect(star).toHaveClass("topup-discovery-star");
    });
    expect(screen.getByRole("button", { name: /view promo result/i })).toBeInTheDocument();
  });

  it("renders no discovery stars once the shared count reaches zero", async () => {
    statusMock.mockResolvedValue({
      campaign,
      visibility: { visible: true, reason: "available" },
      hasPlayed: false,
      play: null,
      discoveredChestNumbers: Array.from({ length: 103 }, (_, index) => index + 1),
      remainingChests: 0,
    });

    renderDiscovery();

    await waitFor(() => expect(statusMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /open discovery star/i })).not.toBeInTheDocument();
  });

  it("removes a star when another user reveals it before this user's click completes", async () => {
    const error = new Error("Another user just discovered this chest.");
    error.payload = {
      code: "chest_already_discovered",
      discoveredChestNumbers: [4],
      remainingChests: 102,
    };
    discoverMock.mockRejectedValue(error);

    renderDiscovery();
    fireEvent.click(await screen.findByRole("button", { name: /Open discovery star 4 of 103/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Open discovery star 4 of 103/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /open discovery star/i })).toHaveLength(11);
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
    fireEvent.click(await screen.findByRole("button", { name: /Open discovery star 4 of 103/i }));

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

  it("keeps the promo visible for non-admin account types", async () => {
    renderDiscovery({ user: { ...user, role: "artist" } });
    expect(await screen.findAllByRole("button", { name: /open discovery star/i })).toHaveLength(12);
  });

  it("renders and submits the 103rd chest on its assigned route", async () => {
    discoverMock.mockResolvedValue({
      campaign,
      hasPlayed: true,
      play: {
        id: "play-103",
        chestNumber: 103,
        outcome: "water",
        won: false,
        prizeAmount: 0,
        passcode: "",
        discoveredAt: "2026-07-15T17:53:00.000Z",
      },
    });

    renderDiscovery({}, "/notifications");
    fireEvent.click(await screen.findByRole("button", { name: /Open discovery star 103 of 103/i }));
    await waitFor(() => expect(discoverMock).toHaveBeenCalledWith(103));
  });
});
