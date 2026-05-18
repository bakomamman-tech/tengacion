import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Sidebar from "../Sidebar";
import { getRechargeRaffleStatus, getSponsoredPoll, submitSponsoredPollVote } from "../api";

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

const waitForSponsoredPoll = async () => {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /submit vote/i })).not.toBeDisabled();
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
  getSponsoredPoll: vi.fn(() =>
    Promise.resolve({
      poll: {
        slug: "onward-baptist-childrens-day",
        title: "Onward Baptist's Children's Day Celebration",
        question: "Would you want your child to attend?",
      },
      stats: { yes: 2, no: 1, total: 3 },
      response: null,
    })
  ),
  submitSponsoredPollVote: vi.fn(() =>
    Promise.resolve({
      success: true,
      created: true,
      stats: { yes: 3, no: 1, total: 4 },
      response: { phone: "+2348012345678", vote: "yes" },
    })
  ),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getRechargeRaffleStatus.mockReset();
    getRechargeRaffleStatus.mockResolvedValue({
      visibility: { visible: true, reason: "available" },
    });
    getSponsoredPoll.mockReset();
    getSponsoredPoll.mockResolvedValue({
      poll: {
        slug: "onward-baptist-childrens-day",
        title: "Onward Baptist's Children's Day Celebration",
        question: "Would you want your child to attend?",
      },
      stats: { yes: 2, no: 1, total: 3 },
      response: null,
    });
    submitSponsoredPollVote.mockReset();
    submitSponsoredPollVote.mockResolvedValue({
      success: true,
      created: true,
      stats: { yes: 3, no: 1, total: 4 },
      response: { phone: "+2348012345678", vote: "yes" },
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
    await waitForSponsoredPoll();
  });

  it("renders the raffle card on mobile instead of the desktop nav", async () => {
    setMatchMedia(true);

    const { container } = render(
      <Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} />
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(container.querySelector(".sidebar-mobile-feature")).toBeInTheDocument();
    expect(screen.getByText(/recharge raffle/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    await waitForSponsoredPoll();
  });

  it("navigates to the standalone messages page when no chat launcher is provided", async () => {
    setMatchMedia(false);

    render(<Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} />);

    fireEvent.click(screen.getByRole("button", { name: /messages/i }));

    expect(navigateMock).toHaveBeenCalledWith("/messages");
    await waitForSponsoredPoll();
  });

  it("submits the sponsored children's day poll from the sidebar", async () => {
    setMatchMedia(false);

    render(<Sidebar user={{ _id: "user-1", name: "Ada", username: "ada" }} />);

    expect(screen.getByText(/sponsored post/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/parent phone number/i), {
      target: { value: "+2348012345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^yes$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit vote/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /submit vote/i }));

    await waitFor(() => {
      expect(submitSponsoredPollVote).toHaveBeenCalledWith("onward-baptist-childrens-day", {
        phone: "+2348012345678",
        vote: "yes",
      });
    });
    expect(await screen.findByText(/thanks, your vote has been saved/i)).toBeInTheDocument();
  });

  it("hides the raffle for completed profiles with an uploaded avatar", async () => {
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
    await waitForSponsoredPoll();
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
    await waitForSponsoredPoll();
  });
});
