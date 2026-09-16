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

const getWorkspaceMock = vi.fn();
const getLeadsMock = vi.fn();
const saveWorkspaceMock = vi.fn();

vi.mock(
  "../../../services/tengaAgentApi",
  () => ({
    getTengaAgentOwnerWorkspace: (...args) =>
      getWorkspaceMock(...args),
    getTengaAgentOwnerLeads: (...args) =>
      getLeadsMock(...args),
    saveTengaAgentOwnerWorkspace: (...args) =>
      saveWorkspaceMock(...args),
  })
);

import TengaAgentOwnerDashboard from "../TengaAgentOwnerDashboard";

const USER = {
  _id: "user-owner-1",
  name: "Owner User",
};

const WORKSPACE = {
  ok: true,
  organization: {
    id: "org-1",
    name: "Kurah Ventures",
    plan: "starter",
    status: "pilot",
  },
  agent: {
    id: "agent-1",
    name: "TengaAgent",
    status: "draft",
  },
};

describe("TengaAgentOwnerDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the authenticated owner's workspace and leads", async () => {
    getWorkspaceMock.mockResolvedValue(WORKSPACE);
    getLeadsMock.mockResolvedValue({
      ok: true,
      leads: [
        {
          id: "lead-1",
          name: "Ada Customer",
          email: "ada@example.com",
          phone: "",
          company: "Ada Labs",
          projectSummary: "Needs an AI receptionist.",
          source: "web",
          status: "new",
          consentToContact: true,
          lastCapturedAt: "2026-09-16T12:00:00.000Z",
        },
        {
          id: "lead-2",
          name: "Tobi Buyer",
          email: "",
          phone: "+2348000000000",
          company: "",
          projectSummary: "Wants a product demo.",
          source: "web",
          status: "qualified",
          consentToContact: true,
          lastCapturedAt: "2026-09-16T13:00:00.000Z",
        },
      ],
    });

    render(
      <TengaAgentOwnerDashboard user={USER} />
    );

    expect(
      await screen.findByText("Kurah Ventures")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ada Customer")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tobi Buyer")
    ).toBeInTheDocument();

    const newFilter = screen.getByRole(
      "button",
      { name: /^new1$/i }
    );

    await userEvent.click(newFilter);

    expect(
      screen.getByText("Ada Customer")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Tobi Buyer")
    ).not.toBeInTheDocument();
  });

  it("lets an authenticated owner create a workspace when none exists", async () => {
    const notFound = new Error(
      "TengaAgent workspace not found."
    );
    notFound.status = 404;

    getWorkspaceMock
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce(WORKSPACE);

    saveWorkspaceMock.mockResolvedValue({
      ...WORKSPACE,
      created: true,
    });

    getLeadsMock.mockResolvedValue({
      ok: true,
      leads: [],
    });

    const user = userEvent.setup();

    render(
      <TengaAgentOwnerDashboard user={USER} />
    );

    const nameInput =
      await screen.findByLabelText(
        /business name/i
      );

    await user.type(
      nameInput,
      "Kurah Ventures"
    );

    await user.click(
      screen.getByRole("button", {
        name: /create tengaagent workspace/i,
      })
    );

    await waitFor(() => {
      expect(saveWorkspaceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Kurah Ventures",
          countryCode: "NG",
          timezone: "Africa/Lagos",
        })
      );
    });

    expect(
      await screen.findByText("Kurah Ventures")
    ).toBeInTheDocument();
  });
});
