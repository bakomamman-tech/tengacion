import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PublicInfoPage from "../PublicInfoPage";

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

vi.mock("../../lib/seo", () => ({
  buildBreadcrumbJsonLd: vi.fn(() => ({})),
  buildOrganizationJsonLd: vi.fn(() => ({})),
  buildWebSiteJsonLd: vi.fn(() => ({})),
}));

describe("PublicInfoPage", () => {
  it("shows parent company and CAC registration details on the about page", () => {
    render(
      <MemoryRouter>
        <PublicInfoPage pageKey="about" />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Company ownership and registration" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "www.tengacion.com is owned and operated by Tengacion Technologies Limited, the parent company behind the Tengacion platform."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tengacion Technologies Limited is registered with the Corporate Affairs Commission (CAC) in Nigeria."
      )
    ).toBeInTheDocument();
  });

  it("publishes the song and album revenue split and transition terms", () => {
    render(
      <MemoryRouter>
        <PublicInfoPage pageKey="creator-monetization-terms" />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Song and album revenue share" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Effective 15 July 2026, artists receive 75% of Net Revenue generated from sales of their songs and albums. Tengacion retains 25% for platform hosting, payment administration, content delivery, creator tools, customer support, and platform development."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Net Revenue means the selling price actually received, less payment-processing fees, refunds, chargebacks, and applicable taxes."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The 75/25 split applies to song and album sales completed on or after 15 July 2026. Purchases completed and revenue allocations made before that date remain valid under the terms then in effect."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The actual processing fee reported by the payment provider for each transaction governs the Net Revenue calculation, including when a published rate changes or differs by payment method."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "As at 15 July 2026, Paystack's published schedule lists Nigerian local transactions at 1.5% plus ₦100, with the ₦100 component waived for transactions below ₦2,500."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View Paystack's current pricing" })
    ).toHaveAttribute("href", "https://paystack.com/pricing");
  });
});
