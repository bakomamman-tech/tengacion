import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteMyAccount } from "../../api";
import AccountDeletionPage from "../AccountDeletion";

const authState = vi.hoisted(() => ({
  user: null,
  logout: vi.fn(),
}));

vi.mock("../../api", () => ({
  deleteMyAccount: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <AccountDeletionPage />
    </MemoryRouter>
  );

describe("self-service account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { _id: "user-1", username: "delete_me" };
    authState.logout = vi.fn().mockResolvedValue(undefined);
  });

  it("requires both password reauthentication and the exact confirmation phrase", async () => {
    const user = userEvent.setup();
    renderPage();

    const submit = screen.getByRole("button", { name: "Permanently delete my account" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Current password"), "Password123!");
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "delete");
    expect(submit).toBeDisabled();

    await user.clear(screen.getByLabelText("Type DELETE to confirm"));
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    expect(submit).toBeEnabled();
  });

  it("keeps reauthentication failures visible without signing out the valid session", async () => {
    vi.mocked(deleteMyAccount).mockRejectedValue(
      new Error("Your current password is incorrect")
    );
    renderPage();

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Permanently delete my account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your current password is incorrect"
    );
    expect(authState.logout).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Permanently delete my account" })
    ).toBeEnabled();
  });

  it("claims completion and clears the local session only after server confirmation", async () => {
    let resolveDeletion;
    vi.mocked(deleteMyAccount).mockImplementation(
      () => new Promise((resolve) => {
        resolveDeletion = resolve;
      })
    );
    renderPage();

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Permanently delete my account" }));

    expect(screen.getByRole("button", { name: "Deleting account…" })).toBeDisabled();
    expect(screen.queryByText("Account deleted")).not.toBeInTheDocument();
    expect(authState.logout).not.toHaveBeenCalled();

    resolveDeletion({
      success: true,
      deleted: true,
      retainedFinancialRecords: true,
      message: "Your account and associated personal content were deleted.",
    });

    expect(await screen.findByText("Account deleted")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your account and associated personal content were deleted."
    );
    await waitFor(() => {
      expect(authState.logout).toHaveBeenCalledWith({ remote: false });
    });
  });

  it("offers sign-in and support paths when no account session is available", () => {
    authState.user = null;
    renderPage();

    expect(screen.getByRole("link", { name: "Sign in to delete account" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(screen.getByRole("link", { name: "Email deletion request" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:/)
    );
    expect(
      screen.queryByRole("button", { name: "Permanently delete my account" })
    ).not.toBeInTheDocument();
  });
});
