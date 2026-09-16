import React from "react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
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
  getPublicAgentMock,
  sendPublicMessageMock,
  submitPublicLeadMock,
  submitPublicAppointmentMock,
} = vi.hoisted(() => ({
  getPublicAgentMock: vi.fn(),
  sendPublicMessageMock: vi.fn(),
  submitPublicLeadMock: vi.fn(),
  submitPublicAppointmentMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentApi",
  () => ({
    getPublicTengaAgent: (...args) =>
      getPublicAgentMock(...args),
    sendPublicTengaAgentMessage: (...args) =>
      sendPublicMessageMock(...args),
    submitPublicTengaAgentLead: (...args) =>
      submitPublicLeadMock(...args),
    submitPublicTengaAgentAppointment: (...args) =>
      submitPublicAppointmentMock(...args),
  })
);

import TengaAgentPublicAgentPage from "../TengaAgentPublicAgentPage";

const PUBLIC_AGENT = {
  ok: true,
  organization: {
    name: "Northstar Academy",
    slug: "northstar-academy-12345678",
    industry: "Education",
    timezone: "Africa/Lagos",
  },
  agent: {
    key: "receptionist",
    name: "Northstar Assistant",
    role: "AI Receptionist",
    greeting:
      "Welcome to Northstar Academy. How can I help?",
  },
};

const renderPublicAgent = () =>
  render(
    <MemoryRouter
      initialEntries={[
        "/tengaagent/northstar-academy-12345678/receptionist",
      ]}
    >
      <Routes>
        <Route
          path="/tengaagent/:organizationSlug/:agentKey"
          element={<TengaAgentPublicAgentPage />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("TengaAgentPublicAgentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      {
        configurable: true,
        value: vi.fn(),
      }
    );

    getPublicAgentMock.mockResolvedValue(
      PUBLIC_AGENT
    );

    sendPublicMessageMock.mockResolvedValue({
      ok: true,
      reply:
        "Use the contact option below to reach Northstar Academy.",
      actions: [
        {
          type: "capture_lead",
          label: "Leave your details",
        },
      ],
    });

    submitPublicLeadMock.mockResolvedValue({
      ok: true,
      message:
        "Thanks. Your details were saved and Northstar Academy can follow up on this enquiry.",
    });
  });

  it("loads the tenant business and submits a tenant-scoped lead from its public link", async () => {
    const user = userEvent.setup();

    renderPublicAgent();

    expect(
      await screen.findByText(
        "Welcome to Northstar Academy. How can I help?"
      )
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Northstar Academy").length
    ).toBeGreaterThan(0);

    expect(getPublicAgentMock).toHaveBeenCalledWith({
      organizationSlug:
        "northstar-academy-12345678",
      agentKey: "receptionist",
    });

    const input = screen.getByLabelText("Message");
    await user.type(
      input,
      "I want to speak with someone"
    );
    await user.click(
      screen.getByRole("button", {
        name: /^send$/i,
      })
    );

    await waitFor(() => {
      expect(sendPublicMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationSlug:
            "northstar-academy-12345678",
          agentKey: "receptionist",
          message:
            "I want to speak with someone",
          sessionId: expect.any(String),
        })
      );
    });

    expect(
      await screen.findByText(/leave your details/i)
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "visitor@northstar.test"
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: /northstar academy may contact me/i,
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: /send my details/i,
      })
    );

    await waitFor(() => {
      expect(submitPublicLeadMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationSlug:
            "northstar-academy-12345678",
          agentKey: "receptionist",
          email: "visitor@northstar.test",
          consentToContact: true,
          sessionId: expect.any(String),
        })
      );
    });

    expect(
      await screen.findByText(
        /northstar academy can follow up/i
      )
    ).toBeInTheDocument();
  });

  it("shows an unavailable state when the agent is not published", async () => {
    const notFound = new Error(
      "This TengaAgent is not currently public."
    );
    notFound.status = 404;
    getPublicAgentMock.mockRejectedValue(notFound);

    renderPublicAgent();

    expect(
      await screen.findByText(/tengaagent unavailable/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not currently public/i)
    ).toBeInTheDocument();
  });
});
