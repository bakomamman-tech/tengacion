import React from "react";
import toast from "react-hot-toast";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Sidebar from "../Sidebar";
import { getFriendsHub, getRechargeRaffleStatus, sendFriendRequest } from "../api";

const navigateMock = vi.fn();
const locationMock = { pathname: "/home" };

const createMatchMedia = (matches) =>
  vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

const setMatchMedia = (matches) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: createMatchMedia(matches),
  });
};

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn() },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => locationMock,
  };
});

vi.mock("../api", () => ({
  resolveImage: (value) => value,
  getRechargeRaffleStatus: vi.fn(() =>
    Promise.resolve({ visibility: { visible: true, reason: "available" } })
  ),
  getFriendsHub: vi.fn(() => Promise.resolve({ suggestions: [] })),
  sendFriendRequest: vi.fn(() => Promise.resolve({ sent: true })),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    toast.error.mockReset();
    getRechargeRaffleStatus.mockReset();
    getRechargeRaffleStatus.mockResolvedValue({
      visibility: { visible: true, reason: "available" },
    });
    getFriendsHub.mockReset();
    getFriendsHub.mockResolvedValue({ suggestions: [] });
    sendFriendRequest.mockReset();
    sendFriendRequest.mockResolvedValue({ sent: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the desktop navigation above the mobile breakpoint", async () => {
    setMatchMedia(false);

    const { container } = render(
      <Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} openChat={vi.fn()} />
    );

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
    expect(container.querySelector(".sidebar-mobile-feature")).not.toBeInTheDocument();

    const raffleCard = container.querySelector(".sidebar-raffle-card");
    expect(raffleCard).toBeInTheDocument();
  });

  it("renders the raffle card first on mobile instead of the desktop nav", async () => {
    setMatchMedia(true);

    const { container } = render(
      <Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} />
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(container.querySelector(".sidebar-mobile-feature")).toBeInTheDocument();
    expect(screen.getByText(/recharge raffle/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();

    const feature = container.querySelector(".sidebar-mobile-feature");
    const raffleCard = feature.querySelector(".sidebar-raffle-card");
    expect(feature.firstElementChild).toBe(raffleCard);
    expect(feature.childElementCount).toBe(1);
  });

  it("instructs users without both photos instead of opening the game", async () => {
    setMatchMedia(false);

    render(
      <Sidebar
        user={{
          _id: "user-1",
          name: "Ada",
          username: "ada",
          email: "ada@example.com",
          avatar: { url: "/uploads/ada.jpg" },
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^play$/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "Upload a profile picture and cover photo to be able to play"
    );
    expect(navigateMock).not.toHaveBeenCalledWith("/recharge-raffle");
  });

  it("opens the game for a user with profile and cover photos", async () => {
    setMatchMedia(false);
    getRechargeRaffleStatus.mockResolvedValueOnce({
      visibility: { visible: true, reason: "available" },
      eligibility: {
        eligible: true,
        profilePhotoComplete: true,
        coverPhotoComplete: true,
      },
      cooldown: { active: false },
    });

    render(
      <Sidebar
        user={{
          _id: "user-1",
          name: "Ada",
          username: "ada",
          email: "ada@example.com",
          avatar: { url: "/uploads/ada.jpg" },
          cover: { url: "/uploads/ada-cover.jpg" },
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^play$/i }));

    expect(navigateMock).toHaveBeenCalledWith("/recharge-raffle");
  });

  it("navigates to the standalone messages page when no chat launcher is provided", async () => {
    setMatchMedia(false);

    render(<Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} />);

    fireEvent.click(screen.getByRole("button", { name: /messages/i }));

    expect(navigateMock).toHaveBeenCalledWith("/messages");
  });

  it("shows friend suggestions and sends a request from the sidebar", async () => {
    setMatchMedia(false);
    getFriendsHub.mockResolvedValueOnce({
      suggestions: [{ _id: "user-2", name: "Bola", username: "bola", mutualFriendsCount: 2 }],
    });

    render(<Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} />);

    expect(await screen.findByText("Bola")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

    await waitFor(() => expect(sendFriendRequest).toHaveBeenCalledWith("user-2"));
    await waitFor(() => expect(screen.queryByText("Bola")).not.toBeInTheDocument());
  });

  it("uses Home's shared suggestions without starting a second friends-hub request", async () => {
    setMatchMedia(false);
    const onAddSuggestedFriend = vi.fn().mockResolvedValue(undefined);

    render(
      <Sidebar
        user={{ _id: "user-1", name: "Ada", username: "ada" }}
        friendSuggestions={[
          { _id: "user-2", name: "Bola", username: "bola", mutualFriendsCount: 2 },
          { _id: "user-3", name: "Chidi", username: "chidi" },
          { _id: "user-4", name: "Dami", username: "dami" },
          { _id: "user-5", name: "Emeka", username: "emeka" },
          { _id: "user-6", name: "Fatima", username: "fatima" },
        ]}
        pendingSuggestionIds={new Set()}
        onAddSuggestedFriend={onAddSuggestedFriend}
      />
    );

    expect(screen.getByText("Bola")).toBeInTheDocument();
    expect(screen.queryByText("Fatima")).not.toBeInTheDocument();
    expect(getFriendsHub).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: /add friend/i })[0]);
    await waitFor(() => expect(onAddSuggestedFriend).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "user-2" })
    ));
    expect(sendFriendRequest).not.toHaveBeenCalled();
  });

  it("uses the raffle status API when a complete local profile may not have spun yet", async () => {
    setMatchMedia(false);
    getRechargeRaffleStatus.mockResolvedValueOnce({
      visibility: { visible: true, reason: "available" },
      play: null,
    });

    render(
      <Sidebar
        user={{
          _id: "user-1",
          name: "Ada",
          username: "ada",
          email: "ada@example.com",
          phone: "+2348012345678",
          country: "Nigeria",
          dob: "1998-05-12T00:00:00.000Z",
          gender: "female",
          avatar: { url: "/uploads/ada.jpg" },
        }}
      />
    );

    expect(await screen.findByText(/recharge raffle/i)).toBeInTheDocument();
    expect(getRechargeRaffleStatus).toHaveBeenCalled();
  });

  it("hides the raffle when the account status says it is unavailable", async () => {
    setMatchMedia(false);
    getRechargeRaffleStatus.mockResolvedValueOnce({
      visibility: { visible: false, reason: "inactive_account" },
    });

    render(
      <Sidebar
        user={{
          _id: "user-1",
          name: "Ada",
          username: "ada",
          email: "ada@example.com",
          phone: "+2348012345678",
          country: "Nigeria",
          dob: "1998-05-12T00:00:00.000Z",
          gender: "female",
          avatar: { url: "/uploads/ada.jpg" },
        }}
      />
    );

    await waitFor(() => {
      expect(getRechargeRaffleStatus).toHaveBeenCalled();
    });
    expect(screen.queryByRole("button", { name: /spin & win/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/recharge raffle/i)).not.toBeInTheDocument();
  });

  it("hides the raffle after the account status reports a claimed win", async () => {
    setMatchMedia(false);
    getRechargeRaffleStatus.mockResolvedValueOnce({
      visibility: { visible: false, reason: "claimed_win" },
    });

    render(<Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /spin & win/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/recharge raffle/i)).not.toBeInTheDocument();
  });

  it("keeps the raffle visible for Stephen Daniel Kurah's designated email", async () => {
    setMatchMedia(false);
    getRechargeRaffleStatus.mockRejectedValueOnce(new Error("offline"));

    render(
      <Sidebar
        user={{
          _id: "pyrexx-user",
          name: "Stephen Daniel Kurah",
          username: "pyrexx_singz",
          email: "tmintldo4_life@yahoo.com",
          phone: "+2348012345678",
          country: "Nigeria",
          dob: "1990-01-01T00:00:00.000Z",
          gender: "male",
          onboarding: { completed: true },
          avatar: { url: "/uploads/pyrexx.jpg" },
        }}
      />
    );

    expect(await screen.findByText(/recharge raffle/i)).toBeInTheDocument();
  });
});
