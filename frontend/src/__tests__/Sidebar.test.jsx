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

  it("renders the desktop navigation above the mobile breakpoint", () => {
    setMatchMedia(false);

    const { container } = render(
      <Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} openChat={vi.fn()} />
    );

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
    expect(container.querySelector(".sidebar-mobile-feature")).not.toBeInTheDocument();
  });

  it("renders the raffle card on mobile instead of the desktop nav", () => {
    setMatchMedia(true);

    const { container } = render(
      <Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} />
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(container.querySelector(".sidebar-mobile-feature")).toBeInTheDocument();
    expect(screen.getByText(/recharge raffle/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("navigates to the standalone messages page when no chat launcher is provided", () => {
    setMatchMedia(false);

    render(<Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} />);

    fireEvent.click(screen.getByRole("button", { name: /messages/i }));

    expect(navigateMock).toHaveBeenCalledWith("/messages");
  });

  it("hides the raffle for completed profiles with an uploaded avatar", () => {
    setMatchMedia(false);

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

    expect(screen.queryByRole("button", { name: /spin & win/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/recharge raffle/i)).not.toBeInTheDocument();
    expect(getRechargeRaffleStatus).not.toHaveBeenCalled();
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
});
