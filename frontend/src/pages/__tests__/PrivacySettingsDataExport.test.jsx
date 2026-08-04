import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PrivacySettings from "../PrivacySettings";
import { exportAccountData } from "../../api";

vi.mock("../../components/QuickAccessLayout", () => ({
  default: ({ title, subtitle, children }) => (
    <main>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </main>
  ),
}));

vi.mock("../../api", () => ({
  blockUser: vi.fn(),
  exportAccountData: vi.fn(),
  hideStoriesFromUser: vi.fn(),
  muteUser: vi.fn(),
  restrictUser: vi.fn(),
  unblockUser: vi.fn(),
  unhideStoriesFromUser: vi.fn(),
  unmuteUser: vi.fn(),
  unrestrictUser: vi.fn(),
  updatePrivacy: vi.fn(),
}));

describe("Privacy Settings account data export", () => {
  let anchorClick;

  beforeEach(() => {
    vi.clearAllMocks();
    anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:tengacion-account-export"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads the authenticated JSON snapshot and reports completion", async () => {
    vi.mocked(exportAccountData).mockResolvedValue({
      fileName: "tengacion-afnan-account-data-2026-08-04.json",
      schemaVersion: "1.0",
      manifest: { complete: true, sections: {} },
      data: { account: { profile: { username: "afnan" } } },
    });

    render(<PrivacySettings user={{ privacy: {} }} />);

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Download account data" }));

    expect(
      await screen.findByText("Your account data download is ready.")
    ).toBeInTheDocument();
    expect(exportAccountData).toHaveBeenCalledWith("Password123!");
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:tengacion-account-export");
  });

  it("keeps an export failure visible without creating a download", async () => {
    vi.mocked(exportAccountData).mockRejectedValue(
      new Error("Account data could not be exported")
    );

    render(<PrivacySettings user={{ privacy: {} }} />);

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Download account data" }));

    expect(
      await screen.findByText("Account data could not be exported")
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Download account data" })
      ).toBeEnabled();
    });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it("requires a current password before requesting the export", async () => {
    render(<PrivacySettings user={{ privacy: {} }} />);

    fireEvent.click(screen.getByRole("button", { name: "Download account data" }));

    expect(
      await screen.findByText("Enter your current password to export account data.")
    ).toBeInTheDocument();
    expect(exportAccountData).not.toHaveBeenCalled();
  });
});
