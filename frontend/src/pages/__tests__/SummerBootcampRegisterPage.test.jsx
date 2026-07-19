import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import SummerBootcampRegisterPage from "../SummerBootcampRegisterPage";

vi.mock("../../api", () => ({
  getSummerBootcampApplication: vi.fn(),
  submitSummerBootcampRegistration: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    login: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

describe("SummerBootcampRegisterPage", () => {
  it("presents the family account, student enrolment, photo, and privacy flow", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SummerBootcampRegisterPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /give curious kids a summer/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Tengacion Virtual Summer Bootcamp flyer" })
    ).toHaveAttribute("src", "/assets/campaigns/summer-bootcamp-2026.png");
    expect(screen.getByLabelText(/Tengacion username/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Parent / guardian full name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload parent photo")).toHaveAttribute("type", "file");
    expect(screen.getByText("Student 01")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload student photo")).toHaveAttribute("type", "file");
    expect(screen.getByText(/children are not automatically given tengacion accounts/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1–30 August 2026/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₦50,000/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "+ Add another child" }));
    expect(screen.getByText("Student 02")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Upload student photo")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "+ Add another child" }));
    expect(screen.getByText("Student 03")).toBeInTheDocument();
    expect(screen.getByText(/₦150,000/i)).toBeInTheDocument();
    expect(screen.getByText(/qualifies to discuss a negotiated three-child rate/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add another child" })).toBeDisabled();
  });
});
