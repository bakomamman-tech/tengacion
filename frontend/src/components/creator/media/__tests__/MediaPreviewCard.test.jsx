import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import MediaPreviewCard from "../MediaPreviewCard";

vi.mock("../ShareActions", () => ({
  default: ({ className = "" }) => (
    <button type="button" className={className}>
      Share
    </button>
  ),
}));

const renderCard = (props = {}) => {
  const { item: itemOverrides = {}, ...restProps } = props;
  const handlers = {
    onPreview: vi.fn(),
    onStream: vi.fn(),
    onDownload: vi.fn(),
    onBuy: vi.fn(),
    onOpen: vi.fn(),
  };

  render(
    <MemoryRouter>
      <MediaPreviewCard
        {...restProps}
        item={{
          id: "track-1",
          itemType: "track",
          mediaType: "audio",
          title: "Hold Me And Pray",
          subtitle: "Afrobeatz",
          route: "/tracks/track-1",
          price: 500,
          canPreview: true,
          canStream: true,
          canDownload: true,
          canBuy: false,
          ...itemOverrides,
        }}
        creatorId="creator-1"
        {...handlers}
      />
    </MemoryRouter>
  );

  return handlers;
};

describe("MediaPreviewCard", () => {
  it("renders distinct stream and download actions without a duplicate open-page button", async () => {
    const user = userEvent.setup();
    const handlers = renderCard();

    expect(screen.getByRole("button", { name: /^preview$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^listen now$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^download now$/i })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /^open page$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /hold me and pray/i }));

    expect(handlers.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "track-1" }));
  });

  it("uses book read and download labels without duplicate actions", () => {
    renderCard({
      item: {
        id: "book-1",
        itemType: "book",
        mediaType: "document",
        title: "The Rustle of Death",
        route: "/books/book-1",
      },
    });

    expect(screen.getByRole("button", { name: /^read now$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^download pdf$/i })).toHaveLength(1);
  });
});
