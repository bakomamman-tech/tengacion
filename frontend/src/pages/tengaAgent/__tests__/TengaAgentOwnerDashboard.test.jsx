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
  getWorkspaceMock,
  getLeadsMock,
  getAppointmentsMock,
  saveWorkspaceMock,
  setPublicationMock,
  updateLeadStatusMock,
  updateAppointmentStatusMock,
} = vi.hoisted(() => ({
  getWorkspaceMock: vi.fn(),
  getLeadsMock: vi.fn(),
  getAppointmentsMock: vi.fn(),
  saveWorkspaceMock: vi.fn(),
  setPublicationMock: vi.fn(),
  updateLeadStatusMock: vi.fn(),
  updateAppointmentStatusMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentApi",
  () => ({
    getTengaAgentOwnerWorkspace: (...args) =>
      getWorkspaceMock(...args),
    getTengaAgentOwnerLeads: (...args) =>
      getLeadsMock(...args),
    getTengaAgentOwnerAppointments: (...args) =>
      getAppointmentsMock(...args),
    saveTengaAgentOwnerWorkspace: (...args) =>
      saveWorkspaceMock(...args),
    setTengaAgentOwnerPublication: (...args) =>
      setPublicationMock(...args),
    updateTengaAgentOwnerLeadStatus: (...args) =>
      updateLeadStatusMock(...args),
    updateTengaAgentOwnerAppointmentStatus: (...args) =>
      updateAppointmentStatusMock(...args),
  })
);

vi.mock("../TengaAgentKnowledgeWorkspace", () => ({
  default: () => <div data-testid="knowledge-workspace" />,
}));

vi.mock("../TengaAgentHandoffInbox", () => ({
  default: () => <div data-testid="handoff-inbox" />,
}));

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
    slug: "kurah-ventures-12345678",
    plan: "starter",
    status: "pilot",
  },
  agent: {
    id: "agent-1",
    key: "receptionist",
    name: "TengaAgent",
    status: "draft",
    published: false,
    publicPath:
      "/tengaagent/kurah-ventures-12345678/receptionist",
  },
};

const LEADS = [
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
];

const APPOINTMENTS = [
  {
    id: "appointment-1",
    name: "Musa Visitor",
    email: "musa@example.com",
    phone: "",
    company: "Musa Ventures",
    purpose: "Discuss an AI support project.",
    notes: "Would like a short demo.",
    preferredStartAt: "2030-01-10T10:00:00.000Z",
    timezone: "Africa/Lagos",
    durationMinutes: 30,
    source: "web",
    status: "requested",
    consentToContact: true,
  },
];

const primeOwnerData = () => {
  getWorkspaceMock.mockResolvedValue(WORKSPACE);
  getLeadsMock.mockResolvedValue({
    ok: true,
    leads: LEADS,
  });
  getAppointmentsMock.mockResolvedValue({
    ok: true,
    appointments: [],
  });
};

describe("TengaAgentOwnerDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppointmentsMock.mockResolvedValue({
      ok: true,
      appointments: [],
    });
  });

  it("loads the authenticated owner's workspace and leads", async () => {
    primeOwnerData();

    render(
      <TengaAgentOwnerDashboard user={USER} />
    );

    expect(
      await screen.findByText("Kurah Ventures")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("knowledge-workspace")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("handoff-inbox")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ada Customer")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tobi Buyer")
    ).toBeInTheDocument();

    const leadFilters = screen.getByRole(
      "group",
      { name: /lead status filter/i }
    );

    const newFilter = leadFilters.querySelector(
      "button:nth-of-type(2)"
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

  it("publishes the owner agent and exposes its shareable tenant path", async () => {
    primeOwnerData();

    setPublicationMock.mockResolvedValue({
      ...WORKSPACE,
      agent: {
        ...WORKSPACE.agent,
        status: "active",
        published: true,
      },
    });

    const user = userEvent.setup();

    render(
      <TengaAgentOwnerDashboard user={USER} />
    );

    expect(
      await screen.findByText(/not public/i)
    ).toBeInTheDocument();

    const shareLink = screen.getByRole("link", {
      name: WORKSPACE.agent.publicPath,
    });
    expect(shareLink).toHaveAttribute(
      "href",
      WORKSPACE.agent.publicPath
    );

    await user.click(
      screen.getByRole("button", {
        name: /publish agent/i,
      })
    );

    await waitFor(() => {
      expect(setPublicationMock).toHaveBeenCalledWith({
        published: true,
      });
    });

    expect(
      await screen.findByText(/^published$/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /pause public agent/i,
      })
    ).toBeInTheDocument();
  });

  it("moves a lead through the owner workflow and refreshes status counts", async () => {
    primeOwnerData();

    updateLeadStatusMock.mockResolvedValue({
      ok: true,
      lead: {
        ...LEADS[0],
        status: "contacted",
      },
    });

    const user = userEvent.setup();

    render(
      <TengaAgentOwnerDashboard user={USER} />
    );

    await screen.findByText("Ada Customer");

    const adaCard = screen
      .getByText("Ada Customer")
      .closest("article");

    const statusSelect = withinArticle(
      adaCard,
      /lead status/i
    );

    await user.selectOptions(
      statusSelect,
      "contacted"
    );

    await waitFor(() => {
      expect(updateLeadStatusMock).toHaveBeenCalledWith({
        leadId: "lead-1",
        status: "contacted",
      });
    });

    expect(statusSelect).toHaveValue("contacted");

    const leadFilters = screen.getByRole(
      "group",
      { name: /lead status filter/i }
    );
    const contactedFilter = Array.from(
      leadFilters.querySelectorAll("button")
    ).find((button) =>
      /contacted/i.test(button.textContent)
    );

    expect(contactedFilter).toHaveTextContent("1");
  });

  it("confirms an appointment request from the owner inbox", async () => {
    primeOwnerData();
    getAppointmentsMock.mockResolvedValue({
      ok: true,
      appointments: APPOINTMENTS,
    });

    updateAppointmentStatusMock.mockResolvedValue({
      ok: true,
      appointment: {
        ...APPOINTMENTS[0],
        status: "confirmed",
      },
    });

    const user = userEvent.setup();

    render(
      <TengaAgentOwnerDashboard user={USER} />
    );

    expect(
      await screen.findByText("Musa Visitor")
    ).toBeInTheDocument();

    const card = screen
      .getByText("Musa Visitor")
      .closest("article");

    const select = withinArticle(
      card,
      /appointment status/i
    );

    await user.selectOptions(
      select,
      "confirmed"
    );

    await waitFor(() => {
      expect(
        updateAppointmentStatusMock
      ).toHaveBeenCalledWith({
        appointmentId: "appointment-1",
        status: "confirmed",
      });
    });

    expect(select).toHaveValue("confirmed");
  });
});

function withinArticle(article, label) {
  if (!article) {
    throw new Error("Expected workflow article to exist.");
  }

  const select = article.querySelector("select");

  if (!select) {
    throw new Error(
      `Expected ${String(label)} select to exist.`
    );
  }

  return select;
}
