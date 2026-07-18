import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import InFeedPeopleCarousel from "../InFeedPeopleCarousel";

vi.mock("../../../api", () => ({
  resolveImage: (value) => value,
}));

const people = [
  {
    _id: "person-1",
    name: "Amina Yusuf",
    username: "amina_yusuf",
    avatar: "/uploads/amina.jpg",
    mutualFriendsCount: 2,
  },
  {
    _id: "person-2",
    name: "Samuel Kaboshia",
    username: "samuel_kaboshia",
    mutualFriendsCount: 1,
  },
];

const renderCarousel = (props = {}) =>
  render(
    <MemoryRouter>
      <InFeedPeopleCarousel people={people} onAdd={() => {}} {...props} />
    </MemoryRouter>
  );

describe("InFeedPeopleCarousel", () => {
  it("links profiles and exposes add, dismiss, and directory actions", () => {
    const onAdd = vi.fn();
    const onDismiss = vi.fn();
    renderCarousel({ onAdd, onDismiss });

    expect(screen.getByRole("region", { name: "People you may know" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "People You May Know" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/find-friends"
    );
    expect(screen.getByRole("link", { name: "View Amina Yusuf's profile" })).toHaveAttribute(
      "href",
      "/profile/amina_yusuf"
    );
    expect(screen.getByText("2 mutual friends")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Add friend" })[0]);
    expect(onAdd).toHaveBeenCalledWith(people[0]);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss Amina Yusuf" }));
    expect(onDismiss).toHaveBeenCalledWith(people[0]);
  });

  it("renders nothing when there are no valid suggestions", () => {
    const { container } = render(
      <MemoryRouter>
        <InFeedPeopleCarousel people={[]} />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps end controls in sync and supports keyboard scrolling", async () => {
    renderCarousel();

    const track = screen.getByTestId("in-feed-people-track");
    const scrollBy = vi.fn();
    let scrollLeft = 0;
    Object.defineProperties(track, {
      clientWidth: { configurable: true, get: () => 320 },
      scrollWidth: { configurable: true, get: () => 960 },
      scrollLeft: {
        configurable: true,
        get: () => scrollLeft,
        set: (value) => {
          scrollLeft = value;
        },
      },
      scrollBy: { configurable: true, value: scrollBy },
    });

    fireEvent(window, new Event("resize"));

    const previous = screen.getByRole("button", { name: "Show previous people" });
    const next = screen.getByRole("button", { name: "Show next people" });
    await waitFor(() => {
      expect(previous).toBeDisabled();
      expect(next).toBeEnabled();
    });

    fireEvent.click(next);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 260, behavior: "smooth" });

    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 260, behavior: "smooth" });

    scrollLeft = 640;
    fireEvent.scroll(track);
    await waitFor(() => {
      expect(previous).toBeEnabled();
      expect(next).toBeDisabled();
    });

    fireEvent.keyDown(track, { key: "ArrowLeft" });
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -260, behavior: "smooth" });
  });
});
