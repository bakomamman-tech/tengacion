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
  getAppointmentMock,
  rescheduleAppointmentMock,
  cancelAppointmentMock,
} = vi.hoisted(() => ({
  getAppointmentMock: vi.fn(),
  rescheduleAppointmentMock: vi.fn(),
  cancelAppointmentMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentVisitorAppointmentApi",
  () => ({
    getPublicSessionAppointment: (...args) =>
      getAppointmentMock(...args),
    reschedulePublicSessionAppointment: (...args) =>
      rescheduleAppointmentMock(...args),
    cancelPublicSessionAppointment: (...args) =>
      cancelAppointmentMock(...args),
  })
);

import TengaAgentVisitorAppointmentManager from "../TengaAgentVisitorAppointmentManager";

const APPOINTMENT = {
  id: "appointment-1",
  status: "requested",
  purpose: "Discuss onboarding",
  preferredStartAt: "2030-01-10T10:00:00.000Z",
  timezone: "UTC",
  durationMinutes: 30,
  rescheduleCount: 0,
  rescheduledAt: null,
};

const renderManager = () =>
  render(
    <TengaAgentVisitorAppointmentManager
      organizationSlug="northstar"
      agentKey="receptionist"
      sessionId="session-a"
      businessName="Northstar Academy"
    />
  );

describe("TengaAgentVisitorAppointmentManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppointmentMock.mockResolvedValue({
      ok: true,
      exists: true,
      appointment: APPOINTMENT,
    });
  });

  it("loads a session appointment and submits a reschedule", async () => {
    const user = userEvent.setup();
    rescheduleAppointmentMock.mockResolvedValue({
      ok: true,
      appointment: {
        ...APPOINTMENT,
        preferredStartAt: "2030-01-11T11:00:00.000Z",
        durationMinutes: 60,
        timezone: "Africa/Lagos",
        rescheduleCount: 1,
        rescheduledAt: "2030-01-01T09:00:00.000Z",
      },
      message: "Your requested appointment time has been updated.",
    });

    renderManager();

    expect(
      await screen.findByText(/awaiting confirmation/i)
    ).toBeInTheDocument();
    expect(getAppointmentMock).toHaveBeenCalledWith({
      organizationSlug: "northstar",
      agentKey: "receptionist",
      sessionId: "session-a",
    });

    await user.click(
      screen.getByRole("button", { name: /change time/i })
    );

    const timeInput = screen.getByLabelText(/new time/i);
    await user.clear(timeInput);
    await user.type(timeInput, "2030-01-11T11:00");

    const durationInput = screen.getByLabelText(/duration/i);
    await user.clear(durationInput);
    await user.type(durationInput, "60");

    await user.click(
      screen.getByRole("button", { name: /save new time/i })
    );

    await waitFor(() => {
      expect(rescheduleAppointmentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationSlug: "northstar",
          agentKey: "receptionist",
          sessionId: "session-a",
          preferredStartAt: expect.any(String),
          timezone: expect.any(String),
          durationMinutes: 60,
        })
      );
    });

    expect(
      await screen.findByText(/rescheduled 1 time/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/requested appointment time has been updated/i)
    ).toBeInTheDocument();
  });

  it("requires a second click before cancelling and then updates the status", async () => {
    const user = userEvent.setup();
    cancelAppointmentMock.mockResolvedValue({
      ok: true,
      appointment: {
        ...APPOINTMENT,
        status: "cancelled",
      },
      message: "Your appointment has been cancelled.",
    });

    renderManager();
    await screen.findByText(/awaiting confirmation/i);

    await user.click(
      screen.getByRole("button", {
        name: /cancel appointment/i,
      })
    );

    expect(cancelAppointmentMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(/cancel this appointment/i)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /confirm cancellation/i,
      })
    );

    await waitFor(() => {
      expect(cancelAppointmentMock).toHaveBeenCalledWith({
        organizationSlug: "northstar",
        agentKey: "receptionist",
        sessionId: "session-a",
      });
    });

    expect(
      await screen.findByRole("heading", {
        name: /cancelled/i,
      })
    ).toBeInTheDocument();
  });
});
