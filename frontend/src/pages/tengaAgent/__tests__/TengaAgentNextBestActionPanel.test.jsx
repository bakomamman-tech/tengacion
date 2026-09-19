import React from "react";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { getFollowUpsMock } = vi.hoisted(() => ({
  getFollowUpsMock: vi.fn(),
}));

vi.mock("../../../services/tengaAgentFollowUpApi", () => ({
  getTengaAgentOwnerFollowUps: (...args) =>
    getFollowUpsMock(...args),
}));

import TengaAgentNextBestActionPanel from "../TengaAgentNextBestActionPanel";

const USER = {
  _id: "user-owner-1",
  name: "Owner User",
};

const recommendation = ({
  action,
  label,
  rationale,
  strength = "strong",
  activityCount = 0,
}) => ({
  action,
  label,
  rationale,
  advisoryOnly: true,
  strength,
  signals: {
    followUpDue: true,
    activityCount,
  },
});

describe("TengaAgentNextBestActionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads advisory recommendations and prioritizes overdue follow-ups", async () => {
    getFollowUpsMock.mockResolvedValue({
      ok: true,
      followUps: [
        {
          appointmentId: "appointment-email",
          name: "Ada Customer",
          company: "Ada Labs",
          purpose: "Review proposal",
          overdue: false,
          followUpAt: "2030-01-11T10:00:00.000Z",
          outcomeDisposition: "qualified",
          recommendation: recommendation({
            action: "email",
            label: "Send reviewed email",
            rationale: "The opportunity is qualified and ready for owner-reviewed outreach.",
          }),
        },
        {
          appointmentId: "appointment-call",
          name: "Musa Visitor",
          company: "Musa Ventures",
          purpose: "Recover failed email",
          overdue: true,
          followUpAt: "2030-01-10T10:00:00.000Z",
          outcomeDisposition: "qualified",
          recommendation: recommendation({
            action: "call",
            label: "Call customer",
            rationale: "The latest email failed and a phone number is available.",
            activityCount: 2,
          }),
        },
      ],
    });

    render(<TengaAgentNextBestActionPanel user={USER} />);

    expect(
      await screen.findByText("What should happen next?")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(getFollowUpsMock).toHaveBeenCalledWith({
        filter: "all",
        limit: 100,
      });
    });

    const cards = document.querySelectorAll(
      ".tengaagent-next-action__card"
    );

    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Musa Visitor");
    expect(cards[0]).toHaveTextContent("Call customer");
    expect(cards[0]).toHaveTextContent("2 contact events");
    expect(cards[1]).toHaveTextContent("Ada Customer");
    expect(cards[1]).toHaveTextContent("Send reviewed email");
    expect(
      screen.getAllByText(/advisory only/i)
    ).toHaveLength(2);
  });

  it("treats a missing follow-up workspace as an empty recommendation state", async () => {
    const notFound = new Error("Follow-ups not found.");
    notFound.status = 404;
    getFollowUpsMock.mockRejectedValue(notFound);

    render(<TengaAgentNextBestActionPanel user={USER} />);

    expect(
      await screen.findByText("No open recommendations right now.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refreshes recommendations only when the owner requests it", async () => {
    getFollowUpsMock.mockResolvedValue({
      ok: true,
      followUps: [],
    });

    const user = userEvent.setup();
    render(<TengaAgentNextBestActionPanel user={USER} />);

    expect(
      await screen.findByText("No open recommendations right now.")
    ).toBeInTheDocument();
    expect(getFollowUpsMock).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", {
        name: /refresh recommendations/i,
      })
    );

    await waitFor(() => {
      expect(getFollowUpsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("renders nothing and does not fetch when there is no authenticated owner", () => {
    const { container } = render(
      <TengaAgentNextBestActionPanel user={null} />
    );

    expect(container).toBeEmptyDOMElement();
    expect(getFollowUpsMock).not.toHaveBeenCalled();
  });
});
