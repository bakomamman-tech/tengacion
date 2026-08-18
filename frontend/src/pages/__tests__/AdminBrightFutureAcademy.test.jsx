import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminBrightFutureAcademy from "../AdminBrightFutureAcademy";
import * as api from "../../features/brightFutureAcademy/brightFutureApi";

vi.mock("../../components/AdminShell", () => ({
  default: ({ title, children }) => <main><h1>{title}</h1>{children}</main>,
}));

vi.mock("../../features/brightFutureAcademy/brightFutureApi", () => ({
  adminGetBrightFutureOverview: vi.fn(),
  adminGetBrightFutureStudents: vi.fn(),
  adminGetBrightFutureResults: vi.fn(),
  adminGetBrightFutureLeaderboard: vi.fn(),
  adminGetBrightFutureControls: vi.fn(),
  adminGetBrightFutureQuestions: vi.fn(),
  adminUpdateBrightFutureControls: vi.fn(),
  adminUpdateBrightFutureQuestion: vi.fn(),
  adminUpdateBrightFutureStudent: vi.fn(),
  adminResetBrightFutureAttempt: vi.fn(),
}));

describe("Bright Future Academy admin console", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.adminGetBrightFutureOverview.mockResolvedValue({ overview: { totalRegistrations: 24, totalCompleted: 12, inProgress: 2, averageScore: 28.5, registrationsPerClass: [], subjectAverages: {} } });
    api.adminGetBrightFutureStudents.mockResolvedValue({ students: [{ id: "1", fullName: "Amina Bello", candidateId: "BFA-2026-000001", status: "active", classLevel: "JSS 2", schoolName: "Unity Academy", state: "Kaduna", lga: "Kaduna North", competitionStatus: "completed", examCompleted: true, totalScore: 32, percentage: 80, ranking: 1, attemptNumber: 1, violationCount: 0 }], total: 1 });
    api.adminGetBrightFutureResults.mockResolvedValue({ results: [], total: 0 });
    api.adminGetBrightFutureLeaderboard.mockResolvedValue({ entries: [] });
    api.adminGetBrightFutureControls.mockResolvedValue({ controls: { competitionStatus: "examination_open", registrationOpen: true, examinationOpen: true, leaderboardVisible: true, winnerVisible: true, detailedResultsVisible: false, questionTimerSeconds: 50, allowedViolations: 3 } });
    api.adminGetBrightFutureQuestions.mockResolvedValue({ questions: [] });
  });

  it("loads real competition overview metrics and the student administration table", async () => {
    render(<MemoryRouter><AdminBrightFutureAcademy user={{ role: "admin" }} /></MemoryRouter>);
    expect(await screen.findByText("24")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Students" }));
    expect(await screen.findByText("Amina Bello")).toBeInTheDocument();
    expect(screen.getByText("BFA-2026-000001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset / retake" })).toBeInTheDocument();
  });

  it("exposes server-enforced timer, integrity and publication controls", async () => {
    render(<MemoryRouter><AdminBrightFutureAcademy user={{ role: "admin" }} /></MemoryRouter>);
    await screen.findByText("24");
    fireEvent.click(screen.getByRole("button", { name: "Competition Controls" }));
    expect(screen.getByLabelText("Seconds per question")).toHaveValue(50);
    expect(screen.getByLabelText("Allowed violations")).toHaveValue(3);
    expect(screen.getByText("Detailed answer review public")).toBeInTheDocument();
    await waitFor(() => expect(api.adminGetBrightFutureControls).toHaveBeenCalled());
  });
});
