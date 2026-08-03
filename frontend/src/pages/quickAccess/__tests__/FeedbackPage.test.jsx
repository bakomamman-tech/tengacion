import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { submitAdminComplaint } from "../../../api";
import { FeedbackPage } from "../../AccountPages";

vi.mock("../../../api", () => ({
  submitAdminComplaint: vi.fn(),
}));

vi.mock("../../../components/QuickAccessLayout", () => ({
  default: ({ title, subtitle, children }) => (
    <main>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </main>
  ),
}));

const renderFeedback = (entry = "/feedback") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <FeedbackPage user={{ username: "feedback_tester" }} />
    </MemoryRouter>
  );

describe("FeedbackPage server submission truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows success and clears the form only after a server reference is returned", async () => {
    const user = userEvent.setup();
    submitAdminComplaint.mockResolvedValue({
      success: true,
      complaint: { _id: "feedback-reference-123" },
    });

    renderFeedback("/feedback?type=bug");

    expect(screen.getByLabelText(/feedback type/i)).toHaveValue("bug");
    await user.type(screen.getByLabelText(/^subject/i), "Composer loses my caption");
    await user.type(
      screen.getByLabelText(/^details/i),
      "The caption disappears after an image upload fails and I try to retry."
    );
    await user.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => {
      expect(submitAdminComplaint).toHaveBeenCalledWith({
        subject: "Composer loses my caption",
        details: "The caption disappears after an image upload fails and I try to retry.",
        category: "bug",
        sourcePath: "/feedback",
        sourceLabel: "Feedback · Bug report",
        supportFlow: "product_feedback",
      });
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Feedback received");
    expect(screen.getByRole("status")).toHaveTextContent("feedback-reference-123");
    expect(screen.getByLabelText(/^subject/i)).toHaveValue("");
    expect(screen.getByLabelText(/^details/i)).toHaveValue("");
  });

  it("keeps the draft and reports failure when the server rejects submission", async () => {
    const user = userEvent.setup();
    submitAdminComplaint.mockRejectedValue(new Error("Review service is temporarily unavailable"));

    renderFeedback();

    await user.type(screen.getByLabelText(/^subject/i), "Improve keyboard focus");
    await user.type(
      screen.getByLabelText(/^details/i),
      "The focus indicator is difficult to see on the composer attachment control."
    );
    await user.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Feedback not sent");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Review service is temporarily unavailable"
    );
    expect(screen.getByLabelText(/^subject/i)).toHaveValue("Improve keyboard focus");
    expect(screen.getByLabelText(/^details/i)).toHaveValue(
      "The focus indicator is difficult to see on the composer attachment control."
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not claim success when the response lacks a durable reference", async () => {
    submitAdminComplaint.mockResolvedValue({ success: true, complaint: {} });

    renderFeedback();

    fireEvent.change(screen.getByLabelText(/^subject/i), {
      target: { value: "Reference contract" },
    });
    fireEvent.change(screen.getByLabelText(/^details/i), {
      target: { value: "The server response must include a durable submission reference." },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Send feedback" }).closest("form"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tengacion did not return a submission reference"
    );
    expect(screen.getByLabelText(/^subject/i)).toHaveValue("Reference contract");
  });
});
