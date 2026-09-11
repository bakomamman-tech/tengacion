import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TovidoAnthonyFoundationPage from "../TovidoAnthonyFoundationPage";

describe("TovidoAnthonyFoundationPage", () => {
  it("renders verified foundation details and working contact links", () => {
    render(<TovidoAnthonyFoundationPage />);

    expect(
      screen.getByRole("heading", {
        name: /restoring hope\. strengthening communities\./i,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText("9649700").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kaduna, Nigeria").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Email the foundation" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:tovidoanthonyfoundation@gmail.com")
    );
    expect(screen.getByRole("link", { name: "0904 242 0446" })).toHaveAttribute(
      "href",
      "tel:+2349042420446"
    );
  });

  it("opens the mobile menu and credits Tengacion Technologies Limited", () => {
    render(<TovidoAnthonyFoundationPage />);

    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Foundation website navigation" })).toHaveClass(
      "is-open"
    );
    expect(
      screen.getByRole("link", { name: /designed by tengacion technologies limited/i })
    ).toHaveAttribute("href", "https://www.tengacion.com");
  });

  it("connects outreach navigation, accessible photos, and partnership actions", () => {
    const { container } = render(<TovidoAnthonyFoundationPage />);
    const section = screen.getByRole("region", {
      name: "Standing with widows through compassion, dignity, and community.",
    });
    expect(section).toHaveAttribute("id", "romi-outreach");
    expect(section.previousElementSibling).toHaveClass("tovido-values");
    expect(section.nextElementSibling).toHaveAttribute("id", "registration");

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const outreachLink = screen.getByRole("link", { name: "Outreach" });
    expect(outreachLink).toHaveAttribute("href", "#romi-outreach");
    fireEvent.click(outreachLink);
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute(
      "aria-expanded", "false"
    );

    const photos = within(section).getAllByRole("img");
    expect(photos).toHaveLength(7);
    expect(new Set(photos.map((photo) => photo.alt)).size).toBe(7);
    photos.forEach((photo) => {
      expect(photo.alt.length).toBeGreaterThan(20);
      expect(photo).toHaveAttribute("loading", "lazy");
      expect(photo).toHaveAttribute("decoding", "async");
      expect(photo.closest("a")).toHaveAttribute("href", photo.getAttribute("src"));
      expect(photo.closest("a")).toHaveAccessibleName(/opens in a new tab/);
    });
    expect(within(section).getByRole("link", { name: "Support future outreaches" }))
      .toHaveAttribute("href", expect.stringContaining("mailto:tovidoanthonyfoundation@gmail.com"));
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

});
