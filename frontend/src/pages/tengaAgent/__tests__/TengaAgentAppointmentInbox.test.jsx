import React from "react";
import {
  fireEvent,
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
  getAppointmentsMock,
  rescheduleAppointmentMock,
  updateStatusMock,
} = vi.hoisted(() => ({
  getAppointmentsMock: vi.fn(),
  rescheduleAppointmentMock: vi.fn(),
  updateStatusMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentApi",
  () => ({
    getTengaAgentOwnerAppointments: (...args) =>
      getAppointmentsMock(...args),
    rescheduleTengaAgentOwnerAppointment: (...args) =>
      rescheduleAppointmentMock(...args),
    updateTengaAgentOwnerAppointmentStatus: (...args) =>
      updateStatusMock(...args),
  })
);

vi.mock("../TengaAgentAvailabilitySettings", () => ({
  default: () => <div>Availability settings</div>,
}));

vi.mock("../TengaAgentHandoffInbox", () => ({
  default: () => <div>Handoff inbox</div>,
}));

import TengaAgentAppointmentInbox from "../TengaAgentAppointmentInbox";

const APPOINTMENT = {
  id: "appointment-1",
  name: "Reschedule Visitor",
  email: "visitor@example.com",
  purpose: "Discuss TengaAgent",
  preferredStartAt: "2030-01-10T10:00:00.000Z",
  timezone: "Africa/Lagos",
  durationMinutes: 30,
  status: "confirmed",
  availabilityState: "confirmed_free",
  availabilitySource: "internal_schedule",
  rescheduleCount: 0,
  rescheduledAt: null,
};

const SECOND_APPOINTMENT = {
  id: "appointment-2",
  name: "Past Customer",
  email: "past@example.com",
  company: "Acme Studio",
  purpose: "Website consultation",
  preferredStartAt: "2020-01-10T10:00:00.000Z",
  timezone: "Africa/Lagos",
  durationMinutes: 45,
  status: "completed",
  availabilityState: "confirmed_free",
  availabilitySource: "internal_schedule",
  rescheduleCount: 0,
  rescheduledAt: null,
};

describe("TengaAgentAppointmentInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppointmentsMock.mockResolvedValue({
      ok: true,
      appointments: [APPOINTMENT],
    });
    updateStatusMock.mockResolvedValue({
      ok: true,
      appointment: APPOINTMENT,
    });
    rescheduleAppointmentMock.mockResolvedValue({
      ok: true,
      appointment: {
        ...APPOINTMENT,
        preferredStartAt:
          "2030-02-01T13:00:00.000Z",
        durationMinutes: 60,
        rescheduleCount: 1,
        rescheduledAt:
          "2026-09-16T21:00:00.000Z",
      },
    });
  });

  it("lets the owner reschedule an active appointment and refreshes its audit metadata", async () => {
    const user = userEvent.setup();

    render(
      <TengaAgentAppointmentInbox
        user={{ id: "owner-1" }}
      />
    );

    expect(
      await screen.findByText("Reschedule Visitor")
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /^reschedule$/i,
      })
    );

    const timeInput = screen.getByLabelText(
      /new meeting time/i
    );
    const durationInput = screen.getByLabelText(
      /duration \(minutes\)/i
    );

    fireEvent.change(timeInput, {
      target: {
        value: "2030-02-01T13:00",
      },
    });
    fireEvent.change(durationInput, {
      target: {
        value: "60",
      },
    });

    await user.click(
      screen.getByRole("button", {
        name: /save new time/i,
      })
    );

    await waitFor(() => {
      expect(
        rescheduleAppointmentMock
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: "appointment-1",
          preferredStartAt:
            expect.stringMatching(/^2030-02-01T/),
          timezone: expect.any(String),
          durationMinutes: 60,
        })
      );
    });

    expect(
      await screen.findByText(/rescheduled 1 time/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /save new time/i,
      })
    ).not.toBeInTheDocument();
  });

  it("filters appointments by search text, status and upcoming/past scope", async () => {
    const user = userEvent.setup();
    getAppointmentsMock.mockResolvedValue({
      ok: true,
      appointments: [
        APPOINTMENT,
        SECOND_APPOINTMENT,
      ],
    });

    render(
      <TengaAgentAppointmentInbox
        user={{ id: "owner-1" }}
      />
    );

    expect(
      await screen.findByText("Past Customer")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Reschedule Visitor")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/showing 2 of 2/i)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /^upcoming$/i,
      })
    );

    expect(
      screen.getByText("Reschedule Visitor")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Past Customer")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/showing 1 of 2/i)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /^all$/i,
      })
    );
    await user.type(
      screen.getByRole("searchbox", {
        name: /search appointments/i,
      }),
      "Acme Studio"
    );

    expect(
      screen.getByText("Past Customer")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Reschedule Visitor")
    ).not.toBeInTheDocument();

    await user.clear(
      screen.getByRole("searchbox", {
        name: /search appointments/i,
      })
    );
    await user.click(
      screen.getByRole("button", {
        name: /completed/i,
      })
    );

    expect(
      screen.getByText("Past Customer")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Reschedule Visitor")
    ).not.toBeInTheDocument();
  });
});
