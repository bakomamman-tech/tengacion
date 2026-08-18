import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BrightFutureAcademyRoot from "./BrightFutureAcademyRoot";
import * as brightFutureApi from "./brightFutureApi";

const session = vi.hoisted(() => ({ token: "" }));

vi.mock("./brightFutureApi", () => ({
  getCandidateToken: vi.fn(() => session.token),
  setCandidateToken: vi.fn((token) => { session.token = token; }),
  getBrightFutureSettings: vi.fn(),
  getBrightFutureProfile: vi.fn(),
  registerBrightFutureCandidate: vi.fn(),
  loginBrightFutureCandidate: vi.fn(),
  updateBrightFutureProfile: vi.fn(),
  startBrightFutureExam: vi.fn(),
  getBrightFutureExam: vi.fn(),
  answerBrightFutureExam: vi.fn(),
  recordBrightFutureViolation: vi.fn(),
  submitBrightFutureExam: vi.fn(),
  getBrightFutureResult: vi.fn(),
  getBrightFutureLeaderboard: vi.fn(),
  getBrightFutureParticipants: vi.fn(),
}));

const candidate = {
  id: "candidate-1",
  candidateId: "BFA-2026-000001",
  firstName: "Amina",
  middleName: "Zainab",
  lastName: "Bello",
  fullName: "Amina Zainab Bello",
  gender: "female",
  age: 13,
  classLevel: "JSS 2",
  schoolName: "Unity Model Academy",
  state: "Kaduna",
  lga: "Kaduna North",
  status: "active",
  competitionStatus: "registered",
  examStarted: false,
  examCompleted: false,
  resultAvailable: false,
  registrationTimestamp: "2026-08-18T09:00:00.000Z",
};

const settings = {
  competition: {
    competitionStatus: "examination_open",
    registrationOpen: true,
    examinationOpen: true,
    leaderboardVisible: true,
    winnerVisible: true,
    detailedResultsVisible: false,
    questionTimerSeconds: 50,
    allowedViolations: 3,
  },
};

const renderFeature = (path = "/") => render(<MemoryRouter initialEntries={[path]}><BrightFutureAcademyRoot /></MemoryRouter>);

describe("Bright Future Academy portal", () => {
  beforeEach(() => {
    session.token = "";
    vi.clearAllMocks();
    brightFutureApi.getBrightFutureSettings.mockResolvedValue(settings);
    brightFutureApi.getBrightFutureLeaderboard.mockResolvedValue({ entries: [], total: 0, page: 1, pages: 1 });
    brightFutureApi.getBrightFutureParticipants.mockResolvedValue({ participants: [], total: 0, page: 1, pages: 1 });
    brightFutureApi.getBrightFutureProfile.mockResolvedValue({ candidate });
  });

  it("renders the premium public landing and core registration call to action", async () => {
    renderFeature("/");
    expect(await screen.findByRole("heading", { name: /learn\. compete\. excel\./i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /register as a student/i })).toBeInTheDocument();
    expect(screen.getByText(/no email required/i)).toBeInTheDocument();
  });

  it("submits the no-email registration form and displays the server Candidate ID", async () => {
    brightFutureApi.registerBrightFutureCandidate.mockResolvedValue({ candidate, candidateToken: "candidate-token", competition: settings.competition });
    const user = userEvent.setup();
    renderFeature("/register");
    await user.type(screen.getByLabelText(/first name/i), "Amina");
    await user.type(screen.getByLabelText(/middle name/i), "Zainab");
    await user.type(screen.getByLabelText(/last name/i), "Bello");
    await user.selectOptions(screen.getByLabelText(/^gender/i), "female");
    await user.type(screen.getByLabelText(/^age/i), "13");
    await user.selectOptions(screen.getByLabelText(/^class/i), "JSS 2");
    await user.type(screen.getByLabelText(/^school name/i), "Unity Model Academy");
    await user.selectOptions(screen.getByLabelText(/^state/i), "Kaduna");
    await user.type(screen.getByLabelText(/local government area/i), "Kaduna North");
    await user.type(screen.getByLabelText(/parent \/ guardian phone/i), "08031234567");
    await user.click(screen.getByRole("button", { name: /complete registration/i }));
    expect(await screen.findByText("BFA-2026-000001")).toBeInTheDocument();
    expect(brightFutureApi.registerBrightFutureCandidate).toHaveBeenCalledWith(expect.not.objectContaining({ email: expect.anything() }));
  });

  it("restores an authenticated candidate dashboard from the server", async () => {
    session.token = "candidate-token";
    renderFeature("/dashboard");
    expect(await screen.findByRole("heading", { name: /good day, amina/i })).toBeInTheDocument();
    expect(screen.getAllByText("BFA-2026-000001").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /enter cbt challenge/i })).toBeInTheDocument();
  });

  it("requires acknowledgement of the exam rules before enabling start", async () => {
    session.token = "candidate-token";
    renderFeature("/exam/instructions");
    const start = await screen.findByRole("button", { name: /start examination/i });
    expect(start).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /i have read and understood/i }));
    expect(start).toBeEnabled();
    expect(screen.getByText(/a browser cannot technically prevent every/i)).toBeInTheDocument();
  });

  it("renders exactly five options for the current server-delivered question and submits a selection", async () => {
    session.token = "candidate-token";
    const currentQuestion = {
      id: "bfa-math-01", subject: "mathematics", subjectLabel: "Mathematics", number: 1,
      subjectQuestionNumber: 1, totalQuestions: 40, prompt: "What is 15% of 240?",
      options: ["24", "30", "36", "40", "45"], deadlineAt: new Date(Date.now() + 50_000).toISOString(),
    };
    brightFutureApi.getBrightFutureExam.mockResolvedValue({ attempt: { id: "attempt-1", status: "in_progress", currentQuestion, violationCount: 0, allowedViolations: 3 } });
    brightFutureApi.answerBrightFutureExam.mockResolvedValue({ attempt: { id: "attempt-1", status: "in_progress", currentQuestion: { ...currentQuestion, id: "bfa-math-02", number: 2, prompt: "Next question" } } });
    const user = userEvent.setup();
    renderFeature("/exam");
    const options = await screen.findAllByRole("radio");
    expect(options).toHaveLength(5);
    await user.click(options[2]);
    await user.click(screen.getByRole("button", { name: /submit & continue/i }));
    await waitFor(() => expect(brightFutureApi.answerBrightFutureExam).toHaveBeenCalledWith(expect.objectContaining({ questionId: "bfa-math-01", selectedOptionIndex: 2 })));
    expect(await screen.findByText("Next question")).toBeInTheDocument();
  });
});
