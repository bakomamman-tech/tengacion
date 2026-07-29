import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import NehezeFarmsPage from "../NehezeFarmsPage";

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

describe("NehezeFarmsPage", () => {
  it("presents the uploaded brand, farm services, contact details, and Tengacion credit", () => {
    render(
      <MemoryRouter>
        <NehezeFarmsPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /plant today\.\s*harvest for generations\./i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: "Neheze Farms Seedlings and Enterprises" })[0]
    ).toHaveAttribute("src", "/assets/neheze-farms/neheze-farms-logo.png");
    expect(screen.getByRole("heading", { name: "Orchard development" })).toBeInTheDocument();
    expect(screen.getAllByText("BN 2384535").length).toBeGreaterThan(0);
    expect(screen.getByText(/Immediately after Gadan Madugu/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Call 0708 222 3478/i })).toHaveAttribute(
      "href",
      "tel:+2347082223478"
    );
    expect(screen.getByRole("link", { name: "Tengacion Technologies Limited" })).toHaveAttribute(
      "href",
      "/leadership"
    );
  });

  it("builds a useful WhatsApp enquiry from the visitor's selections", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NehezeFarmsPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Your name"), "Amina");
    await user.selectOptions(
      screen.getByLabelText("What are you interested in?"),
      "Orchard development"
    );
    await user.selectOptions(screen.getByLabelText("Estimated quantity"), "100–500");

    const enquiryLink = screen.getByRole("link", { name: /Continue on WhatsApp/i });
    expect(enquiryLink).toHaveAttribute("href", expect.stringContaining("wa.me/2347082223478"));
    expect(decodeURIComponent(enquiryLink.getAttribute("href"))).toContain(
      "my name is Amina. I am interested in Orchard development (estimated quantity: 100–500)"
    );
  });
});
