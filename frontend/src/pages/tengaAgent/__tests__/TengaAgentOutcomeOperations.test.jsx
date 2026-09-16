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

const {
  getOutcomesMock,
  updateOutcomeMock,
} = vi.hoisted(() => ({
  getOutcomesMock: vi.fn(),
  updateOutcomeMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentOutcomeApi",
  () => ({
    getTengaAgentOwnerAppointmentOutcomes: (...args) =>
      getOutcomesMock(...args),
    updateTengaAgentOwnerAppointmentOutcome: (...args) =>
      updateOutcomeMock(...args),
  })
);

import TengaAgentOutcomeOperations from "../TengaAgentOutcomeOperations";

const OUTCOME = {
  appointmentId: "appointment-1",
  status: "completed",
  name: "Outcome Visitor",
  email: "visitor@example.com",
  company: "Outcome Co",
  purpose: "Discuss implementation",
  preferredStartAt: "2026-09-15T10:00:00.000Z",
  timezone: "Africa/Lagos",
  outcomeDisposition: "qualified",
  outcomeNotes: "Send the implementation proposal.",
  followUpNeeded: true,
  followUpAt: "2026-09-16T10:00:00.000Z",
  followUpOverdue: true,
};

const RESPONSE = {
  ok: true,
  outcomes: [OUTCOME],
  metrics: {
    terminalAppointments: 1,
    completed: 1,
    noShow: 0,
    reviewedOutcomes: 1,
    converted: 0,
    qualified: 1,
    notInterested: 0,
    rescheduleRequested: 0,
    followUpNeeded: 1,
    followUpOverdue: 1,
    followUpDueNext7Days: 0,
  },
};

describe("TengaAgentOutcomeOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOutcomesMock.mockResolvedValue(RESPONSE);
    updateOutcomeMock.mockResolvedValue({
      ok: true,
      outcome: {
        ...OUTCOME,
        followUpNeeded: false,
        followUpAt: null,
        followUpOverdue: false,
      },
    });
  });

  it("surfaces overdue follow-ups and lets the owner close the reminder", async () => {
    const user = userEvent.setup();

    render(
      <TengaAgentOutcomeOperations
        user={{ id: "owner-1" }}
      />
    );

    expect(
      await screen.findByText("Outcome Visitor")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/overdue follow-up/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText("1", {
        selector: ".tengaagent-outcomes__metrics strong",
      })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /mark follow-up done/i,
      })
    );

    await waitFor(() => {
      expect(updateOutcomeMock).toHaveBeenCalledWith({
        appointmentId: "appointment-1",
        disposition: "qualified",
        notes: "Send the implementation proposal.",
        followUpNeeded: false,
        followUpAt: null,
      });
    });

    expect(getOutcomesMock).toHaveBeenCalledTimes(2);
  });
});
