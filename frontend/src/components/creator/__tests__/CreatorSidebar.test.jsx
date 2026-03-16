import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CreatorSidebar from "../CreatorSidebar";

describe("CreatorSidebar", () => {
  it("shows enabled creator lanes as children of the content categories link", () => {
    render(
      <MemoryRouter initialEntries={["/creator/music"]}>
        <CreatorSidebar
          creatorProfile={{ creatorTypes: ["music", "bookPublishing", "podcast"] }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /content categories/i })).toHaveClass("active");

    const categoryGroup = screen.getByRole("group", { name: /content categories/i });
    expect(within(categoryGroup).getByRole("link", { name: /music/i })).toHaveAttribute("href", "/creator/music");
    expect(within(categoryGroup).getByRole("link", { name: /book publishing/i })).toHaveAttribute("href", "/creator/books");
    expect(within(categoryGroup).getByRole("link", { name: /podcast/i })).toHaveAttribute("href", "/creator/podcasts");
  });
});
