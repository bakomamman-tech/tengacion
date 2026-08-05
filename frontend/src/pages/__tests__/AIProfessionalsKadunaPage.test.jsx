import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AIProfessionalsKadunaPage from "../AIProfessionalsKadunaPage";

const { authState } = vi.hoisted(() => ({
  authState: { current: null },
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => authState.current,
}));

vi.mock("../../api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  requestRegistrationOtp: vi.fn(),
  updateMe: vi.fn(),
  verifyRegistrationOtp: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
  }),
}));

const renderPage = () => render(
  <MemoryRouter initialEntries={["/AI-Professionals-In-Kaduna-State"]}>
    <AIProfessionalsKadunaPage />
  </MemoryRouter>
);

describe("AIProfessionalsKadunaPage", () => {
  beforeEach(() => {
    authState.current = {
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
    };
  });

  it("keeps directory profiles behind the registration and sign-in gate", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Phone number")).toBeRequired();
    expect(screen.getByLabelText("Date of birth")).toBeRequired();
    expect(screen.queryByText("Hajiya Asmau Abbass")).not.toBeInTheDocument();
  });

  it("asks existing accounts missing required access details to complete them", () => {
    authState.current.user = {
      email: "member@example.com",
      name: "Kaduna Member",
      phone: "",
      dob: null,
    };

    renderPage();

    expect(
      screen.getByRole("heading", { name: "Complete your access details" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Hajiya Asmau Abbass")).not.toBeInTheDocument();
  });

  it("renders all 11 supplied professionals and filters by company", async () => {
    const user = userEvent.setup();
    authState.current.user = {
      email: "member@example.com",
      phone: "+2348000000000",
      dob: "1990-05-10T00:00:00.000Z",
    };

    renderPage();

    expect(screen.getAllByRole("article")).toHaveLength(11);
    expect(screen.getByText("Hajiya Asmau Abbass")).toBeInTheDocument();
    expect(screen.getByText("Miss. Adele Samuel")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search professionals"), "BOB-TECH");

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Engr. David Caleb")).toBeInTheDocument();
    expect(screen.queryByText("Dr. Hanif Abdulsalam")).not.toBeInTheDocument();
  });
});
