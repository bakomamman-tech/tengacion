import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Login from "../Login";

const mocks = vi.hoisted(() => ({
  authUser: null,
  contextLogin: vi.fn(),
  loginApi: vi.fn(),
  navigate: vi.fn(),
  qrToDataUrl: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  verifyLoginChallenge: vi.fn(),
}));

vi.mock("../../api", () => ({
  login: mocks.loginApi,
  verifyLoginChallenge: mocks.verifyLoginChallenge,
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    login: mocks.contextLogin,
    user: mocks.authUser,
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: mocks.qrToDataUrl,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

const renderLogin = (initialEntry = "/login") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Login />
    </MemoryRouter>
  );

const enterCredentials = async (user) => {
  await user.type(screen.getByRole("textbox", { name: "Email" }), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "Password123!");
};

describe("Login", () => {
  beforeEach(() => {
    mocks.authUser = null;
    mocks.contextLogin.mockReset();
    mocks.loginApi.mockReset();
    mocks.navigate.mockReset();
    mocks.qrToDataUrl.mockReset();
    mocks.qrToDataUrl.mockResolvedValue("data:image/png;base64,qr-code");
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.verifyLoginChallenge.mockReset();
  });

  it("keeps the form disabled while a direct login is pending, then restores auth at a safe return path", async () => {
    const user = userEvent.setup();
    let resolveLogin;
    mocks.loginApi.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );
    renderLogin("/login?returnTo=%2Fcreators%3Ftab%3Dfollowing");

    await enterCredentials(user);
    await user.click(screen.getByRole("button", { name: "Log In" }));

    expect(mocks.loginApi).toHaveBeenCalledWith("ada@example.com", "Password123!");
    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Email" })).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: /create new account/i })).toBeDisabled();

    await act(async () => {
      resolveLogin({
        token: "access-token",
        sessionId: "session-42",
        user: { _id: "user-42", name: "Ada" },
      });
    });

    expect(mocks.contextLogin).toHaveBeenCalledWith(
      "access-token",
      { _id: "user-42", name: "Ada" },
      "session-42"
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Welcome back");
    expect(mocks.navigate).toHaveBeenCalledWith("/creators?tab=following", {
      replace: true,
    });
  });

  it("moves into an email challenge and submits a trimmed verification code", async () => {
    const user = userEvent.setup();
    mocks.loginApi.mockResolvedValue({
      challengeRequired: true,
      challenge: {
        method: "email",
        maskedEmail: "a***@example.com",
        purpose: "login_mfa",
        token: "challenge-token",
      },
    });
    mocks.verifyLoginChallenge.mockResolvedValue({
      token: "verified-token",
      sessionId: "verified-session",
      user: { _id: "user-42", name: "Ada" },
    });
    renderLogin("/login?returnTo=%2Fhome%2Fsaved");

    await enterCredentials(user);
    await user.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByRole("heading", { name: "Verify your sign-in" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Email" })).not.toBeInTheDocument();
    expect(screen.getByText(/code sent to a\*\*\*@example\.com/i)).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "We sent a verification code to your email."
    );

    await user.type(screen.getByRole("textbox", { name: "Verification code" }), " 123456 ");
    await user.click(screen.getByRole("button", { name: /verify and continue/i }));

    expect(mocks.verifyLoginChallenge).toHaveBeenCalledWith({
      challengeToken: "challenge-token",
      code: "123456",
    });
    await waitFor(() => {
      expect(mocks.contextLogin).toHaveBeenCalledWith(
        "verified-token",
        { _id: "user-42", name: "Ada" },
        "verified-session"
      );
    });
    expect(mocks.toastSuccess).toHaveBeenLastCalledWith("Login verified");
    expect(mocks.navigate).toHaveBeenCalledWith("/home/saved", { replace: true });
  });

  it("returns from a challenge to the preserved password form", async () => {
    const user = userEvent.setup();
    mocks.loginApi.mockResolvedValue({
      challengeRequired: true,
      challenge: {
        method: "totp",
        purpose: "login_mfa",
        token: "challenge-token",
      },
    });
    renderLogin();

    await enterCredentials(user);
    await user.click(screen.getByRole("button", { name: "Log In" }));
    await screen.findByRole("textbox", { name: "Verification code" });
    await user.type(screen.getByRole("textbox", { name: "Verification code" }), "654321");
    await user.click(screen.getByRole("button", { name: /back to password login/i }));

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("Password123!");
    expect(screen.queryByRole("textbox", { name: "Verification code" })).not.toBeInTheDocument();
    expect(mocks.verifyLoginChallenge).not.toHaveBeenCalled();
  });

  it("exposes an accessible password visibility control", async () => {
    const user = userEvent.setup();
    renderLogin();

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(screen.queryByRole("button", { name: "Show password" })).not.toBeInTheDocument();

    await user.type(passwordInput, "secret");
    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("keeps the home, registration, recovery, policy, and support routes intact", async () => {
    const user = userEvent.setup();
    renderLogin();

    expect(screen.getByRole("link", { name: "Tengacion home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Guidelines" })).toHaveAttribute(
      "href",
      "/community-guidelines"
    );
    expect(screen.getByRole("link", { name: /contact tengacion support/i })).toHaveAttribute(
      "href",
      "/developer-contact"
    );

    await user.click(screen.getByRole("button", { name: /create new account/i }));
    expect(mocks.navigate).toHaveBeenCalledWith("/register");
  });
});
