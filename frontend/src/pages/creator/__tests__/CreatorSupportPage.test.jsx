import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorSupportPage from "../CreatorSupportPage";
import { submitAdminComplaint } from "../../../api";

vi.mock("../../../api", () => ({
  submitAdminComplaint: vi.fn(),
}));

describe("CreatorSupportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits a flow-tagged creator support escalation", async () => {
    submitAdminComplaint.mockResolvedValue({
      success: true,
      complaint: { _id: "ticket-123" },
    });

    render(
      <MemoryRouter initialEntries={["/creator/support"]}>
        <CreatorSupportPage />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("tab", { name: /payout readiness/i }));
    await userEvent.type(
      screen.getByLabelText(/what is blocking you/i),
      "My payout page says profile incomplete after I added my bank details."
    );
    await userEvent.click(screen.getByRole("button", { name: /send to creator support/i }));

    await waitFor(() => {
      expect(submitAdminComplaint).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Creator payout readiness blocked",
          category: "account",
          sourcePath: "/creator/payouts",
          sourceLabel: "Creator payouts",
          supportFlow: "creator_payouts",
          details: expect.stringContaining("My payout page says profile incomplete"),
        })
      );
    });

    expect(await screen.findByText(/creator support escalation sent/i)).toBeInTheDocument();
  });

  it("requires blocker details before sending", async () => {
    render(
      <MemoryRouter initialEntries={["/creator/support"]}>
        <CreatorSupportPage />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: /send to creator support/i }));

    expect(submitAdminComplaint).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/add the blocker details/i);
  });
});
