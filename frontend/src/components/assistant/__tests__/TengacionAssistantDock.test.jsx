import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.hoisted(() => vi.fn());
const fetchAssistantHintsMock = vi.hoisted(() => vi.fn());
const streamAssistantMessageMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: {
    id: "user-1",
    username: "viewer_user",
  },
  loading: false,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../../../services/assistantApi", () => ({
  fetchAssistantHints: (...args) => fetchAssistantHintsMock(...args),
  streamAssistantMessage: (...args) => streamAssistantMessageMock(...args),
}));

import TengacionAssistantDock from "../TengacionAssistantDock";

describe("TengacionAssistantDock", () => {
  beforeEach(() => {
    authState.user = {
      id: "user-1",
      username: "viewer_user",
    };
    authState.loading = false;
    navigateMock.mockReset();
    fetchAssistantHintsMock.mockReset();
    fetchAssistantHintsMock.mockResolvedValue({ hints: [] });
    streamAssistantMessageMock.mockReset();
  });

  it("keeps the panel open while navigating when Akuso returns a safe navigate action", async () => {
    const user = userEvent.setup();
    streamAssistantMessageMock.mockResolvedValue({
      message: "Opening your messages.",
      actions: [
        {
          type: "navigate",
          target: "/messages",
          state: { openMessenger: true },
        },
      ],
      cards: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId: "conversation-1",
    });

    render(
      <MemoryRouter>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));
    const composer = await screen.findByRole("textbox", { name: /message akuso/i });
    await user.type(composer, "Take me to messages");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(streamAssistantMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Take me to messages",
        })
      );
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        "/messages",
        expect.objectContaining({
          state: {
            openMessenger: true,
          },
        })
      );
    });

    expect(await screen.findByText("Opening your messages.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /message akuso/i })).toBeInTheDocument();
  });

  it("renders for signed-out guests and can start a chat", async () => {
    const user = userEvent.setup();
    authState.user = null;
    streamAssistantMessageMock.mockResolvedValue({
      message: "You can ask about Tengacion or sign in for account-specific help.",
      actions: [],
      cards: [],
      followUps: [],
      sources: [],
      details: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId: "guest-conversation-1",
      responseId: "trace-guest-1",
      feedbackToken: "token-guest-1",
      category: "SAFE_ANSWER",
      mode: "knowledge",
      safety: { level: "safe", notice: "", escalation: "" },
      trust: {
        provider: "local-fallback",
        mode: "public-knowledge",
        grounded: true,
        usedModel: false,
        confidenceLabel: "medium",
        note: "",
      },
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));
    const composer = await screen.findByRole("textbox", { name: /message akuso/i });
    await user.type(composer, "What can Akuso do here?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(streamAssistantMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "What can Akuso do here?",
        })
      );
    });

    expect(
      await screen.findByText(/sign in for account-specific help/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Continue chatting with Akuso in this thread.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /message akuso/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /send/i })).toBeVisible();
  });

  it("shows proactive page suggestions from Akuso hints", async () => {
    const user = userEvent.setup();
    fetchAssistantHintsMock.mockResolvedValue({
      hints: ["Upload a song", "Open creator earnings"],
    });

    render(
      <MemoryRouter initialEntries={["/creator/dashboard"]}>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    expect(await screen.findByText(/try now/i)).toBeInTheDocument();
    expect(screen.getAllByText(/upload a song/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));

    expect(
      (await screen.findAllByRole("button", { name: "Open creator earnings" })).length
    ).toBeGreaterThan(0);
  });

  it("opens minimized by default and can expand into the full panel", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));

    expect(await screen.findByRole("button", { name: /minimize akuso panel/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /maximize akuso panel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close akuso panel/i })).toBeInTheDocument();
    expect(screen.queryByText("Current conversation")).not.toBeInTheDocument();
    expect(screen.queryByText("Mode")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /maximize akuso panel/i }));

    expect(await screen.findByRole("button", { name: /restore akuso panel/i })).toBeInTheDocument();
    expect(screen.getByText("Current conversation")).toBeInTheDocument();
    expect(screen.getByText("Mode")).toBeInTheDocument();
  });

  it("can minimize to the launcher and reopen with the same size", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));
    await user.click(await screen.findByRole("button", { name: /maximize akuso panel/i }));

    expect(await screen.findByText("Current conversation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /minimize akuso panel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /restore akuso panel/i })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));

    expect(await screen.findByRole("button", { name: /restore akuso panel/i })).toBeInTheDocument();
    expect(screen.getByText("Current conversation")).toBeInTheDocument();
  });
});
