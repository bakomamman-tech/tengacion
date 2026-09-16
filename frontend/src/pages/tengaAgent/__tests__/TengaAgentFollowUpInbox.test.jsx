import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  completeFollowUpMock,
  getFollowUpsMock,
  rescheduleFollowUpMock,
} = vi.hoisted(() => ({
  completeFollowUpMock: vi.fn(),
  getFollowUpsMock: vi.fn(),
  rescheduleFollowUpMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentFollowUpApi",
  () => ({
    getTengaAgentOwnerFollowUps: (...args) => getFollowUpsMock(...args),
    completeTengaAgentOwnerFollowUp: (...args) => completeFollowUpMock(...args),
    rescheduleTengaAgentOwnerFollowUp: (...args) => rescheduleFollowUpMock(...args),
  })
);

import TengaAgentFollowUpInbox from "../TengaAgentFollowUpInbox";

const FOLLOW_UP = {
  appointmentId: "appointment-follow-up-1",
  name: "Follow Up Visitor",
  email: "followup@example.com",
  purpose: "Review commercial proposal",
  appointmentStatus: "completed",
  outcomeDisposition: "qualified",
  outcomeNotes: "Send revised implementation scope.",
  followUpAt: "2026-09-16T10:00:00.000Z",
  overdue: true,
  dueState: "overdue",
  reminder: {
    id: "reminder-1",
    status: "sent",
    attempts: 1,
    sentAt: "2026-09-16T10:01:00.000Z",
    lastError: "",
  },
};

const RESPONSE = {
  ok: true,
  filter: "all",
  followUps: [FOLLOW_UP],
  metrics: {
    open: 1,
    overdue: 1,
    upcoming: 0,
    dueNext7Days: 0,
  },
};

describe("TengaAgentFollowUpInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFollowUpsMock.mockResolvedValue(RESPONSE);
    completeFollowUpMock.mockResolvedValue({ ok: true });
    rescheduleFollowUpMock.mockResolvedValue({ ok: true });
  });

  it("shows reminder state and completes an owner follow-up", async () => {
    const user = userEvent.setup();

    render(<TengaAgentFollowUpInbox user={{ id: "owner-1" }} />);

    expect(await screen.findByText("Follow Up Visitor")).toBeInTheDocument();
    expect(screen.getByText("Reminder sent")).toBeInTheDocument();

    const overdueMetric = screen.getByText("Overdue").closest("article");
    expect(overdueMetric).not.toBeNull();
    expect(within(overdueMetric).getByText("1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /mark follow-up done/i })
    );

    await waitFor(() => {
      expect(completeFollowUpMock).toHaveBeenCalledWith({
        appointmentId: "appointment-follow-up-1",
      });
    });
    expect(getFollowUpsMock).toHaveBeenCalledTimes(2);
  });

  it("reloads filters and reschedules with an ISO due time", async () => {
    const user = userEvent.setup();

    render(<TengaAgentFollowUpInbox user={{ id: "owner-1" }} />);
    await screen.findByText("Follow Up Visitor");

    await user.click(screen.getByRole("button", { name: "overdue" }));
    await waitFor(() => {
      expect(getFollowUpsMock).toHaveBeenLastCalledWith({
        filter: "overdue",
        limit: 100,
      });
    });

    await user.click(screen.getByRole("button", { name: "Reschedule" }));
    const input = screen.getByLabelText("New follow-up due");
    fireEvent.change(input, { target: { value: "2026-09-19T12:30" } });

    await user.click(
      screen.getByRole("button", { name: /save new due time/i })
    );

    await waitFor(() => {
      expect(rescheduleFollowUpMock).toHaveBeenCalledWith({
        appointmentId: "appointment-follow-up-1",
        followUpAt: new Date("2026-09-19T12:30").toISOString(),
      });
    });
  });
});
