import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminContentPage from "../AdminContent";
import {
  adminListContent,
  adminPublishAlbum,
  adminPublishTrack,
  adminPublishVideo,
} from "../../api";

vi.mock("../../components/AdminShell", () => ({
  default: ({ title, subtitle, actions, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div>{actions}</div>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("../../api", () => ({
  adminApproveBook: vi.fn(),
  adminGetBookReview: vi.fn(),
  adminListContent: vi.fn(),
  adminPublishAlbum: vi.fn(),
  adminPublishTrack: vi.fn(),
  adminPublishVideo: vi.fn(),
  resolveImage: (value) => value,
}));

const contentPayload = {
  page: 1,
  limit: 20,
  total: 5,
  items: [
    {
      id: "draft-track",
      type: "track",
      title: "Unsubmitted Draft",
      status: "draft",
      reviewRequired: false,
      audioAvailable: true,
      audioUrl: "https://cdn.test/draft.mp3",
    },
    {
      id: "draft-book",
      type: "book",
      title: "Unsubmitted Manuscript",
      status: "draft",
      reviewRequired: true,
    },
    {
      id: "submitted-podcast",
      type: "podcast",
      title: "Submitted Episode",
      status: "under_review",
      reviewRequired: true,
      audioAvailable: true,
      audioUrl: "https://cdn.test/episode.mp3",
      copyrightScanStatus: "flagged",
    },
    {
      id: "submitted-album",
      type: "album",
      title: "Submitted EP",
      description: "A two-track creator EP.",
      releaseType: "ep",
      status: "under_review",
      reviewRequired: true,
      tracksAvailable: true,
      totalTracks: 2,
      tracks: [
        {
          title: "First Track",
          order: 1,
          audioUrl: "https://cdn.test/first-track.mp3",
          previewUrl: "",
        },
        {
          title: "Second Track",
          order: 2,
          audioUrl: "https://cdn.test/second-track.mp3",
          previewUrl: "https://cdn.test/second-track-preview.mp3",
        },
      ],
      copyrightScanStatus: "flagged",
      verificationNotes: "Admin review requested.",
      price: 1200,
      currency: "NGN",
    },
    {
      id: "submitted-video",
      type: "video",
      title: "Submitted Film",
      description: "A creator film awaiting approval.",
      status: "under_review",
      reviewRequired: true,
      videoAvailable: true,
      videoUrl: "https://cdn.test/film.mp4",
      coverImageUrl: "https://cdn.test/film.jpg",
      copyrightScanStatus: "flagged",
      verificationNotes: "Manual review requested.",
      creator: { displayName: "Film Creator" },
    },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/content"]}>
      <Routes>
        <Route path="/admin/content" element={<AdminContentPage user={{ role: "admin" }} />} />
      </Routes>
    </MemoryRouter>
  );

describe("AdminContentPage approval actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminListContent.mockResolvedValue(contentPayload);
    adminPublishAlbum.mockResolvedValue({ success: true });
    adminPublishTrack.mockResolvedValue({ success: true });
    adminPublishVideo.mockResolvedValue({ success: true });
  });

  it("hides draft actions and lets admins review submitted albums and videos", async () => {
    const { container } = renderPage();

    const draftTitle = await screen.findByText("Unsubmitted Draft");
    expect(within(draftTitle.closest("tr")).queryByRole("button")).not.toBeInTheDocument();
    const draftBookTitle = screen.getByText("Unsubmitted Manuscript");
    expect(within(draftBookTitle.closest("tr")).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review episode" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review EP" }));

    expect(screen.getByRole("heading", { name: "Submitted EP" })).toBeInTheDocument();
    const albumPlayers = container.querySelectorAll("audio");
    expect(albumPlayers).toHaveLength(2);
    expect(albumPlayers[0]).toHaveAttribute("src", "https://cdn.test/first-track.mp3");
    expect(albumPlayers[1]).toHaveAttribute("src", "https://cdn.test/second-track-preview.mp3");

    fireEvent.click(screen.getByRole("button", { name: "Approve EP" }));

    await waitFor(() => {
      expect(adminPublishAlbum).toHaveBeenCalledWith("submitted-album", {
        reason: "Album rights, track playback and release metadata reviewed by Admin.",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Review video" }));

    expect(screen.getByRole("heading", { name: "Submitted Film" })).toBeInTheDocument();
    const player = container.querySelector("video");
    expect(player).toHaveAttribute("src", "https://cdn.test/film.mp4");
    expect(player).toHaveAttribute("poster", "https://cdn.test/film.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Approve video" }));

    await waitFor(() => {
      expect(adminPublishVideo).toHaveBeenCalledWith("submitted-video", {
        reason: "Video rights, playback and release metadata reviewed by Admin.",
      });
    });
    expect(adminPublishTrack).not.toHaveBeenCalled();
  });
});
