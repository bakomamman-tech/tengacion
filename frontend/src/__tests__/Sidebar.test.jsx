import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Sidebar from "../Sidebar";
import { getRechargeRaffleStatus } from "../api";

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
}));

describe("Sidebar", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getRechargeRaffleStatus.mockReset();
    getRechargeRaffleStatus.mockResolvedValue({
      visibility: { visible: true, reason: "available" },
    });
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

  it("navigates to the standalone messages page when no chat launcher is provided", async () => {
    setMatchMedia(false);

    render(<Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} />);

    fireEvent.click(screen.getByRole("button", { name: /messages/i }));

    expect(navigateMock).toHaveBeenCalledWith("/messages");
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

  it("hides the raffle when the account status says the completed profile is unavailable", async () => {
    setMatchMedia(false);
    getRechargeRaffleStatus.mockResolvedValueOnce({
      visibility: { visible: false, reason: "profile_complete_with_photo" },
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

  it("keeps the raffle visible for the pyrexx_singz demo account", async () => {
    setMatchMedia(false);
    getRechargeRaffleStatus.mockRejectedValueOnce(new Error("offline"));

    render(
      <Sidebar
        user={{
          _id: "pyrexx-user",
          name: "Stephen Daniel Kurah",
          username: "pyrexx_singz",
          email: "pyrexx@example.com",
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
