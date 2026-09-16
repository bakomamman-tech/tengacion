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
  saveWorkspaceMock,
  updateLeadStatusMock,
} = vi.hoisted(() => ({
  getWorkspaceMock: vi.fn(),
  getLeadsMock: vi.fn(),
  saveWorkspaceMock: vi.fn(),
  updateLeadStatusMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentApi",
  () => ({
    getTengaAgentOwnerWorkspace: (...args) =>
      getWorkspaceMock(...args),
    getTengaAgentOwnerLeads: (...args) =>
      getLeadsMock(...args),
    saveTengaAgentOwnerWorkspace: (...args) =>
      saveWorkspaceMock(...args),
    updateTengaAgentOwnerLeadStatus: (...args) =>
      updateLeadStatusMock(...args),
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

const primeOwnerData = () => {
  getWorkspaceMock.mockResolvedValue(WORKSPACE);
  getLeadsMock.mockResolvedValue({
    ok: true,
    leads: LEADS,
  });
};

describe("TengaAgentOwnerDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      screen.getByText("Ada Customer")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tobi Buyer")
    ).toBeInTheDocument();

    const newFilter = screen.getByRole(
      "button",
      { name: /new/i }
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

    const contactedFilter = screen.getByRole(
      "button",
      { name: /contacted/i }
    );

    expect(contactedFilter).toHaveTextContent("1");
  });
});

function withinArticle(article, label) {
  if (!article) {
    throw new Error("Expected lead article to exist.");
  }

  const select = article.querySelector("select");

  if (!select) {
    throw new Error(
      `Expected ${String(label)} select to exist.`
    );
  }

  return select;
}
