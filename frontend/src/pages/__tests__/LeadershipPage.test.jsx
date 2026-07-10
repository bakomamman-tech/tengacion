import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LeadershipPage from "../LeadershipPage";

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

describe("LeadershipPage", () => {
  it("presents only verified public team members", () => {
    render(
      <MemoryRouter>
        <LeadershipPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Verified team members" })).toBeInTheDocument();
    expect(screen.getAllByText("Stephen Daniel Kurah")[0]).toBeInTheDocument();
    expect(screen.getByText("Founder, Chairman and Chief Executive Officer")).toBeInTheDocument();
    const founderPortraits = screen.getAllByAltText(/Stephen Daniel Kurah, Founder/i);
    expect(founderPortraits).toHaveLength(2);
    founderPortraits.forEach((portrait) => {
      expect(portrait).toHaveAttribute(
        "src",
        "/assets/leadership/stephen-daniel-kurah.jpg"
      );
    });
    expect(screen.getByText("Social Media Lead")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Diana Comfort Danjuma" })).toBeInTheDocument();
    expect(
      screen.getByAltText("Diana Comfort Danjuma, Social Media Lead at Tengacion")
    ).toHaveAttribute("src", "/assets/leadership/diana-comfort-danjuma.png");
    expect(screen.getByText("Customer Support Team Lead")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vincent Bilat Danjuma" })).toBeInTheDocument();
    expect(
      screen.getByAltText("Vincent Bilat Danjuma, Customer Support Team Lead at Tengacion")
    ).toHaveAttribute("src", "/assets/leadership/vincent-bilat-danjuma.png");
    expect(screen.getByText("Abuja Creators Support Lead")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Christopher Ebere Chibuzor" })).toBeInTheDocument();
    expect(
      screen.getByAltText("Christopher Ebere Chibuzor, Abuja Creators Support Lead at Tengacion")
    ).toHaveAttribute("src", "/assets/leadership/christopher-ebere-chibuzor.png");
    expect(screen.getByRole("heading", { name: "Interns" })).toBeInTheDocument();
    expect(screen.getByText("Intern (Software Development)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tengacion Intern" })).toBeInTheDocument();
    expect(screen.getByAltText("Tengacion intern")).toHaveAttribute(
      "src",
      "/assets/leadership/tengacion-intern.png"
    );
    expect(screen.queryByText("Illustrative placeholder")).not.toBeInTheDocument();
    expect(screen.queryByText("Appointment to be announced")).not.toBeInTheDocument();
  });
});
