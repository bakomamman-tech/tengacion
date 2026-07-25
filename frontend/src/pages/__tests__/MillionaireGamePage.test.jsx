import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MillionaireGamePage from "../MillionaireGamePage";
import { getMillionaireStatus } from "../../api";

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
    prizeLadder: [100, 150, 200, 300, 500, 650, 800, 1000, 1250, 1500, 1800, 2200, 3000, 4000, 5000],
  },
  registration: { registered: true },
  eligibility: { eligible: true, requirements: [] },
  cooldown: { active: false },
  attempt: {
    id: "attempt-1",
    status: "in_progress",
    currentPrize: 0,
    correctAnswers: 0,
    lifelineUsed: false,
    currentQuestion: {
      id: "question-1",
      number: 1,
      totalQuestions: 15,
      stage: 1,
      stageName: "The Spark",
      difficulty: "Foundation",
      category: "Mathematics",
      prompt: "What is 15% of 200?",
      options: ["15", "20", "30", "35"],
      timeLimitSeconds: 45,
      secondsRemaining: 45,
    },
  },
};

describe("MillionaireGamePage", () => {
  beforeEach(() => {
    vi.mocked(getMillionaireStatus).mockReset();
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
});
