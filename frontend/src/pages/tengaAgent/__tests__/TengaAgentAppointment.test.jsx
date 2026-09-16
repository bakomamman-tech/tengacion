import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import TengaAgentLandingPage from "../TengaAgentLandingPage";
import {
  sendTengaAgentMessage,
  submitTengaAgentAppointment,
} from "../../../services/tengaAgentApi";

vi.mock("../../../services/tengaAgentApi", () => ({
  sendTengaAgentMessage: vi.fn(),
  submitTengaAgentLead: vi.fn(),
  submitTengaAgentAppointment: vi.fn(),
  getTengaAgentOwnerWorkspace: vi.fn(),
  getTengaAgentOwnerLeads: vi.fn(),
  getTengaAgentOwnerAppointments: vi.fn(),
  saveTengaAgentOwnerWorkspace: vi.fn(),
  setTengaAgentOwnerPublication: vi.fn(),
  updateTengaAgentOwnerLeadStatus: vi.fn(),
  updateTengaAgentOwnerAppointmentStatus: vi.fn(),
}));

describe("TengaAgent appointment request UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      {
        configurable: true,
        value: vi.fn(),
      }
    );

    window.sessionStorage.clear();

    sendTengaAgentMessage.mockResolvedValue({
      ok: true,
      reply:
        "Choose a preferred meeting time below.",
      actions: [
        {
          type: "book_appointment",
          label: "Request a meeting time",
        },
      ],
    });

    submitTengaAgentAppointment.mockResolvedValue({
      ok: true,
      appointment: {
        id: "appointment-1",
        status: "requested",
      },
      message:
        "Your preferred meeting time has been requested. The Tengacion team still needs to confirm the appointment.",
    });
  });

  it("opens the appointment form and submits a future meeting request", async () => {
    const user = userEvent.setup();

    render(<TengaAgentLandingPage />);

    await user.click(
      screen.getByRole("button", {
        name: /book a meeting with the team/i,
      })
    );

    expect(
      await screen.findByText(/request a meeting time/i)
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "visitor@example.com"
    );

    const dateInput = document.querySelector(
      'input[type="datetime-local"]'
    );

    expect(dateInput).toBeTruthy();

    fireEvent.change(dateInput, {
      target: {
        value: "2030-01-10T11:00",
      },
    });

    await user.type(
      screen.getByPlaceholderText(
        /product demo, project discussion/i
      ),
      "Discuss an AI receptionist project"
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: /confirm or manage this appointment request/i,
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: /request this meeting time/i,
      })
    );

    expect(
      submitTengaAgentAppointment
    ).toHaveBeenCalledTimes(1);

    expect(
      submitTengaAgentAppointment
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "tengacion-demo",
        email: "visitor@example.com",
        purpose:
          "Discuss an AI receptionist project",
        durationMinutes: 30,
        consentToContact: true,
        preferredStartAt:
          expect.stringMatching(/^2030-01-10T/),
        timezone: expect.any(String),
      })
    );

    expect(
      await screen.findByText(
        /still needs to confirm the appointment/i
      )
    ).toBeInTheDocument();
  });
});
