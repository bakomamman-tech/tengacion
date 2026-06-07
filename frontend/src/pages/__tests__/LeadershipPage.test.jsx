import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LeadershipPage from "../LeadershipPage";

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

describe("LeadershipPage", () => {
  it("presents the founder and clearly labels unfilled executive offices", () => {
    render(
      <MemoryRouter>
        <LeadershipPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Executives" })).toBeInTheDocument();
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
    expect(screen.getAllByText("Illustrative placeholder")).toHaveLength(6);
    expect(screen.getAllByText("Appointment to be announced")).toHaveLength(6);
  });
});
