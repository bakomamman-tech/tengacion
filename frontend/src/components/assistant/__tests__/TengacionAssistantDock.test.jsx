import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.hoisted(() => vi.fn());
const fetchAssistantHintsMock = vi.hoisted(() => vi.fn());
const streamAssistantMessageMock = vi.hoisted(() => vi.fn());
const sendAssistantFeedbackMock = vi.hoisted(() => vi.fn());
const clipboardWriteTextMock = vi.hoisted(() => vi.fn());
const createObjectUrlMock = vi.hoisted(() => vi.fn());
const revokeObjectUrlMock = vi.hoisted(() => vi.fn());
const speechSynthesisSpeakMock = vi.hoisted(() => vi.fn());
const speechSynthesisCancelMock = vi.hoisted(() => vi.fn());
const SpeechSynthesisUtteranceMock = vi.hoisted(() =>
  vi.fn(function SpeechSynthesisUtterance(text) {
    this.text = text;
    this.lang = "";
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.onend = null;
    this.onerror = null;
  })
);
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
  sendAssistantFeedback: (...args) => sendAssistantFeedbackMock(...args),
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
    sendAssistantFeedbackMock.mockReset();
    sendAssistantFeedbackMock.mockResolvedValue({ ok: true, feedbackId: "feedback-1" });
    clipboardWriteTextMock.mockReset();
    clipboardWriteTextMock.mockResolvedValue(undefined);
    createObjectUrlMock.mockReset();
    createObjectUrlMock.mockReturnValue("blob:akuso-media");
    revokeObjectUrlMock.mockReset();
    speechSynthesisSpeakMock.mockReset();
    speechSynthesisSpeakMock.mockImplementation((utterance) => {
      utterance?.onend?.();
    });
    speechSynthesisCancelMock.mockReset();
    SpeechSynthesisUtteranceMock.mockClear();
    window.localStorage.clear();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteTextMock,
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: speechSynthesisCancelMock,
        speak: speechSynthesisSpeakMock,
      },
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: SpeechSynthesisUtteranceMock,
    });
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

  it("renders safe inline citations and a visible source list", async () => {
    const user = userEvent.setup();
    streamAssistantMessageMock.mockResolvedValue({
      message:
        "The verified update is in [Example News](https://news.example.com/story) and is marked as `current`.",
      actions: [],
      cards: [],
      followUps: [],
      sources: [
        {
          id: "web-search:1",
          type: "web_search",
          label: "Source report",
          summary: "Current source retrieved for this answer.",
          url: "https://news.example.com/story",
        },
      ],
      details: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId: "conversation-current-1",
      responseId: "trace-current-1",
      feedbackToken: "token-current-1",
      category: "SAFE_ANSWER",
      mode: "knowledge",
      safety: { level: "safe", notice: "", escalation: "" },
      trust: {
        provider: "openai",
        mode: "knowledge",
        grounded: true,
        usedModel: true,
        confidenceLabel: "high",
        note: "",
      },
    });

    render(
      <MemoryRouter>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));
    await user.type(screen.getByRole("textbox", { name: /message akuso/i }), "Latest update");
    await user.click(screen.getByRole("button", { name: /send/i }));

    const inlineCitation = await screen.findByRole("link", { name: "Example News" });
    const sourceCitation = screen.getByRole("link", { name: "Source report" });
    expect(inlineCitation).toHaveAttribute("href", "https://news.example.com/story");
    expect(sourceCitation).toHaveAttribute("href", "https://news.example.com/story");
    expect(screen.getByRole("navigation", { name: /sources cited by akuso/i })).toBeVisible();
    expect(screen.getByText("current", { selector: "code" })).toBeVisible();
  });

  it("uploads an image attachment to Akuso without requiring typed text", async () => {
    const user = userEvent.setup();
    const file = new File(["fake image"], "poster.png", { type: "image/png" });
    streamAssistantMessageMock.mockResolvedValue({
      message: "I can assess the poster image.",
      actions: [],
      cards: [],
      followUps: [],
      sources: [],
      details: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId: "conversation-image-1",
      responseId: "trace-image-1",
      feedbackToken: "token-image-1",
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
      <MemoryRouter>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));
    const input = await waitFor(() => {
      const node = document.querySelector(
        "input[type='file'][aria-label='Attach image or voice file']"
      );
      expect(node).toBeTruthy();
      return node;
    });

    await user.upload(input, file);

    expect(await screen.findByText("poster.png")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(streamAssistantMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "",
          attachments: expect.arrayContaining([
            expect.objectContaining({
              file,
              type: "image",
            }),
          ]),
        })
      );
    });
    expect(await screen.findByText("I can assess the poster image.")).toBeInTheDocument();
  });

  it("reads Akuso search answers aloud when the speaker is enabled", async () => {
    const user = userEvent.setup();
    streamAssistantMessageMock.mockResolvedValue({
      message: "I found three public results about Tengacion and summarized the strongest match.",
      actions: [],
      cards: [],
      followUps: [],
      sources: [],
      details: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId: "conversation-speech-1",
      responseId: "trace-speech-1",
      feedbackToken: "token-speech-1",
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
      <MemoryRouter>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));
    await user.click(await screen.findByRole("button", { name: /turn akuso speaker on/i }));
    const composer = await screen.findByRole("textbox", { name: /message akuso/i });
    await user.type(composer, "Search for Tengacion");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(
      await screen.findByText(/summarized the strongest match/i)
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(speechSynthesisSpeakMock).toHaveBeenCalledTimes(1);
    });
    expect(SpeechSynthesisUtteranceMock).toHaveBeenCalledWith(
      "I found three public results about Tengacion and summarized the strongest match."
    );
    expect(speechSynthesisCancelMock).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /turn akuso speaker off/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("formats structured Akuso replies and copies the answer text", async () => {
    const user = userEvent.setup();
    const structuredAnswer = [
      "Requirements:",
      "",
      "The denominators are **3, 6, and 4**.",
      "1. Create a modern, responsive calculator UI.",
      "2. The calculator should support:",
      "- Addition",
      "- Subtraction",
      "",
      "Implementation instructions:",
      "- Find the best location in the project.",
      "- Keep the existing layout intact.",
      "",
      "```math",
      "tan(theta) = K / sqrt(1 - K^2)",
      "5/4 = 1 1/4",
      "1\\frac{1}{4}",
      "\\boxed{tan(theta) = K / sqrt(1 - K^2)}",
      "```",
    ].join("\n");

    streamAssistantMessageMock.mockResolvedValue({
      message: structuredAnswer,
      actions: [],
      cards: [],
      followUps: [],
      sources: [],
      details: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId: "conversation-structured-1",
      responseId: "trace-structured-1",
      feedbackToken: "token-structured-1",
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
      <MemoryRouter>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));
    const composer = await screen.findByRole("textbox", { name: /message akuso/i });
    await user.type(composer, "Build a calculator feature");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Requirements:")).toBeInTheDocument();
    expect(screen.getByText("3, 6, and 4").tagName).toBe("STRONG");
    expect(screen.getByText("Create a modern, responsive calculator UI.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      expect.arrayContaining(["Addition", "Subtraction"])
    );
    expect(
      screen.getAllByText("tan(θ) = K / √(1 − K²)")[0].closest(
        ".tg-assistant-message__formula"
      )
    ).not.toBeNull();
    expect(screen.getByLabelText("Final answer")).toHaveTextContent(
      "tan(θ) = K / √(1 − K²)"
    );
    expect(screen.getByLabelText("Final answer")).toHaveClass("is-final-answer");
    const mixedNumbers = screen.getAllByLabelText("Mixed number 1 and 1 over 4");
    expect(mixedNumbers).toHaveLength(2);
    expect(mixedNumbers[0].querySelector(".tg-assistant-message__mixed-whole")).toHaveTextContent(
      "1"
    );
    expect(
      mixedNumbers[0].querySelector(".tg-assistant-message__mixed-numerator")
    ).toHaveTextContent("1");
    expect(
      mixedNumbers[0].querySelector(".tg-assistant-message__mixed-denominator")
    ).toHaveTextContent("4");

    await user.click(await screen.findByRole("button", { name: /copy akuso response/i }));

    expect(
      await screen.findByRole("button", { name: /akuso response copied/i })
    ).toBeInTheDocument();
  });

  it("lets users report unsafe Akuso answers for review", async () => {
    const user = userEvent.setup();
    streamAssistantMessageMock.mockResolvedValue({
      message: "A response that should be reviewed.",
      actions: [],
      cards: [],
      followUps: [],
      sources: [],
      details: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId: "conversation-report-1",
      responseId: "trace-report-1",
      feedbackToken: "token-report-1",
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
      <MemoryRouter>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));
    const composer = await screen.findByRole("textbox", { name: /message akuso/i });
    await user.type(composer, "Say something unsafe");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("A response that should be reviewed.")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /report akuso response/i }));

    await waitFor(() => {
      expect(sendAssistantFeedbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conversation-report-1",
          responseId: "trace-report-1",
          feedbackToken: "token-report-1",
          rating: "report",
          mode: "knowledge",
          category: "SAFE_ANSWER",
          reason: expect.stringMatching(/offensive or unsafe/i),
        })
      );
    });

    expect(
      await screen.findByRole("button", { name: /akuso response reported/i })
    ).toBeInTheDocument();
  });

  it("keeps proactive hints inside the compact Akuso launcher flow", async () => {
    const user = userEvent.setup();
    fetchAssistantHintsMock.mockResolvedValue({
      hints: ["Upload a song", "Open creator earnings"],
    });

    render(
      <MemoryRouter initialEntries={["/creator/dashboard"]}>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /open akuso assistant/i })).toBeInTheDocument();
    expect(screen.queryByText(/try now/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));

    expect((await screen.findAllByText(/upload a song/i)).length).toBeGreaterThan(0);
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
