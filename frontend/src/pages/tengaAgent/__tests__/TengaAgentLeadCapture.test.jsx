import React from "react";
import { render, screen } from "@testing-library/react";
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
  submitTengaAgentLead,
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

describe("TengaAgent lead capture UI", () => {
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
        "I can connect you with the Tengacion team. Use the contact option below.",
      actions: [
        {
          type: "capture_lead",
          label: "Leave your details",
        },
      ],
    });

    submitTengaAgentLead.mockResolvedValue({
      ok: true,
      message:
        "Thanks. Your details have been saved for Tengacion follow-up.",
    });
  });

  it("shows the contact form from a capture_lead action and submits consented details", async () => {
    const user = userEvent.setup();

    render(<TengaAgentLandingPage />);

    await user.click(
      screen.getByRole("button", {
        name: /i want to speak with someone/i,
      })
    );

    expect(
      await screen.findByText(/leave your details/i)
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "visitor@example.com"
    );

    await user.type(
      screen.getByPlaceholderText(
        /briefly describe your project/i
      ),
      "I need help building an AI support product."
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: /tengacion may contact me/i,
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: /send my details/i,
      })
    );

    expect(submitTengaAgentLead).toHaveBeenCalledTimes(1);
    expect(submitTengaAgentLead).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "tengacion-demo",
        email: "visitor@example.com",
        projectSummary:
          "I need help building an AI support product.",
        consentToContact: true,
      })
    );

    expect(
      await screen.findByText(
        /details have been saved for tengacion follow-up/i
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/leave your details/i)
    ).not.toBeInTheDocument();
  });

  it("requires an email or phone before submission", async () => {
    const user = userEvent.setup();

    render(<TengaAgentLandingPage />);

    await user.click(
      screen.getByRole("button", {
        name: /i want to speak with someone/i,
      })
    );

    await screen.findByText(/leave your details/i);

    await user.click(
      screen.getByRole("checkbox", {
        name: /tengacion may contact me/i,
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: /send my details/i,
      })
    );

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(/email address or phone number/i);
    expect(submitTengaAgentLead).not.toHaveBeenCalled();
  });
});
