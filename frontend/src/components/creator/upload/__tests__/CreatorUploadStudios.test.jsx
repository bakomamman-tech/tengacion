import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCreatorWorkspace } from "../../useCreatorWorkspace";
import BookUploadStudio from "../BookUploadStudio";
import MusicUploadStudio from "../MusicUploadStudio";
import PodcastUploadStudio from "../PodcastUploadStudio";

vi.mock("../../useCreatorWorkspace", () => ({
  useCreatorWorkspace: vi.fn(),
}));

vi.mock("../../../../hooks/useUnsavedChangesPrompt", () => ({
  useUnsavedChangesPrompt: vi.fn(),
}));

describe("Creator upload studios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreatorWorkspace.mockReturnValue({
      creatorProfile: {
        _id: "creator-1",
        displayName: "Creator Example",
        fullName: "Creator Example",
        creatorTypes: ["music", "bookPublishing", "podcast"],
        podcastsProfile: {
          seriesTitle: "Studio Stories",
          themeOrTopic: "Culture",
        },
        booksProfile: {
          penName: "C. Example",
        },
      },
      refreshWorkspace: vi.fn(),
    });
  });

  it("renders a music-only form without podcast or book fields", () => {
    render(<MusicUploadStudio showNotice={false} />);

    expect(screen.getByLabelText(/track title/i)).toBeInTheDocument();
    expect(screen.getByText(/full audio upload/i)).toBeInTheDocument();
    expect(screen.getByText(/cover image upload/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/podcast series name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/manuscript upload/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/season number/i)).not.toBeInTheDocument();
  });

  it("renders a podcast-only form without music or book fields", () => {
    render(<PodcastUploadStudio showNotice={false} />);

    expect(screen.getByLabelText(/episode title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/podcast series name/i)).toBeInTheDocument();
    expect(screen.getByText(/full audio upload/i)).toBeInTheDocument();
    expect(screen.getAllByText(/transcript upload/i)[0]).toBeInTheDocument();
    expect(screen.queryByLabelText(/track title/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/manuscript upload/i)).not.toBeInTheDocument();
  });

  it("renders a book-only form without audio episode fields", () => {
    render(<BookUploadStudio showNotice={false} />);

    expect(screen.getByLabelText(/book title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/author name/i)).toBeInTheDocument();
    expect(screen.getByText(/manuscript upload/i)).toBeInTheDocument();
    expect(screen.queryByText(/full audio upload/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/episode title/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/season number/i)).not.toBeInTheDocument();
  });
});
