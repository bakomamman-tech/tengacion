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
});
