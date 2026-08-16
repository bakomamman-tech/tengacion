import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CygroEnterprisePage from "../CygroEnterprisePage";

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

describe("CygroEnterprisePage", () => {
  it("presents the supplied brand, services, CAC details, and public contact information", () => {
    render(
      <MemoryRouter>
        <CygroEnterprisePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /grow smarter\.\s*feed the future\./i })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Cygro Enterprise" })[0]).toHaveAttribute(
      "src",
      "/assets/cygro-enterprise/cygro-logo.png"
    );
    expect(screen.getByRole("heading", { name: "Agri-Tech & digital services" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agribusiness SME support" })).toBeInTheDocument();
    expect(screen.getAllByText("BN 7865737").length).toBeGreaterThan(0);
    expect(screen.getByText("Registered 23 August 2024")).toBeInTheDocument();
    expect(screen.getByText("Stephen Adebayo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Call or WhatsApp/i })).toHaveAttribute(
      "href",
      "tel:+2348060012595"
    );
    expect(screen.getByRole("link", { name: /Email Cygro/i })).toHaveAttribute(
      "href",
      "mailto:Cygro.enterprise@aol.com"
    );
    expect(screen.getByRole("link", { name: "Website by Tengacion Technologies Limited" })).toHaveAttribute(
      "href",
      "/leadership"
    );
  });

  it("builds a tailored WhatsApp enquiry without submitting customer data", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CygroEnterprisePage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Your name"), "Amina");
    await user.selectOptions(
      screen.getByLabelText("I want to discuss"),
      "Drip irrigation design and installation"
    );

    const link = screen.getByRole("link", { name: /Continue on WhatsApp/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("wa.me/2348060012595"));
    expect(decodeURIComponent(link.getAttribute("href"))).toContain(
      "My name is Amina. I would like to discuss drip irrigation design and installation."
    );
  });
});
