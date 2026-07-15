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
  totalChests: 50,
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
      remainingChests: 50,
    });
  });

  it("defines fifty permitted placements and shows the six assigned Home stars", async () => {
    expect(DISCOVERY_PLACEMENTS).toHaveLength(50);
    expect(new Set(DISCOVERY_PLACEMENTS.map((placement) => placement.id)).size).toBe(50);
    expect(DISCOVERY_PLACEMENTS.every((placement) => !/^\/(admin|creator|marketplace)(?:\/|$)/i.test(placement.route))).toBe(true);

    renderDiscovery();

    const stars = await screen.findAllByRole("button", { name: /open discovery star/i });
    expect(stars).toHaveLength(6);
    expect(stars.map((star) => star.getAttribute("aria-label"))).toEqual(expect.arrayContaining([
      expect.stringContaining("star 4 of 50 near Stories tray"),
      expect.stringContaining("star 5 of 50 near Post composer"),
      expect.stringContaining("star 7 of 50 near Right quick-navigation sidebar"),
    ]));
  });

  it("distributes checkpoints by route and excludes Creator and Marketplace", async () => {
    const messagesView = renderDiscovery({}, "/messages");
    expect(await screen.findByRole("button", { name: /star 2 of 50 near Conversation sidebar/i })).toBeInTheDocument();
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
      remainingChests: 47,
    });

    renderDiscovery();

    const stars = await screen.findAllByRole("button", { name: /open discovery star/i });
    expect(stars).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /star 4 of 50/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /star 7 of 50/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /star 16 of 50/i })).not.toBeInTheDocument();
  });

  it("removes a newly revealed position immediately for other connected users", async () => {
    renderDiscovery();
    expect(await screen.findByRole("button", { name: /Open discovery star 4 of 50/i })).toBeInTheDocument();

    act(() => {
      socketHandlers.get("top-up-promo:discovered")?.({
        chestNumber: 4,
        discoveredChestNumbers: [4],
        remainingChests: 49,
      });
    });

    expect(screen.queryByRole("button", { name: /Open discovery star 4 of 50/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /open discovery star/i })).toHaveLength(5);
  });

  it("renders no discovery stars once the shared count reaches zero", async () => {
    statusMock.mockResolvedValue({
      campaign,
      visibility: { visible: true, reason: "available" },
      hasPlayed: false,
      play: null,
      discoveredChestNumbers: Array.from({ length: 50 }, (_, index) => index + 1),
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
      remainingChests: 49,
    };
    discoverMock.mockRejectedValue(error);

    renderDiscovery();
    fireEvent.click(await screen.findByRole("button", { name: /Open discovery star 4 of 50/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Open discovery star 4 of 50/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /open discovery star/i })).toHaveLength(5);
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
    fireEvent.click(await screen.findByRole("button", { name: /Open discovery star 4 of 50/i }));

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
    expect(await screen.findAllByRole("button", { name: /open discovery star/i })).toHaveLength(6);
  });

  it("renders and submits the fiftieth chest on its assigned route", async () => {
    discoverMock.mockResolvedValue({
      campaign,
      hasPlayed: true,
      play: {
        id: "play-50",
        chestNumber: 50,
        outcome: "water",
        won: false,
        prizeAmount: 0,
        passcode: "",
        discoveredAt: "2026-07-15T17:50:00.000Z",
      },
    });

    renderDiscovery({}, "/birthdays");
    fireEvent.click(await screen.findByRole("button", { name: /Open discovery star 50 of 50/i }));
    await waitFor(() => expect(discoverMock).toHaveBeenCalledWith(50));
  });
});
