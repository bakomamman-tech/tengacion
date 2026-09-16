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
  archiveKnowledgeMock,
  getKnowledgeMock,
  saveKnowledgeMock,
  importWebsiteMock,
  updateConfigurationMock,
  updateProfileMock,
} = vi.hoisted(() => ({
  archiveKnowledgeMock: vi.fn(),
  getKnowledgeMock: vi.fn(),
  saveKnowledgeMock: vi.fn(),
  importWebsiteMock: vi.fn(),
  updateConfigurationMock: vi.fn(),
  updateProfileMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentOwnerConfigApi",
  () => ({
    archiveTengaAgentOwnerKnowledgeSource: (...args) =>
      archiveKnowledgeMock(...args),
    getTengaAgentOwnerKnowledge: (...args) =>
      getKnowledgeMock(...args),
    saveTengaAgentOwnerKnowledge: (...args) =>
      saveKnowledgeMock(...args),
    importTengaAgentOwnerWebsite: (...args) =>
      importWebsiteMock(...args),
    updateTengaAgentOwnerBusinessProfile: (...args) =>
      updateProfileMock(...args),
    updateTengaAgentOwnerConfiguration: (...args) =>
      updateConfigurationMock(...args),
  })
);

import TengaAgentKnowledgeWorkspace from "../TengaAgentKnowledgeWorkspace";

const WORKSPACE = {
  organization: {
    id: "org-1",
    name: "Northstar Academy",
    website: "https://northstar.example.com",
    industry: "Education",
    countryCode: "NG",
    timezone: "Africa/Lagos",
  },
  agent: {
    id: "agent-1",
    key: "receptionist",
    name: "TengaAgent",
    role: "AI Receptionist",
    greeting: "Welcome to Northstar Academy.",
    tone: "friendly-professional",
    languages: ["English"],
    systemInstructions:
      "Represent Northstar Academy accurately and use only approved business knowledge when answering visitors.",
    enabledTools: [
      "lead_capture",
      "appointment_requests",
    ],
    status: "active",
    published: true,
  },
};

const READY_SOURCE = {
  id: "source-1",
  type: "faq",
  title: "Admissions FAQ",
  sourceUrl: "",
  status: "ready",
  chunkCount: 2,
  updatedAt: "2026-09-16T14:00:00.000Z",
};

describe("TengaAgentKnowledgeWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKnowledgeMock.mockResolvedValue({
      ok: true,
      sources: [READY_SOURCE],
    });
  });

  it("updates the business profile and pauses publication for review", async () => {
    const onWorkspaceChange = vi.fn();
    const user = userEvent.setup();

    updateProfileMock.mockResolvedValue({
      ...WORKSPACE,
      publicationPaused: true,
      archivedWebsiteSources: 0,
      unchanged: false,
      organization: {
        ...WORKSPACE.organization,
        industry: "Education Technology",
      },
      agent: {
        ...WORKSPACE.agent,
        status: "paused",
        published: false,
      },
    });

    render(
      <TengaAgentKnowledgeWorkspace
        workspace={WORKSPACE}
        onWorkspaceChange={onWorkspaceChange}
      />
    );

    await screen.findByText("Admissions FAQ");

    const industry = screen.getByLabelText(/^industry$/i);
    await user.clear(industry);
    await user.type(industry, "Education Technology");

    await user.click(
      screen.getByRole("button", {
        name: /save business profile/i,
      })
    );

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        name: "Northstar Academy",
        website: "https://northstar.example.com",
        industry: "Education Technology",
        countryCode: "NG",
        timezone: "Africa/Lagos",
      });
    });

    expect(onWorkspaceChange).toHaveBeenCalledWith(
      expect.objectContaining({
        publicationPaused: true,
      })
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /paused.*review.*publishing again/i
    );
  });

  it("loads readiness and pauses publication after live configuration changes", async () => {
    const onWorkspaceChange = vi.fn();
    const user = userEvent.setup();

    updateConfigurationMock.mockResolvedValue({
      ...WORKSPACE,
      publicationPaused: true,
      agent: {
        ...WORKSPACE.agent,
        greeting: "Hello from Northstar.",
        status: "paused",
        published: false,
      },
    });

    render(
      <TengaAgentKnowledgeWorkspace
        workspace={WORKSPACE}
        onWorkspaceChange={onWorkspaceChange}
      />
    );

    expect(
      await screen.findByText("Admissions FAQ")
    ).toBeInTheDocument();

    const greeting = screen.getByLabelText(/greeting/i);
    await user.clear(greeting);
    await user.type(greeting, "Hello from Northstar.");

    await user.click(
      screen.getByRole("button", {
        name: /save agent configuration/i,
      })
    );

    await waitFor(() => {
      expect(updateConfigurationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          greeting: "Hello from Northstar.",
          languages: ["English"],
          enabledTools: [
            "lead_capture",
            "appointment_requests",
          ],
        })
      );
    });

    expect(onWorkspaceChange).toHaveBeenCalledWith(
      expect.objectContaining({
        publicationPaused: true,
        agent: expect.objectContaining({
          status: "paused",
          published: false,
        }),
      })
    );
    expect(
      screen.getByRole("status")
    ).toHaveTextContent(/paused.*review.*publishing again/i);
  });

  it("adds manual business knowledge and refreshes the source list", async () => {
    const user = userEvent.setup();

    getKnowledgeMock
      .mockResolvedValueOnce({
        ok: true,
        sources: [READY_SOURCE],
      })
      .mockResolvedValueOnce({
        ok: true,
        sources: [
          READY_SOURCE,
          {
            id: "source-2",
            type: "hours",
            title: "Opening hours",
            sourceUrl: "",
            status: "ready",
            chunkCount: 1,
            updatedAt: "2026-09-16T15:00:00.000Z",
          },
        ],
      });

    saveKnowledgeMock.mockResolvedValue({
      ok: true,
      source: { id: "source-2" },
      chunksCreated: 1,
      unchanged: false,
    });

    render(
      <TengaAgentKnowledgeWorkspace
        workspace={WORKSPACE}
        onWorkspaceChange={vi.fn()}
      />
    );

    await screen.findByText("Admissions FAQ");

    await user.selectOptions(
      screen.getByLabelText(/knowledge type/i),
      "hours"
    );
    await user.type(
      screen.getByLabelText(/^title$/i),
      "Opening hours"
    );
    await user.type(
      screen.getByLabelText(/knowledge text/i),
      "We are open Monday to Friday from 8am to 4pm."
    );
    await user.click(
      screen.getByRole("button", {
        name: /add knowledge source/i,
      })
    );

    await waitFor(() => {
      expect(saveKnowledgeMock).toHaveBeenCalledWith({
        type: "hours",
        title: "Opening hours",
        text: "We are open Monday to Friday from 8am to 4pm.",
      });
    });

    expect(
      await screen.findByText("Opening hours")
    ).toBeInTheDocument();
  });

  it("imports only through the registered workspace website URL supplied to the API", async () => {
    const user = userEvent.setup();

    importWebsiteMock.mockResolvedValue({
      ok: true,
      source: {
        id: "source-web",
        type: "website",
        title: "Business website",
        sourceUrl:
          "https://northstar.example.com/admissions",
        status: "ready",
        chunkCount: 3,
      },
      chunksCreated: 3,
      unchanged: false,
    });

    render(
      <TengaAgentKnowledgeWorkspace
        workspace={WORKSPACE}
        onWorkspaceChange={vi.fn()}
      />
    );

    await screen.findByText("Admissions FAQ");

    const urlInput = screen.getByLabelText(/https page url/i);
    await user.clear(urlInput);
    await user.type(
      urlInput,
      "https://northstar.example.com/admissions"
    );

    await user.click(
      screen.getByRole("button", {
        name: /import website knowledge/i,
      })
    );

    await waitFor(() => {
      expect(importWebsiteMock).toHaveBeenCalledWith({
        url: "https://northstar.example.com/admissions",
        title: "Business website",
      });
    });
  });

  it("archives a source after confirmation and refreshes it out of the active knowledge list", async () => {
    const onWorkspaceChange = vi.fn();
    const user = userEvent.setup();
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(true);

    getKnowledgeMock
      .mockResolvedValueOnce({
        ok: true,
        sources: [READY_SOURCE],
      })
      .mockResolvedValueOnce({
        ok: true,
        sources: [],
      });

    archiveKnowledgeMock.mockResolvedValue({
      ...WORKSPACE,
      publicationPaused: true,
      chunksRemoved: 2,
      source: {
        ...READY_SOURCE,
        status: "archived",
      },
      agent: {
        ...WORKSPACE.agent,
        status: "paused",
        published: false,
      },
    });

    render(
      <TengaAgentKnowledgeWorkspace
        workspace={WORKSPACE}
        onWorkspaceChange={onWorkspaceChange}
      />
    );

    await screen.findByText("Admissions FAQ");

    await user.click(
      screen.getByRole("button", {
        name: /archive admissions faq/i,
      })
    );

    await waitFor(() => {
      expect(archiveKnowledgeMock).toHaveBeenCalledWith({
        sourceId: "source-1",
      });
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(onWorkspaceChange).toHaveBeenCalledWith(
      expect.objectContaining({
        publicationPaused: true,
      })
    );
    await waitFor(() => {
      expect(
        screen.queryByText("Admissions FAQ")
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /archived.*removed.*paused/i
    );

    confirmSpy.mockRestore();
  });
});
