import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MillionaireGamePage from "../MillionaireGamePage";
import { answerMillionaireQuestion, getMillionaireStatus } from "../../api";

vi.mock("../../api", () => ({
  answerMillionaireQuestion: vi.fn(),
  askMillionaireAi: vi.fn(),
  getMillionaireStatus: vi.fn(),
  startMillionaireGame: vi.fn(),
}));

vi.mock("../../Navbar", () => ({
  default: () => <header>Navbar</header>,
}));

vi.mock("../../Sidebar", () => ({
  default: () => <nav>Sidebar</nav>,
}));

vi.mock("../../components/RightQuickNav", () => ({
  default: () => <div>Quick nav</div>,
}));

const activeGame = {
  campaign: {
    prizeLadder: [100, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 390, 400],
  },
  registration: { registered: true },
  eligibility: { eligible: true, requirements: [] },
  access: { publicOpen: true, qaMode: false, adminExcluded: false },
  cooldown: { active: false },
  attempt: {
    id: "attempt-1",
    status: "in_progress",
    currentPrize: 0,
    correctAnswers: 0,
    lifelineUsed: false,
    prizeTier: "standard",
    payoutEligible: true,
    qaMode: false,
    currentQuestion: {
      id: "question-1",
      number: 1,
      totalQuestions: 15,
      stage: 1,
      stageName: "The Crucible",
      difficulty: "Challenging",
      category: "Mathematics",
      prompt: "What is 15% of 200?",
      options: ["15", "20", "30", "35", "40"],
      timeLimitSeconds: 20,
      secondsRemaining: 20,
    },
  },
};

describe("MillionaireGamePage", () => {
  beforeEach(() => {
    vi.mocked(getMillionaireStatus).mockReset();
    vi.mocked(answerMillionaireQuestion).mockReset();
  });

  it("renders the protected question console, prize ladder and single AI lifeline", async () => {
    vi.mocked(getMillionaireStatus).mockResolvedValue(activeGame);

    render(
      <MemoryRouter>
        <MillionaireGamePage user={{ _id: "user-1", username: "ada" }} />
      </MemoryRouter>
    );

    expect(await screen.findByText("What is 15% of 200?")).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 15")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ask AI · one lifeline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /30/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Prize ladder")).toBeInTheDocument();
  });

  it("blocks copying while keeping all five answer buttons clickable", async () => {
    vi.mocked(getMillionaireStatus).mockResolvedValue(activeGame);
    vi.mocked(answerMillionaireQuestion).mockResolvedValue({
      answerResult: {
        correct: false,
        correctAnswer: "30",
        explanation: "15% of 200 is 30.",
      },
      game: {
        ...activeGame,
        attempt: {
          ...activeGame.attempt,
          status: "lost",
          currentQuestion: null,
          review: [],
        },
      },
    });

    render(
      <MemoryRouter>
        <MillionaireGamePage user={{ _id: "user-1", username: "ada" }} />
      </MemoryRouter>
    );

    const choices = within(await screen.findByRole("group", { name: "Answer choices" }))
      .getAllByRole("button");
    const questionPanel = choices[0].closest(".millionaire-question-panel");
    expect(choices).toHaveLength(5);
    expect(questionPanel).toHaveAttribute(
      "data-player-watermark",
      expect.stringContaining("@ada")
    );
    await waitFor(() => choices.forEach((choice) => expect(choice).toBeEnabled()));
    expect(answerMillionaireQuestion).not.toHaveBeenCalled();

    const copyEvent = new Event("copy", { bubbles: true, cancelable: true });
    const contextMenuEvent = new Event("contextmenu", { bubbles: true, cancelable: true });
    const copyShortcutEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "c",
    });
    expect(questionPanel.dispatchEvent(copyEvent)).toBe(false);
    expect(questionPanel.dispatchEvent(contextMenuEvent)).toBe(false);
    expect(choices[0].dispatchEvent(copyShortcutEvent)).toBe(false);

    fireEvent.click(choices[4]);

    await waitFor(() =>
      expect(answerMillionaireQuestion).toHaveBeenCalledWith({
        questionId: "question-1",
        selectedIndex: 4,
      })
    );
  });

  it("gates an incomplete profile before any question is shown", async () => {
    vi.mocked(getMillionaireStatus).mockResolvedValue({
      ...activeGame,
      attempt: null,
      eligibility: {
        eligible: false,
        requirements: [
          { id: "registration", label: "Register for Tengacion Millionaire", complete: true },
          { id: "avatar", label: "Upload a profile picture", complete: false },
          { id: "cover", label: "Upload a cover photo", complete: false },
        ],
      },
    });

    render(
      <MemoryRouter>
        <MillionaireGamePage user={{ _id: "user-1", username: "ada" }} />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: /finish your profile/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Upload a profile picture")).toBeInTheDocument();
    expect(screen.getByText("Upload a cover photo")).toBeInTheDocument();
    expect(screen.queryByText("What is 15% of 200?")).not.toBeInTheDocument();
  });

  it("shows payout-disabled unlimited mode for the named QA account", async () => {
    vi.mocked(getMillionaireStatus).mockResolvedValue({
      ...activeGame,
      attempt: null,
      canStart: true,
      access: { publicOpen: false, qaMode: true, adminExcluded: false },
    });

    render(
      <MemoryRouter>
        <MillionaireGamePage user={{ _id: "qa-1", username: "pyrexx_singz" }} />
      </MemoryRouter>
    );

    expect(await screen.findByText(/unrestricted QA mode/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot receive a payout/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start unrestricted QA test/i })).toBeInTheDocument();
  });

  it("shows that administrators are excluded instead of rendering the game", async () => {
    vi.mocked(getMillionaireStatus).mockResolvedValue({
      ...activeGame,
      registration: { registered: false },
      attempt: null,
      access: { publicOpen: true, qaMode: false, adminExcluded: true },
    });

    render(
      <MemoryRouter>
        <MillionaireGamePage user={{ _id: "admin-1", username: "admin" }} />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: /admins monitor the game/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("What is 15% of 200?")).not.toBeInTheDocument();
  });
});
