import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { submitPublicSupportReport } from "../../api";
import PublicContactPage from "../PublicContactPage";

vi.mock("../../api", () => ({
  submitPublicSupportReport: vi.fn(),
}));

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

vi.mock("../../lib/seo", () => ({
  buildBreadcrumbJsonLd: vi.fn(() => ({})),
  buildOrganizationJsonLd: vi.fn(() => ({})),
  buildWebSiteJsonLd: vi.fn(() => ({})),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <PublicContactPage />
    </MemoryRouter>
  );

describe("PublicContactPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the category cards and native form control synchronized", async () => {
    const user = userEvent.setup();
    renderPage();

    const privacyButton = screen.getByRole("button", { name: /^privacy/i });
    const categorySelect = screen.getByRole("combobox", { name: /category/i });

    expect(screen.getByRole("button", { name: /^copyright/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(categorySelect).toHaveValue("copyright");

    await user.click(privacyButton);

    expect(privacyButton).toHaveAttribute("aria-pressed", "true");
    expect(categorySelect).toHaveValue("privacy");
    expect(
      screen.getAllByText("Personal data, impersonation, or profile privacy concerns.")
    ).toHaveLength(2);

    await user.selectOptions(categorySelect, "child_safety");

    expect(screen.getByRole("button", { name: /^child safety/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("preserves the report payload, pending state, success reference, and reset behavior", async () => {
    const user = userEvent.setup();
    let resolveSubmission;
    vi.mocked(submitPublicSupportReport).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmission = resolve;
        })
    );
    renderPage();

    await user.type(screen.getByRole("textbox", { name: /full name/i }), "Ada Reporter");
    await user.type(screen.getByRole("textbox", { name: /email address/i }), "ada@example.com");
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "copyright");
    await user.type(screen.getByRole("textbox", { name: /subject/i }), "Copied artwork");
    await user.type(
      screen.getByRole("textbox", { name: /link or source url/i }),
      "https://tengacion.com/posts/123"
    );
    await user.type(screen.getByRole("textbox", { name: /rights owner/i }), "Ada Studios");
    await user.type(screen.getByRole("textbox", { name: /work title/i }), "Northern Light");
    await user.type(
      screen.getByRole("textbox", { name: /details/i }),
      "This upload reproduces the original artwork without permission."
    );

    const submitButton = screen.getByRole("button", { name: "Submit report" });
    await user.click(submitButton);

    expect(submitPublicSupportReport).toHaveBeenCalledWith({
      name: "Ada Reporter",
      email: "ada@example.com",
      category: "copyright",
      subject: "Copied artwork",
      sourceUrl: "https://tengacion.com/posts/123",
      rightsOwner: "Ada Studios",
      workTitle: "Northern Light",
      details: "This upload reproduces the original artwork without permission.",
      website: "",
    });
    expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();

    await act(async () => {
      resolveSubmission({ reportId: "TG-REPORT-42" });
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Report received. The Tengacion team will review it. Reference: TG-REPORT-42."
    );
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /full name/i })).toHaveValue("");
      expect(screen.getByRole("textbox", { name: /details/i })).toHaveValue("");
    });
  });

  it("announces submission errors without clearing the form", async () => {
    const user = userEvent.setup();
    vi.mocked(submitPublicSupportReport).mockRejectedValue(new Error("Please try again shortly."));
    renderPage();

    await user.type(screen.getByRole("textbox", { name: /full name/i }), "Ada Reporter");
    await user.type(screen.getByRole("textbox", { name: /email address/i }), "ada@example.com");
    await user.type(screen.getByRole("textbox", { name: /subject/i }), "Privacy concern");
    await user.type(screen.getByRole("textbox", { name: /details/i }), "A profile exposes my data.");
    await user.click(screen.getByRole("button", { name: "Submit report" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again shortly.");
    expect(screen.getByRole("textbox", { name: /full name/i })).toHaveValue("Ada Reporter");
  });
});
